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

  private textureCache = new Map<string, { view: GPUTextureView; bindGroup: GPUBindGroup; patternBindGroup: GPUBindGroup }>();
  private sampler!: GPUSampler;

  private vertexBuffer!: GPUBuffer;

  private imageInstanceBuffer!: GPUBuffer;
  private patternInstanceBuffer!: GPUBuffer;
  private rectInstanceBuffer!: GPUBuffer;

  private worldDataBuffer!: GPUBuffer;
  private worldDataValues = new Float32Array(8);

  //*Persistent CPU-side staging (no per-frame allocations)
  private imageStaging!: Float32Array;
  private patternStaging!: Float32Array;
  private rectStaging!: Float32Array;

  //*Bind groups are fixed per pipeline+buffer pair, created once at init
  private imageGlobalBindGroup!: GPUBindGroup;
  private patternGlobalBindGroup!: GPUBindGroup;
  private rectGlobalBindGroup!: GPUBindGroup;

  private queue: QueuedItem[] = [];
  private MAX_INSTANCES = 40000;

  // Stride de 16 floats (64 bytes).
  private readonly FLOATS_PER_INSTANCE = 16;
  //*Los rects llevan stride propio de 20 floats: roll+pitch+yaw+borderW y canvas en transform3
  private readonly RECT_FLOATS_PER_INSTANCE = 20;

  //*Scratch state reused across batches to avoid allocations in the hot path
  private groupCounts = new Map<string, number>();
  private groupFirst = new Map<string, number>();
  private groupCursor = new Map<string, number>();
  private groupOrder: string[] = [];
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
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
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
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store",
      }]
    });

    passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);

    this.processQueueInOrder(passEncoder, canvas.width, canvas.height);

    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    this.queue.length = 0;
  }

  private processQueueInOrder(pass: GPURenderPassEncoder, cw: number, ch: number) {
    if (this.queue.length === 0) return;

    const runs: Array<{ type: string; start: number; end: number }> = [];
    let runStart = 0;
    let currentType: string | null = null;

    for (let i = 0; i < this.queue.length; i++) {
      const itemType = this.queue[i].type;
      if (currentType !== null && currentType !== itemType) {
        this.processBatch(pass, currentType, runStart, i, cw, ch);
        runs.push({ type: currentType, start: runStart, end: i });
        runStart = i;
      }
      currentType = itemType;
    }
    if (currentType !== null) {
      this.processBatch(pass, currentType, runStart, this.queue.length, cw, ch);
      runs.push({ type: currentType, start: runStart, end: this.queue.length });
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

  private processBatch(pass: GPURenderPassEncoder, type: string, startIdx: number, endIdx: number, cw: number, ch: number) {
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
      this.processGroupedBatch(pass, this.imageStaging, this.imageInstanceBuffer, this.imageGlobalBindGroup, startIdx, clampedEnd, cw, ch, false, slotBase);
    } else if (type === 'pattern') {
      this.patternUsed += count;
      this.processGroupedBatch(pass, this.patternStaging, this.patternInstanceBuffer, this.patternGlobalBindGroup, startIdx, clampedEnd, cw, ch, true, slotBase);
    } else {
      this.rectUsed += count;
      this.processRectBatch(pass, startIdx, clampedEnd, cw, ch, slotBase);
    }
  }

  /**
   * Escribe las instancias de un rango del queue agrupadas por textura,
   * preservando el orden de primera aparicion (identico al comportamiento previo)
   * y emitiento un draw call por grupo.
   * slotBase es el offset absoluto (en instancias) dentro del instanceBuffer donde
   * inicia este run: los slots se acumulan durante todo el frame porque solo hay
   * un submit al final de render().
   */
  private processGroupedBatch(
    pass: GPURenderPassEncoder,
    staging: Float32Array,
    instanceBuffer: GPUBuffer,
    globalBindGroup: GPUBindGroup,
    startIdx: number,
    endIdx: number,
    cw: number,
    ch: number,
    isPattern: boolean,
    slotBase: number
  ) {
    const queue = this.queue;
    const counts = this.groupCounts;
    const firstOf = this.groupFirst;
    const cursor = this.groupCursor;
    const order = this.groupOrder;
    counts.clear(); firstOf.clear(); cursor.clear(); order.length = 0;
    this.drawCallCount = 0;

    for (let i = startIdx; i < endIdx; i++) {
      const id = queue[i].params.id!;
      const known = counts.get(id);
      if (known === undefined) {
        counts.set(id, 1);
        firstOf.set(id, 0);
        order.push(id);
      } else {
        counts.set(id, known + 1);
      }
    }

    let acc = slotBase;
    for (let k = 0; k < order.length; k++) {
      const id = order[k];
      firstOf.set(id, acc);
      cursor.set(id, acc);
      const c = counts.get(id)!;
      this.drawCallPool[this.drawCallCount++] = { id, firstInstance: acc, count: c };
      acc += c;
    }

    const FLOATS = this.FLOATS_PER_INSTANCE;
    for (let i = startIdx; i < endIdx; i++) {
      const p = queue[i].params;
      const offset = cursor.get(p.id!)! * FLOATS;
      cursor.set(p.id!, offset / FLOATS + 1);

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
      } else {
        staging[offset + 9] = p.ignoreWorldRotation ?? 0; // transform3.y → ignoreWorld flag
      }
    }

    this.device.queue.writeBuffer(
      instanceBuffer,
      slotBase * FLOATS * 4,
      staging,
      slotBase * FLOATS,
      (acc - slotBase) * FLOATS
    );

    if (isPattern) {
      pass.setPipeline(this.patternPipeline);
    } else {
      pass.setPipeline(this.texturePipeline);
    }
    pass.setBindGroup(0, globalBindGroup);

    for (let d = 0; d < this.drawCallCount; d++) {
      const dc = this.drawCallPool[d];
      const tex = this.textureCache.get(dc.id);
      if (!tex) { this.diagMissingTexture(dc.id); continue; }
      pass.setBindGroup(1, isPattern ? tex.patternBindGroup : tex.bindGroup);
      pass.draw(6, dc.count, 0, dc.firstInstance);
      this.diagDraw(isPattern ? "pattern" : "image", dc.id, dc.firstInstance, dc.count);
    }
  }

  private processRectBatch(pass: GPURenderPassEncoder, startIdx: number, endIdx: number, cw: number, ch: number, slotBase: number) {
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
    }

    this.device.queue.writeBuffer(this.rectInstanceBuffer, slotBase * FLOATS * 4, data, slotBase * FLOATS, count * FLOATS);
    pass.setPipeline(this.shapePipeline);
    pass.setBindGroup(0, this.rectGlobalBindGroup);
    pass.draw(6, count, 0, slotBase);
    this.diagDraw("rect", undefined, slotBase, count);
  }

  private createPipelines() {
    const commonWGSLTransforms = `
      struct WorldData {
        rotation: vec4f,
        cameraOrigin: vec4f,
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

      fn getNDCPosition(vertexPos: vec2f, pos: vec2f, size: vec2f, roll: f32, pitch: f32, yaw: f32, canvasSize: vec2f, ignoreWorld: f32) -> vec4f {
        let localPixelPos = vertexPos * size;
        let center = size * 0.5;
        let translatedPos = localPixelPos - center;
        let local3D = vec3f(translatedPos.x, translatedPos.y, 0.0);

        let worldEffect = 1.0 - ignoreWorld;
        let worldRotatedLocal = rotate3D(local3D, world.rotation.z * worldEffect, world.rotation.x * worldEffect, world.rotation.y * worldEffect);
        let rotated3D = rotate3D(worldRotatedLocal, roll, pitch, yaw);

        let cameraDist = max(canvasSize.x, canvasSize.y) * 1.2;

        var final3D = rotated3D;
        if (worldEffect > 0.5) {
          let objCenter = pos + size * 0.5;
          let camCenter = world.cameraOrigin.xy * canvasSize;
          let offset = objCenter - camCenter;
          let viewPitch = offset.y / cameraDist;
          let viewYaw = -offset.x / cameraDist;
          final3D = rotate3D(rotated3D, 0.0, viewPitch, viewYaw);
        }

        let perspectiveScale = cameraDist / (cameraDist + final3D.z);
        let worldPixelPos = vec2f(final3D.x, final3D.y) * perspectiveScale + center + pos;

        let ndcX = (worldPixelPos.x / canvasSize.x) * 2.0 - 1.0;
        let ndcY = (worldPixelPos.y / canvasSize.y) * -2.0 + 1.0;
        return vec4f(ndcX, ndcY, 0.0, 1.0);
      }
    `;

    // 1. SHADER DE IMAGEN (Alineación limpia sin uniform separado)
    const imageShader = `
      struct InstImage {
        transform1: vec4f, // [x, y, width, height]
        transform2: vec4f, // [roll, pitch, yaw, canvasWidth]
        transform3: vec4f, // [canvasHeight, 0, 0, 0]
        _pad: vec4f
      };
      struct DataImage { instances: array<InstImage> };
      @group(0) @binding(0) var<storage, read> data: DataImage;

      struct Out { @builtin(position) p: vec4f, @location(0) uv: vec2f };
      
      ${commonWGSLTransforms}

      @vertex fn vs(@location(0) pos: vec2f, @location(1) uv: vec2f, @builtin(instance_index) i: u32) -> Out {
        let inst = data.instances[i];
        let p_pos = inst.transform1.xy;
        let p_size = inst.transform1.zw;
        let p_rot = inst.transform2.x;
        let p_pitch = inst.transform2.y;
        let p_yaw = inst.transform2.z;
        let canvasSize = vec2f(inst.transform2.w, inst.transform3.x);

        let ndc = getNDCPosition(pos, p_pos, p_size, p_rot, p_pitch, p_yaw, canvasSize, inst.transform3.y);
        return Out(ndc, uv);
      }

      @group(1) @binding(0) var s: sampler;
      @group(1) @binding(1) var t: texture_2d<f32>;
      @fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
        return textureSample(t, s, uv);
      }
    `;

    // 2. SHADER DE PATRÓN
    const patternShader = `
      struct InstPattern {
        transform1: vec4f, // [x, y, width, height]
        transform2: vec4f, // [roll, pitch, yaw, canvasWidth]
        tiling: vec4f,     // [canvasHeight, uvScaleX, uvScaleY, uvOffsetX]
        offset: vec4f      // [uvOffsetY, 0,0,0]
      };
      struct DataPattern { instances: array<InstPattern> };
      @group(0) @binding(0) var<storage, read> data: DataPattern;

      struct Out { @builtin(position) p: vec4f, @location(0) uv: vec2f };

      ${commonWGSLTransforms}

      @vertex fn vs(@location(0) pos: vec2f, @location(1) uv: vec2f, @builtin(instance_index) i: u32) -> Out {
        let inst = data.instances[i];
        let p_pos = inst.transform1.xy;
        let p_size = inst.transform1.zw;
        let p_rot = inst.transform2.x;
        let p_pitch = inst.transform2.y;
        let p_yaw = inst.transform2.z;
        let canvasSize = vec2f(inst.transform2.w, inst.tiling.x);

        let ndc = getNDCPosition(pos, p_pos, p_size, p_rot, p_pitch, p_yaw, canvasSize, inst.offset.y);
        let tiledUV = uv * inst.tiling.yz + vec2f(inst.tiling.w, inst.offset.x);
        return Out(ndc, tiledUV);
      }

      @group(1) @binding(0) var s: sampler;
      @group(1) @binding(1) var t: texture_2d<f32>;
      @fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
        return textureSample(t, s, uv);
      }
    `;

    // 3. SHADER DE RECTÁNGULO
    const rectShader = `
      struct InstRect {
        transform1: vec4f, // [x, y, width, height]
        transform2: vec4f, // [roll, pitch, yaw, borderWidth(normalized)]
        transform3: vec4f, // [canvasWidth, canvasHeight, 0, 0]
        fill: vec4f,       // [r, g, b, a]
        border: vec4f      // [r, g, b, a]
      };
      struct DataRect { instances: array<InstRect> };
      @group(0) @binding(0) var<storage, read> data: DataRect;

      struct Out { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) id: u32 };

      ${commonWGSLTransforms}

      @vertex fn vs(@location(0) pos: vec2f, @location(1) uv: vec2f, @builtin(instance_index) i: u32) -> Out {
        let inst = data.instances[i];
        let p_pos = inst.transform1.xy;
        let p_size = inst.transform1.zw;
        let p_rot = inst.transform2.x;
        let p_pitch = inst.transform2.y;
        let p_yaw = inst.transform2.z;
        let canvasSize = inst.transform3.xy;

        let ndc = getNDCPosition(pos, p_pos, p_size, p_rot, p_pitch, p_yaw, canvasSize, inst.transform3.z);
        return Out(ndc, uv, i);
      }

      @fragment fn fs(in: Out) -> @location(0) vec4f {
        let inst = data.instances[in.id];
        let brdW = inst.transform2.w;

        let d = max(abs(in.uv.x - 0.5), abs(in.uv.y - 0.5)) * 2.0;
        if (d > 1.0) { discard; }
        if (d > (1.0 - brdW * 2.0)) { return inst.border; }
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


    this.shapePipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: this.device.createShaderModule({ code: rectShader }),    entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: this.device.createShaderModule({ code: rectShader }),    entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
      primitive: { topology: "triangle-list" }
    });
    this.texturePipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: this.device.createShaderModule({ code: imageShader }),   entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: this.device.createShaderModule({ code: imageShader }),   entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
      primitive: { topology: "triangle-list" }
    });

    this.patternPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: this.device.createShaderModule({ code: patternShader }), entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: this.device.createShaderModule({ code: patternShader }), entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
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
  }
}
