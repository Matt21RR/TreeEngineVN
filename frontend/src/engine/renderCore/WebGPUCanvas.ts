import DualKawaseBlur from "./DualKawaseBlur.ts";
import RgbSplit, { computeRgbSplitOffsets, RgbSplitOffsets, RgbSplitParams } from "./RgbSplit.ts";

export type RepeatMode = "repeat" | "repeat-x" | "repeat-y";

interface DrawParams {
  id?: string;
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  pitch?: number;
  yaw?: number;
  roll?: number;
  ignoreWorldRotation?: number;
  /** Profundidad mundo del centro + px por unidad mundo (perspectiva real por vertice).
   *  depthP = 0 => ortografico (foreshorten local historico). */
  depthZ?: number;
  depthP?: number;
  fillColor?: [number, number, number, number];
  borderColor?: [number, number, number, number];
  borderWidth?: number;
  tileWidth?: number;
  tileHeight?: number;
}

type QueuedItem =
  | { type: 'image'; params: DrawParams }
  | { type: 'pattern'; params: DrawParams; mode: RepeatMode }
  | { type: 'rect'; params: DrawParams };

type DrawCallRef = { id: string; firstInstance: number; count: number };

export default class WebGPUCanvas {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  private texturePipeline!: GPURenderPipeline;
  private patternPipeline!: GPURenderPipeline;
  private shapePipeline!: GPURenderPipeline;

  //*Variantes sin depth test/write para runs HUD (ignoreParallax = bypass total).
  //Mismo shader, distinto estado: el depth queda intacto y el painter manda.
  private textureNoDepthPipeline!: GPURenderPipeline;
  private patternNoDepthPipeline!: GPURenderPipeline;
  private shapeNoDepthPipeline!: GPURenderPipeline;

  private textureCache = new Map<string, { view: GPUTextureView; bindGroup: GPUBindGroup; patternBindGroup: GPUBindGroup }>();
  private sampler!: GPUSampler;

  private vertexBuffer!: GPUBuffer;

  //*Post-proceso fullscreen: dual kawase blur (activado solo si blurRadius > 0)
  private dualKawase = new DualKawaseBlur();
  private _blurRadius = 0;

  //*Post-proceso fullscreen: rgb split (activado si hay params con maxMag > 0)
  private rgbSplit = new RgbSplit();
  private _rgbSplitParams: RgbSplitParams | null = null;
  private _rgbSplitOffsets: RgbSplitOffsets = { r: [0, 0], g: [0, 0], b: [0, 0] };

  setBlurRadius(radiusPx: number) {
    this._blurRadius = Math.max(radiusPx || 0, 0);
  }

  get blurRadius() {
    return this._blurRadius;
  }

  setRgbSplit(params: RgbSplitParams | null) {
    this._rgbSplitParams = params;
    this._rgbSplitOffsets = computeRgbSplitOffsets(params ?? { channels: {}, maxMag: 0 });
  }

  //activo solo si maxMag != 0 y algun canal tiene magnitud > 0
  get rgbSplitActive() {
    const p = this._rgbSplitParams;
    if (!p || !((p.maxMag || 0) > 0)) return false;
    const ch = p.channels ?? {};
    return (ch.r?.mag ?? 0) > 0 || (ch.g?.mag ?? 0) > 0 || (ch.b?.mag ?? 0) > 0;
  }

  private imageInstanceBuffer!: GPUBuffer;
  private patternInstanceBuffer!: GPUBuffer;
  private rectInstanceBuffer!: GPUBuffer;

  private worldDataBuffer!: GPUBuffer;
  //rotation(4) + cameraOrigin(4) + depthParams[near, invFar, 0, 0](4)
  private worldDataValues = new Float32Array(12);

  //*Depth buffer para oclusion por fragmento (siempre tamano del canvas)
  private depthTexture: GPUTexture | null = null;
  private depthView: GPUTextureView | null = null;
  private depthW = 0;
  private depthH = 0;

  //*Persistent CPU-side staging (no per-frame allocations)
  private imageStaging!: Float32Array;
  private patternStaging!: Float32Array;
  private rectStaging!: Float32Array;

  //*Bind groups are fixed per pipeline+buffer pair, created once at init
  private imageGlobalBindGroup!: GPUBindGroup;
  private patternGlobalBindGroup!: GPUBindGroup;
  private rectGlobalBindGroup!: GPUBindGroup;
  private imageNoDepthBindGroup!: GPUBindGroup;
  private patternNoDepthBindGroup!: GPUBindGroup;
  private rectNoDepthBindGroup!: GPUBindGroup;

  private queue: QueuedItem[] = [];
  private MAX_INSTANCES = 40000;

