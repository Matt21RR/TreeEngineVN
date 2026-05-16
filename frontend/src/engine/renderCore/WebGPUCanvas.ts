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

  // Stride de 16 floats (64 bytes). 
  // Bloque 1 (vec4f): [x, y, w, h]
  // Bloque 2 (vec4f): [rot, canvasW, canvasH, opcional]
  private readonly FLOATS_PER_INSTANCE = 16;

  async init(context: GPUCanvasContext) {
    this.context = context;

    const adapter = await navigator.gpu.requestAdapter();
    this.device = await adapter!.requestDevice();
    this.format = navigator.gpu.getPreferredCanvasFormat();

    const canvas = this.context.canvas as HTMLCanvasElement;

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
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied"
    });
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
    const bufDesc = { size: bufSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST };
    
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

  queueImage(params: DrawParams) { this.imageQueue.push(params); }
  queueRect(params: DrawParams) { this.rectQueue.push(params); }

  queueRepeatPattern(params: DrawParams, mode: RepeatMode) {
    const canvas = this.context.canvas as HTMLCanvasElement;
    let { x, y, width, height } = params;

    if (mode === "repeat") {
      width = canvas.width; height = canvas.height;
      x = 0; y = 0;
    }
    if (mode === "repeat-x") {
      width = canvas.width; height = params.tileHeight!;
      x = 0; params.y = 0;
    }
    if (mode === "repeat-y") {
      height = canvas.height; width = params.tileWidth!;
      y = 0; params.x = 0;
    }

    const uvScaleX = width  / params.tileWidth!;
    const uvScaleY = height / params.tileHeight!;
    const uvOffsetX = -params.x / params.tileWidth!;
    const uvOffsetY = -params.y / params.tileHeight!;

    this.patternQueue.push({
      ...params,
      x, y, width, height,
      fillColor: [uvScaleX, uvScaleY, uvOffsetX, uvOffsetY]
    });
  }

  render() {
    const canvas = this.context.canvas as HTMLCanvasElement;
    if (canvas.width === 0 || canvas.height === 0) return;

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      }]
    });

    // Fijar el viewport físicamente a las dimensiones actuales del canvas
    passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);

    this.processImageQueue(passEncoder, canvas.width, canvas.height);
    this.processPatternQueue(passEncoder, canvas.width, canvas.height);
    this.processRectQueue(passEncoder, canvas.width, canvas.height);

    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    this.imageQueue   = [];
    this.patternQueue = [];
    this.rectQueue    = [];
  }

  private processImageQueue(pass: GPURenderPassEncoder, cw: number, ch: number) {
    if (this.imageQueue.length === 0) return;

    const groups = new Map<string, DrawParams[]>();
    for (const img of this.imageQueue) {
      if (!groups.has(img.id!)) groups.set(img.id!, []);
      groups.get(img.id!)!.push(img);
    }

    const allData = new Float32Array(this.imageQueue.length * this.FLOATS_PER_INSTANCE);
    let globalIndex = 0;
    const drawCalls: { id: string; firstInstance: number; count: number }[] = [];

    groups.forEach((items, id) => {
      const firstInstance = globalIndex;
      items.forEach(item => {
        const offset = globalIndex * this.FLOATS_PER_INSTANCE;
        allData[offset + 0] = item.x;
        allData[offset + 1] = item.y;
        allData[offset + 2] = item.width;
        allData[offset + 3] = item.height;
        allData[offset + 4] = item.rotation;
        allData[offset + 5] = cw; // Enviamos el ancho del canvas por instancia
        allData[offset + 6] = ch; // Enviamos el alto del canvas por instancia
        globalIndex++;
      });
      drawCalls.push({ id, firstInstance, count: items.length });
    });

    this.device.queue.writeBuffer(this.imageInstanceBuffer, 0, allData);
    pass.setPipeline(this.texturePipeline);
    pass.setBindGroup(0, this.createGlobalBindGroup(this.texturePipeline, this.imageInstanceBuffer));

    for (const { id, firstInstance, count } of drawCalls) {
      const tex = this.textureCache.get(id);
      if (!tex) continue;
      pass.setBindGroup(1, tex.bindGroup);
      pass.draw(6, count, 0, firstInstance);
    }
  }

  private processPatternQueue(pass: GPURenderPassEncoder, cw: number, ch: number) {
    if (this.patternQueue.length === 0) return;

    const groups = new Map<string, DrawParams[]>();
    for (const p of this.patternQueue) {
      if (!groups.has(p.id!)) groups.set(p.id!, []);
      groups.get(p.id!)!.push(p);
    }

    const allData = new Float32Array(this.patternQueue.length * this.FLOATS_PER_INSTANCE);
    let globalIndex = 0;
    const drawCalls: { id: string; firstInstance: number; count: number }[] = [];

    groups.forEach((items, id) => {
      const firstInstance = globalIndex;
      items.forEach(item => {
        const offset = globalIndex * this.FLOATS_PER_INSTANCE;
        allData[offset + 0] = item.x;
        allData[offset + 1] = item.y;
        allData[offset + 2] = item.width;
        allData[offset + 3] = item.height;
        allData[offset + 4] = item.rotation;
        allData[offset + 5] = cw;
        allData[offset + 6] = ch;
        
        allData[offset + 8] = item.fillColor![0]; // uvScaleX
        allData[offset + 9] = item.fillColor![1]; // uvScaleY
        allData[offset + 10] = item.fillColor![2]; // uvOffsetX
        allData[offset + 11] = item.fillColor![3]; // uvOffsetY
        globalIndex++;
      });
      drawCalls.push({ id, firstInstance, count: items.length });
    });

    this.device.queue.writeBuffer(this.patternInstanceBuffer, 0, allData);
    pass.setPipeline(this.patternPipeline);
    pass.setBindGroup(0, this.createGlobalBindGroup(this.patternPipeline, this.patternInstanceBuffer));

    for (const { id, firstInstance, count } of drawCalls) {
      const tex = this.textureCache.get(id);
      if (!tex) continue;
      pass.setBindGroup(1, tex.patternBindGroup);
      pass.draw(6, count, 0, firstInstance);
    }
  }

  private processRectQueue(pass: GPURenderPassEncoder, cw: number, ch: number) {
    if (this.rectQueue.length === 0) return;

    const data = new Float32Array(this.rectQueue.length * this.FLOATS_PER_INSTANCE);
    
    this.rectQueue.forEach((item, i) => {
      const offset = i * this.FLOATS_PER_INSTANCE;
      data[offset + 0] = item.x;
      data[offset + 1] = item.y;
      data[offset + 2] = item.width;
      data[offset + 3] = item.height;
      data[offset + 4] = item.rotation;
      data[offset + 5] = item.borderWidth! / Math.max(item.width, item.height);
      data[offset + 6] = cw;
      data[offset + 7] = ch;

      data[offset + 8] = item.fillColor![0] / 255;
      data[offset + 9] = item.fillColor![1] / 255;
      data[offset + 10] = item.fillColor![2] / 255;
      data[offset + 11] = item.fillColor![3] / 255;

      data[offset + 12] = item.borderColor![0] / 255;
      data[offset + 13] = item.borderColor![1] / 255;
      data[offset + 14] = item.borderColor![2] / 255;
      data[offset + 15] = item.borderColor![3] / 255;
    });

    this.device.queue.writeBuffer(this.rectInstanceBuffer, 0, data);
    pass.setPipeline(this.shapePipeline);
    pass.setBindGroup(0, this.createGlobalBindGroup(this.shapePipeline, this.rectInstanceBuffer));
    pass.draw(6, this.rectQueue.length);
  }

  private createGlobalBindGroup(pipeline: GPURenderPipeline, buffer: GPUBuffer) {
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer } } // Eliminamos la dependencia del buffer de uniform global
      ]
    });
  }

  private createPipelines() {
    const commonWGSLTransforms = `
      fn getNDCPosition(vertexPos: vec2f, pos: vec2f, size: vec2f, rotation: f32, canvasSize: vec2f) -> vec4f {
        let localPixelPos = vertexPos * size;
        let center = size * 0.5;
        let translatedPos = localPixelPos - center;
        
        let c = cos(rotation);
        let s = sin(rotation);
        let rotatedPos = vec2f(
          translatedPos.x * c - translatedPos.y * s,
          translatedPos.x * s + translatedPos.y * c
        );
        
        let worldPixelPos = rotatedPos + center + pos;
        let ndcX = (worldPixelPos.x / canvasSize.x) * 2.0 - 1.0;
        let ndcY = (worldPixelPos.y / canvasSize.y) * -2.0 + 1.0;
        return vec4f(ndcX, ndcY, 0.0, 1.0);
      }
    `;

    // 1. SHADER DE IMAGEN (Alineación limpia sin uniform separado)
    const imageShader = `
      struct InstImage {
        transform1: vec4f, // [x, y, width, height]
        transform2: vec4f, // [rotation, canvasWidth, canvasHeight, 0]
        _pad: array<vec4f, 2>
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
        let canvasSize = inst.transform2.yz;

        let ndc = getNDCPosition(pos, p_pos, p_size, p_rot, canvasSize);
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
        transform2: vec4f, // [rotation, canvasWidth, canvasHeight, 0]
        tiling: vec4f,     // [uvScaleX, uvScaleY, uvOffsetX, uvOffsetY]
        _pad: vec4f
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
        let canvasSize = inst.transform2.yz;

        let ndc = getNDCPosition(pos, p_pos, p_size, p_rot, canvasSize);
        let tiledUV = uv * inst.tiling.xy + inst.tiling.zw;
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
        transform2: vec4f, // [rotation, borderWidth, canvasWidth, canvasHeight]
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
        let canvasSize = inst.transform2.zw;

        let ndc = getNDCPosition(pos, p_pos, p_size, p_rot, canvasSize);
        return Out(ndc, uv, i);
      }

      @fragment fn fs(in: Out) -> @location(0) vec4f {
        let inst = data.instances[in.id];
        let brdW = inst.transform2.y;

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

    this.shapePipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: this.device.createShaderModule({ code: rectShader }),    entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: this.device.createShaderModule({ code: rectShader }),    entryPoint: "fs", targets: [{ format: this.format, blend: blendAlpha }] },
      primitive: { topology: "triangle-list" }
    });
  }
}