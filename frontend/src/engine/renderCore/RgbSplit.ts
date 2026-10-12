/**
 * RGB Split (post-proceso fullscreen) para el renderer WebGPU.
 *
 * Cada canal R/G/B se muestrea de la textura de escena en una posicion
 * desplazada. La definicion del efecto es polar por canal:
 *   empuje del canal c = dir(angle_c) * mag_c * maxMag   (px de escena)
 * y el shader hace el proceso inverso (gather): para "empujar" el canal c
 * hacia fuera se LEE en uv - empuje (inversa 180°, negate el vector).
 *
 * Toda la matematica polar->cartesiana se hace en CPU (computeRgbSplitOffsets,
 * una vez por frame al cambiar params); la GPU solo hace 3 textureSample por
 * pixel + mezcla por canal: cero trigonometria por pixel.
 *
 * Alpha de salida = max de los alphas muestreados (composicion estable con
 * targets premultiplicados). Sampler clamp-to-edge para bordes de pantalla.
 */
export type RgbSplitChannel = { angle: number; mag: number };
export type RgbSplitChannels = { r?: RgbSplitChannel; g?: RgbSplitChannel; b?: RgbSplitChannel };
export type RgbSplitParams = { channels: RgbSplitChannels; maxMag: number };

/**Offsets finales del gather por canal, en px de escena (ya invertidos 180°) */
export type RgbSplitOffsets = { r: [number, number]; g: [number, number]; b: [number, number] };

/**Angle default por canal en grados (clasico: rojo izq / azul der, g en reposo? si mag llega 0 no se usa) */
const CHANNEL_ANGLE_DEFAULTS = { r: 180, g: 90, b: 0 } as const;

/**
 * polar (angle en grados, mag 0..1) -> cartesiano en px, invertido 180°.
 * Convencion de pantalla (Y hacia abajo): 0=derecha, 90=abajo, 180=izquierda, 270=arriba.
 * Canal ausente => mag 0 => [0,0] (reposo). Canal sin angle => default por canal.
 */
export function computeRgbSplitOffsets(params: RgbSplitParams): RgbSplitOffsets {
  const maxMag = Math.max(params?.maxMag || 0, 0);
  const ch = params?.channels ?? {};
  const calc = (c?: RgbSplitChannel, key: keyof typeof CHANNEL_ANGLE_DEFAULTS = "g"): [number, number] => {
    const mag = Math.min(Math.max(c?.mag ?? 0, 0), 1) * maxMag;
    if (mag === 0) return [0, 0];
    const rad = ((c?.angle ?? CHANNEL_ANGLE_DEFAULTS[key]) * Math.PI) / 180;
    return [-Math.cos(rad) * mag, -Math.sin(rad) * mag];
  };
  return { r: calc(ch.r, "r"), g: calc(ch.g, "g"), b: calc(ch.b, "b") };
}

type Target = { texture: GPUTexture; view: GPUTextureView; w: number; h: number };

export default class RgbSplit {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  private sampler!: GPUSampler;

  private splitPipeline!: GPURenderPipeline; //3 muestras con offsets
  private copyPipeline!: GPURenderPipeline;  //blit premult (offsets nulos)

  /**Target donde se renderiza la escena cuando el split corre sin blur */
  private sceneTarget: Target | null = null;
  /**Target intermedio cuando blur alimenta al split: escena -> blur -> intermediario -> split */
  private intermediate: Target | null = null;

  private uniform!: GPUBuffer;
  private uniformValues = new Float32Array(8);

  //*Bind groups cacheados por fuente (escena o intermedio), se invalidan al recrear targets
  private bgCache = new Map<GPUTextureView, { split: GPUBindGroup; copy: GPUBindGroup }>();

  init(device: GPUDevice, format: GPUTextureFormat) {
    this.device = device;
    this.format = format;

    this.sampler = device.createSampler({
      magFilter: "linear", minFilter: "linear",
      addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge",
    });

    const shader = device.createShaderModule({ code: `
      struct Out { @builtin(position) p: vec4f, @location(0) uv: vec2f };

      struct SplitParams {
        a: vec4f, //xy = offset gather del canal R (uv), zw = offset gather del canal G (uv)
        b: vec4f, //xy = offset gather del canal B (uv), zw = sin uso
      };
      @group(0) @binding(0) var<uniform> params: SplitParams;
      @group(0) @binding(1) var s: sampler;
      @group(0) @binding(2) var t: texture_2d<f32>;

      @vertex fn vs(@location(0) pos: vec2f, @location(1) uv: vec2f) -> Out {
        return Out(vec4f(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0), uv);
      }

      @fragment fn splitFs(@location(0) uv: vec2f) -> @location(0) vec4f {
        let cR = textureSample(t, s, uv + params.a.xy);
        let cG = textureSample(t, s, uv + params.a.zw);
        let cB = textureSample(t, s, uv + params.b.xy);
        let a = max(cR.a, max(cG.a, cB.a));
        return vec4f(cR.r, cG.g, cB.b, a);
      }

      @fragment fn copyFs(@location(0) uv: vec2f) -> @location(0) vec4f {
        return textureSample(t, s, uv);
      }
    `});

    const fullscreenVertex: GPUVertexState = {
      module: shader, entryPoint: "vs", buffers: [{
        arrayStride: 16,
        attributes: [
          { format: "float32x2", offset: 0, shaderLocation: 0 },
          { format: "float32x2", offset: 8, shaderLocation: 1 },
        ]
      } as GPUVertexBufferLayout]
    };
    const premultBlend = {
      color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
    } as GPUBlendState;

    const layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      ]
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const fragmentFormat = { format: this.format, blend: premultBlend } as GPUColorTargetState;

