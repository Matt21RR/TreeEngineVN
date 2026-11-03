/**
 * SSAO (oclusion ambiental en espacio de pantalla) para las mallas 3D del
 * renderer WebGPU, SIN prepass: el pase principal escribe, ademas del color,
 * tres attachments extra (MRT) que este modulo posee:
 *   2 amb (r8unorm):     fraccion del color que es luz ambiente. Sprites y
 *                        translucidos la atenuan con su alfa al pintar encima.
 *   3 pos (rgba16float): posicion mundo relativa al ojo (xyz) + unidades
 *                        mundo por pixel (w; 0 = vacio, el clear).
 *   4 nrm (rg8unorm):    normal mundo hacia el observador, octaedrica.
 * Con bloom suman 28 B/muestra: caben en los 32 por defecto de
 * maxColorAttachmentBytesPerSample.
 *
 * Con MSAA NO se resuelven (el resolve de 3 targets multisample costaba mas
 * que todo el SSAO): la reduccion lee la muestra 0 de pos/nrm y la
 * composicion promedia las muestras de amb.
 *
 * La proyeccion del motor es propia y varia por instancia (modo ojo con K,
 * modo depthP, orto), asi que no se reconstruye nada desde el depth: el AO
 * se estima estilo SAO/Alchemy con las posiciones del G-buffer (muestras en
 * un disco de pantalla cuyo radio en px sale de las unidades por pixel).
 *
 * Tras el pase principal (todo a media resolucion salvo la composicion):
 * reduccion del G-buffer -> hPos/hNrm, ssao -> aoRaw, blur bilateral H/V ->
 * aoOut, y composicion multiplicativa: color *= 1 - amb * (1 - ao).
 * Asi el AO solo quita luz ambiente, sin volver a dibujar la geometria.
 */
export type SSAOParams = { radius: number; intensity: number; bias: number; power: number };

type Target = { texture: GPUTexture; view: GPUTextureView };

export const SSAO_AMB_FORMAT: GPUTextureFormat = "r8unorm";
export const SSAO_GBUF_FORMAT: GPUTextureFormat = "rgba16float";
export const SSAO_NRM_FORMAT: GPUTextureFormat = "rg8unorm";

/** Normal unitaria -> octaedrica en [0, 1] (la escribe el shader de mallas en nrm). */
export const SSAO_OCT_WGSL = `
  fn octEncode(n: vec3f) -> vec2f {
    let p = n.xy / (abs(n.x) + abs(n.y) + abs(n.z));
    let s = select(vec2f(-1.0), vec2f(1.0), p >= vec2f(0.0));
    let q = select(p, (vec2f(1.0) - abs(p.yx)) * s, n.z < 0.0);
    return q * 0.5 + 0.5;
  }
`;

export default class SSAO {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  //*Leen el G-buffer de resolucion completa: dependen de si es multisample.
  private fullPipes: { ms: boolean; reduce: GPURenderPipeline; composite: GPURenderPipeline; debug: GPURenderPipeline } | null = null;
  private ssaoPipeline!: GPURenderPipeline;
  private blurPipeline!: GPURenderPipeline;
  private sampler!: GPUSampler;
  //[radio, intensidad, bias, power] + [fullW, fullH, halfW, halfH]
  private paramsBuffer!: GPUBuffer;
  private paramsValues = new Float32Array(8);
  private dirH!: GPUBuffer;
  private dirV!: GPUBuffer;

