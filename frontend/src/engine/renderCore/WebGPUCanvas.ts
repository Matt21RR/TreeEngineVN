export type RepeatMode = "repeat" | "repeat-x" | "repeat-y";

interface DrawParams {
  id?: string;
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  fillColor?: [number, number, number, number];
  borderColor?: [number, number, number, number];
  borderWidth?: number;
  tileWidth?: number;
  tileHeight?: number;
}

export default class WebGPUCanvas {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  private texturePipeline!: GPURenderPipeline;
  private patternPipeline!: GPURenderPipeline;
  private shapePipeline!: GPURenderPipeline;

  private textureCache = new Map<string, { view: GPUTextureView; bindGroup: GPUBindGroup; patternBindGroup: GPUBindGroup }>();
  private sampler!: GPUSampler;

  private vertexBuffer!: GPUBuffer;
  private imageInstanceBuffer!: GPUBuffer;
  private patternInstanceBuffer!: GPUBuffer;
  private rectInstanceBuffer!: GPUBuffer;

  private imageQueue: DrawParams[] = [];
  private patternQueue: DrawParams[] = [];
  private rectQueue: DrawParams[] = [];
  private MAX_INSTANCES = 40000;

  async init(context: GPUCanvasContext) {
    this.context = context;

    const adapter = await navigator.gpu.requestAdapter();
    this.device = await adapter!.requestDevice();
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });

    this.sampler = this.device.createSampler({
      magFilter: "linear", minFilter: "linear",
      addressModeU: "repeat", addressModeV: "repeat",
    });

    this.createBuffers();
    this.createPipelines();
  }

  setResolution(width: number, height: number) {
    const canvas = this.context.canvas as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
    this.context.configure({ device: this.device, format: this.format, alphaMode: "premultiplied" });
  }

  private createBuffers() {
    const vertexData = new Float32Array([
      // x, y, u, v
      0, 0, 0, 0,  // Top-Left
      1, 0, 1, 0,  // Top-Right
      0, 1, 0, 1,  // Bottom-Left
      0, 1, 0, 1,  // Bottom-Left
      1, 0, 1, 0,  // Top-Right
      1, 1, 1, 1,  // Bottom-Right
    ]);

    this.vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertexData);
    this.vertexBuffer.unmap();

    const bufDesc = { size: this.MAX_INSTANCES * 128, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST };
    this.imageInstanceBuffer   = this.device.createBuffer(bufDesc);
    this.patternInstanceBuffer = this.device.createBuffer(bufDesc);
    this.rectInstanceBuffer    = this.device.createBuffer(bufDesc);
  }

  async preloadImage(image: ImageBitmap, id: string) {
    const texture = this.device.createTexture({
      size: [image.width, image.height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture({ source: image, flipY: false }, { texture }, [image.width, image.height]);

    const view = texture.createView();

    // Bind group para el pipeline de imagen simple
    const bindGroup = this.device.createBindGroup({
      layout: this.texturePipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: this.sampler }, { binding: 1, resource: view }],
    });

    // Bind group dedicado para el pipeline de patrón
    const patternBindGroup = this.device.createBindGroup({
      layout: this.patternPipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: this.sampler }, { binding: 1, resource: view }],
    });

    this.textureCache.set(id, { view, bindGroup, patternBindGroup });
  }

  // --- Métodos de registro (CPU) ---

  queueImage(params: DrawParams) {
    this.imageQueue.push(params);
  }

  queueRect(params: DrawParams) {
    this.rectQueue.push(params);
  }

  queueRepeatPattern(params: DrawParams, mode: RepeatMode) {
    const canvas = this.context.canvas as HTMLCanvasElement;

    let { x, y, width, height } = params;

    // Espejamos la lógica de Canvas2D — drawPattern:
    //   repeat   => fillRect(0, 0, displayWidth, displayHeight)         ancho=canvas, alto=canvas
    //   repeat-x => fillRect(0, corner.y, displayWidth, object.height)  ancho=canvas, alto=objeto
    //   repeat-y => fillRect(corner.x, 0, object.width, displayHeight)  ancho=objeto, alto=canvas
    if (mode === "repeat") {
      width = canvas.width;
      height = canvas.height;
      x = 0;
      y = 0;
    }
    if (mode === "repeat-x") {
      width = canvas.width;
      height = params.tileHeight!;
      x = 0;
      params.y = 0; // Para que la fase del patrón se calcule desde el borde del canvas
    }
    if (mode === "repeat-y") {
      height = canvas.height;
      width = params.tileWidth!;
      y = 0;
      params.x = 0; // Para que la fase del patrón se calcule desde el borde del canvas
    }

    // uvScale: cuántas repeticiones del tile caben en el quad
    // El quad cubre `width` px; cada tile mide `tileWidth` px → width/tileWidth repeticiones
    const uvScaleX = width  / params.tileWidth!;
    const uvScaleY = height / params.tileHeight!;

    // uvOffset: desplaza la fase del patrón para que el tile base aparezca en corner.x/corner.y.
    // uv=0 corresponde al píxel (0,0) del canvas. El tile base debe comenzar en params.x/params.y.
    // En unidades de tile: params.x / tileWidth. Negativo porque desplazamos la textura
    // en sentido contrario al movimiento visual (igual que DOMMatrix con translateX=corner.x en Canvas2D).
    const uvOffsetX = -params.x / params.tileWidth!;
    const uvOffsetY = -params.y / params.tileHeight!;

    this.patternQueue.push({
      ...params,
      x, y, width, height,
      fillColor: [uvScaleX, uvScaleY, uvOffsetX, uvOffsetY]
    });
  }

  render() {
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      }]
    });

    passEncoder.setVertexBuffer(0, this.vertexBuffer);

    this.processImageQueue(passEncoder);
    this.processPatternQueue(passEncoder);
    this.processRectQueue(passEncoder);

    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    this.imageQueue   = [];
    this.patternQueue = [];
    this.rectQueue    = [];
  }

  private processImageQueue(pass: GPURenderPassEncoder) {
    const canvas = this.context.canvas as HTMLCanvasElement;

    const groups = new Map<string, DrawParams[]>();
    for (const img of this.imageQueue) {
      if (!groups.has(img.id!)) groups.set(img.id!, []);
      groups.get(img.id!)!.push(img);
    }

    // Primero escribimos TODAS las instancias en el buffer de forma contigua,
    // cada grupo en su propio segmento. Así los draws posteriores no se pisan.
    // Layout por instancia (32 floats = 128 bytes):
    //   [0..15]  mat4x4f
    //   [16..31] sin uso (el shader de imagen no necesita datos extra)
    const FLOATS_PER_INSTANCE = 32;

    const allData = new Float32Array(this.imageQueue.length * FLOATS_PER_INSTANCE);
    let globalIndex = 0;

    const drawCalls: { id: string; firstInstance: number; count: number }[] = [];

    groups.forEach((items, id) => {
      const firstInstance = globalIndex;
      items.forEach(item => {
        allData.set(
          this.calculateMatrix(item.x, item.y, item.width, item.height, item.rotation, canvas),
          globalIndex * FLOATS_PER_INSTANCE
        );
        globalIndex++;
      });
      drawCalls.push({ id, firstInstance, count: items.length });
    });

    // Una sola escritura al buffer cubre todos los grupos
    this.device.queue.writeBuffer(this.imageInstanceBuffer, 0, allData);
    pass.setPipeline(this.texturePipeline);
    pass.setBindGroup(0, this.createInstanceBindGroup(this.texturePipeline, this.imageInstanceBuffer));

    // Un draw call por grupo de textura, con firstInstance correcto
    for (const { id, firstInstance, count } of drawCalls) {
      const tex = this.textureCache.get(id);
      if (!tex) continue;
      pass.setBindGroup(1, tex.bindGroup);
      pass.draw(6, count, 0, firstInstance);
    }
  }

  private processPatternQueue(pass: GPURenderPassEncoder) {
    if (this.patternQueue.length === 0) return;
    const canvas = this.context.canvas as HTMLCanvasElement;

    const groups = new Map<string, DrawParams[]>();
    for (const p of this.patternQueue) {
      if (!groups.has(p.id!)) groups.set(p.id!, []);
      groups.get(p.id!)!.push(p);
    }

    // Layout por instancia (32 floats = 128 bytes):
    //   [0..15]  mat4x4f
    //   [16..17] uvScale  (vec2f)
    //   [18..19] uvOffset (vec2f)
    //   [20..31] sin uso
    const FLOATS_PER_INSTANCE = 32;

    const allData = new Float32Array(this.patternQueue.length * FLOATS_PER_INSTANCE);
    let globalIndex = 0;

    const drawCalls: { id: string; firstInstance: number; count: number }[] = [];

    groups.forEach((items, id) => {
      const firstInstance = globalIndex;
      items.forEach(item => {
        const offset = globalIndex * FLOATS_PER_INSTANCE;
        allData.set(
          this.calculateMatrix(item.x, item.y, item.width, item.height, item.rotation, canvas),
          offset
        );
        // fillColor aquí contiene [uvScaleX, uvScaleY, uvOffsetX, uvOffsetY]
        allData.set(item.fillColor!, offset + 16);
        globalIndex++;
      });
      drawCalls.push({ id, firstInstance, count: items.length });
    });

    this.device.queue.writeBuffer(this.patternInstanceBuffer, 0, allData);
    pass.setPipeline(this.patternPipeline);
    pass.setBindGroup(0, this.createInstanceBindGroup(this.patternPipeline, this.patternInstanceBuffer));

    for (const { id, firstInstance, count } of drawCalls) {
      const tex = this.textureCache.get(id);
      if (!tex) continue;
      pass.setBindGroup(1, tex.patternBindGroup);
      pass.draw(6, count, 0, firstInstance);
    }
  }

  private processRectQueue(pass: GPURenderPassEncoder) {
    if (this.rectQueue.length === 0) return;
    const canvas = this.context.canvas as HTMLCanvasElement;

    // Layout por instancia (32 floats = 128 bytes):
    //   [0..15]  mat4x4f
    //   [16..19] sin uso (_pad vec4f en el struct)
    //   [20..23] fill    (vec4f RGBA)
    //   [24..27] border  (vec4f RGBA)
    //   [28]     brdW    (f32)
    //   [29..31] sin uso
    const data = new Float32Array(this.rectQueue.length * 32);
    this.rectQueue.forEach((item, i) => {
      const offset = i * 32;
      data.set(this.calculateMatrix(item.x, item.y, item.width, item.height, item.rotation, canvas), offset);
      data.set(item.fillColor!.map( v   => v / 255 ), offset + 20);
      data.set(item.borderColor!.map( v => v / 255 ), offset + 24);
      data.set([item.borderWidth! / Math.max(item.width, item.height)],       offset + 28);
    });

    this.device.queue.writeBuffer(this.rectInstanceBuffer, 0, data);
    pass.setPipeline(this.shapePipeline);
    pass.setBindGroup(0, this.createInstanceBindGroup(this.shapePipeline, this.rectInstanceBuffer));
    pass.draw(6, this.rectQueue.length);
  }

  private calculateMatrix(x: number, y: number, w: number, h: number, rot: number, canvas: HTMLCanvasElement): Float32Array {
    const tx = (x / canvas.width)  *  2 - 1;
    const ty = (y / canvas.height) * -2 + 1;
    const sx = (w / canvas.width)  *  2;
    const sy = (h / canvas.height) * -2; // negativo: eje Y de pantalla apunta hacia abajo

    const c = Math.cos(rot);
    const s = Math.sin(rot);

    // Column-major
    return new Float32Array([
      sx * c,  s * sy,  0, 0, // Col 0
      -s * sx, c * sy,  0, 0, // Col 1
      0,       0,       1, 0, // Col 2
      tx,      ty,      0, 1  // Col 3
    ]);
  }

  private createInstanceBindGroup(pipeline: GPURenderPipeline, buffer: GPUBuffer) {
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer } }]
    });
  }

  private createPipelines() {
    // -----------------------------------------------------------------------
    // Shader de imagen simple — UVs directas 0→1, sin transformación extra
    // El struct ocupa 128 bytes (32 floats) igual que el stride del instanceBuffer:
    //   mat4x4f = 64 bytes, _pad = 64 bytes → total 128 bytes
    // -----------------------------------------------------------------------
    const imageShader = `
      struct InstImage { mat: mat4x4f, _pad: array<vec4f, 4> };
      struct DataImage { instances: array<InstImage> };
      @group(0) @binding(0) var<storage, read> data: DataImage;

      struct Out { @builtin(position) p: vec4f, @location(0) uv: vec2f };

      @vertex fn vs(
        @location(0) pos: vec2f,
        @location(1) uv: vec2f,
        @builtin(instance_index) i: u32
      ) -> Out {
        return Out(data.instances[i].mat * vec4f(pos, 0.0, 1.0), uv);
      }

      @group(1) @binding(0) var s: sampler;
      @group(1) @binding(1) var t: texture_2d<f32>;

      @fragment fn fs(@builtin(position) p: vec4f, @location(0) uv: vec2f) -> @location(0) vec4f {
        return textureSample(t, s, uv);
      }
    `;

    // -----------------------------------------------------------------------
    // Shader de patrón repetido — aplica uvScale y uvOffset para tiling
    // El struct ocupa 128 bytes (32 floats):
    //   mat4x4f = 64 bytes, uvScale = 8 bytes, uvOffset = 8 bytes, _pad = 48 bytes → total 128 bytes
    // -----------------------------------------------------------------------
    const patternShader = `
      struct InstPattern { mat: mat4x4f, uvScale: vec2f, uvOffset: vec2f, _pad: array<vec4f, 3> };
      struct DataPattern { instances: array<InstPattern> };
      @group(0) @binding(0) var<storage, read> data: DataPattern;

      struct Out { @builtin(position) p: vec4f, @location(0) uv: vec2f };

      @vertex fn vs(
        @location(0) pos: vec2f,
        @location(1) uv: vec2f,
        @builtin(instance_index) i: u32
      ) -> Out {
        let inst = data.instances[i];
        // uv (0→1 sobre el quad) escalado al número de repeticiones + desplazamiento de fase
        let tiledUV = uv * inst.uvScale + inst.uvOffset;
        return Out(inst.mat * vec4f(pos, 0.0, 1.0), tiledUV);
      }

      @group(1) @binding(0) var s: sampler;
      @group(1) @binding(1) var t: texture_2d<f32>;

      @fragment fn fs(@builtin(position) p: vec4f, @location(0) uv: vec2f) -> @location(0) vec4f {
        return textureSample(t, s, uv);
      }
    `;

    // -----------------------------------------------------------------------
    // Shader de rectángulo — fill + border, sin textura
    // -----------------------------------------------------------------------
    const rectShader = `
      struct InstRect { mat: mat4x4f, _pad: vec4f, fill: vec4f, brdC: vec4f, brdW: f32 };
      struct DataRect { instances: array<InstRect> };
      @group(0) @binding(0) var<storage, read> data: DataRect;

      struct Out { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) id: u32 };

      @vertex fn vs(
        @location(0) pos: vec2f,
        @location(1) uv: vec2f,
        @builtin(instance_index) i: u32
      ) -> Out {
        return Out(data.instances[i].mat * vec4f(pos, 0.0, 1.0), uv, i);
      }

      @fragment fn fs(in: Out) -> @location(0) vec4f {
        let inst = data.instances[in.id];
        let d = max(abs(in.uv.x - 0.5), abs(in.uv.y - 0.5)) * 2.0;
        if (d > 1.0) { discard; }
        if (d > (1.0 - inst.brdW * 2.0)) { return inst.brdC; }
        return inst.fill;
      }
    `;

    const commonAttribs = {
      arrayStride: 16,
      attributes: [
        { format: "float32x2", offset: 0, shaderLocation: 0 },
        { format: "float32x2", offset: 8, shaderLocation: 1 },
      ]
    };

    const blendAlpha = {
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one",       dstFactor: "one-minus-src-alpha", operation: "add" }
    } as GPUBlendState;

    const imageModule   = this.device.createShaderModule({ code: imageShader });
    const patternModule = this.device.createShaderModule({ code: patternShader });
    const rectModule    = this.device.createShaderModule({ code: rectShader });

    this.texturePipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: imageModule,   entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: imageModule,   entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
      primitive: { topology: "triangle-list" }
    });

    this.patternPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: patternModule, entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: patternModule, entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
      primitive: { topology: "triangle-list" }
    });

    this.shapePipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: rectModule,    entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: rectModule,    entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
      primitive: { topology: "triangle-list" }
    });
  }
}