    this.splitPipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: fullscreenVertex,
      fragment: { module: shader, entryPoint: "splitFs", targets: [fragmentFormat] },
      primitive: { topology: "triangle-list" }
    });
    this.copyPipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: fullscreenVertex,
      fragment: { module: shader, entryPoint: "copyFs", targets: [fragmentFormat] },
      primitive: { topology: "triangle-list" }
    });

    this.uniform = device.createBuffer({
      size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private ensureTarget(current: Target | null, w: number, h: number): Target {
    if (current && current.w === w && current.h === h) return current;
    const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
    const texture = this.device.createTexture({ size: [w, h], format: this.format, usage });
    return { texture, view: texture.createView(), w, h };
  }

  /**Target donde se renderiza la escena cuando el split corre sin blur */
  getSceneTarget(w: number, h: number): GPUTextureView {
    const next = this.ensureTarget(this.sceneTarget, w, h);
    if (next !== this.sceneTarget) {
      this.destroyTargets();
      this.sceneTarget = next;
      this.bgCache.clear();
    }
    this.intermediate = this.ensureTarget(this.intermediate, w, h);
    return this.sceneTarget!.view;
  }

  /**Target intermedio: destino del blur y fuente del split cuando ambos estan activos */
  getIntermediate(w: number, h: number): GPUTextureView {
    const next = this.ensureTarget(this.intermediate, w, h);
    if (next !== this.intermediate) {
      this.destroyIntermediate();
      this.intermediate = next;
      this.bgCache.clear();
    }
    return this.intermediate!.view;
  }

  private destroyIntermediate() {
    if (this.intermediate) { this.intermediate.texture.destroy(); this.intermediate = null; }
  }

  /**
   * Agrega el pase de split al encoder del frame.
   * @param srcView textura fuente (escena o intermedio del blur)
   * @param dstView view destino (swapchain u otro pase)
   * @param offsets px del gather por canal (computeRgbSplitOffsets), en espacio escena
   */
  record(
    encoder: GPUCommandEncoder,
    srcView: GPUTextureView,
    dstView: GPUTextureView,
    offsets: RgbSplitOffsets,
    w: number, h: number,
    vertexBuffer: GPUBuffer
  ) {
    const zero = (offsets.r[0] === 0 && offsets.r[1] === 0 && offsets.g[0] === 0 && offsets.g[1] === 0 && offsets.b[0] === 0 && offsets.b[1] === 0);
    const pipeline = zero ? this.copyPipeline : this.splitPipeline;
    if (!zero) {
      this.uniformValues[0] = offsets.r[0] / w;
      this.uniformValues[1] = offsets.r[1] / h;
      this.uniformValues[2] = offsets.g[0] / w;
      this.uniformValues[3] = offsets.g[1] / h;
      this.uniformValues[4] = offsets.b[0] / w;
      this.uniformValues[5] = offsets.b[1] / h;
      this.uniformValues[6] = 0;
      this.uniformValues[7] = 0;
      this.device.queue.writeBuffer(this.uniform, 0, this.uniformValues);
    }

    let cache = this.bgCache.get(srcView);
    if (!cache) {
      cache = {
        split: this.device.createBindGroup({
          layout: this.splitPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.uniform } },
            { binding: 1, resource: this.sampler },
            { binding: 2, resource: srcView },
          ]
        }),
        copy: this.device.createBindGroup({
          layout: this.copyPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.uniform } },
            { binding: 1, resource: this.sampler },
            { binding: 2, resource: srcView },
          ]
        }),
      };
      this.bgCache.set(srcView, cache);
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: dstView,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store",
      }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, zero ? cache.copy : cache.split);
    pass.setViewport(0, 0, w, h, 0, 1);
    if (vertexBuffer) pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(6);
    pass.end();
  }

  private destroyTargets() {
    if (this.sceneTarget) { this.sceneTarget.texture.destroy(); this.sceneTarget = null; }
    this.destroyIntermediate();
  }

  destroy() {
    this.destroyTargets();
  }
}