  private w = 0;
  private h = 0;
  private hw = 0;
  private hh = 0;
  private samples = 1;
  //*Resolucion completa (multisample si hay MSAA; se leen sin resolver).
  private amb: Target | null = null;
  private gPos: Target | null = null;
  private gNrm: Target | null = null;
  //*Media resolucion: G-buffer reducido (pos + unidades por pixel, normal) y AO.
  private hPos: Target | null = null;
  private hNrm: Target | null = null;
  private aoRaw: Target | null = null;
  private aoTmp: Target | null = null;
  private aoOut: Target | null = null;
  private reduceBg: GPUBindGroup | null = null;
  private ssaoBg: GPUBindGroup | null = null;
  private blurHBg: GPUBindGroup | null = null;
  private blurVBg: GPUBindGroup | null = null;
  private compositeBg: GPUBindGroup | null = null;
  private debugBg: GPUBindGroup | null = null;

  private static readonly COMMON = `
    struct Params { a: vec4f, size: vec4f }; // [R, intensidad, bias, power], [fullW, fullH, halfW, halfH]
    @group(0) @binding(0) var<uniform> P: Params;
    struct VOut { @builtin(position) p: vec4f };
    @vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
      let xy = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
      return VOut(vec4f(xy * 2.0 - 1.0, 0.0, 1.0));
    }
  `;

  private fullscreen(module: GPUShaderModule, entryPoint: string, targets: GPUColorTargetState[]) {
    return this.device.createRenderPipeline({
      layout: "auto",
      vertex: { module, entryPoint: "vs" },
      fragment: { module, entryPoint, targets },
      primitive: { topology: "triangle-list" },
    });
  }

  init(device: GPUDevice, format: GPUTextureFormat) {
    this.device = device;
    this.format = format;
    this.paramsBuffer = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.dirH = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.dirV = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.dirH, 0, new Float32Array([1, 0, 0, 0]));
    device.queue.writeBuffer(this.dirV, 0, new Float32Array([0, 1, 0, 0]));
    this.sampler = device.createSampler({
      magFilter: "linear", minFilter: "linear",
      addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge",
    });

