/**
 * Dual Kawase Blur (dual-filter kawase) para el renderer WebGPU.
 *
 * Regla de escala estandar a partir de un solo input (radio en px de pantalla):
 *   passes = clamp(floor(log2(radius)), 1, maxPasses/por tamano)
 *   spacing (distancia de sampling en texels del source) = radius / 2^passes
 *
 * Transicion suave (estandar "blend entre dos chains"):
 * el radio cuantizado en bandas de 2^k produce un pop de kernel al cruzar
 * un borde de banda (cambia el nro de passes). Para eliminarlo se ejecutan
 * DOS cadenas (p y p+1 passes) apuntando al mismo radio y se mezclan los
 * resultados full-res con el factor fraccional del radio en la banda
 * (ref: Shadertoy "Dual Kawase Blur" de zznewclear13; PostProcessing/Unity usan
 * el mismo mapping cuantizado+spacing con el mismo pop sin corregir).
 */
const MAX_PASSES = 6;

type BlurLevel = {
  texture: GPUTexture;
  view: GPUTextureView;
};

type FullscreenEntry = {
  pipeline: GPURenderPipeline;
  uniform: GPUBuffer;
  srcView: GPUTextureView;
  dstView: GPUTextureView;
  dstW: number;
  dstH: number;
  srcW: number;
  srcH: number;
  bgCache: { bg: GPUBindGroup | null };
};

type Chain = {
  levels: BlurLevel[];
  downUniforms: GPUBuffer[];
  upUniforms: GPUBuffer[];
  downEntries: FullscreenEntry[];
  upEntries: FullscreenEntry[];
  result: { texture: GPUTexture; view: GPUTextureView };
};

export default class DualKawaseBlur {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  private sampler!: GPUSampler;

  private downPipeline!: GPURenderPipeline;
  private upPipeline!: GPURenderPipeline;
  private composePipeline!: GPURenderPipeline;        //blit simple (1 tex)
  private composeLerpPipeline!: GPURenderPipeline;    //blit blend 2 tex

  private sceneTarget: { texture: GPUTexture; view: GPUTextureView; w: number; h: number } | null = null;
  private chainsSup: Chain | null = null; //cadena A (p passes)
  private chainB: Chain | null = null;    //cadena B (p+1 passes) para el blend fraccional
  private composeLerpUniform: GPUBuffer | null = null;
  private composeLerpEntry: FullscreenEntry | null = null;
  private composeSimpleEntry: FullscreenEntry | null = null;
  private uniformValues = new Float32Array(4);
  private composeValues = new Float32Array(8);