  // Stride de 16 floats (64 bytes).
  private readonly FLOATS_PER_INSTANCE = 16;
  //*Los rects llevan stride propio de 24 floats: roll+pitch+yaw+borderW, canvas+ignore, fill, border y profundidad
  private readonly RECT_FLOATS_PER_INSTANCE = 24;

  //*Scratch state reused across batches to avoid allocations in the hot path
  private drawCallPool: DrawCallRef[] = [];
  private drawCallCount = 0;

  //*Per-frame instance usage. The frame is submitted once at the end of render(),
  //so every writeBuffer must target a distinct region or earlier runs get clobbered.
  private imageUsed = 0;
  private patternUsed = 0;
  private rectUsed = 0;

  //*Temporary diagnostics (window.__GPU_DIAG): silent GPU-side failures visibility
  private diag = {
    frames: 0,
    lastFrame: null as null | {
      queueLength: number;
      runs: Array<{ type: string; start: number; end: number }>;
      draws: Array<{ type: string; id?: string; firstInstance: number; count: number }>;
    },
    missingTextures: [] as string[],
    deviceErrors: [] as string[],
    deviceLost: null as string | null,
  };

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

    //*Diagnostics hooks
    (window as any).__GPU_DIAG = this.diag;
    this.device.lost.then((info) => {
      this.diag.deviceLost = String(info?.reason ?? "unknown");
      console.error("WebGPU device lost:", info);
    });
    this.device.addEventListener("uncapturederror", (ev: any) => {
      const msg = ev?.error?.message ?? String(ev);
      if (this.diag.deviceErrors.length < 50) this.diag.deviceErrors.push(msg);
      console.error("WebGPU uncaptured error:", msg);
    });