    //*G-buffer reducido a media resolucion (lo leen ssao y blur).
    const halfG = `
      @group(0) @binding(1) var hPos: texture_2d<f32>;
      @group(0) @binding(2) var hNrm: texture_2d<f32>;
      //*pos relativa al ojo; upp = unidades mundo por pixel de MEDIA resolucion (0 = vacio).
      struct G { pos: vec3f, upp: f32, ok: bool };
      fn loadP(p: vec2i) -> G {
        let a = textureLoad(hPos, p, 0);
        return G(a.xyz, a.w, a.w > 0.0);
      }
      fn loadN(p: vec2i) -> vec3f { return normalize(textureLoad(hNrm, p, 0).xyz * 2.0 - 1.0); }
    `;
    const ssaoModule = device.createShaderModule({ code: `
      ${SSAO.COMMON}
      ${halfG}
      const SAMPLES = 12;
      const TURNS = 7.0;
      const TAU = 6.28318531;
      @fragment fn fs(in: VOut) -> @location(0) vec4f {
        let p = vec2i(floor(in.p.xy));
        let c = loadP(p);
        if (!c.ok) { return vec4f(1.0); }
        let R = P.a.x;
        let radiusPx = min(R / c.upp, 32.0);
        if (radiusPx < 0.5) { return vec4f(1.0); }
        let N = loadN(p);
        //*Interleaved gradient noise: rotacion del espiral por pixel (el blur la limpia).
        let phi = fract(52.9829189 * fract(dot(in.p.xy, vec2f(0.06711056, 0.00583715)))) * TAU;
        let maxP = vec2i(P.size.zw) - vec2i(1);
        let R2 = R * R;
        var occ = 0.0;
        for (var i = 0; i < SAMPLES; i++) {
          let alpha = (f32(i) + 0.5) / f32(SAMPLES);
          let ang = alpha * TURNS * TAU + phi;
          let off = vec2f(cos(ang), sin(ang)) * max(alpha * radiusPx, 1.0);
          let q = loadP(clamp(p + vec2i(round(off)), vec2i(0), maxP));
          if (!q.ok) { continue; }
          let v = q.pos - c.pos;
          let vv = dot(v, v);
          if (vv < 1e-12 || vv >= R2) { continue; }
          let falloff = 1.0 - vv / R2;
          occ += falloff * max(dot(v, N) * inverseSqrt(vv) - P.a.z, 0.0);
        }
        let ao = clamp(1.0 - P.a.y * 2.0 * occ / f32(SAMPLES), 0.0, 1.0);
        return vec4f(pow(ao, P.a.w));
      }
    ` });
    const blurModule = device.createShaderModule({ code: `
      ${SSAO.COMMON}
      ${halfG}
      struct Dir { d: vec4f };
      @group(0) @binding(3) var<uniform> D: Dir;
      @group(0) @binding(4) var src: texture_2d<f32>;
      //*Bilateral separable: peso gaussiano x distancia al plano del centro
      //(no cruza bordes de objeto ni pliegues).
      @fragment fn fs(in: VOut) -> @location(0) vec4f {
        let hp = vec2i(floor(in.p.xy));
        let maxH = vec2i(P.size.zw) - vec2i(1);
        let c = loadP(hp);
        let center = textureLoad(src, hp, 0).r;
        if (!c.ok) { return vec4f(center); }
        let N = loadN(hp);
        let dir = vec2i(D.d.xy);
        var sum = center;
        var wsum = 1.0;
        for (var k = -4; k <= 4; k++) {
          if (k == 0) { continue; }
          let hq = clamp(hp + dir * k, vec2i(0), maxH);
          let q = loadP(hq);
          if (!q.ok) { continue; }
          let fk = f32(k);
          let tol = c.upp * 2.0 * (abs(fk) + 1.0);
          let w = exp(-fk * fk / 8.0) * max(1.0 - abs(dot(q.pos - c.pos, N)) / tol, 0.0);
          sum += textureLoad(src, hq, 0).r * w;
          wsum += w;
        }
        return vec4f(sum / wsum);
      }
    ` });
    this.ssaoPipeline = this.fullscreen(ssaoModule, "fs", [{ format: "r8unorm" }]);
    this.blurPipeline = this.fullscreen(blurModule, "fs", [{ format: "r8unorm" }]);
  }

  /**
   * Pipelines que leen el G-buffer de resolucion completa. Con MSAA son
   * texture_multisampled_2d (textureLoad(t, p, muestra)); sin MSAA, texture_2d
   * (textureLoad(t, p, mip 0)): el mismo codigo con otro tipo.
   */
  private ensureFullPipes(samples: number) {
    const ms = samples > 1;
    if (this.fullPipes?.ms === ms && (!ms || this.samples === samples)) return;
    const tex = ms ? "texture_multisampled_2d<f32>" : "texture_2d<f32>";
    const module = this.device.createShaderModule({ code: `
      ${SSAO.COMMON}
      const NS = ${ms ? samples : 1};
      @group(0) @binding(1) var gPos: ${tex};
      @group(0) @binding(2) var gNrm: ${tex};
      @group(0) @binding(3) var aoSamp: sampler;
      @group(0) @binding(4) var aoTex: texture_2d<f32>;
      @group(0) @binding(5) var ambTex: ${tex};
      fn octDecode(e: vec2f) -> vec3f {
        let f = e * 2.0 - 1.0;
        var n = vec3f(f, 1.0 - abs(f.x) - abs(f.y));
        let t = max(-n.z, 0.0);
        n = vec3f(n.xy + select(vec2f(t), vec2f(-t), n.xy >= vec2f(0.0)), n.z);
        return normalize(n);
      }
      //*Reduccion: muestra 0 del texel de resolucion completa que representa
      //al de media (sin promediar: no mezcla bordes con el fondo).
      struct Out { @location(0) pos: vec4f, @location(1) nrm: vec4f };
      @fragment fn fsReduce(in: VOut) -> Out {
        let fp = clamp(vec2i(floor(in.p.xy)) * 2, vec2i(0), vec2i(P.size.xy) - vec2i(1));
        let a = textureLoad(gPos, fp, 0);
        if (a.w <= 0.0) { return Out(vec4f(0.0), vec4f(0.0)); }
        let n = octDecode(textureLoad(gNrm, fp, 0).xy);
        return Out(vec4f(a.xyz, a.w * 2.0), vec4f(n * 0.5 + 0.5, 1.0));
      }
      //*Factor por el que se multiplica el color final: 1 - ambiente x (1 - AO).
      @fragment fn fs(in: VOut) -> @location(0) vec4f {
        let ao = textureSample(aoTex, aoSamp, in.p.xy / P.size.xy).r;
        let p = vec2i(floor(in.p.xy));
        var amb = 0.0;
        for (var i = 0; i < NS; i++) { amb += textureLoad(ambTex, p, i).r; }
        amb /= f32(NS);
        return vec4f(vec3f(1.0 - amb * (1.0 - ao)), 1.0);
      }
      //*Debug: solo el AO a pantalla completa, en gris (blanco = sin oclusion;
      //tapa sprites y fondos, que no reciben AO).
      @fragment fn fsDebug(in: VOut) -> @location(0) vec4f {
        let ao = textureSample(aoTex, aoSamp, in.p.xy / P.size.xy).r;
        return vec4f(ao, ao, ao, 1.0);
      }
    ` });
    this.fullPipes = {
      ms,
      reduce: this.fullscreen(module, "fsReduce", [{ format: SSAO_GBUF_FORMAT }, { format: "rgba8unorm" }]),
      composite: this.fullscreen(module, "fs", [{
        format: this.format,
        blend: {
          color: { srcFactor: "zero", dstFactor: "src", operation: "add" },
          alpha: { srcFactor: "zero", dstFactor: "one", operation: "add" },
        },
      }]),
      debug: this.fullscreen(module, "fsDebug", [{ format: this.format }]),
    };
  }

  /** Recrea los targets si cambia tamano o MSAA. */
  ensureTargets(w: number, h: number, samples: number) {
    if (this.gPos && this.w === w && this.h === h && this.samples === samples) return;
    this.ensureFullPipes(samples);
    for (const t of [this.amb, this.gPos, this.gNrm, this.hPos, this.hNrm, this.aoRaw, this.aoTmp, this.aoOut]) t?.texture.destroy();
    const mk = (tw: number, th: number, format: GPUTextureFormat, sampleCount = 1): Target => {
      const texture = this.device.createTexture({
        size: [tw, th],
        format,
        sampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      return { texture, view: texture.createView() };
    };
    this.w = w;
    this.h = h;
    this.samples = samples;
    this.hw = Math.max(1, Math.ceil(w / 2));
    this.hh = Math.max(1, Math.ceil(h / 2));
    this.amb = mk(w, h, SSAO_AMB_FORMAT, samples);
    this.gPos = mk(w, h, SSAO_GBUF_FORMAT, samples);
    this.gNrm = mk(w, h, SSAO_NRM_FORMAT, samples);
    this.hPos = mk(this.hw, this.hh, SSAO_GBUF_FORMAT);
    this.hNrm = mk(this.hw, this.hh, "rgba8unorm");
    this.aoRaw = mk(this.hw, this.hh, "r8unorm");
    this.aoTmp = mk(this.hw, this.hh, "r8unorm");
    this.aoOut = mk(this.hw, this.hh, "r8unorm");
    const params = { binding: 0, resource: { buffer: this.paramsBuffer } };
    this.reduceBg = this.device.createBindGroup({
      layout: this.fullPipes!.reduce.getBindGroupLayout(0),
      entries: [params, { binding: 1, resource: this.gPos.view }, { binding: 2, resource: this.gNrm.view }],
    });
    const half = [params, { binding: 1, resource: this.hPos.view }, { binding: 2, resource: this.hNrm.view }];
    this.ssaoBg = this.device.createBindGroup({ layout: this.ssaoPipeline.getBindGroupLayout(0), entries: half });
    const blurBg = (dir: GPUBuffer, src: GPUTextureView) => this.device.createBindGroup({
      layout: this.blurPipeline.getBindGroupLayout(0),
      entries: [...half, { binding: 3, resource: { buffer: dir } }, { binding: 4, resource: src }],
    });
    this.blurHBg = blurBg(this.dirH, this.aoRaw.view);
    this.blurVBg = blurBg(this.dirV, this.aoTmp.view);
    //*"auto" solo incluye lo que usa cada entry point: un bind group por pipeline.
    const aoEntries = [params, { binding: 3, resource: this.sampler }, { binding: 4, resource: this.aoOut.view }];
    this.compositeBg = this.device.createBindGroup({
      layout: this.fullPipes!.composite.getBindGroupLayout(0),
      entries: [...aoEntries, { binding: 5, resource: this.amb.view }],
    });
    this.debugBg = this.device.createBindGroup({
      layout: this.fullPipes!.debug.getBindGroupLayout(0),
      entries: aoEntries,
    });
  }

  /** Attachments 2..4 del pase principal (limpios a 0, sin resolve). */
  mainAttachments(): GPURenderPassColorAttachment[] {
    const att = (t: Target): GPURenderPassColorAttachment =>
      ({ view: t.view, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" });
    return [att(this.amb!), att(this.gPos!), att(this.gNrm!)];
  }

  /**
   * Reduccion + SSAO + blur + composicion sobre dst (color ya resuelto del
   * pase principal). ts: timestamps opcionales (inicio de la reduccion, fin de
   * la composicion).
   */
  record(encoder: GPUCommandEncoder, dst: GPUTextureView, params: SSAOParams, debug: boolean,
    ts?: { querySet: GPUQuerySet; begin: number; end: number }) {
    const v = this.paramsValues;
    v[0] = params.radius;
    v[1] = params.intensity;
    v[2] = params.bias;
    v[3] = params.power;
    v[4] = this.w;
    v[5] = this.h;
    v[6] = this.hw;
    v[7] = this.hh;
    this.device.queue.writeBuffer(this.paramsBuffer, 0, v);
    const run = (pipeline: GPURenderPipeline, bg: GPUBindGroup, targets: GPURenderPassColorAttachment[], w: number, h: number, tsw?: GPURenderPassTimestampWrites) => {
      const pass = encoder.beginRenderPass({ colorAttachments: targets, ...(tsw ? { timestampWrites: tsw } : {}) });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bg);
      pass.setViewport(0, 0, w, h, 0, 1);
      pass.draw(3);
      pass.end();
    };
    const half = (view: GPUTextureView): GPURenderPassColorAttachment =>
      ({ view, loadOp: "clear", clearValue: { r: 1, g: 1, b: 1, a: 1 }, storeOp: "store" });
    const fp = this.fullPipes!;
    run(fp.reduce, this.reduceBg!, [half(this.hPos!.view), half(this.hNrm!.view)], this.hw, this.hh,
      ts ? { querySet: ts.querySet, beginningOfPassWriteIndex: ts.begin } : undefined);
    run(this.ssaoPipeline, this.ssaoBg!, [half(this.aoRaw!.view)], this.hw, this.hh);
    run(this.blurPipeline, this.blurHBg!, [half(this.aoTmp!.view)], this.hw, this.hh);
    run(this.blurPipeline, this.blurVBg!, [half(this.aoOut!.view)], this.hw, this.hh);
    run(debug ? fp.debug : fp.composite, debug ? this.debugBg! : this.compositeBg!,
      [{ view: dst, loadOp: "load", storeOp: "store" }], this.w, this.h,
      ts ? { querySet: ts.querySet, endOfPassWriteIndex: ts.end } : undefined);
  }
}