  init(device: GPUDevice, format: GPUTextureFormat) {
    this.device = device;
    this.format = format;

    this.sampler = device.createSampler({
      magFilter: "linear", minFilter: "linear",
      addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge",
    });

    const shader = device.createShaderModule({ code: `
      struct Out { @builtin(position) p: vec4f, @location(0) uv: vec2f };

      struct BlurParams {
        spacing: vec2f, //distancia de sampling en texels del source
        texel:   vec2f, //1/size del source
      };
      @group(0) @binding(0) var<uniform> params: BlurParams;
      @group(0) @binding(1) var s: sampler;
      @group(0) @binding(2) var t: texture_2d<f32>;

      @vertex fn vs(@location(0) pos: vec2f, @location(1) uv: vec2f) -> Out {
        return Out(vec4f(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0), uv);
      }

      @fragment fn downFs(@location(0) uv: vec2f) -> @location(0) vec4f {
        let hp = params.texel * 0.5;
        let sp = params.texel * params.spacing;
        var c = textureSample(t, s, uv) * 4.0;
        c += textureSample(t, s, uv - hp - sp);
        c += textureSample(t, s, uv + hp + sp);
        c += textureSample(t, s, uv + vec2(hp.x - sp.x, -hp.y + sp.y));
        c += textureSample(t, s, uv + vec2(-hp.x + sp.x, hp.y - sp.y));
        return c * 0.125;
      }

      @fragment fn upFs(@location(0) uv: vec2f) -> @location(0) vec4f {
        let hp = params.texel * 0.5;
        let sp = params.texel * params.spacing;
        var c = textureSample(t, s, uv + vec2(-hp.x - sp.x,  hp.y - sp.y));
        c += textureSample(t, s, uv + vec2( hp.x - sp.x,  hp.y + sp.y));
        c += textureSample(t, s, uv + vec2( hp.x + sp.x, -hp.y + sp.y));
        c += textureSample(t, s, uv + vec2(-hp.x + sp.x, -hp.y - sp.y));
        return c * 0.25;
      }

      @fragment fn copyFs(@location(0) uv: vec2f) -> @location(0) vec4f {
        return textureSample(t, s, uv);
      }

      //Compose final con blend entre dos cadenas + cross-fade alpha con la escena sharp:
      //w = peso de la cadena A (tA); alpha = visibilidad del blur (1 = solo blur, 0 = solo escena)
      struct ComposeParams {
        weight: vec4f,  //.x = peso mix(RB, RA)
        alpha: vec4f,   //.x = visibilidad del blur
      };
      @group(0) @binding(0) var<uniform> cmp: ComposeParams;
      @group(0) @binding(1) var sB: sampler;
      @group(0) @binding(2) var tA: texture_2d<f32>;
      @group(0) @binding(3) var tB: texture_2d<f32>;
      @group(0) @binding(4) var tSharp: texture_2d<f32>;

      @fragment fn composeLerpFs(@location(0) uv: vec2f) -> @location(0) vec4f {
        let a = textureSample(tA, sB, uv);
        let b = textureSample(tB, sB, uv);
        let mid = mix(a, b, cmp.weight.x);
        let sharp = textureSample(tSharp, sB, uv);
        return mid * cmp.alpha.x + sharp * (1.0 - cmp.alpha.x);
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
    const fragmentFormat = { format: this.format } as GPUColorTargetState;
    const premultBlend = {
      color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
    } as GPUBlendState;

    //Layout explicito compartido (down/up/copy comparten uniform+sampler+texture)
    const blurBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      ]
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [blurBindGroupLayout] });

    //Layout del compose con 2 cadenas + escena sharp y blend factor
    const composeBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      ]
    });
    const composePipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [composeBindGroupLayout] });

    this.downPipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: fullscreenVertex,
      fragment: { module: shader, entryPoint: "downFs", targets: [fragmentFormat] },
      primitive: { topology: "triangle-list" }
    });
    this.upPipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: fullscreenVertex,
      fragment: { module: shader, entryPoint: "upFs", targets: [fragmentFormat] },
      primitive: { topology: "triangle-list" }
    });
    //Blit final premultiplied-over hacia el swapchain (contexto con alphaMode premultiplied)
    this.composePipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: fullscreenVertex,
      fragment: { module: shader, entryPoint: "copyFs", targets: [{ format: this.format, blend: premultBlend }] },
      primitive: { topology: "triangle-list" }
    });
    this.composeLerpPipeline = device.createRenderPipeline({
      layout: composePipelineLayout,
      vertex: fullscreenVertex,
      fragment: { module: shader, entryPoint: "composeLerpFs", targets: [{ format: this.format, blend: premultBlend }] },
      primitive: { topology: "triangle-list" }
    });

    this.composeLerpUniform = device.createBuffer({
      size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private makeUniform(): GPUBuffer {
    return this.device.createBuffer({
      size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private buildChain(w: number, h: number): Chain {
    const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
    const chain: Chain = {
      levels: [], downUniforms: [], upUniforms: [], downEntries: [], upEntries: [],
      result: null as any,
    };
    chain.result = { texture: this.device.createTexture({ size: [w, h], format: this.format, usage }), view: null as any };
    chain.result.view = chain.result.texture.createView();

    for (let i = 0; i < MAX_PASSES; i++) {
      const mw = Math.max(Math.floor(w / (2 << i)), 8);
      const mh = Math.max(Math.floor(h / (2 << i)), 8);
      const tex = this.device.createTexture({ size: [mw, mh], format: this.format, usage });
      chain.levels.push({ texture: tex, view: tex.createView() });

      chain.downUniforms.push(this.makeUniform());
      chain.upUniforms.push(this.makeUniform());

      //down i: escribe levels[i], lee escena (i==0) o levels[i-1]
      let srcView = this.sceneTarget!.view;
      let srcW = w, srcH = h;
      if (i > 0) {
        srcView = chain.levels[i - 1].view;
        srcW = Math.max(Math.floor(w / (2 << (i - 1))), 8);
        srcH = Math.max(Math.floor(h / (2 << (i - 1))), 8);
      }
      chain.downEntries.push({
        pipeline: this.downPipeline,
        uniform: chain.downUniforms[i],
        srcView, srcW, srcH,
        dstView: chain.levels[i].view,
        dstW: mw, dstH: mh,
        bgCache: { bg: null },
      });
    }

    //up entries en orden ascendente de nivel: upEntries[i] es el up del nivel i
    for (let i = 0; i < MAX_PASSES; i++) {
      const isFinal = i === 0;
      chain.upEntries.push({
        pipeline: this.upPipeline,
        uniform: chain.upUniforms[i],
        srcView: chain.levels[i].view,
        srcW: Math.max(Math.floor(w / (2 << i)), 8),
        srcH: Math.max(Math.floor(h / (2 << i)), 8),
        dstView: isFinal ? chain.result.view : chain.levels[i - 1].view,
        dstW: isFinal ? w : Math.max(Math.floor(w / (2 << (i - 1))), 8),
        dstH: isFinal ? h : Math.max(Math.floor(h / (2 << (i - 1))), 8),
        bgCache: { bg: null },
      });
    }
    return chain;
  }

  /**Target donde se renderiza la escena cuando hay blur activo */
  getSceneTarget(w: number, h: number): GPUTextureView {
    if (!this.sceneTarget || this.sceneTarget.w !== w || this.sceneTarget.h !== h) {
      this.destroyTargets();
      const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
      this.sceneTarget = {
        texture: this.device.createTexture({ size: [w, h], format: this.format, usage }),
        view: null as any, w, h
      };
      this.sceneTarget.view = this.sceneTarget.texture.createView();

      this.chainsSup = this.buildChain(w, h);
      this.chainB = this.buildChain(w, h);

      this.composeLerpEntry = {
        pipeline: this.composeLerpPipeline,
        uniform: this.composeLerpUniform!,
        srcView: null as any,
        srcW: w, srcH: h,
        dstView: null as any,
        dstW: w, dstH: h,
        bgCache: { bg: null },
      };
      this.composeSimpleEntry = {
        pipeline: this.composePipeline,
        uniform: this.makeUniform(),
        srcView: this.chainsSup.result.view,
        srcW: w, srcH: h,
        dstView: null as any,
        dstW: w, dstH: h,
        bgCache: { bg: null },
      };
    }
    return this.sceneTarget!.view;
  }

  /**
   * Encadena down passes + up passes + compose dentro del encoder del frame.
   * @param srcView target donde se renderizo la escena
   * @param dstView view del swapchain destino
   */
  record(
    encoder: GPUCommandEncoder,
    srcView: GPUTextureView,
    dstView: GPUTextureView,
    radiusPx: number,
    w: number, h: number,
    vertexBuffer: GPUBuffer
  ) {
    if (!this.sceneTarget) return;
    if (radiusPx <= 0.05) return;

    //Cap dinamico: los mips nunca bajan de 8px de alto
    const maxBySize = Math.floor(Math.log2(Math.min(w, h))) - 3;
    let p = Math.floor(Math.log2(Math.max(radiusPx, 1.0001)));
    p = Math.max(p, 1);
    p = Math.min(p, MAX_PASSES, maxBySize);
    if (p < 1) return;

    //Regimen fade (radios bajos): alpha cross-fade con la escena sharp.
    //El kernel queda FIJO en p=1, spacing=1.0 (== la cadena estandar en r=2) para que
    //la transicion al regimen normal sea continua: en r=R0, alpha=1 y kernels identicos.
    const FADE_R0 = 2.0;
    const fadeMode = radiusPx < FADE_R0;
    const alphaVisibility = fadeMode ? Math.min(Math.max(radiusPx / FADE_R0, 0), 1) : 1;

    //Spacing por cadena: ambos kernels apuntan al MISMO radio (sigma ~ spacing*2^passes)
    const passesA = p;
    const passesB = !fadeMode && p + 1 <= Math.min(MAX_PASSES, maxBySize) ? p + 1 : 0;
    const spacingA = fadeMode ? 1.0 : Math.min(Math.max(radiusPx / (1 << passesA), 0.5), 2.0);
    //blend fraccional dentro de la banda: sA in [1,2) -> w=0 en el inicio del bin
    //(chainB domina; su kernel ~ igual al fin del bin anterior) y w->1 hacia el fin del bin.
    //Ambas cadenas apuntan al MISMO radio (spacing*2^passes == radius).
    const chains: Array<{ chain: Chain; passes: number; spacing: number; w: number }> = [];
    const weightA = fadeMode ? 0 : Math.min(Math.max(spacingA - 1, 0), 1);
    //chainA siempre corre: es el fallback del compose simple cuando no hay blend
    chains.push({ chain: this.chainsSup!, passes: passesA, spacing: spacingA, w: weightA });
    if (passesB > 0 && weightA < 1 - 1e-4) {
      chains.push({ chain: this.chainB!, passes: passesB, spacing: spacingA / 2, w: 1 - weightA });
    }

    const writeParams = (entry: FullscreenEntry, spacing: number) => {
      this.uniformValues[0] = spacing;
      this.uniformValues[1] = spacing;
      this.uniformValues[2] = 1 / entry.srcW;
      this.uniformValues[3] = 1 / entry.srcH;
      this.device.queue.writeBuffer(entry.uniform, 0, this.uniformValues);
    };

    const runFullscreenPass = (entry: FullscreenEntry) => {
      if (!entry.bgCache.bg) {
        entry.bgCache.bg = this.device.createBindGroup({
          layout: entry.pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: entry.uniform } },
            { binding: 1, resource: this.sampler },
            { binding: 2, resource: entry.srcView },
          ]
        });
      }
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: entry.dstView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        }]
      });
      pass.setPipeline(entry.pipeline);
      pass.setBindGroup(0, entry.bgCache.bg);
      pass.setViewport(0, 0, entry.dstW, entry.dstH, 0, 1);
      if (vertexBuffer) pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(6);
      pass.end();
    };

    const runChain = (chain: Chain, passes: number, spacing: number) => {
      for (let i = 0; i < passes; i++) {
        const entry = chain.downEntries[i];
        writeParams(entry, spacing);
        runFullscreenPass(entry);
      }
      for (let i = passes - 1; i >= 0; i--) {
        const entry = chain.upEntries[i];
        writeParams(entry, spacing);
        runFullscreenPass(entry);
      }
    };

    for (const { chain, passes, spacing } of chains) {
      runChain(chain, passes, spacing);
    }

    //Compose final al swapchain
    if (chains.length === 2 || fadeMode) {
      //compose con 2 cadenas (o cross-fade con la escena en el regimen fade)
      const entry = this.composeLerpEntry!;
      entry.dstView = dstView;
      const weightAUsed = chains.length === 2 ? chains.find(c => c.chain === this.chainsSup)!.w : weightA;
      this.composeValues[0] = weightAUsed;  //peso de la cadena A (binding tA)
      this.composeValues[1] = weightAUsed;
      this.composeValues[2] = 0;
      this.composeValues[3] = 0;
      this.composeValues[4] = alphaVisibility; //visibilidad blur vs escena sharp
      this.composeValues[5] = alphaVisibility;
      this.composeValues[6] = 0;
      this.composeValues[7] = 0;
      this.device.queue.writeBuffer(entry.uniform, 0, this.composeValues);
      if (!entry.bgCache.bg) {
        entry.bgCache.bg = this.device.createBindGroup({
          layout: entry.pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: entry.uniform } },
            { binding: 1, resource: this.sampler },
            { binding: 2, resource: this.chainsSup!.result.view },
            { binding: 3, resource: this.chainB!.result.view },
            { binding: 4, resource: this.sceneTarget!.view },
          ]
        });
      }
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: entry.dstView, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }]
      });
      pass.setPipeline(entry.pipeline);
      pass.setBindGroup(0, entry.bgCache.bg);
      pass.setViewport(0, 0, entry.dstW, entry.dstH, 0, 1);
      if (vertexBuffer) pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(6);
      pass.end();
    } else {
      //Cadena unica: blit premult simple (entry persistente; dstView cambia por frame)
      const compose = this.composeSimpleEntry!;
      compose.dstView = dstView;
      writeParams(compose, chains[0].spacing);
      runFullscreenPass(compose);
    }
  }

  private destroyTargets() {
    if (this.sceneTarget) { this.sceneTarget.texture.destroy(); this.sceneTarget = null; }
    for (const chainKey of ["chainsSup", "chainB"] as const) {
      const chain = this[chainKey];
      if (chain) {
        chain.result.texture.destroy();
        for (const lvl of chain.levels) lvl.texture.destroy();
        this[chainKey] = null;
      }
    }
    this.composeLerpEntry = null;
    this.composeSimpleEntry = null;
  }

  destroy() {
    this.destroyTargets();
  }
}