    this.createBuffers();
    this.createPipelines();
    this.dualKawase.init(this.device, this.format);
    this.rgbSplit.init(this.device, this.format);
  }

  setResolution(width: number, height: number) {
    const canvas = this.context.canvas as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied"
    });
  }

  setWorldRotation(pitch: number, yaw: number, roll: number) {
    this.worldDataValues[0] = pitch;
    this.worldDataValues[1] = yaw;
    this.worldDataValues[2] = roll;
    this.worldDataValues[3] = 0;
    this.device.queue.writeBuffer(this.worldDataBuffer, 0, this.worldDataValues);
  }

  setWorldCameraPos(x: number, y: number) {
    this.worldDataValues[4] = x;
    this.worldDataValues[5] = y;
    this.worldDataValues[6] = 0;
    this.worldDataValues[7] = 0;
    this.device.queue.writeBuffer(this.worldDataBuffer, 0, this.worldDataValues);
  }

  setDepthRange(near: number, maxZ: number) {
    this.worldDataValues[8] = Math.max(near || 0, 1e-6);
    this.worldDataValues[9] = 1 / Math.max(maxZ || 1, 1e-6);
    this.worldDataValues[10] = 0;
    this.worldDataValues[11] = 0;
    this.device.queue.writeBuffer(this.worldDataBuffer, 0, this.worldDataValues);
  }

  private createBuffers() {
    const vertexData = new Float32Array([
      0, 0, 0, 0,
      1, 0, 1, 0,
      0, 1, 0, 1,
      0, 1, 0, 1,
      1, 0, 1, 0,
      1, 1, 1, 1,
    ]);

    this.vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertexData);
    this.vertexBuffer.unmap();

    const bufSize = this.MAX_INSTANCES * this.FLOATS_PER_INSTANCE * 4;
    const rectBufSize = this.MAX_INSTANCES * this.RECT_FLOATS_PER_INSTANCE * 4;
    const bufDesc = { size: bufSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST };

    this.imageInstanceBuffer   = this.device.createBuffer(bufDesc);
    this.patternInstanceBuffer = this.device.createBuffer(bufDesc);
    this.rectInstanceBuffer = this.device.createBuffer({
      size: rectBufSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this.imageStaging   = new Float32Array(this.MAX_INSTANCES * this.FLOATS_PER_INSTANCE);
    this.patternStaging = new Float32Array(this.MAX_INSTANCES * this.FLOATS_PER_INSTANCE);
    this.rectStaging    = new Float32Array(this.MAX_INSTANCES * this.RECT_FLOATS_PER_INSTANCE);

    this.worldDataBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  //Crea o recrea el depth buffer al tamano del canvas (lazy: el resize de
  //canvas no siempre reconfigura el contexto, asi se evita mismatch).
  private ensureDepthTarget(w: number, h: number) {
    if (this.depthTexture && this.depthW === w && this.depthH === h) return;
    if (this.depthTexture) this.depthTexture.destroy();
    this.depthTexture = this.device.createTexture({
      size: [w, h],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthView = this.depthTexture.createView();
    this.depthW = w;
    this.depthH = h;
  }

  async preloadImage(image: ImageBitmap, id: string) {
    const texture = this.device.createTexture({
      size: [image.width, image.height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture({ source: image, flipY: false }, { texture }, [image.width, image.height]);

    const view = texture.createView();

    this.textureCache.set(id, {
      view,
      bindGroup: this.device.createBindGroup({
        layout: this.texturePipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: this.sampler }, { binding: 1, resource: view }],
      }),
      patternBindGroup: this.device.createBindGroup({
        layout: this.patternPipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: this.sampler }, { binding: 1, resource: view }],
      }),
    });
  }

  queueImage(params: DrawParams) {
    this.queue.push({ type: 'image', params });
  }

  queueRect(params: DrawParams) {
    this.queue.push({ type: 'rect', params });
  }

  queueRepeatPattern(params: DrawParams, mode: RepeatMode) {
    const canvas = this.context.canvas as HTMLCanvasElement;
    let x = params.x, y = params.y, width = params.width, height = params.height;

    if (mode === "repeat") {
      width = canvas.width; height = canvas.height;
      x = 0; y = 0;
    }
    if (mode === "repeat-x") {
      width = canvas.width; height = params.tileHeight!;
      x = 0; y = 0;
    }
    if (mode === "repeat-y") {
      height = canvas.height; width = params.tileWidth!;
      y = 0; x = 0;
    }

    const uvScaleX = width / params.tileWidth!;
    const uvScaleY = height / params.tileHeight!;
    const uvOffsetX = -x / params.tileWidth!;
    const uvOffsetY = -y / params.tileHeight!;

    this.queue.push({
      type: 'pattern',
      mode,
      params: {
        id: params.id,
        x, y, width, height,
        rotation: params.rotation,
        pitch: params.pitch,
        yaw: params.yaw,
        roll: params.roll,
        ignoreWorldRotation: params.ignoreWorldRotation,
        depthZ: params.depthZ,
        depthP: params.depthP,
        fillColor: [uvScaleX, uvScaleY, uvOffsetX, uvOffsetY]
      }
    });
  }

  render() {
    const canvas = this.context.canvas as HTMLCanvasElement;
    if (canvas.width === 0 || canvas.height === 0) return;

    this.imageUsed = 0;
    this.patternUsed = 0;
    this.rectUsed = 0;

    const commandEncoder = this.device.createCommandEncoder();

    const swapchainView = this.context.getCurrentTexture().createView();
    let passView = swapchainView;
    let targetW = canvas.width;
    let targetH = canvas.height;
    let splitOffscreen: "scene" | "chain" | null = null;
    if (this._blurRadius > 0.05 || this.rgbSplitActive) {
      //el blur SIEMPRE lee de su propio scene target (record usa bind groups fijos internos);
      //el split usa el suyo solo cuando corre sin blur, y un intermedio cuando encadena
      passView = this._blurRadius > 0.05
        ? this.dualKawase.getSceneTarget(canvas.width, canvas.height)
        : this.rgbSplit.getSceneTarget(canvas.width, canvas.height);
      splitOffscreen = this.rgbSplitActive && this._blurRadius > 0.05 ? "chain" : (this.rgbSplitActive ? "scene" : null);
    }

    this.ensureDepthTarget(canvas.width, canvas.height);
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: passView,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store",
      }],
      depthStencilAttachment: {
        view: this.depthView!,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      }
    });

    passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);

    this.processQueueInOrder(passEncoder, canvas.width, canvas.height);

    passEncoder.end();

    if (passView !== swapchainView) {
      //blur -> (rgbSplit si ambos activos: escena->blur->intermedio->split->swapchain)
      if (splitOffscreen === "chain") {
        const midView = this.rgbSplit.getIntermediate(targetW, targetH);
        this.dualKawase.record(commandEncoder, passView, midView, this._blurRadius, targetW, targetH, this.vertexBuffer);
        this.rgbSplit.record(commandEncoder, midView, swapchainView, this._rgbSplitOffsets, targetW, targetH, this.vertexBuffer);
      } else if (splitOffscreen === "scene") {
        this.rgbSplit.record(commandEncoder, passView, swapchainView, this._rgbSplitOffsets, targetW, targetH, this.vertexBuffer);
      } else {
        this.dualKawase.record(commandEncoder, passView, swapchainView, this._blurRadius, targetW, targetH, this.vertexBuffer);
      }
    }

    this.device.queue.submit([commandEncoder.finish()]);

    this.queue.length = 0;
  }

  private processQueueInOrder(pass: GPURenderPassEncoder, cw: number, ch: number) {
    if (this.queue.length === 0) return;

    //Runs HUD (ignoreParallax) van separados: usan pipelines sin depth
    //(bypass total) y no deben mezclarse con runs con depth en un mismo batch.
    const runKey = (i: number) =>
      this.queue[i].type + ((this.queue[i].params.ignoreWorldRotation ?? 0) !== 0 ? ":hud" : "");
    const runs: Array<{ type: string; hud: boolean; start: number; end: number }> = [];
    let runStart = 0;
    let currentKey: string | null = null;
    let currentType = "";
    let currentHud = false;

    for (let i = 0; i < this.queue.length; i++) {
      const key = runKey(i);
      if (currentKey !== null && currentKey !== key) {
        this.processBatch(pass, currentType, currentHud, runStart, i, cw, ch);
        runs.push({ type: currentType, hud: currentHud, start: runStart, end: i });
        runStart = i;
      }
      currentKey = key;
      currentType = this.queue[i].type;
      currentHud = key.endsWith(":hud");
    }
    if (currentKey !== null) {
      this.processBatch(pass, currentType, currentHud, runStart, this.queue.length, cw, ch);
      runs.push({ type: currentType, hud: currentHud, start: runStart, end: this.queue.length });
    }

    //*Diagnostics
    this.diag.frames++;
    this.diag.lastFrame = {
      queueLength: this.queue.length,
      runs,
      draws: (this.diag as any)._frameDraws ?? []
    };
    (this.diag as any)._frameDraws = undefined;
  }

  private diagDraw(type: string, id: string | undefined, firstInstance: number, count: number) {
    const frameDraws = ((this.diag as any)._frameDraws ??= []);
    frameDraws.push({ type, id, firstInstance, count });
  }

  private diagMissingTexture(id: string) {
    if (!this.diag.missingTextures.includes(id) && this.diag.missingTextures.length < 100) {
      this.diag.missingTextures.push(id);
    }
  }

  private processBatch(pass: GPURenderPassEncoder, type: string, noDepth: boolean, startIdx: number, endIdx: number, cw: number, ch: number) {
    if (endIdx <= startIdx) return;

    let slotBase: number;
    let count = endIdx - startIdx;
    if (type === 'image') {
      slotBase = this.imageUsed;
    } else if (type === 'pattern') {
      slotBase = this.patternUsed;
    } else if (type === 'rect') {
      slotBase = this.rectUsed;
    } else {
      return;
    }

    if (slotBase + count > this.MAX_INSTANCES) {
      console.warn(`WebGPUCanvas: '${type}' instance overflow (${slotBase + count} > ${this.MAX_INSTANCES}), skipping ${slotBase + count - this.MAX_INSTANCES} instances`);
      count = this.MAX_INSTANCES - slotBase;
    }
    if (count <= 0) return;
    const clampedEnd = startIdx + count;

    if (type === 'image') {
      this.imageUsed += count;
      this.processGroupedBatch(pass, this.imageStaging, this.imageInstanceBuffer, this.imageGlobalBindGroup, this.imageNoDepthBindGroup, startIdx, clampedEnd, cw, ch, false, noDepth, slotBase);
    } else if (type === 'pattern') {
      this.patternUsed += count;
      this.processGroupedBatch(pass, this.patternStaging, this.patternInstanceBuffer, this.patternGlobalBindGroup, this.patternNoDepthBindGroup, startIdx, clampedEnd, cw, ch, true, noDepth, slotBase);
    } else {
      this.rectUsed += count;
      this.processRectBatch(pass, startIdx, clampedEnd, cw, ch, noDepth, slotBase);
    }
  }

  /**
   * Escribe las instancias de un rango del queue en ORDEN ESTRICTO de cola
   * (painter's algorithm: lejos -> cerca) y emite un draw por segmento
   * contiguo de misma textura. Agrupar por textura reordenando rompia la
   * oclusion: una instancia lejana se dibujaba junto a una cercana tapando
   * a objetos intermedios de otra textura.
   * slotBase es el offset absoluto (en instancias) dentro del instanceBuffer donde
   * inicia este run: los slots se acumulan durante todo el frame porque solo hay
   * un submit al final de render().
   */
  private processGroupedBatch(
    pass: GPURenderPassEncoder,
    staging: Float32Array,
    instanceBuffer: GPUBuffer,
    globalBindGroup: GPUBindGroup,
    noDepthBindGroup: GPUBindGroup,
    startIdx: number,
    endIdx: number,
    cw: number,
    ch: number,
    isPattern: boolean,
    noDepth: boolean,
    slotBase: number
  ) {
    const queue = this.queue;
    this.drawCallCount = 0;

    //Segmentos contiguos de misma textura, en orden de cola (estable).
    //Cada segmento ocupa slots consecutivos: slot = slotBase + (i - startIdx).
    let segId = queue[startIdx].params.id!;
    let segStart = slotBase;
    let segCount = 0;
    const pushSegment = () => {
      this.drawCallPool[this.drawCallCount++] = { id: segId, firstInstance: segStart, count: segCount };
    };

    const FLOATS = this.FLOATS_PER_INSTANCE;
    for (let i = startIdx; i < endIdx; i++) {
      const p = queue[i].params;
      const id = p.id!;
      if (id !== segId) {
        pushSegment();
        segId = id;
        segStart = slotBase + (i - startIdx);
        segCount = 0;
      }
      segCount++;
      const offset = (slotBase + (i - startIdx)) * FLOATS;

      staging[offset + 0] = p.x;
      staging[offset + 1] = p.y;
      staging[offset + 2] = p.width;
      staging[offset + 3] = p.height;
      staging[offset + 4] = p.roll ?? p.rotation;
      staging[offset + 5] = p.pitch ?? 0;
      staging[offset + 6] = p.yaw ?? 0;
      staging[offset + 7] = cw;
      staging[offset + 8] = ch;
      if (isPattern) {
        staging[offset + 9] = p.fillColor![0];  // uvScaleX
        staging[offset + 10] = p.fillColor![1]; // uvScaleY
        staging[offset + 11] = p.fillColor![2]; // uvOffsetX
        staging[offset + 12] = p.fillColor![3]; // uvOffsetY
        staging[offset + 13] = p.ignoreWorldRotation ?? 0; // offset.y → ignoreWorld flag
        staging[offset + 14] = p.depthZ ?? 0; // offset.z → profundidad centro (mundo)
        staging[offset + 15] = p.depthP ?? 0; // offset.w → px por unidad mundo (0 = orto)
      } else {
        staging[offset + 9] = p.ignoreWorldRotation ?? 0; // transform3.y → ignoreWorld flag
        staging[offset + 10] = p.depthZ ?? 0; // transform3.z → profundidad centro (mundo)
        staging[offset + 11] = p.depthP ?? 0; // transform3.w → px por unidad mundo (0 = orto)
      }
    }
    pushSegment();

    const totalInstances = endIdx - startIdx;
    this.device.queue.writeBuffer(
      instanceBuffer,
      slotBase * FLOATS * 4,
      staging,
      slotBase * FLOATS,
      totalInstances * FLOATS
    );

    if (isPattern) {
      pass.setPipeline(noDepth ? this.patternNoDepthPipeline : this.patternPipeline);
    } else {
      pass.setPipeline(noDepth ? this.textureNoDepthPipeline : this.texturePipeline);
    }
    pass.setBindGroup(0, noDepth ? noDepthBindGroup : globalBindGroup);

    for (let d = 0; d < this.drawCallCount; d++) {
      const dc = this.drawCallPool[d];
      const tex = this.textureCache.get(dc.id);
      if (!tex) { this.diagMissingTexture(dc.id); continue; }
      pass.setBindGroup(1, isPattern ? tex.patternBindGroup : tex.bindGroup);
      pass.draw(6, dc.count, 0, dc.firstInstance);
      this.diagDraw(isPattern ? "pattern" : "image", dc.id, dc.firstInstance, dc.count);
    }
  }

  private processRectBatch(pass: GPURenderPassEncoder, startIdx: number, endIdx: number, cw: number, ch: number, noDepth: boolean, slotBase: number) {
    const queue = this.queue;
    const data = this.rectStaging;
    const FLOATS = this.RECT_FLOATS_PER_INSTANCE;
    const count = endIdx - startIdx;

    for (let i = startIdx; i < endIdx; i++) {
      const item = queue[i].params;
      const offset = ((i - startIdx) + slotBase) * FLOATS;
      data[offset + 0] = item.x;
      data[offset + 1] = item.y;
      data[offset + 2] = item.width;
      data[offset + 3] = item.height;
      data[offset + 4] = item.roll ?? item.rotation;
      data[offset + 5] = item.pitch ?? 0;
      data[offset + 6] = item.yaw ?? 0;
      data[offset + 7] = item.borderWidth! / Math.max(item.width, item.height);
      data[offset + 8] = cw;
      data[offset + 9] = ch;
      data[offset + 10] = item.ignoreWorldRotation ?? 0; // transform3.z → ignoreWorld flag

      data[offset + 12] = item.fillColor![0] / 255;
      data[offset + 13] = item.fillColor![1] / 255;
      data[offset + 14] = item.fillColor![2] / 255;
      data[offset + 15] = item.fillColor![3] / 255;

      data[offset + 16] = item.borderColor![0] / 255;
      data[offset + 17] = item.borderColor![1] / 255;
      data[offset + 18] = item.borderColor![2] / 255;
      data[offset + 19] = item.borderColor![3] / 255;

      data[offset + 20] = item.depthZ ?? 0; // depth.x → profundidad centro (mundo)
      data[offset + 21] = item.depthP ?? 0; // depth.y → px por unidad mundo (0 = orto)
    }

    this.device.queue.writeBuffer(this.rectInstanceBuffer, slotBase * FLOATS * 4, data, slotBase * FLOATS, count * FLOATS);
    pass.setPipeline(noDepth ? this.shapeNoDepthPipeline : this.shapePipeline);
    pass.setBindGroup(0, noDepth ? this.rectNoDepthBindGroup : this.rectGlobalBindGroup);
    pass.draw(6, count, 0, slotBase);
    this.diagDraw("rect", undefined, slotBase, count);
  }

  private createPipelines() {
    const commonWGSLTransforms = `
      struct WorldData {
        rotation: vec4f,
        cameraOrigin: vec4f,
        depthParams: vec4f, // [near, invFar, 0, 0]
      };
      @group(0) @binding(1) var<uniform> world: WorldData;

      fn rotate3D(point: vec3f, roll: f32, pitch: f32, yaw: f32) -> vec3f {
        let cr = cos(roll);
        let sr = sin(roll);
        let cp = cos(pitch);
        let sp = sin(pitch);
        let cy = cos(yaw);
        let sy = sin(yaw);

        let x1 = point.x * cy + point.z * sy;
        let z1 = -point.x * sy + point.z * cy;
        let y1 = point.y;

        let y2 = y1 * cp - z1 * sp;
        let z2 = y1 * sp + z1 * cp;

        let x3 = x1 * cr - y2 * sr;
        let y3 = x1 * sr + y2 * cr;
        return vec3f(x3, y3, z2);
      }

      fn getNDCPosition(vertexPos: vec2f, pos: vec2f, size: vec2f, roll: f32, pitch: f32, yaw: f32, canvasSize: vec2f, ignoreWorld: f32, zCenter: f32, pxPerWorld: f32, zvOut: ptr<function, f32>) -> vec4f {
        let localPixelPos = vertexPos * size;
        let center = size * 0.5;
        let translatedPos = localPixelPos - center;
        let local3D = vec3f(translatedPos.x, translatedPos.y, 0.0);

        //La CPU ya proyecta el CENTRO del billboard con perspectiva real (pinhole).
        //Aqui solo se rotan los offsets locales (orientacion), nunca se re-proyecta:
        //rotar por offset en pantalla seria una segunda proyeccion fantasma que
        //deforma los quads descentrados y se vuelve loca al acercar la camara.
        //Orden estandar model-matrix: primero la orientacion propia del objeto
        //(roll/pitch/yaw) y despues la rotacion de mundo. Al reves (mundo primero)
        //ninguna orientacion local estatica seguia pegada al mundo al orbitar:
        //p.ej. pitch=90 (suelo) se levantaba como pared al girar yaw.
        //Con R_world=R_local=I el resultado es bit-identico al anterior.
        let worldEffect = 1.0 - ignoreWorld;
        let localRotated = rotate3D(local3D, roll, pitch, yaw);
        let rotated3D = rotate3D(localRotated, world.rotation.z * worldEffect, world.rotation.x * worldEffect, world.rotation.y * worldEffect);

        let cameraDist = max(canvasSize.x, canvasSize.y) * 1.2;

        //Proyeccion exacta del mismo modelo por vertice: v = c0 + r·((Cc-c0)+o),
        //con r = P(Zv)/P(Zc). Sin profundidad (pxPerWorld = 0, modo orto) se
        //conserva el foreshorten local historico. Tras el near plane no se
        //clampea: w<=0 deja que el hardware recorte y el FS descarta por zv
        //(corte nitido, sin streaks).
        //wClip = Zv/Zc activa interpolacion UV con correccion perspectiva;
        //zClip mapea 1/Z entre near y far para el depth buffer.
        let final3D = rotated3D;
        var persp = cameraDist / (cameraDist + final3D.z);
        var wClip = 1.0;
        var zClip = 0.0;
        var worldPixelPos = vec2f(final3D.x, final3D.y) * persp + center + pos;
        //*zvOut: 1e10 por defecto (orto) -> el FS nunca descarta; en perspectiva
        //se escribe la Z mundo real del vertice para descarte tras el near.
        if (pxPerWorld > 0.0) {
          let near = world.depthParams.x;
          let invFar = world.depthParams.y;
          //Zv real SIN clamp: si un vertice queda tras camara (w<=0) el hardware
          //recorta el triangulo; los fragmentos tras el near se descartan en FS.
          //Clampear aqui los aplastaba contra el near generando streaks.
          let zRaw = zCenter + final3D.z / pxPerWorld;
          *zvOut = zRaw;
          //Proyeccion exacta del mismo modelo: v = c0 + (P(Zv)/P(Zc))·((Cc-c0)+o).
          //Asi dos cartas adyacentes evaluan su borde compartido con la misma
          //profundidad y el borde coincide al girar (antes: grietas de ~60px).
          //Con Zv=Zc, r=1 y es bit-identico al codigo anterior.
          let zForR = max(zRaw, near * 0.25);
          let r = (1.0 / zForR - invFar) / max(1.0 / zCenter - invFar, 1e-6);
          let c0 = vec2f(canvasSize.x * 0.5, canvasSize.y * world.cameraOrigin.y);
          worldPixelPos = c0 + r * ((pos + center - c0) + vec2f(final3D.x, final3D.y));
          wClip = zRaw / zCenter;
          let zVert = max(zRaw, near);
          let invNear = 1.0 / near;
          zClip = clamp(1.0 - ((1.0 / zVert) - invFar) / (invNear - invFar), 0.0, 1.0);
        }

        let ndcX = (worldPixelPos.x / canvasSize.x) * 2.0 - 1.0;
        let ndcY = (worldPixelPos.y / canvasSize.y) * -2.0 + 1.0;
        return vec4f(ndcX * wClip, ndcY * wClip, zClip * wClip, wClip);
      }
    `;

    // 1. SHADER DE IMAGEN (Alineación limpia sin uniform separado)
    const imageShader = `
      struct InstImage {
        transform1: vec4f, // [x, y, width, height]
        transform2: vec4f, // [roll, pitch, yaw, canvasWidth]
        transform3: vec4f, // [canvasHeight, ignoreWorld, zCenter, pxPerWorld]
        _pad: vec4f
      };
      struct DataImage { instances: array<InstImage> };
      @group(0) @binding(0) var<storage, read> data: DataImage;

      struct Out { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) zv: f32 };
      
      ${commonWGSLTransforms}

      @vertex fn vs(@location(0) pos: vec2f, @location(1) uv: vec2f, @builtin(instance_index) i: u32) -> Out {
        let inst = data.instances[i];
        let p_pos = inst.transform1.xy;
        let p_size = inst.transform1.zw;
        let p_rot = inst.transform2.x;
        let p_pitch = inst.transform2.y;
        let p_yaw = inst.transform2.z;
        let canvasSize = vec2f(inst.transform2.w, inst.transform3.x);

        var zvLin: f32 = 1e10;
        let ndc = getNDCPosition(pos, p_pos, p_size, p_rot, p_pitch, p_yaw, canvasSize, inst.transform3.y, inst.transform3.z, inst.transform3.w, &zvLin);
        return Out(ndc, uv, zvLin);
      }

      @group(1) @binding(0) var s: sampler;
      @group(1) @binding(1) var t: texture_2d<f32>;
      @fragment fn fs(@location(0) uv: vec2f, @location(1) zv: f32) -> @location(0) vec4f {
        //Corte nitido tras el near plane (zv interpola con correccion perspectiva,
        //igual que w): sin esto los vertices clampados generaban streaks.
        if (zv < world.depthParams.x) { discard; }
        let c = textureSample(t, s, uv);
        if (c.a < 0.015) { discard; }
        return c;
      }
    `;

    // 2. SHADER DE PATRÓN
    const patternShader = `
      struct InstPattern {
        transform1: vec4f, // [x, y, width, height]
        transform2: vec4f, // [roll, pitch, yaw, canvasWidth]
        tiling: vec4f,     // [canvasHeight, uvScaleX, uvScaleY, uvOffsetX]
        offset: vec4f      // [uvOffsetY, ignoreWorld, zCenter, pxPerWorld]
      };
      struct DataPattern { instances: array<InstPattern> };
      @group(0) @binding(0) var<storage, read> data: DataPattern;

      struct Out { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) zv: f32 };

      ${commonWGSLTransforms}

      @vertex fn vs(@location(0) pos: vec2f, @location(1) uv: vec2f, @builtin(instance_index) i: u32) -> Out {
        let inst = data.instances[i];
        let p_pos = inst.transform1.xy;
        let p_size = inst.transform1.zw;
        let p_rot = inst.transform2.x;
        let p_pitch = inst.transform2.y;
        let p_yaw = inst.transform2.z;
        let canvasSize = vec2f(inst.transform2.w, inst.tiling.x);

        var zvLin: f32 = 1e10;
        let ndc = getNDCPosition(pos, p_pos, p_size, p_rot, p_pitch, p_yaw, canvasSize, inst.offset.y, inst.offset.z, inst.offset.w, &zvLin);
        let tiledUV = uv * inst.tiling.yz + vec2f(inst.tiling.w, inst.offset.x);
        return Out(ndc, tiledUV, zvLin);
      }

      @group(1) @binding(0) var s: sampler;
      @group(1) @binding(1) var t: texture_2d<f32>;
      @fragment fn fs(@location(0) uv: vec2f, @location(1) zv: f32) -> @location(0) vec4f {
        //Corte nitido tras el near plane (zv interpola con correccion perspectiva,
        //igual que w): sin esto los vertices clampados generaban streaks.
        if (zv < world.depthParams.x) { discard; }
        let c = textureSample(t, s, uv);
        if (c.a < 0.015) { discard; }
        return c;
      }
    `;

    // 3. SHADER DE RECTÁNGULO
    const rectShader = `
      struct InstRect {
        transform1: vec4f, // [x, y, width, height]
        transform2: vec4f, // [roll, pitch, yaw, borderWidth(normalized)]
        transform3: vec4f, // [canvasWidth, canvasHeight, ignoreWorld, 0]
        fill: vec4f,       // [r, g, b, a]
        border: vec4f,      // [r, g, b, a]
        depth: vec4f        // [zCenter, pxPerWorld, 0, 0]
      };
      struct DataRect { instances: array<InstRect> };
      @group(0) @binding(0) var<storage, read> data: DataRect;

      struct Out { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) id: u32, @location(2) zv: f32 };

      ${commonWGSLTransforms}

      @vertex fn vs(@location(0) pos: vec2f, @location(1) uv: vec2f, @builtin(instance_index) i: u32) -> Out {
        let inst = data.instances[i];
        let p_pos = inst.transform1.xy;
        let p_size = inst.transform1.zw;
        let p_rot = inst.transform2.x;
        let p_pitch = inst.transform2.y;
        let p_yaw = inst.transform2.z;
        let canvasSize = inst.transform3.xy;

        var zvLin: f32 = 1e10;
        let ndc = getNDCPosition(pos, p_pos, p_size, p_rot, p_pitch, p_yaw, canvasSize, inst.transform3.z, inst.depth.x, inst.depth.y, &zvLin);
        return Out(ndc, uv, i, zvLin);
      }

      @fragment fn fs(in: Out) -> @location(0) vec4f {
        if (in.zv < world.depthParams.x) { discard; }
        let inst = data.instances[in.id];
        let brdW = inst.transform2.w;

        let d = max(abs(in.uv.x - 0.5), abs(in.uv.y - 0.5)) * 2.0;
        if (d > 1.0) { discard; }
        var c: vec4f;
        if (d > (1.0 - brdW * 2.0)) { c = inst.border; } else { c = inst.fill; }
        if (c.a < 0.015) { discard; }
        return c;
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

    //Depth por fragmento: LessEqual preserva el painter en coplanares y
    //arregla planos intersectados/rotados donde el orden por centro miente.
    const depthTest = {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less-equal",
    } as GPUDepthStencilState;

    const rectModule = this.device.createShaderModule({ code: rectShader });
    const imageModule = this.device.createShaderModule({ code: imageShader });
    const patternModule = this.device.createShaderModule({ code: patternShader });

    this.shapePipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: rectModule,    entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: rectModule,    entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
      primitive: { topology: "triangle-list" },
      depthStencil: depthTest
    });
    this.texturePipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: imageModule,   entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: imageModule,   entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
      primitive: { topology: "triangle-list" },
      depthStencil: depthTest
    });

    this.patternPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: patternModule, entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: patternModule, entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
      primitive: { topology: "triangle-list" },
      depthStencil: depthTest
    });

    //HUD (ignoreParallax): mismo shader, sin depthStencil => bypass total de depth.
    this.shapeNoDepthPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: rectModule,    entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: rectModule,    entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
      primitive: { topology: "triangle-list" }
    });
    this.textureNoDepthPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: imageModule,   entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: imageModule,   entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
      primitive: { topology: "triangle-list" }
    });
    this.patternNoDepthPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: patternModule, entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: patternModule, entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
      primitive: { topology: "triangle-list" }
    });

    this.imageGlobalBindGroup = this.device.createBindGroup({
      layout: this.texturePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.imageInstanceBuffer } },
        { binding: 1, resource: { buffer: this.worldDataBuffer } },
      ]
    });
    this.patternGlobalBindGroup = this.device.createBindGroup({
      layout: this.patternPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.patternInstanceBuffer } },
        { binding: 1, resource: { buffer: this.worldDataBuffer } },
      ]
    });
    this.rectGlobalBindGroup = this.device.createBindGroup({
      layout: this.shapePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.rectInstanceBuffer } },
        { binding: 1, resource: { buffer: this.worldDataBuffer } },
      ]
    });
    this.imageNoDepthBindGroup = this.device.createBindGroup({
      layout: this.textureNoDepthPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.imageInstanceBuffer } },
        { binding: 1, resource: { buffer: this.worldDataBuffer } },
      ]
    });
    this.patternNoDepthBindGroup = this.device.createBindGroup({
      layout: this.patternNoDepthPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.patternInstanceBuffer } },
        { binding: 1, resource: { buffer: this.worldDataBuffer } },
      ]
    });
    this.rectNoDepthBindGroup = this.device.createBindGroup({
      layout: this.shapeNoDepthPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.rectInstanceBuffer } },
        { binding: 1, resource: { buffer: this.worldDataBuffer } },
      ]
    });
  }
}
