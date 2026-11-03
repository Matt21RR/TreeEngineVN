import DualKawaseBlur from "./DualKawaseBlur.ts";
import SSAO, { SSAO_AMB_FORMAT, SSAO_GBUF_FORMAT, SSAO_NRM_FORMAT, SSAO_OCT_WGSL } from "./SSAO.ts";
import RgbSplit, { computeRgbSplitOffsets, RgbSplitOffsets, RgbSplitParams } from "./RgbSplit.ts";
import { PACKED_VERTEX_BYTES, type PackedGlbModel } from "./GlbPacker.ts";
import type { TexImageBC7 } from "./GlbTex.ts";
import type { PointLightData } from "./RenderEngine.d.tsx";
import { buildAxesVertices, buildGridUniform, GRID_FLOATS_PER_VERTEX, GRID_UNIFORM_FLOATS, MAX_GRID_VERTICES, type GridState, type GridView } from "./GridHelper.ts";

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
  /** Pixeles por unidad modelo (solo meshes): escala de los vertices objeto a px. */
  ppu?: number;
  /** Centro mundo de la instancia (solo meshes): base.x/y/z para V real. */
  wx?: number;
  wy?: number;
  wz?: number;
  /** Solo meshes en perspectiva relativa al ojo (mk > 0): centro relativo al
   *  ojo en unidades mundo (mvz = profundidad), px por unidad a Z = 1 (mk) y
   *  escala modelo->mundo (ms). Ver RenderingDimentions (meshView). */
  mvx?: number;
  mvy?: number;
  mvz?: number;
  mk?: number;
  ms?: number;
  /** Solo meshes: px por unidad modelo para elegir LOD (0 = nivel original). */
  lodPx?: number;
  fillColor?: [number, number, number, number];
  borderColor?: [number, number, number, number];
  borderWidth?: number;
  tileWidth?: number;
  tileHeight?: number;
}

type QueuedItem =
  | { type: 'image'; params: DrawParams }
  | { type: 'pattern'; params: DrawParams; mode: RepeatMode }
  | { type: 'rect'; params: DrawParams }
  | { type: 'mesh'; params: DrawParams };

type DrawCallRef = { id: string; firstInstance: number; count: number };

//*Variantes del pipeline de mallas: depth (opaco 1 cara) / ds (opaco 2 caras)
//blend y blendDS (transparentes: depth test sin write, lejos->cerca) / hud
//(bypass total de depth). mask/maskDS = MASK (alpha-to-coverage con MSAA).
//Cull back con frontFace por defecto (ccw): la conversion glTF->engine es una
//rotacion propia y la proyeccion no espeja, asi que el winding glTF se conserva.
//BLEND va en dos fases: blendPre/blendPreDS escriben profundidad solo con los
//fragmentos casi opacos (alfa >= 0.98) y blendBack/blendFront mezclan solo
//los translucidos sin escribirla (doble cara: traseras y luego frontales).
type MeshPipeKey = "depth" | "ds" | "mask" | "maskDS" | "blendPre" | "blendPreDS" | "blendBack" | "blendFront" | "hud";

//*Primitiva de un modelo ya subido: rango de indices + material. El material
//vive en el buffer de materiales del modelo (offset dinamico `matOffset`);
//los campos alpha/ds solo eligen la variante de pipeline en CPU.
type GpuMeshPrim = {
  firstIndex: number;
  indexCount: number;
  textureId: string | null;
  emissiveTextureId: string | null;
  transmissionTextureId: string | null;
  /** Niveles de LOD (de menos a mas simples; error absoluto en unidades modelo). */
  lods?: Array<{ firstIndex: number; indexCount: number; error: number }>;
  /** Texturas lineales de PBR (null = blanco/sin mapa). */
  mrTextureId: string | null;
  occTextureId: string | null;
  normalTextureId: string | null;
  matOffset: number;
  alpha: number;
  ds: boolean;
};

//*Uniform de material por primitiva (MeshMat del shader), 240 B:
//factor(4) + [metallic, roughness, cutoff, alphaMode](4) +
//[emissive.rgb, transmission](4) + tcA [texCoord base, emisivo, mr, occ](4) +
//tcB [texCoord normal, transmision, normalScale, occStrength](4) +
//flags [hasNormalMap, hasMR, hasOcc, 0](4) +
//tx: 6 matrices 2x3 de KHR_texture_transform (36 floats, slots base, emisivo,
//mr, occ, normal, transmision) = 240 B (cabe en el stride de 256).
const MESH_MAT_FLOATS = 60;
const MESH_MAT_TX = 24;
const IDENTITY_TX: [number, number, number, number, number, number] = [1, 0, 0, 0, 1, 0];
const MESH_MAT_BYTES = MESH_MAT_FLOATS * 4;

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
  //*Pipeline de mallas 3D (modelos GLB estaticos; unlit/Lambert/Phong por
  //uniform global): vertices objeto reales en vez de quads. depth igual
  //que sprites para oclusion coherente. Ver MeshPipeKey para variantes.
  private meshPipes!: Record<MeshPipeKey, GPURenderPipeline>;
  //*Layout explicito compartido por las 7 variantes: un solo bind group por
  //grupo sirve para todas, y el grupo 2 (material) admite offset dinamico.
  //Se crea una vez por device (los bind groups de modelos ya subidos
  //siguen validos al recrear pipelines por cambio de MSAA).
  private meshBgls: GPUBindGroupLayout[] | null = null;
  private meshPipelineLayout!: GPUPipelineLayout;
  private meshGlobalBg!: GPUBindGroup;
  private meshLightBg!: GPUBindGroup;
  //*Stride de cada material en el buffer por modelo (>= 48 B y alineado a
  //minUniformBufferOffsetAlignment, normalmente 256).
  private meshMatStride = 256;
  //*Grid 3D de ayuda (line-list, vertices ya en clip-space desde
  //GridHelper): se dibuja primero para que la escena lo ocluya.
  private gridPipeline!: GPURenderPipeline;
  private gridVertexBuffer!: GPUBuffer;
  //*Grid infinito procedural (fullscreen): raycast al plano en el fragment
  //shader con fade por distancia (estilo Blender). Sin limite de vertices
  //ni alcance. El fs es funcion unica a proposito (asi era la version que
  //renderizaba bien; los helpers separados rompieron la compilacion).
  private gridInfPipeline!: GPURenderPipeline;
  private gridUniformBuffer!: GPUBuffer;
  private gridUniformValues = new Float32Array(GRID_UNIFORM_FLOATS);
  private gridInfBindGroup!: GPUBindGroup;
  //*El pipeline solo se usa cuando su compilacion reporta exito: un shader
  //invalido deja el grid apagado en vez de tumbar todo el canvas a negro.
  private gridInfReady = false;
  private gridState: GridState | null = null;
  private gridView: GridView | null = null;

  //*view = vista de muestreo de color (sRGB en texturas de modelos);
  //linearView = misma textura sin conversion (mapas de datos: MR, AO, normal).
  private textureCache = new Map<string, { texture: GPUTexture; view: GPUTextureView; linearView: GPUTextureView; bindGroup: GPUBindGroup; patternBindGroup: GPUBindGroup; noDepthBindGroup: GPUBindGroup; noDepthPatternBindGroup: GPUBindGroup }>();
  //*Modelos GLB subidos a GPU: un vertex/index buffer por modelo con sus
  //primitivas como rangos de indices (una drawIndexed por primitiva).
  private meshCache = new Map<string, {
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexFormat: GPUIndexFormat;
    //*Materiales de todas las primitivas (uno por stride), escritos una vez.
    materialBuffer: GPUBuffer;
    materialBg: GPUBindGroup;
    primitives: GpuMeshPrim[];
    //*VRAM estimada del modelo (buffers + texturas RGBA8 con mips).
    gpuBytes: number;
  }>();
  //*performance.now() del ultimo frame en que se dibujo cada modelo (LRU de
  //VRAM en ModelManager: nunca se expulsa lo que se esta viendo).
  private meshLastDrawn = new Map<string, number>();
  //*Textura blanca 1x1 para primitivas sin textura (unlit * factor).
  private whiteTextureId: string | null = null;
  //*Sampler de escena con filtrado anisotropico (solo image/pattern).
  //mipmapFilter linear siempre: con anisotropia 1 queda trilineal.
  private sampler!: GPUSampler;
  private _anisotropyLevel: number = 2;
  private maxAnisotropyCap: number = 16;

  //*Iluminacion de mallas 3D: 0 = unlit (look actual), 1 = Lambert
  //(difuso), 2 = Phong (difuso + especular). Global de camara, como
  //anisotropia: un uniform por frame, sin rebuild de pipelines.
  //+ hasta MAX_POINT_LIGHTS puntuales (color, intensidad, rango con
  //atenuacion 1/d^2 con ventana glTF) que acumulan difuso (+ especular en
  //Phong).
  private _lightingMode: number = 0;
  private _lightAzim: number = 0.6;
  private _lightElev: number = 0.8;
  private _lightAmbient: number = 0.35;
  private _lightShininess: number = 32;
  private _lightSpec: number = 0.5;
  /** Nº maximo de puntuales en el uniform (array fijo WGSL). */
  static readonly MAX_POINT_LIGHTS = 4;

  //*Recursos para generar mipmaps en GPU (blit lineal clamp-to-edge).
  private mipSampler!: GPUSampler;
  private mipPipeline!: GPURenderPipeline;

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

  //*Filtrado anisotropico de escena (image/pattern). 0/1 = off (mip 0,
  //look original sin mipmaps), 2/4/8/16 = maxAnisotropy (clamp al limite
  //del adapter). Default 2.
  setAnisotropyLevel(level: number) {
    const normalized = !level || level <= 1 ? 1 : Math.min(Math.floor(level), 16);
    const allowed = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 4 ? 4 : normalized <= 8 ? 8 : 16;
    if (allowed === this._anisotropyLevel && this.sampler) return;
    this._anisotropyLevel = allowed;
    if (!this.device) return;
    this.sampler = this.createSceneSampler();
    this.rebuildSceneBindGroups();
  }

  get anisotropyLevel() {
    return this._anisotropyLevel;
  }

  //*Modo de iluminacion de mallas: 0 = unlit, 1 = Lambert, 2 = Phong.
  setLightingMode(mode: number) {
    const m = mode === 3 ? 3 : mode === 2 ? 2 : mode === 1 ? 1 : 0;
    this._lightingMode = m;
    this.pushLightingUniform();
  }

  get lightingMode() {
    return this._lightingMode;
  }

  //*Parametros de la luz direccional global (azim/elev en radianes:
  //azim = giro en XZ desde -Z, elev = altura sobre XZ, up = -Y).
  setLightingParams(params: { azim?: number; elev?: number; ambient?: number; shininess?: number; specStrength?: number; intensity?: number }) {
    if (params.intensity !== undefined && Number.isFinite(params.intensity)) this._lightIntensity = Math.max(params.intensity, 0);
    if (params.azim !== undefined && Number.isFinite(params.azim)) this._lightAzim = params.azim;
    if (params.elev !== undefined && Number.isFinite(params.elev)) this._lightElev = params.elev;
    if (params.ambient !== undefined && Number.isFinite(params.ambient)) this._lightAmbient = Math.min(Math.max(params.ambient, 0), 1);
    if (params.shininess !== undefined && Number.isFinite(params.shininess)) this._lightShininess = Math.min(Math.max(params.shininess, 1), 256);
    if (params.specStrength !== undefined && Number.isFinite(params.specStrength)) this._lightSpec = Math.min(Math.max(params.specStrength, 0), 2);
    this.pushLightingUniform();
  }

  //*Ojo de camara en mundo (para V = normalize(eye - fragWorld)).
  setLightingEye(x: number, y: number, z: number) {
    this.lightingValues[8] = x;
    this.lightingValues[9] = y;
    this.lightingValues[10] = z;
    if (!this.device || !this.lightingBuffer) return;
    this.device.queue.writeBuffer(this.lightingBuffer, 0, this.lightingValues);
  }

  //*Puntuales de escena (fase 1, sin sombras): se copian tal cual al uniform
  //(max MAX_POINT_LIGHTS; el resto se ignora). range<=0 o intensidad 0 =
  //luz apagada. Coordenadas en mundo engine (mismo espacio que fragWorld).
  setPointLights(lights: PointLightData[] | null | undefined) {
    const list = Array.isArray(lights) ? lights : [];
    const n = Math.min(list.length, WebGPUCanvas.MAX_POINT_LIGHTS);
    this.lightingValues[12] = n;
    this.writePointMetaExtras();
    for (let k = 0; k < WebGPUCanvas.MAX_POINT_LIGHTS; k++) {
      const o = 16 + k * 8;
      const L = k < n ? list[k] : null;
      const fx = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
      this.lightingValues[o] = fx(L?.x);
      this.lightingValues[o + 1] = fx(L?.y);
      this.lightingValues[o + 2] = fx(L?.z);
      this.lightingValues[o + 3] = L ? Math.max(fx(L.range), 0) : 0;
      this.lightingValues[o + 4] = Math.max(fx(L?.r), 0);
      this.lightingValues[o + 5] = Math.max(fx(L?.g), 0);
      this.lightingValues[o + 6] = Math.max(fx(L?.b), 0);
      this.lightingValues[o + 7] = Math.max(fx(L?.intensity), 0);
    }
    if (!this.device || !this.lightingBuffer) return;
    this.device.queue.writeBuffer(this.lightingBuffer, 0, this.lightingValues);
  }

  //*Grid 3D de ayuda: solo guarda el estado/vista; los vértices se
  //reconstruyen en cada render() (la cámara orbita cada frame).
  setGridState(state: GridState | null, view: GridView | null) {
    this.gridState = state;
    this.gridView = view;
  }

  //*Diagnostico de mallas (solo herramientas/harness): forceOpaque dibuja
  //todo con los pipelines opacos; showAlpha pinta el alfa muestreado en gris
  //(viaja en pointMeta.y del uniform de luz, sin coste si esta apagado).
  private meshDebug = { forceOpaque: false, showAlpha: false };
  //*Bloom de mallas (ver setBloom): el umbral viaja en el uniform de luz.
  private bloom = { enabled: false, threshold: 1, intensity: 0.6, radius: 4 };
  //*true = pipelines/targets con el 2o attachment de bloom (recrearlos cuesta:
  //solo cambia al activar/desactivar, no al ajustar parametros).
  private bloomEnabled = false;
  private bloomKawase = new DualKawaseBlur();
  private bloomMsaaTexture: GPUTexture | null = null;
  private bloomMsaaView: GPUTextureView | null = null;
  private bloomOut: { texture: GPUTexture; view: GPUTextureView; w: number; h: number } | null = null;
  private bloomCompositePipeline!: GPURenderPipeline;
  private bloomCompositeUniform!: GPUBuffer;
  private bloomCompositeValues = new Float32Array(4);
  private bloomCompositeBg: GPUBindGroup | null = null;

  /** Bloom de mallas 3D (null/enabled false = apagado, coste cero). */
  setBloom(b: { enabled?: boolean; threshold?: number; intensity?: number; radius?: number } | null) {
    const fin = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    const next = {
      enabled: !!b?.enabled,
      threshold: Math.max(fin(b?.threshold, 1), 0),
      intensity: Math.max(fin(b?.intensity, 0.6), 0),
      radius: Math.max(fin(b?.radius, 4), 1),
    };
    const cur = this.bloom;
    if (cur.enabled === next.enabled && cur.threshold === next.threshold && cur.intensity === next.intensity && cur.radius === next.radius) return;
    this.bloom = next;
    if (cur.threshold !== next.threshold) {
      this.writePointMetaExtras();
      this.pushLightingUniform();
    }
    const enabled = next.enabled && next.intensity > 0;
    if (enabled === this.bloomEnabled) return;
    this.bloomEnabled = enabled;
    if (!this.device) return;
    //mismo recorrido que setMsaa: pipelines + bind groups + targets nuevos
    this.gridInfReady = false;
    this.createPipelines();
    this.rebuildSceneBindGroups();
    this.depthW = 0;
    this.depthH = 0;
  }
  //*SSAO de mallas (ver SSAO.ts): radio en unidades mundo. Sin prepass: el
  //pase principal escribe 3 attachments extra y despues se compone. Como
  //bloom, activar/desactivar recrea pipelines (los parametros no).
  private ssao = new SSAO();
  private ao = { enabled: false, radius: 0.05, intensity: 1, bias: 0.02, power: 1.5, debug: false };
  //*true = pipelines/attachments con los targets del SSAO.
  private aoActive = false;

  /** Oclusion ambiental (SSAO) de modelos 3D (null/enabled false = apagado, coste cero). */
  setAmbientOcclusion(a: { enabled?: boolean; radius?: number; intensity?: number; bias?: number; power?: number; debug?: boolean } | null) {
    const fin = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    this.ao = {
      enabled: !!a?.enabled,
      radius: Math.max(fin(a?.radius, 0.05), 1e-4),
      intensity: Math.max(fin(a?.intensity, 1), 0),
      bias: Math.min(Math.max(fin(a?.bias, 0.02), 0), 0.9),
      power: Math.min(Math.max(fin(a?.power, 1.5), 0.1), 8),
      debug: !!a?.debug,
    };
    if (!this.device) return;
    const active = this.ao.enabled && (this.ao.intensity > 0 || this.ao.debug);
    if (active === this.aoActive) return;
    this.aoActive = active;
    //mismo recorrido que setBloom: pipelines + bind groups + targets nuevos
    this.gridInfReady = false;
    this.createPipelines();
    this.rebuildSceneBindGroups();
    this.depthW = 0;
    this.depthH = 0;
  }

  setMeshDebug(debug: { forceOpaque?: boolean; showAlpha?: boolean }) {
    this.meshDebug = { forceOpaque: !!debug.forceOpaque, showAlpha: !!debug.showAlpha };
    this.writePointMetaExtras();
    if (!this.device || !this.lightingBuffer) return;
    this.device.queue.writeBuffer(this.lightingBuffer, 0, this.lightingValues);
  }

  //*Tonemapping de mallas (solo modelos 3D: sprites/UI no pasan por aqui).
  //0 = none (clamp, look historico), 1 = ACES, 2 = AgX, 3 = Khronos PBR Neutral.
  private _toneMode = 0;
  private _exposure = 1;
  private _lightIntensity = 1;
  setToneMapping(mode: string | number) {
    const m = typeof mode === "number" ? mode : ({ none: 0, aces: 1, agx: 2, neutral: 3 } as Record<string, number>)[mode] ?? 0;
    const next = m >= 0 && m <= 3 ? Math.trunc(m) : 0;
    if (next === this._toneMode) return;
    this._toneMode = next;
    this.writePointMetaExtras();
    this.pushLightingUniform();
  }
  setExposure(exposure: number) {
    const e = Number.isFinite(exposure) && exposure > 0 ? exposure : 1;
    if (e === this._exposure) return;
    this._exposure = e;
    this.pushLightingUniform();
  }
  //*pointMeta.yzw del uniform de luz: [debug alpha, toneMode, bloomThreshold].
  private writePointMetaExtras() {
    this.lightingValues[13] = this.meshDebug.showAlpha ? 1 : 0;
    this.lightingValues[14] = this._toneMode;
    this.lightingValues[15] = this.bloom.threshold;
  }

  private lightDirInto(out: Float32Array, base: number) {
    const ce = Math.cos(this._lightElev), se = Math.sin(this._lightElev);
    const sa = Math.sin(this._lightAzim), ca = Math.cos(this._lightAzim);
    out[base] = sa * ce;
    out[base + 1] = -se;
    out[base + 2] = -ca * ce;
  }

  private pushLightingUniform() {
    this.lightingValues[0] = this._lightingMode;
    this.lightingValues[1] = this._lightAmbient;
    this.lightingValues[2] = this._lightShininess;
    this.lightingValues[3] = this._lightSpec;
    this.lightDirInto(this.lightingValues, 4);
    this.lightingValues[7] = this._lightIntensity; // lightDir.w = intensidad direccional (PBR)
    this.lightingValues[11] = this._exposure;      // eye.w = exposicion (tonemapping de mallas)
    if (!this.device || !this.lightingBuffer) return;
    this.device.queue.writeBuffer(this.lightingBuffer, 0, this.lightingValues);
  }

  private effectiveAnisotropy(): number {
    if (this._anisotropyLevel <= 1) return 1;
    return Math.min(this._anisotropyLevel, this.maxAnisotropyCap || 16);
  }

  private createSceneSampler(): GPUSampler {
    //*Off (0/1): look original previo a la feature. lod clamp a 0 fuerza el
    //mip 0 (la imagen base intacta) y desactiva el filtrado entre mips:
    //mismo muestreo que cuando las texturas tenian un solo nivel.
    if (this._anisotropyLevel <= 1) {
      return this.device.createSampler({
        magFilter: "linear", minFilter: "linear", mipmapFilter: "nearest",
        maxAnisotropy: 1,
        lodMinClamp: 0, lodMaxClamp: 0,
        addressModeU: "repeat", addressModeV: "repeat",
      });
    }
    return this.device.createSampler({
      magFilter: "linear", minFilter: "linear", mipmapFilter: "linear",
      maxAnisotropy: this.effectiveAnisotropy(),
      lodMinClamp: 0, lodMaxClamp: 32,
      addressModeU: "repeat", addressModeV: "repeat",
    });
  }

  private rebuildSceneBindGroups() {
    for (const entry of this.textureCache.values()) {
      entry.bindGroup = this.device.createBindGroup({
        layout: this.texturePipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: this.sampler }, { binding: 1, resource: entry.view }],
      });
      entry.patternBindGroup = this.device.createBindGroup({
        layout: this.patternPipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: this.sampler }, { binding: 1, resource: entry.view }],
      });
      entry.noDepthBindGroup = this.device.createBindGroup({
        layout: this.textureNoDepthPipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: this.sampler }, { binding: 1, resource: entry.view }],
      });
      entry.noDepthPatternBindGroup = this.device.createBindGroup({
        layout: this.patternNoDepthPipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: this.sampler }, { binding: 1, resource: entry.view }],
      });
    }
    //*Los bind groups mesh cachean el sampler viejo: se recrean bajo demanda.
    this.meshMaterialBindGroups.clear();
  }

  private imageInstanceBuffer!: GPUBuffer;
  private patternInstanceBuffer!: GPUBuffer;
  private rectInstanceBuffer!: GPUBuffer;
  private meshInstanceBuffer!: GPUBuffer;

  private worldDataBuffer!: GPUBuffer;
  //rotation(4) + cameraOrigin(4) + depthParams[near, invFar, 0, 0](4)
  private worldDataValues = new Float32Array(12);

  //*Uniform global de iluminacion (solo meshes):
  //[mode, ambient, shininess, spec] + [lightDir.xyz, 0] + [eye.xyz, 0] +
  //[pointCount, 0, 0, 0] + MAX_POINT_LIGHTS x ([pos.xyz, range] + [rgb, intensity])
  //= 12 + 4 + 4*8 = 48 floats = 192 B.
  private lightingBuffer!: GPUBuffer;
  private lightingValues = new Float32Array(48);

  //*Depth buffer para oclusion por fragmento (siempre tamano del canvas)
  private depthTexture: GPUTexture | null = null;
  private depthView: GPUTextureView | null = null;
  private depthW = 0;
  private depthH = 0;
  //*MSAA: color multisample del pase principal (se resuelve a passView).
  //sampleCount fijo desde init(): los pipelines (layout auto) y todos sus
  //bind groups dependen de el, cambiarlo en caliente obliga a recrearlos.
  private sampleCount: 1 | 4 = 4;
  private msaaColorTexture: GPUTexture | null = null;
  private msaaColorView: GPUTextureView | null = null;

  //*Persistent CPU-side staging (no per-frame allocations)
  private imageStaging!: Float32Array;
  private patternStaging!: Float32Array;
  private rectStaging!: Float32Array;
  private meshStaging!: Float32Array;

  //*Bind groups are fixed per pipeline+buffer pair, created once at init
  private imageGlobalBindGroup!: GPUBindGroup;
  private patternGlobalBindGroup!: GPUBindGroup;
  private rectGlobalBindGroup!: GPUBindGroup;
  private imageNoDepthBindGroup!: GPUBindGroup;
  private patternNoDepthBindGroup!: GPUBindGroup;
  private rectNoDepthBindGroup!: GPUBindGroup;
  //*(grupos 0/3 de mallas: meshGlobalBg/meshLightBg; grupo 2 por modelo)

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
  private meshUsed = 0;

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
    sampleCount: 1 as number,
    //*Tiempos del ultimo frame: encodeMs = CPU de render() (codificar
    //comandos); gpuPassMs = GPU del pase principal (timestamp-query; -1 si
    //el adaptador no la soporta). Lo lee el benchmark del harness.
    //aoMs = GPU de SSAO + blur + composicion (pases posteriores al principal);
    //aoSpanMs = desde el inicio del pase principal hasta el fin de la composicion
    //(incluye lo que el driver hace entre pases: resolves, transiciones).
    timing: { encodeMs: 0, gpuPassMs: -1, aoMs: -1, aoSpanMs: -1 },
  };
  //*Timestamps de GPU del pase principal (feature opcional timestamp-query):
  //se leen de forma asincrona con varios buffers de lectura (sin bloquear el
  //frame; si todos estan ocupados, ese frame no se mide).
  private ts: { querySet: GPUQuerySet; resolve: GPUBuffer; readbacks: GPUBuffer[]; busy: boolean[] } | null = null;
  /** El dispositivo admite texturas BC (bc7-rgba-unorm). */
  supportsBC = false;

  async init(context: GPUCanvasContext, opts?: { msaa?: 1 | 4 }) {
    this.context = context;
    this.sampleCount = opts?.msaa === 1 ? 1 : 4;
    this.diag.sampleCount = this.sampleCount;

    const adapter = await navigator.gpu.requestAdapter();
    const hasTimestamps = !!adapter?.features.has("timestamp-query");
    //*BC (BC7): texturas comprimidas de modelos (cache .tex). Escritorio: siempre.
    this.supportsBC = !!adapter?.features.has("texture-compression-bc");
    const requiredFeatures: GPUFeatureName[] = [];
    if (hasTimestamps) requiredFeatures.push("timestamp-query");
    if (this.supportsBC) requiredFeatures.push("texture-compression-bc");
    this.device = await adapter!.requestDevice({ requiredFeatures });
    if (hasTimestamps) {
      this.ts = {
        querySet: this.device.createQuerySet({ type: "timestamp", count: 4 }),
        resolve: this.device.createBuffer({ size: 32, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }),
        readbacks: [0, 1, 2].map(() => this.device.createBuffer({ size: 32, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST })),
        busy: [false, false, false],
      };
    }
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });

    this.maxAnisotropyCap = Math.max((adapter?.limits as any)?.maxSamplerAnisotropy ?? 16, 1);
    this.sampler = this.createSceneSampler();
    this.mipSampler = this.device.createSampler({
      magFilter: "linear", minFilter: "linear", mipmapFilter: "linear",
      addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge",
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
    this.ssao.init(this.device, this.format);
    this.createPipelines();
    this.dualKawase.init(this.device, this.format);
    this.bloomKawase.init(this.device, "rgba16float");
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
    this.meshInstanceBuffer = this.device.createBuffer(bufDesc);
    this.lightingBuffer = this.device.createBuffer({
      size: 192,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.pushLightingUniform();

    this.imageStaging   = new Float32Array(this.MAX_INSTANCES * this.FLOATS_PER_INSTANCE);
    this.patternStaging = new Float32Array(this.MAX_INSTANCES * this.FLOATS_PER_INSTANCE);
    this.rectStaging    = new Float32Array(this.MAX_INSTANCES * this.RECT_FLOATS_PER_INSTANCE);
    this.meshStaging    = new Float32Array(this.MAX_INSTANCES * this.FLOATS_PER_INSTANCE);

    //*Grid: line-list con clipPos vec4 + color vec4 por vértice.
    this.gridVertexBuffer = this.device.createBuffer({
      size: MAX_GRID_VERTICES * GRID_FLOATS_PER_VERTEX * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    //*Grid infinito: uniforme reconstruido por frame (112 B).
    this.gridUniformBuffer = this.device.createBuffer({
      size: GRID_UNIFORM_FLOATS * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.worldDataBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  //Crea o recrea depth (+ color MSAA si sampleCount > 1) al tamano del
  //canvas (lazy: el resize de canvas no siempre reconfigura el contexto,
  //asi se evita mismatch). Ambos con el mismo sampleCount que los pipelines.
  private ensureTargets(w: number, h: number) {
    if (this.depthTexture && this.depthW === w && this.depthH === h) return;
    if (this.depthTexture) this.depthTexture.destroy();
    if (this.msaaColorTexture) this.msaaColorTexture.destroy();
    this.depthTexture = this.device.createTexture({
      size: [w, h],
      format: "depth24plus",
      sampleCount: this.sampleCount,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthView = this.depthTexture.createView();
    if (this.sampleCount > 1) {
      this.msaaColorTexture = this.device.createTexture({
        size: [w, h],
        format: this.format,
        sampleCount: this.sampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.msaaColorView = this.msaaColorTexture.createView();
    } else {
      this.msaaColorTexture = null;
      this.msaaColorView = null;
    }
    if (this.bloomMsaaTexture) { this.bloomMsaaTexture.destroy(); this.bloomMsaaTexture = null; this.bloomMsaaView = null; }
    if (this.bloomEnabled && this.sampleCount > 1) {
      this.bloomMsaaTexture = this.device.createTexture({
        size: [w, h],
        format: "rgba16float",
        sampleCount: this.sampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.bloomMsaaView = this.bloomMsaaTexture.createView();
    }
    this.depthW = w;
    this.depthH = h;
  }

  get msaa() {
    return this.sampleCount;
  }

  //*Cambio de MSAA en caliente: coste unico (recompilar pipelines + bind
  //groups, que con layout auto dependen de ellos), cero coste por frame.
  setMsaa(samples: 1 | 4) {
    const next: 1 | 4 = samples === 1 ? 1 : 4;
    if (next === this.sampleCount) return;
    this.sampleCount = next;
    this.diag.sampleCount = next;
    if (!this.device) return;
    //el grid infinito vuelve a validarse con el pipeline nuevo
    this.gridInfReady = false;
    this.createPipelines();
    this.rebuildSceneBindGroups();
    //fuerza a ensureTargets a recrear depth/color MSAA con el nuevo sampleCount
    this.depthW = 0;
    this.depthH = 0;
  }

  async preloadImage(image: ImageBitmap, id: string, opts?: { srgb?: boolean }) {
    //*Bitmap vacio (0x0: decodificacion fantasma que no lanza): createTexture
    //con Extent3D vacio es invalida y envenena el submit. Se omite con aviso.
    if (!image || image.width <= 0 || image.height <= 0) {
      console.warn(`WebGPUCanvas.preloadImage('${id}'): bitmap ${image?.width ?? "?"}x${image?.height ?? "?"} vacio (omitido).`);
      return;
    }
    const mipLevelCount = Math.max(Math.floor(Math.log2(Math.max(image.width, image.height))) + 1, 1);
    //*srgb (texturas de color de modelos 3D): se almacena unorm (los mips se
    //generan igual que siempre) y se muestrea por una vista -srgb, de modo
    //que el shader de mallas recibe color lineal para iluminar.
    const texture: GPUTexture = this.device.createTexture({
      size: [image.width, image.height],
      format: "rgba8unorm",
      viewFormats: opts?.srgb ? ["rgba8unorm-srgb"] : [],
      mipLevelCount,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture(
      { source: image, flipY: false },
      { texture, mipLevel: 0 },
      [image.width, image.height]
    );
    if (mipLevelCount > 1) this.generateMipmaps(texture, image.width, image.height, mipLevelCount);
    this.registerTexture(id, texture, opts?.srgb ? "rgba8unorm-srgb" : null);
  }

  //*Textura BC7 ya codificada (cache .tex, ver GlbTex): niveles de mip
  //concatenados, subidos tal cual (sin generar mips). Mismo registro y vistas
  //sRGB/lineal que preloadImage.
  preloadCompressedImage(tex: TexImageBC7, id: string, opts?: { srgb?: boolean }) {
    const texture = this.device.createTexture({
      size: [tex.width, tex.height],
      format: "bc7-rgba-unorm",
      viewFormats: opts?.srgb ? ["bc7-rgba-unorm-srgb"] : [],
      mipLevelCount: tex.levels,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    let off = 0;
    for (let l = 0; l < tex.levels; l++) {
      //tamano fisico en bloques 4x4 (los mips < 4 px ocupan un bloque)
      const bw = Math.ceil(Math.max(1, tex.width >> l) / 4), bh = Math.ceil(Math.max(1, tex.height >> l) / 4);
      const bytes = bw * bh * 16;
      this.device.queue.writeTexture(
        { texture, mipLevel: l },
        tex.data.subarray(off, off + bytes),
        { bytesPerRow: bw * 16, rowsPerImage: bh },
        [bw * 4, bh * 4],
      );
      off += bytes;
    }
    this.registerTexture(id, texture, opts?.srgb ? "bc7-rgba-unorm-srgb" : null);
  }

  private registerTexture(id: string, texture: GPUTexture, srgbFormat: GPUTextureFormat | null) {
    //*La vista cubre toda la cadena de mips: el sampler trilineal/anisotropico
    //elige el lod por derivadas (mejora angulos rasantes en pitch/yaw).
    const view = texture.createView(srgbFormat ? { format: srgbFormat } : undefined);

    const prev = this.textureCache.get(id);
    if (prev) prev.texture.destroy();
    //*El bind group mesh cacheado referenciaba la vista vieja: invalidar.
    //Clave combinada base|emisivo: se vacia entera (recargas puntuales).
    this.meshMaterialBindGroups.clear();
    const mkTexBg = (layout: GPUBindGroupLayout) => this.device.createBindGroup({
      layout,
      entries: [{ binding: 0, resource: this.sampler }, { binding: 1, resource: view }],
    });
    //*Un grupo por pipeline: compartir bind groups entre pipelines con
    //layout "auto" invalida el command buffer (uncaptured error por frame).
    this.textureCache.set(id, {
      texture,
      view,
      linearView: srgbFormat ? texture.createView() : view,
      bindGroup: mkTexBg(this.texturePipeline.getBindGroupLayout(1)),
      patternBindGroup: mkTexBg(this.patternPipeline.getBindGroupLayout(1)),
      noDepthBindGroup: mkTexBg(this.textureNoDepthPipeline.getBindGroupLayout(1)),
      noDepthPatternBindGroup: mkTexBg(this.patternNoDepthPipeline.getBindGroupLayout(1)),
    });
  }

  //*Downsample en GPU: mip i se renderiza desde mip i-1 con filtro lineal.
  //La textura ya tiene RENDER_ATTACHMENT, asi que cada nivel es renderizable.
  private generateMipmaps(texture: GPUTexture, w: number, h: number, mipLevelCount: number) {
    if (!this.mipPipeline || mipLevelCount <= 1) return;
    const encoder = this.device.createCommandEncoder();
    for (let i = 1; i < mipLevelCount; i++) {
      const srcView = texture.createView({ baseMipLevel: i - 1, mipLevelCount: 1 });
      const dstView = texture.createView({ baseMipLevel: i, mipLevelCount: 1 });
      const dstW = Math.max(1, Math.floor(w / (1 << i)));
      const dstH = Math.max(1, Math.floor(h / (1 << i)));
      const bg = this.device.createBindGroup({
        layout: this.mipPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: this.mipSampler }, { binding: 1, resource: srcView }],
      });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: dstView,
          loadOp: "clear",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: "store",
        }],
      });
      pass.setPipeline(this.mipPipeline);
      pass.setBindGroup(0, bg);
      pass.setVertexBuffer(0, this.vertexBuffer);
      pass.setViewport(0, 0, dstW, dstH, 0, 1);
      pass.draw(6);
      pass.end();
    }
    this.device.queue.submit([encoder.finish()]);
  }

  queueImage(params: DrawParams) {
    this.queue.push({ type: 'image', params });
  }

  queueMesh(params: DrawParams) {
    this.queue.push({ type: 'mesh', params });
  }

  //*Sube un modelo GLB ya empaquetado (GlbPacker) a GPU: un vertex/index
  //buffer por modelo + un buffer con los materiales de todas sus primitivas
  //(escrito UNA vez; en render se elige con offset dinamico). `bitmaps` mapea
  //indice de imagen del modelo -> ImageBitmap (decodificado en el worker).
  async preloadModel(id: string, model: PackedGlbModel, bitmaps: Map<number, ImageBitmap>, compressed?: Map<number, TexImageBC7>) {
    //*Si se recarga el mismo id, liberar primero lo anterior (incluidas
    //texturas cuyo indice ya no exista en la version nueva).
    if (this.meshCache.has(id)) this.unloadModel(id);
    //*baseColor y emisivo son sRGB en glTF (unicos mapas soportados).
    for (const [imgIdx, bmp] of bitmaps) {
      await this.preloadImage(bmp, `mdl:${id}:img${imgIdx}`, { srgb: true });
    }
    let texBytes = 0;
    for (const bmp of bitmaps.values()) texBytes += bmp.width * bmp.height * 4 * 4 / 3;
    if (compressed) {
      for (const [imgIdx, tex] of compressed) {
        if (!this.supportsBC) continue; //no deberia llegar: ModelManager no las pide sin BC
        this.preloadCompressedImage(tex, `mdl:${id}:img${imgIdx}`, { srgb: true });
        texBytes += tex.data.byteLength;
      }
    }
    await this.ensureWhiteTexture();

    const vertexBuffer = this.device.createBuffer({
      size: Math.max(model.vData.byteLength, 4),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    //*Copia por bytes: el float 14 de cada vertice son los 4 bytes del color
    //(un patron NaN no debe pasar por conversiones de float).
    new Uint8Array(vertexBuffer.getMappedRange(0, model.vData.byteLength))
      .set(new Uint8Array(model.vData.buffer, model.vData.byteOffset, model.vData.byteLength));
    vertexBuffer.unmap();
    const indexBuffer = this.device.createBuffer({
      size: Math.max(model.iData.byteLength, 4),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const iRange = indexBuffer.getMappedRange(0, model.iData.byteLength);
    if (model.indexFormat === "uint16") new Uint16Array(iRange).set(model.iData);
    else new Uint32Array(iRange).set(model.iData);
    indexBuffer.unmap();

    const stride = this.meshMatStride;
    const strideFloats = stride / 4;
    const materialBuffer = this.device.createBuffer({
      size: Math.max(model.prims.length, 1) * stride,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const matData = new Float32Array(materialBuffer.getMappedRange());
    const texIdFor = (texIndex: number): string | null => {
      if (texIndex < 0) return null;
      const imgIdx = model.textures[texIndex];
      return imgIdx !== undefined && imgIdx >= 0 && this.textureCache.has(`mdl:${id}:img${imgIdx}`) ? `mdl:${id}:img${imgIdx}` : null;
    };
    //*alpha: 0 = OPAQUE, 1 = MASK (cutout con cutoff), 2 = BLEND (dos fases,
    //ver MeshPipeKey). ds = doubleSided (sin culling). Un material con
    //transmission (cristal) se trata como BLEND aunque declare OPAQUE.
    const primitives: GpuMeshPrim[] = model.prims.map((p, k) => {
      const mat = model.materials[p.material];
      const transmission = mat.transmission ?? 0;
      const alpha = mat.alphaMode === "MASK" ? 1 : (mat.alphaMode === "BLEND" || transmission > 0) ? 2 : 0;
      const o = k * strideFloats;
      matData.set(mat.baseColorFactor, o);
      matData[o + 4] = mat.metallic;
      matData[o + 5] = mat.roughness;
      matData[o + 6] = mat.alphaCutoff;
      matData[o + 7] = alpha;
      matData.set(mat.emissive, o + 8);
      matData[o + 11] = transmission;
      const tc = mat.texCoords;
      const mrId = texIdFor(mat.metallicRoughnessTexture ?? -1);
      const occId = texIdFor(mat.occlusionTexture ?? -1);
      const nrmId = texIdFor(mat.normalTexture ?? -1);
      matData[o + 12] = tc?.base ?? 0;
      matData[o + 13] = tc?.emissive ?? 0;
      matData[o + 14] = tc?.mr ?? 0;
      matData[o + 15] = tc?.occlusion ?? 0;
      matData[o + 16] = tc?.normal ?? 0;
      matData[o + 17] = tc?.transmission ?? 0;
      matData[o + 18] = mat.normalScale ?? 1;
      matData[o + 19] = mat.occlusionStrength ?? 1;
      matData[o + 20] = nrmId ? 1 : 0;
      matData[o + 21] = mrId ? 1 : 0;
      matData[o + 22] = occId ? 1 : 0;
      //KHR_texture_transform: identidad si el slot no trae (u*1 + v*0 + 0 = u exacto)
      const tx = mat.texTransforms;
      const txSlots = [tx?.base, tx?.emissive, tx?.mr, tx?.occlusion, tx?.normal, tx?.transmission];
      for (let k = 0; k < 6; k++) matData.set(txSlots[k] ?? IDENTITY_TX, o + MESH_MAT_TX + k * 6);
      return {
        firstIndex: p.firstIndex,
        indexCount: p.indexCount,
        lods: p.lods,
        textureId: texIdFor(mat.baseColorTexture),
        emissiveTextureId: texIdFor(mat.emissiveTexture),
        transmissionTextureId: texIdFor(mat.transmissionTexture ?? -1),
        mrTextureId: mrId,
        occTextureId: occId,
        normalTextureId: nrmId,
        matOffset: k * stride,
        alpha,
        ds: mat.doubleSided === true,
      };
    });
    materialBuffer.unmap();
    const materialBg = this.device.createBindGroup({
      layout: this.meshBgls![2],
      entries: [{ binding: 0, resource: { buffer: materialBuffer, offset: 0, size: MESH_MAT_BYTES } }],
    });

    let gpuBytes = vertexBuffer.size + indexBuffer.size + materialBuffer.size;
    gpuBytes += texBytes;
    this.meshCache.set(id, { vertexBuffer, indexBuffer, indexFormat: model.indexFormat, materialBuffer, materialBg, primitives, gpuBytes });
  }

  //*Error maximo de LOD en pantalla (px). 0 = siempre el original.
  private lodMaxErrorPx = 1;
  setLodMaxErrorPx(px: number) {
    this.lodMaxErrorPx = Math.max(0, Number(px) || 0);
  }

  hasModel(id: string): boolean {
    return this.meshCache.has(id);
  }

  /** VRAM estimada de un modelo subido (0 si no esta). */
  getModelGpuBytes(id: string): number {
    return this.meshCache.get(id)?.gpuBytes ?? 0;
  }

  /** performance.now() del ultimo dibujado del modelo (0 = nunca). */
  getModelLastDrawn(id: string): number {
    return this.meshLastDrawn.get(id) ?? 0;
  }

  //*Libera todo lo que preloadModel subio para `id`: buffers del modelo y
  //sus texturas `mdl:${id}:img*`. Los draws encolados con ese id se omiten.
  unloadModel(id: string) {
    const entry = this.meshCache.get(id);
    if (entry) {
      entry.vertexBuffer.destroy();
      entry.indexBuffer.destroy();
      entry.materialBuffer.destroy();
      this.meshCache.delete(id);
    }
    this.meshLastDrawn.delete(id);
    const prefix = `mdl:${id}:img`;
    for (const [texId, tex] of this.textureCache) {
      if (texId.startsWith(prefix)) {
        tex.texture.destroy();
        this.textureCache.delete(texId);
      }
    }
    this.meshMaterialBindGroups.clear();
  }

  private async ensureWhiteTexture() {
    if (this.whiteTextureId && this.textureCache.has(this.whiteTextureId)) return;
    const id = "engineWhiteTexture";
    const bmp = await createImageBitmap(new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1));
    await this.preloadImage(bmp, id);
    this.whiteTextureId = id;
  }

  //*Bind groups de texturas por primitiva (group 1 del pipeline mesh):
  //base (bindings 0/1) + emisivo (bindings 2/3) en el MISMO grupo porque
  //maxBindGroups = 4 (no existe group 4). Sin mapa de emisivo se bindea
  //blanco 1x1 (emissive * 1 = comportamiento anterior bit-identico).
  //Layout explicito compartido: un bind group sirve para las 7 variantes.
  private meshMaterialBindGroups = new Map<string, GPUBindGroup>();

  private getMeshMaterialBindGroup(prim: GpuMeshPrim): GPUBindGroup | null {
    const baseId = prim.textureId ?? this.whiteTextureId;
    const emisId = prim.emissiveTextureId ?? this.whiteTextureId;
    const trId = prim.transmissionTextureId ?? this.whiteTextureId;
    const mrId = prim.mrTextureId ?? this.whiteTextureId;
    const occId = prim.occTextureId ?? this.whiteTextureId;
    const nrmId = prim.normalTextureId ?? this.whiteTextureId;
    if (!baseId || !emisId || !trId || !mrId || !occId || !nrmId) return null;
    const key = baseId + "|" + emisId + "|" + trId + "|" + mrId + "|" + occId + "|" + nrmId;
    const cached = this.meshMaterialBindGroups.get(key);
    if (cached) return cached;
    const baseEntry = this.textureCache.get(baseId);
    if (!baseEntry) { this.diagMissingTexture(baseId); return null; }
    const emisEntry = this.textureCache.get(emisId);
    if (!emisEntry) { this.diagMissingTexture(emisId); return null; }
    const trEntry = this.textureCache.get(trId);
    if (!trEntry) { this.diagMissingTexture(trId); return null; }
    const mrEntry = this.textureCache.get(mrId);
    if (!mrEntry) { this.diagMissingTexture(mrId); return null; }
    const occEntry = this.textureCache.get(occId);
    if (!occEntry) { this.diagMissingTexture(occId); return null; }
    const nrmEntry = this.textureCache.get(nrmId);
    if (!nrmEntry) { this.diagMissingTexture(nrmId); return null; }
    const bg = this.device.createBindGroup({
      layout: this.meshBgls![1],
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: baseEntry.view },
        { binding: 2, resource: this.sampler },
        { binding: 3, resource: emisEntry.view },
        { binding: 4, resource: this.sampler },
        //mapas de datos: vista lineal (sin decodificar sRGB)
        { binding: 5, resource: trEntry.linearView },
        { binding: 6, resource: mrEntry.linearView },
        { binding: 7, resource: occEntry.linearView },
        { binding: 8, resource: nrmEntry.linearView },
      ],
    });
    this.meshMaterialBindGroups.set(key, bg);
    return bg;
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
    const encodeStart = performance.now();
    const tsSlot = this.ts ? this.ts.busy.indexOf(false) : -1;

    this.imageUsed = 0;
    this.patternUsed = 0;
    this.rectUsed = 0;
    this.meshUsed = 0;

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

    this.ensureTargets(canvas.width, canvas.height);

    //*SSAO: targets del G-buffer (MRT 2..4 del pase principal) al tamano/MSAA actual.
    const aoOn = this.aoActive;
    if (aoOn) this.ssao.ensureTargets(canvas.width, canvas.height, this.sampleCount);
    //*Con MSAA se dibuja en el target multisample y se resuelve a passView
    //(swapchain o scene target del post-proceso, que siguen a 1 sample).
    const msaaView = this.msaaColorView;
    const colorAttachments: Array<GPURenderPassColorAttachment | null> = [msaaView ? {
      view: msaaView,
      resolveTarget: passView,
      clearValue: { r: 0, g: 0, b: 0, a: 0 },
      loadOp: "clear",
      storeOp: "discard",
    } : {
      view: passView,
      clearValue: { r: 0, g: 0, b: 0, a: 0 },
      loadOp: "clear",
      storeOp: "store",
    }];
    //*Bloom: 2o attachment con el excedente HDR de las mallas. Se resuelve
    //al scene target de su propia cadena dual Kawase (rgba16float).
    let bloomSrc: GPUTextureView | null = null;
    if (this.bloomEnabled) {
      bloomSrc = this.bloomKawase.getSceneTarget(canvas.width, canvas.height);
      colorAttachments.push(this.bloomMsaaView ? {
        view: this.bloomMsaaView,
        resolveTarget: bloomSrc,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "discard",
      } : {
        view: bloomSrc,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store",
      });
    }
    //*SSAO: slot 1 (bloom) vacio si no hay bloom; 2 = ambiente, 3 = pos, 4 = normal.
    if (aoOn) {
      if (!bloomSrc) colorAttachments.push(null);
      colorAttachments.push(...this.ssao.mainAttachments());
    }
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments,
      ...(tsSlot >= 0 ? { timestampWrites: { querySet: this.ts!.querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } } : {}),
      depthStencilAttachment: {
        view: this.depthView!,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      }
    });

    passEncoder.setViewport(0, 0, canvas.width, canvas.height, 0, 1);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);

    this.drawGrid(passEncoder);
    this.processQueueInOrder(passEncoder, canvas.width, canvas.height);

    passEncoder.end();
    //*SSAO + blur + composicion (resta ambiente x (1 - AO)) antes del bloom
    //y del post-proceso global.
    if (aoOn) {
      this.ssao.record(commandEncoder, passView, this.ao, this.ao.debug,
        tsSlot >= 0 ? { querySet: this.ts!.querySet, begin: 2, end: 3 } : undefined);
    }
    const aoTimed = aoOn && tsSlot >= 0;
    if (tsSlot >= 0) {
      const nq = aoTimed ? 4 : 2;
      commandEncoder.resolveQuerySet(this.ts!.querySet, 0, nq, this.ts!.resolve, 0);
      commandEncoder.copyBufferToBuffer(this.ts!.resolve, 0, this.ts!.readbacks[tsSlot], 0, nq * 8);
    }

    if (bloomSrc) this.recordBloom(commandEncoder, bloomSrc, passView, canvas.width, canvas.height);

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
    this.diag.timing.encodeMs = performance.now() - encodeStart;
    if (tsSlot >= 0) {
      const ts = this.ts!;
      const rb = ts.readbacks[tsSlot];
      ts.busy[tsSlot] = true;
      rb.mapAsync(GPUMapMode.READ).then(() => {
        const t = new BigInt64Array(rb.getMappedRange());
        const ns = Number(t[1] - t[0]);
        const nsAo = aoTimed ? Number(t[3] - t[2]) : 0;
        const nsSpan = aoTimed ? Number(t[3] - t[0]) : 0;
        rb.unmap();
        if (ns > 0) this.diag.timing.gpuPassMs = ns / 1e6;
        this.diag.timing.aoMs = nsAo > 0 ? nsAo / 1e6 : -1;
        this.diag.timing.aoSpanMs = nsSpan > 0 ? nsSpan / 1e6 : -1;
        ts.busy[tsSlot] = false;
      }).catch(() => { ts.busy[tsSlot] = false; });
    }

    this.queue.length = 0;
  }

  /**
   * Grid 3D infinito (pass fullscreen procedural con fade) + ejes XYZ
   * exactos (line-list). El infinito se dibuja primero para oclusión
   * correcta; los ejes después de la escena irían encima de translúcidos,
   * así que van aquí también (con depth test, se ocluyen bien).
   * No toca el binding del slot 0 (el quad buffer de render()).
   */
  private drawGrid(pass: GPURenderPassEncoder) {
    if (!this.gridState?.enabled || !this.gridView) return;
    //*Plano infinito procedural (solo si compilo bien; si no, se omite y la
    //escena sigue renderizando).
    if (this.gridInfReady && this.gridInfPipeline && this.gridUniformBuffer && this.gridInfBindGroup) {
      let uni: Float32Array;
      try {
        uni = buildGridUniform(this.gridState, this.gridView);
      } catch (e) {
        console.error("Grid uniform build failed:", e);
        uni = new Float32Array(GRID_UNIFORM_FLOATS);
      }
      this.gridUniformValues.set(uni);
      this.device.queue.writeBuffer(this.gridUniformBuffer, 0, this.gridUniformValues);
      pass.setPipeline(this.gridInfPipeline);
      pass.setBindGroup(0, this.gridInfBindGroup);
      pass.draw(6);
      this.diagDraw("grid", undefined, 0, 6);
    }
    //*Ejes XYZ exactos (cerca del origen, proyección idéntica a objetos).
    if (!this.gridPipeline || !this.gridVertexBuffer) return;
    let verts: Float32Array;
    try {
      verts = buildAxesVertices(this.gridState, this.gridView);
    } catch (e) {
      console.error("Grid axes build failed:", e);
      return;
    }
    if (verts.length === 0) return;
    const count = Math.min(verts.length / GRID_FLOATS_PER_VERTEX, MAX_GRID_VERTICES);
    if (count <= 0) return;
    this.device.queue.writeBuffer(this.gridVertexBuffer, 0, verts, 0, count * GRID_FLOATS_PER_VERTEX);
    pass.setPipeline(this.gridPipeline);
    pass.setVertexBuffer(0, this.gridVertexBuffer);
    pass.draw(count);
    //*Restaurar el quad buffer: los batches de quads (image/pattern/rect)
    //asumen el binding del slot 0 de render() y nunca lo rebindan. Sin esto
    //leen pos/uv del buffer del grid (stride distinto) y las texturas glitchean.
    pass.setVertexBuffer(0, this.vertexBuffer);
    this.diagDraw("grid-axes", undefined, 0, count);
  }

  private processQueueInOrder(pass: GPURenderPassEncoder, cw: number, ch: number) {    if (this.queue.length === 0) return;

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
    } else if (type === 'mesh') {
      slotBase = this.meshUsed;
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
    } else if (type === 'mesh') {
      this.meshUsed += count;
      this.processMeshBatch(pass, startIdx, clampedEnd, cw, ch, noDepth, slotBase);
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
      //*Bind group del pipeline que dibuja (no compartir entre depth/noDepth).
      const bg = isPattern
        ? (noDepth ? tex.noDepthPatternBindGroup : tex.patternBindGroup)
        : (noDepth ? tex.noDepthBindGroup : tex.bindGroup);
      pass.setBindGroup(1, bg);
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

  /**
   * Escribe UNA instancia de malla en el staging (slot absoluto). El layout
   * de 16 floats lo consume el vertex shader de mallas.
   */
  private stageMeshInstance(item: DrawParams, cw: number, ch: number, slot: number) {
    const data = this.meshStaging;
    const FLOATS = this.FLOATS_PER_INSTANCE;
    const offset = slot * FLOATS;
    //center = esquina mapeada igual que sprites: x,y = centro pantalla px
    data[offset + 0] = item.x;
    data[offset + 1] = item.y;
    data[offset + 2] = item.ppu ?? 0; // pixeles por unidad modelo
    data[offset + 3] = item.wx ?? 0; // world.x del centro (V real)
    data[offset + 4] = item.roll ?? item.rotation;
    data[offset + 5] = item.pitch ?? 0;
    data[offset + 6] = item.yaw ?? 0;
    data[offset + 7] = cw;
    data[offset + 8] = ch;
    data[offset + 9] = item.wy ?? 0; // world.y del centro (V real)
    data[offset + 10] = item.ignoreWorldRotation ?? 0; // transform3.z → ignoreWorld flag
    data[offset + 11] = item.wz ?? 0; // world.z del centro (V real)
    data[offset + 12] = item.depthZ ?? 0; // depth.x → profundidad centro (mundo)
    data[offset + 13] = item.depthP ?? 0; // depth.y → px por unidad mundo (0 = orto)
    data[offset + 14] = 0;
    data[offset + 15] = 0;
    //*Perspectiva relativa al ojo (depth.z = 1): center.xy = centro relativo
    //al ojo (mundo), center.z = escala modelo->mundo, depth.x = Z del centro
    //(puede ser <= 0: camara dentro del modelo), depth.w = K.
    if ((item.mk ?? 0) > 0) {
      data[offset + 0] = item.mvx ?? 0;
      data[offset + 1] = item.mvy ?? 0;
      data[offset + 2] = item.ms ?? 0;
      data[offset + 12] = item.mvz ?? 0;
      data[offset + 14] = 1;
      data[offset + 15] = item.mk!;
    }
  }

  /**
   * Dibuja meshes GLB en DOS pasadas: primero opacos + cutout (con depth
   * write, orden irrelevante) y despues BLEND sin depth write en orden de
   * cola (pintor lejos->cerca). Cada primitiva usa su variante de pipeline
   * segun alphaMode/doubleSided. Instancia = 1 por draw (firstInstance).
   * HUD (noDepth) conserva el comportamiento legacy de un solo pipeline.
   */
  private processMeshBatch(pass: GPURenderPassEncoder, startIdx: number, endIdx: number, cw: number, ch: number, noDepth: boolean, slotBase: number) {
    const queue = this.queue;
    const FLOATS = this.FLOATS_PER_INSTANCE;
    const count = endIdx - startIdx;

    for (let i = startIdx; i < endIdx; i++) {
      this.stageMeshInstance(queue[i].params, cw, ch, (i - startIdx) + slotBase);
    }

    this.device.queue.writeBuffer(this.meshInstanceBuffer, slotBase * FLOATS * 4, this.meshStaging, slotBase * FLOATS, count * FLOATS);
    //*Grupos 0/3 compartidos por las 7 variantes (layout explicito): se
    //bindean una vez; cambiar de pipeline no los invalida.
    pass.setBindGroup(0, this.meshGlobalBg);
    pass.setBindGroup(3, this.meshLightBg);
    const forceOpaque = this.meshDebug.forceOpaque;
    let curPipe: MeshPipeKey | "" = "";
    const usePipe = (p: MeshPipeKey) => {
      if (p === curPipe) return;
      curPipe = p;
      pass.setPipeline(this.meshPipes[p]);
    };
    type MeshEntry = { vertexBuffer: GPUBuffer; indexBuffer: GPUBuffer; indexFormat: GPUIndexFormat; materialBg: GPUBindGroup; primitives: GpuMeshPrim[] };
    const bindModel = (entry: MeshEntry) => {
      pass.setVertexBuffer(1, entry.vertexBuffer);
      pass.setIndexBuffer(entry.indexBuffer, entry.indexFormat);
    };
    //*Material por offset dinamico dentro del buffer del modelo: cada draw
    //lee SU material (antes un unico uniform reescrito con writeBuffer
    //dejaba a todas las primitivas del frame con el material de la ultima).
    //*LOD: el nivel mas simple cuyo error proyectado (error en unidades
    //modelo x px por unidad) no supere lodMaxErrorPx. lodPx 0 = original
    //(ojo dentro de la caja / centro tras la camara / sin dato).
    const maxErr = this.lodMaxErrorPx;
    const drawPrim = (id: string, entry: MeshEntry, prim: GpuMeshPrim, slot: number, lodPx: number) => {
      let first = prim.firstIndex;
      let count = prim.indexCount;
      if (lodPx > 0 && maxErr > 0 && prim.lods) {
        for (const l of prim.lods) {
          if (l.error * lodPx > maxErr) break;
          first = l.firstIndex;
          count = l.indexCount;
        }
      }
      if (count === 0) return; //nivel podado entero (piezas menores que el error)
      const texBg = this.getMeshMaterialBindGroup(prim);
      if (!texBg) return;
      pass.setBindGroup(1, texBg);
      pass.setBindGroup(2, entry.materialBg, [prim.matOffset]);
      pass.drawIndexed(count, 1, first, 0, slot);
      this.diagDraw("mesh", id, slot, count);
    };

    const drawnAt = performance.now();
    for (let i = startIdx; i < endIdx; i++) {
      const id = queue[i].params.id!;
      const entry = this.meshCache.get(id);
      if (!entry) { this.diagMissingTexture(id); continue; }
      this.meshLastDrawn.set(id, drawnAt);
      const slot = slotBase + (i - startIdx);
      const lodPx = queue[i].params.lodPx ?? 0;
      bindModel(entry);
      for (const prim of entry.primitives) {
        if (noDepth) {
          usePipe("hud");
        } else if (forceOpaque) {
          usePipe(prim.ds ? "ds" : "depth");
        } else {
          if (prim.alpha === 2) continue; // BLEND va en la segunda pasada
          if (prim.alpha === 1) usePipe(prim.ds ? "maskDS" : "mask");
          else usePipe(prim.ds ? "ds" : "depth");
        }
        drawPrim(id, entry, prim, slot, lodPx);
      }
    }
    if (!noDepth && !forceOpaque) {
      //*BLEND fase A: las partes casi opacas (alfa >= 0.98) de materiales
      //BLEND escriben color y profundidad como un opaco. Sin esto, un marco
      //opaco con material BLEND (cabina telefonica) no ocluia nada y sus
      //triangulos interiores/traseros se pintaban encima en orden de indices.
      for (let i = startIdx; i < endIdx; i++) {
        const id = queue[i].params.id!;
        const entry = this.meshCache.get(id);
        if (!entry) continue;
        const slot = slotBase + (i - startIdx);
        const lodPx = queue[i].params.lodPx ?? 0;
        let bound = false;
        for (const prim of entry.primitives) {
          if (prim.alpha !== 2) continue;
          if (!bound) { bindModel(entry); bound = true; }
          usePipe(prim.ds ? "blendPreDS" : "blendPre");
          drawPrim(id, entry, prim, slot, lodPx);
        }
      }
      //*BLEND fase B: solo lo translucido, sin escribir profundidad, por
      //objeto en orden de cola (lejos->cerca). Doble cara: primero las caras
      //traseras y despues las frontales de todas sus primitivas.
      for (let i = startIdx; i < endIdx; i++) {
        const id = queue[i].params.id!;
        const entry = this.meshCache.get(id);
        if (!entry) continue;
        const slot = slotBase + (i - startIdx);
        const lodPx = queue[i].params.lodPx ?? 0;
        let bound = false;
        for (const side of ["blendBack", "blendFront"] as const) {
          for (const prim of entry.primitives) {
            if (prim.alpha !== 2 || (side === "blendBack" && !prim.ds)) continue;
            if (!bound) { bindModel(entry); bound = true; }
            usePipe(side);
            drawPrim(id, entry, prim, slot, lodPx);
          }
        }
      }
    }
  }

  //*Bloom: desenfoque dual Kawase del excedente HDR (rgba16float) y suma
  //aditiva sobre la escena ya compuesta (antes de blur/rgbSplit globales).
  //Aproximacion en espacio de pantalla: el halo se tonemapea aparte y se
  //suma al color sRGB de la escena.
  private recordBloom(encoder: GPUCommandEncoder, bloomSrc: GPUTextureView, dst: GPUTextureView, w: number, h: number) {
    if (!this.bloomOut || this.bloomOut.w !== w || this.bloomOut.h !== h) {
      this.bloomOut?.texture.destroy();
      const texture = this.device.createTexture({
        size: [w, h],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      this.bloomOut = { texture, view: texture.createView(), w, h };
      this.bloomCompositeBg = null;
    }
    this.bloomKawase.record(encoder, bloomSrc, this.bloomOut.view, Math.max(this.bloom.radius, 1), w, h, this.vertexBuffer);
    this.bloomCompositeValues[0] = this.bloom.intensity;
    this.bloomCompositeValues[1] = this._toneMode;
    this.device.queue.writeBuffer(this.bloomCompositeUniform, 0, this.bloomCompositeValues);
    if (!this.bloomCompositeBg) {
      this.bloomCompositeBg = this.device.createBindGroup({
        layout: this.bloomCompositePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.bloomCompositeUniform } },
          { binding: 1, resource: this.mipSampler },
          { binding: 2, resource: this.bloomOut.view },
        ],
      });
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: dst, loadOp: "load", storeOp: "store" }],
    });
    pass.setPipeline(this.bloomCompositePipeline);
    pass.setBindGroup(0, this.bloomCompositeBg);
    pass.setViewport(0, 0, w, h, 0, 1);
    pass.draw(3);
    pass.end();
  }

  //*Layouts explicitos de las mallas (ver meshBgls). Una vez por device:
  //recrear pipelines (MSAA) no invalida los bind groups ya creados.
  private ensureMeshLayouts() {
    if (this.meshBgls) return;
    const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    const F = GPUShaderStage.FRAGMENT;
    const tex: GPUTextureBindingLayout = { sampleType: "float", viewDimension: "2d" };
    this.meshBgls = [
      this.device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: VF, buffer: { type: "uniform" } },
      ] }),
      this.device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: F, sampler: { type: "filtering" } },
        { binding: 1, visibility: F, texture: tex },
        { binding: 2, visibility: F, sampler: { type: "filtering" } },
        { binding: 3, visibility: F, texture: tex },
        { binding: 4, visibility: F, sampler: { type: "filtering" } },
        { binding: 5, visibility: F, texture: tex },
        { binding: 6, visibility: F, texture: tex },
        { binding: 7, visibility: F, texture: tex },
        { binding: 8, visibility: F, texture: tex },
      ] }),
      this.device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: VF, buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: MESH_MAT_BYTES } },
      ] }),
      this.device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: VF, buffer: { type: "uniform" } },
      ] }),
    ];
    this.meshPipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: this.meshBgls });
    const align = this.device.limits.minUniformBufferOffsetAlignment || 256;
    this.meshMatStride = Math.ceil(MESH_MAT_BYTES / align) * align;
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
          //El clip-space se calcula en forma LINEAL en Zv (sin 1/Zv intermedio):
          //r*w = (1-Zv*invFar)/(Zc*denP) es finito incluso en Zv=0, asi el
          //recorte HW 4D es exacto y no hay streaks. Clampear (max/clamp) aqui
          //rompia la linealidad y el hardware recortaba en sitio equivocado.
          //Con Zv=Zc, r=1 y es bit-identico al codigo anterior.
          let zRaw = zCenter + final3D.z / pxPerWorld;
          *zvOut = zRaw;
          let denP = max(1.0 / zCenter - invFar, 1e-6);
          let invNear = 1.0 / near;
          let denN = invNear - invFar;
          let c0 = vec2f(canvasSize.x * 0.5, canvasSize.y * world.cameraOrigin.y);
          let D = (pos + center - c0) + vec2f(final3D.x, final3D.y);
          let wLin = zRaw / zCenter;
          let rwLin = (1.0 - zRaw * invFar) / (zCenter * denP);
          let cxLin = (c0.x * 2.0 / canvasSize.x - 1.0) * wLin + D.x * 2.0 / canvasSize.x * rwLin;
          let cyLin = (1.0 - c0.y * 2.0 / canvasSize.y) * wLin - D.y * 2.0 / canvasSize.y * rwLin;
          let czLin = wLin - (1.0 - zRaw * invFar) / (zCenter * denN);
          return vec4f(cxLin, cyLin, czLin, wLin);
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

    // 4. SHADER DE MALLA 3D (modelos GLB estaticos).
    //Misma convencion que sprites: orientacion propia (roll/pitch/yaw) y
    //luego rotacion de mundo; la CPU ya proyecto el CENTRO del modelo con
    //pinhole (puerto de RenderingDimentions) y la GPU solo rota offsets
    //locales en px (pos * ppu), sin re-proyectar. Proyeccion por vertice
    //identica a getNDCPosition pero con centro explicito (no quad).
    //Iluminacion: mode 0 = unlit (bit-identico al anterior), 1 = Lambert,
    //2 = Phong con V = normalize(eye - fragWorld). En orto (pxPerWorld = 0)
    //V es constante hacia la camara. Fase 1: + hasta 4 puntuales (difuso en
    //1 y 2, especular solo en 2; atenuacion glTF 1/d^2 con ventana por rango,
    //sin sombras) + fallback a normal geometrica si no hay NORMAL + mapa de
    //emisivo (group 4, blanco si no hay).
    //*Tonemapping + codificacion sRGB, compartidos por el shader de mallas y
    //la composicion del bloom (WGSL sin dependencias de bind groups).
    const tonemapWGSL = `
      //*Texturas de modelos se muestrean por vista -srgb y los factores glTF
      //son lineales: se ilumina en lineal y se codifica a sRGB al escribir
      //(el formato del canvas no es -srgb y no lo hace solo).
      fn linearToSrgb(c: vec3f) -> vec3f {
        let x = max(c, vec3f(0.0));
        let lo = x * 12.92;
        let hi = 1.055 * pow(x, vec3f(1.0 / 2.4)) - 0.055;
        return select(hi, lo, x <= vec3f(0.0031308));
      }

      //*Tonemapping (solo mallas; sprites/UI nunca pasan por aqui).
      fn tonemapAces(x: vec3f) -> vec3f {
        //ACES filmic, ajuste de Narkowicz
        return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
      }
      fn agxContrast(x: vec3f) -> vec3f {
        let x2 = x * x;
        let x4 = x2 * x2;
        return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
      }
      fn tonemapAgx(c: vec3f) -> vec3f {
        //AgX (aproximacion polinomica de Wrensch), devuelve lineal
        let inset = mat3x3f(
          vec3f(0.842479062253094, 0.0423282422610123, 0.0423756549057051),
          vec3f(0.0784335999999992, 0.878468636469772, 0.0784336),
          vec3f(0.0792237451477643, 0.0791661274605434, 0.879142973793104));
        let outset = mat3x3f(
          vec3f(1.19687900512017, -0.0528968517574562, -0.0529716355144438),
          vec3f(-0.0980208811401368, 1.15190312990417, -0.0980434501171241),
          vec3f(-0.0990297440797205, -0.0989611768448433, 1.15107367264116));
        let minEv = -12.47393;
        let maxEv = 4.026069;
        var v = inset * max(c, vec3f(0.0));
        v = clamp(log2(max(v, vec3f(1e-10))), vec3f(minEv), vec3f(maxEv));
        v = (v - vec3f(minEv)) / (maxEv - minEv);
        v = outset * agxContrast(v);
        return pow(max(v, vec3f(0.0)), vec3f(2.2));
      }
      fn tonemapNeutral(color: vec3f) -> vec3f {
        //Khronos PBR Neutral
        let startCompression = 0.8 - 0.04;
        let desaturation = 0.15;
        let x = min(color.r, min(color.g, color.b));
        let offset = select(0.04, x - 6.25 * x * x, x < 0.08);
        let c = color - vec3f(offset);
        let peak = max(c.r, max(c.g, c.b));
        if (peak < startCompression) { return c; }
        let d = 1.0 - startCompression;
        let newPeak = 1.0 - d * d / (peak + d - startCompression);
        let g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
        return mix(c * (newPeak / peak), vec3f(newPeak), g);
      }
      //*tm: 0 = none (clamp), 1 = ACES, 2 = AgX, 3 = Khronos PBR Neutral.
      fn applyTonemap(hdr: vec3f, tm: f32) -> vec3f {
        if (tm > 2.5) { return tonemapNeutral(hdr); }
        if (tm > 1.5) { return tonemapAgx(hdr); }
        if (tm > 0.5) { return tonemapAces(hdr); }
        return hdr;
      }
    `;
    const meshShader = `
      struct InstMesh {
        center: vec4f, // [cx, cy, ppu, worldX]
        orient: vec4f, // [roll, pitch, yaw, canvasWidth]
        misc: vec4f,   // [canvasHeight, worldY, ignoreWorld, worldZ]
        depth: vec4f   // [zCenter, pxPerWorld, modo (1 = relativo al ojo), K]
      };
      struct DataMesh { instances: array<InstMesh> };
      @group(0) @binding(0) var<storage, read> data: DataMesh;
      //*Material por primitiva (96 B, offset dinamico en el buffer del modelo):
      //factor albedo; params [metallic, roughness, cutoff, alphaMode]
      //(0 = OPAQUE, 1 = MASK, 2 = BLEND); emissive [r,g,b,transmission];
      //tcA [texCoord base, emisivo, mr, occ]; tcB [texCoord normal,
      //transmision, normalScale, occStrength]; flags [hasNormalMap, hasMR, hasOcc, 0];
      //tx = 6 matrices 2x3 (KHR_texture_transform) empaquetadas de 6 en 6 floats:
      //slot 0 base, 1 emisivo, 2 mr, 3 occ, 4 normal, 5 transmision.
      struct MeshMat { factor: vec4f, params: vec4f, emissive: vec4f, tcA: vec4f, tcB: vec4f, flags: vec4f, tx: array<vec4f, 9> };
      @group(2) @binding(0) var<uniform> mat: MeshMat;
      struct PLight {
        posRange: vec4f, // [x, y, z mundo, rango] (rango <= 0 = apagada)
        colorInt: vec4f, // [r, g, b, intensidad]
      };
      struct LightData {
        modeAmbShinSpec: vec4f, // [mode (0 unlit,1 Lambert,2 Phong,3 PBR), ambient, shininess, specStrength]
        lightDir: vec4f,        // [direccion hacia la luz (mundo engine), intensidad direccional]
        eye: vec4f,             // [ojo de camara (mundo engine), exposicion]
        pointMeta: vec4f,       // [nº puntuales (0..4), debug alfa, toneMode, umbral bloom]
        points: array<PLight, 4>,
      };
      @group(3) @binding(0) var<uniform> light: LightData;
      //*Texturas del material (grupo 1; maxBindGroups = 4, no hay grupo 4).
      //Blanco 1x1 en los slots sin mapa. base/emisivo por vista sRGB; el
      //resto (datos) por vista lineal.
      @group(1) @binding(0) var s: sampler;
      @group(1) @binding(1) var t: texture_2d<f32>;
      @group(1) @binding(2) var eSamp: sampler;
      @group(1) @binding(3) var eTex: texture_2d<f32>;
      @group(1) @binding(4) var trSamp: sampler;
      @group(1) @binding(5) var trTex: texture_2d<f32>;
      @group(1) @binding(6) var mrTex: texture_2d<f32>;
      @group(1) @binding(7) var occTex: texture_2d<f32>;
      @group(1) @binding(8) var nrmTex: texture_2d<f32>;

      struct Out {
        @builtin(position) p: vec4f,
        @location(0) uv: vec2f,
        @location(1) zv: f32,
        @location(2) nW: vec3f,
        @location(3) wW: vec3f,
        @location(4) noLight: f32,
        @location(5) uv1: vec2f,
        @location(6) tW: vec4f,
        @location(7) vColor: vec4f,
        @location(8) aoOn: f32,
      };

      ${commonWGSLTransforms}

      @vertex fn vs(@location(0) pos: vec3f, @location(1) uv: vec2f, @location(2) nrm: vec3f, @location(3) uv1: vec2f, @location(4) tan: vec4f, @location(5) col: vec4f, @builtin(instance_index) i: u32) -> Out {
        let inst = data.instances[i];
        let canvasSize = vec2f(inst.orient.w, inst.misc.x);

        let local3 = pos * inst.center.z;
        let worldEffect = 1.0 - inst.misc.z;
        let localRotated = rotate3D(local3, inst.orient.x, inst.orient.y, inst.orient.z);
        let rotated3D = rotate3D(localRotated, world.rotation.z * worldEffect, world.rotation.x * worldEffect, world.rotation.y * worldEffect);

        //*Normal en mundo (solo rotaciones, ppu es escala uniforme: no cambia direccion).
        let nLocal = rotate3D(nrm, inst.orient.x, inst.orient.y, inst.orient.z);
        let nWorld = rotate3D(nLocal, world.rotation.z * worldEffect, world.rotation.x * worldEffect, world.rotation.y * worldEffect);
        //*Tangente: misma rotacion que la normal; w (signo de la bitangente)
        //intacto. (0,0,0,0) = sin TANGENT (el FS usa el marco por derivadas).
        let tLocal = rotate3D(tan.xyz, inst.orient.x, inst.orient.y, inst.orient.z);
        let tWorld = vec4f(rotate3D(tLocal, world.rotation.z * worldEffect, world.rotation.x * worldEffect, world.rotation.y * worldEffect), tan.w);
        //*Posicion mundo del fragmento (unidades mundo: pos ya es 1u=1u).
        let localWorld = rotate3D(pos, inst.orient.x, inst.orient.y, inst.orient.z);
        let rotWorld = rotate3D(localWorld, world.rotation.z * worldEffect, world.rotation.x * worldEffect, world.rotation.y * worldEffect);
        let fragWorld = vec3f(inst.center.w, inst.misc.y, inst.misc.w) + rotWorld;
        let noLight = 1.0 - step(0.000000001, dot(nWorld, nWorld));
        //*Mallas HUD (ignoreWorld) no pasan por el prepass del SSAO.
        let aoOn = select(1.0, 0.0, inst.misc.z != 0.0);

        //*Perspectiva relativa al OJO (modo 1): center.xy = centro relativo al
        //ojo y center.z = escala modelo->mundo, asi que rotated3D ya esta en
        //unidades mundo. px = c0 + X*K*(1/Zv - invFar); multiplicado por Zv
        //queda lineal (clip con w = Zv): no depende de la proyeccion del
        //centro, que no existe si el centro esta tras la camara (camara
        //dentro del modelo). El hardware recorta lo que queda tras el ojo.
        if (inst.depth.z > 0.5) {
          let invFar = world.depthParams.y;
          let denN = 1.0 / world.depthParams.x - invFar;
          let Zv = inst.depth.x + rotated3D.z;
          let X = inst.center.x + rotated3D.x;
          let Y = inst.center.y + rotated3D.y;
          let lin = inst.depth.w * (1.0 - Zv * invFar);
          let c0 = vec2f(canvasSize.x * 0.5, canvasSize.y * world.cameraOrigin.y);
          let cx = (c0.x * Zv + X * lin) * 2.0 / canvasSize.x - Zv;
          let cy = Zv - (c0.y * Zv + Y * lin) * 2.0 / canvasSize.y;
          let cz = Zv - (1.0 - Zv * invFar) / denN;
          return Out(vec4f(cx, cy, cz, Zv), uv, Zv, nWorld, fragWorld, noLight, uv1, tWorld, col, aoOn);
        }

        let cameraDist = max(canvasSize.x, canvasSize.y) * 1.2;
        var persp = cameraDist / (cameraDist + rotated3D.z);
        var wClip = 1.0;
        var zClip = 0.0;
        var zvLin: f32 = 1e10;
        var worldPixelPos = vec2f(rotated3D.x, rotated3D.y) * persp + vec2f(inst.center.x, inst.center.y);
        if (inst.depth.y > 0.0) {
          let near = world.depthParams.x;
          let invFar = world.depthParams.y;
          //Clip-space LINEAL en Zv (igual que getNDCPosition): sin 1/Zv
          //intermedio, recorte HW exacto, corte nitido por near sin streaks.
          let zRaw = inst.depth.x + rotated3D.z / inst.depth.y;
          zvLin = zRaw;
          let denP = max(1.0 / inst.depth.x - invFar, 1e-6);
          let invNear = 1.0 / near;
          let denN = invNear - invFar;
          let c0 = vec2f(canvasSize.x * 0.5, canvasSize.y * world.cameraOrigin.y);
          let Dm = (vec2f(inst.center.x, inst.center.y) - c0) + vec2f(rotated3D.x, rotated3D.y);
          let wLin = zRaw / inst.depth.x;
          let rwLin = (1.0 - zRaw * invFar) / (inst.depth.x * denP);
          let cxLin = (c0.x * 2.0 / canvasSize.x - 1.0) * wLin + Dm.x * 2.0 / canvasSize.x * rwLin;
          let cyLin = (1.0 - c0.y * 2.0 / canvasSize.y) * wLin - Dm.y * 2.0 / canvasSize.y * rwLin;
          let czLin = wLin - (1.0 - zRaw * invFar) / (inst.depth.x * denN);
          return Out(vec4f(cxLin, cyLin, czLin, wLin), uv, zvLin, nWorld, fragWorld, noLight, uv1, tWorld, col, aoOn);
        }

        let ndcX = (worldPixelPos.x / canvasSize.x) * 2.0 - 1.0;
        let ndcY = (worldPixelPos.y / canvasSize.y) * -2.0 + 1.0;
        return Out(vec4f(ndcX * wClip, ndcY * wClip, zClip * wClip, wClip), uv, zvLin, nWorld, fragWorld, noLight, uv1, tWorld, col, aoOn);
      }

      //*true solo en pipelines MASK con MSAA (alpha-to-coverage).
      override A2C: bool = false;
      //*Fase BLEND: 0 = sin filtro, 1 = solo casi opacos (prepass con depth),
      //2 = solo translucidos (sin depth write).
      override BLEND_PHASE: u32 = 0u;
      //*Transmission sin refraccion: el cristal deja pasar casi todo (queda un
      //velo minimo para que siga leyendose como superficie).
      const TRANSMISSION_MIN_ALPHA = 0.18;
      const BLEND_OPAQUE_ALPHA = 0.98;
      const PI = 3.14159265;
      ${tonemapWGSL}
      //*hdr lineal (ya expuesto) -> color de pantalla (sRGB). toneMode 0 =
      //clamp: identico al comportamiento historico.
      fn toDisplay(hdr: vec3f) -> vec3f {
        return linearToSrgb(applyTonemap(hdr, light.pointMeta.z));
      }

      //*BRDF Cook-Torrance (GGX + Smith-Schlick + Fresnel Schlick) para una
      //luz con direccion L y radiancia rad. Difuso Lambert * (1-F)(1-metal).
      fn brdfGGX(N: vec3f, V: vec3f, L: vec3f, albedo: vec3f, metal: f32, rough: f32, rad: vec3f) -> vec3f {
        let NdotL = max(dot(N, L), 0.0);
        if (NdotL <= 0.0) { return vec3f(0.0); }
        let H = normalize(L + V);
        let NdotV = max(dot(N, V), 0.0001);
        let NdotH = max(dot(N, H), 0.0);
        let VdotH = max(dot(V, H), 0.0);
        let a = max(rough * rough, 0.002);
        let a2 = a * a;
        let dd = NdotH * NdotH * (a2 - 1.0) + 1.0;
        let D = a2 / (PI * dd * dd);
        let k = (rough + 1.0) * (rough + 1.0) / 8.0;
        let G = (NdotV / (NdotV * (1.0 - k) + k)) * (NdotL / (NdotL * (1.0 - k) + k));
        let F0 = mix(vec3f(0.04), albedo, metal);
        let F = F0 + (vec3f(1.0) - F0) * pow(1.0 - VdotH, 5.0);
        let spec = D * G * F / max(4.0 * NdotV * NdotL, 0.0001);
        let kd = (vec3f(1.0) - F) * (1.0 - metal);
        //*PI: intensidad 1 = mismo brillo que Lambert (convencion no fisica
        //habitual en motores; las puntuales ya traen su atenuacion glTF).
        return (kd * albedo / PI + spec) * rad * NdotL * PI;
      }

      struct FsIn {
        @location(0) uv: vec2f,
        @location(1) zv: f32,
        @location(2) nW: vec3f,
        @location(3) wW: vec3f,
        @location(4) noLight: f32,
        @location(5) uv1: vec2f,
        @location(6) tW: vec4f,
        @location(7) vColor: vec4f,
        @location(8) aoOn: f32,
        @builtin(front_facing) isFront: bool,
      };
      //*color = salida de pantalla (sRGB, alfa final); hdr = color lineal
      //expuesto antes del tonemap (fuente del bloom); amb = parte de hdr que
      //es luz ambiente (la que atenua el SSAO).
      struct Shade { color: vec4f, hdr: vec3f, amb: vec3f };
      fn uvSel(tc: f32, uv0: vec2f, uv1: vec2f) -> vec2f { return select(uv0, uv1, tc > 0.5); }
      fn txAt(i: u32) -> f32 { return mat.tx[i / 4u][i % 4u]; }
      //*KHR_texture_transform del slot k: u' = a*u + b*v + c, v' = d*u + e*v + f.
      fn uvTx(uv: vec2f, k: u32) -> vec2f {
        let b = k * 6u;
        return vec2f(txAt(b) * uv.x + txAt(b + 1u) * uv.y + txAt(b + 2u),
                     txAt(b + 3u) * uv.x + txAt(b + 4u) * uv.y + txAt(b + 5u));
      }

      fn shadeMesh(f: FsIn) -> Shade {
        if (f.zv < world.depthParams.x) { discard; }
        //*Todos los muestreos y derivadas en flujo uniforme (WGSL los exige
        //fuera de branches no uniformes; abajo hay discards y returns).
        //canal UV del slot + su KHR_texture_transform (identidad si no hay)
        let uvB = uvTx(uvSel(mat.tcA.x, f.uv, f.uv1), 0u);
        let uvE = uvTx(uvSel(mat.tcA.y, f.uv, f.uv1), 1u);
        let uvM = uvTx(uvSel(mat.tcA.z, f.uv, f.uv1), 2u);
        let uvO = uvTx(uvSel(mat.tcA.w, f.uv, f.uv1), 3u);
        let uvN = uvTx(uvSel(mat.tcB.x, f.uv, f.uv1), 4u);
        let uvT = uvTx(uvSel(mat.tcB.y, f.uv, f.uv1), 5u);
        let texel = textureSample(t, s, uvB) * mat.factor * f.vColor;
        let trAmt = clamp(mat.emissive.w * textureSample(trTex, s, uvT).r, 0.0, 1.0);
        let emisTexel = textureSample(eTex, eSamp, uvE);
        let mrTexel = textureSample(mrTex, s, uvM);
        let occTexel = textureSample(occTex, s, uvO);
        let nrmTexel = textureSample(nrmTex, s, uvN);
        let dpx = dpdx(f.wW);
        let dpy = dpdy(f.wW);
        let duvx = dpdx(uvN);
        let duvy = dpdy(uvN);

        let base = vec4f(texel.rgb, texel.a * mix(1.0, TRANSMISSION_MIN_ALPHA, trAmt));
        if (light.pointMeta.y > 0.5) { return Shade(vec4f(base.a, base.a, base.a, 1.0), vec3f(0.0), vec3f(0.0)); }
        //*Cutoff del material: MASK usa su alphaCutoff (default glTF 0.5),
        //OPAQUE/BLEND conservan el epsilon historico 0.015.
        let alphaMode = mat.params.w;
        var cutoff = 0.015;
        if (alphaMode > 0.5 && alphaMode < 1.5) { cutoff = clamp(mat.params.z, 0.0, 1.0); }
        let aw = max(fwidth(base.a), 0.0001);
        var outA = base.a;
        if (A2C) {
          //*Alpha-to-coverage: alfa afilado alrededor del cutoff (~1 px de
          //transicion) para que la cobertura MSAA suavice solo el borde.
          outA = clamp((base.a - cutoff) / aw + 0.5, 0.0, 1.0);
          if (outA <= 0.0) { discard; }
        } else if (base.a < cutoff) { discard; }
        if (BLEND_PHASE == 1u && outA < BLEND_OPAQUE_ALPHA) { discard; }
        if (BLEND_PHASE == 2u && outA >= BLEND_OPAQUE_ALPHA) { discard; }

        let exposure = light.eye.w;
        let mode = light.modeAmbShinSpec.x;
        //*Emisivo = luz propia: se suma tambien sin iluminacion (glTF). Los
        //modelos con luz horneada de Sketchfab la guardan aqui con el color
        //base casi negro; sin sumarlo en unlit salian negros.
        let emisRgb = mat.emissive.rgb * emisTexel.rgb;
        if (mode < 0.5) {
          let hdr = (base.rgb + emisRgb) * exposure;
          return Shade(vec4f(toDisplay(hdr), outA), hdr, vec3f(0.0));
        }
        var N = f.nW;
        if (f.noLight > 0.5) { N = cross(dpx, dpy); }
        if (dot(N, N) < 0.000000000001) {
          let hdr = (base.rgb + emisRgb) * exposure;
          return Shade(vec4f(toDisplay(hdr), outA), hdr, vec3f(0.0));
        }
        N = normalize(N);
        //*Normal mapping (modos con luz). Con TANGENT: TBN = (T, cross(N,T)*w, N).
        //Sin TANGENT: marco cotangente por derivadas (Schuler); la V de glTF
        //crece hacia abajo, asi que el verde del mapa se invierte (= three.js).
        if (mat.flags.x > 0.5) {
          var tn = nrmTexel.xyz * 2.0 - vec3f(1.0);
          tn = vec3f(tn.xy * mat.tcB.z, tn.z);
          var T = f.tW.xyz;
          var B = vec3f(0.0);
          if (dot(T, T) > 0.000001) {
            T = normalize(T - N * dot(N, T));
            B = cross(N, T) * select(1.0, -1.0, f.tW.w < 0.0);
            //*Rotacion del texture_transform del normal map: los ejes del
            //mapa giran respecto a (u, v) de la tangente; se contrarrota el
            //XY tangente (sin efecto con rotacion 0). El marco por derivadas
            //no lo necesita: ya usa las UV transformadas.
            let rot = atan2(-txAt(27u), txAt(24u));
            let cr = cos(rot);
            let sr = sin(rot);
            tn = vec3f(cr * tn.x - sr * tn.y, sr * tn.x + cr * tn.y, tn.z);
          } else {
            let dp2perp = cross(dpy, N);
            let dp1perp = cross(N, dpx);
            T = dp2perp * duvx.x + dp1perp * duvy.x;
            B = dp2perp * duvx.y + dp1perp * duvy.y;
            let invmax = inverseSqrt(max(max(dot(T, T), dot(B, B)), 1e-20));
            T = T * invmax;
            B = B * invmax;
            tn.y = -tn.y;
          }
          let pn = T * tn.x + B * tn.y + N * tn.z;
          if (dot(pn, pn) > 1e-12) { N = normalize(pn); }
        }
        if (!f.isFront) { N = -N; }
        let L = normalize(light.lightDir.xyz);
        //*Metal/rugosidad: factor x mapa (G = rugosidad, B = metal; blanco si no hay).
        let metal = clamp(mat.params.x * mrTexel.b, 0.0, 1.0);
        let rough = clamp(mat.params.y * mrTexel.g, 0.0, 1.0);
        //*Oclusion: solo atenua la luz ambiente (glTF), con su intensidad.
        let ao = mix(1.0, occTexel.r, mat.tcB.w);
        //*V para especular: real desde el ojo (perspectiva); en orto, a camara.
        var V = vec3f(0.0, 0.0, -1.0);
        let toEye = light.eye.xyz - f.wW;
        let eyeD2 = dot(toEye, toEye);
        if (eyeD2 > 0.0000000001) { V = toEye * inverseSqrt(eyeD2); }
        let nPoints = i32(min(light.pointMeta.x + 0.5, 4.0));
        let ambient = light.modeAmbShinSpec.y;

        if (mode > 2.5) {
          //*PBR (modo 3): ambiente hemisferico simple (sin IBL) + GGX.
          let F0 = mix(vec3f(0.04), base.rgb, metal);
          var lit = ambient * ao * (base.rgb * (1.0 - metal) + F0 * metal);
          lit = lit + brdfGGX(N, V, L, base.rgb, metal, rough, vec3f(light.lightDir.w));
          for (var k = 0; k < 4; k++) {
            if (k >= nPoints) { break; }
            let pl = light.points[k];
            let range = pl.posRange.w;
            if (range <= 0.0 || pl.colorInt.w <= 0.0) { continue; }
            let toL = pl.posRange.xyz - f.wW;
            let d2 = dot(toL, toL);
            let d = sqrt(d2);
            if (d >= range) { continue; }
            let att = pow(clamp(1.0 - pow(d / range, 4.0), 0.0, 1.0), 2.0) / max(d2, 0.0001);
            lit = lit + brdfGGX(N, V, toL / max(d, 0.000001), base.rgb, metal, rough, pl.colorInt.rgb * (pl.colorInt.w * att));
          }
          let hdr = (lit + emisRgb) * exposure;
          let ambHdr = ambient * ao * (base.rgb * (1.0 - metal) + F0 * metal) * exposure;
          return Shade(vec4f(toDisplay(hdr), outA), hdr, ambHdr);
        }

        let diff = max(dot(N, L), 0.0);
        //*Metales casi no tienen difuso; dielectricos completo.
        var lit = base.rgb * (ambient * ao + (1.0 - ambient) * diff * (1.0 - metal));
        //*Emisivo: factor x mapa, luz propia sin importar NdotL (modos 1 y 2).
        lit = lit + emisRgb;
        //*Termino especular comun (tinte F0 + cantidad + exponente): la
        //direccional lo usa tal cual, las puntuales lo modulan por color/att.
        let specTint = mix(vec3f(1.0), base.rgb, metal);
        let specBase = light.modeAmbShinSpec.w * (1.0 - rough * 0.7) * mix(1.0, 1.25, metal);
        let specShin = clamp(light.modeAmbShinSpec.z * (1.0 - rough * 0.9), 1.0, 256.0);
        if (mode > 1.5) {
          let R = reflect(-L, N);
          lit = lit + specTint * (pow(max(dot(R, V), 0.0), specShin) * specBase);
        }
        //*Puntuales: atenuacion glTF 1/d^2 con ventana suave por rango.
        //Difuso en Lambert y Phong, especular solo en Phong.
        for (var k = 0; k < 4; k++) {
          if (k >= nPoints) { break; }
          let pl = light.points[k];
          let range = pl.posRange.w;
          if (range <= 0.0 || pl.colorInt.w <= 0.0) { continue; }
          let toL = pl.posRange.xyz - f.wW;
          let d2 = dot(toL, toL);
          let d = sqrt(d2);
          if (d >= range) { continue; }
          let att = pow(clamp(1.0 - pow(d / range, 4.0), 0.0, 1.0), 2.0) / max(d2, 0.0001);
          let lum = pl.colorInt.rgb * (pl.colorInt.w * att);
          let Lp = toL / max(d, 0.000001);
          lit = lit + base.rgb * max(dot(N, Lp), 0.0) * lum * (1.0 - metal);
          if (mode > 1.5) {
            let Rp = reflect(-Lp, N);
            lit = lit + specTint * (pow(max(dot(Rp, V), 0.0), specShin) * specBase) * lum;
          }
        }
        let hdr = lit * exposure;
        return Shade(vec4f(toDisplay(hdr), outA), hdr, base.rgb * (ambient * ao * exposure));
      }

      @fragment fn fs(f: FsIn) -> @location(0) vec4f {
        return shadeMesh(f).color;
      }
      //*Variante con bloom (MRT): location 1 = energia que excede el umbral
      //(lineal, pre-tonemap), ponderada por la cobertura del fragmento.
      struct FsBloomOut { @location(0) color: vec4f, @location(1) bloom: vec4f };
      @fragment fn fsBloom(f: FsIn) -> FsBloomOut {
        let r = shadeMesh(f);
        let excess = max(r.hdr - vec3f(light.pointMeta.w), vec3f(0.0)) * r.color.a;
        return FsBloomOut(r.color, vec4f(excess, 1.0));
      }
      //*Variantes con SSAO (MRT, ver SSAO.ts): 2 = fraccion del color que es
      //luz ambiente (r8, con su alfa para mezclarse como el color); 3 =
      //posicion relativa al ojo + unidades mundo por pixel; 4 = normal
      //geometrica hacia el observador (octaedrica). Translucidos
      //(fase 2) y HUD no aportan ambiente (sus pipelines tampoco escriben 3/4)
      //pero si tapan lo de detras con su alfa.
      fn ambRatio(f: FsIn, r: Shade) -> vec4f {
        var k = 0.0;
        if (BLEND_PHASE != 2u && f.aoOn > 0.5) {
          let lw = vec3f(0.2126, 0.7152, 0.0722);
          k = clamp(dot(r.amb, lw) / max(dot(r.hdr, lw), 1e-5), 0.0, 1.0);
        }
        return vec4f(k, 0.0, 0.0, r.color.a);
      }
      ${SSAO_OCT_WGSL}
      //*G-buffer: se llama al principio del entry point (derivadas en flujo uniforme).
      struct Gbuf { pos: vec4f, nrm: vec4f };
      fn gbuf(f: FsIn) -> Gbuf {
        let dpx = dpdx(f.wW);
        let dpy = dpdy(f.wW);
        var n = f.nW;
        if (f.noLight > 0.5 || dot(n, n) < 0.000000000001) { n = cross(dpx, dpy); }
        n = n * inverseSqrt(max(dot(n, n), 1e-20));
        if (!f.isFront) { n = -n; }
        return Gbuf(vec4f(f.wW - light.eye.xyz, max(length(dpx), length(dpy))), vec4f(octEncode(n), 0.0, 0.0));
      }
      struct FsAoOut { @location(0) color: vec4f, @location(2) amb: vec4f, @location(3) pos: vec4f, @location(4) nrm: vec4f };
      @fragment fn fsAo(f: FsIn) -> FsAoOut {
        let g = gbuf(f);
        let r = shadeMesh(f);
        return FsAoOut(r.color, ambRatio(f, r), g.pos, g.nrm);
      }
      struct FsBloomAoOut { @location(0) color: vec4f, @location(1) bloom: vec4f, @location(2) amb: vec4f, @location(3) pos: vec4f, @location(4) nrm: vec4f };
      @fragment fn fsBloomAo(f: FsIn) -> FsBloomAoOut {
        let g = gbuf(f);
        let r = shadeMesh(f);
        let excess = max(r.hdr - vec3f(light.pointMeta.w), vec3f(0.0)) * r.color.a;
        return FsBloomAoOut(r.color, vec4f(excess, 1.0), ambRatio(f, r), g.pos, g.nrm);
      }
    `;

    const commonAttribs = {
      arrayStride: 16,
      attributes: [
        { format: "float32x2", offset: 0, shaderLocation: 0 },
        { format: "float32x2", offset: 8, shaderLocation: 1 },
      ]
    };

    //*Con bloom el pase principal tiene un 2o attachment (rgba16float): todo
    //pipeline que dibuje en el debe declararlo. Los que no aportan bloom
    //(sprites, rects, grid) lo declaran con writeMask 0 (sin tocar su shader).
    const blendAlpha = {
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one",       dstFactor: "one-minus-src-alpha", operation: "add" }
    } as GPUBlendState;
    //*Con SSAO hay 3 attachments mas (2 = ratio de ambiente, 3/4 = G-buffer; el 1 queda
    //vacio sin bloom). amb = true: el shader escribe @location(2) (sprites y
    //rects, que con su alfa tapan el ambiente de las mallas de detras); el
    //grid se dibuja antes que todo y no lo necesita.
    const mainTargets = (blend: GPUBlendState, amb = false): Array<GPUColorTargetState | null> => {
      const t: Array<GPUColorTargetState | null> = [{ format: this.format, blend }];
      if (this.bloomEnabled) t.push({ format: "rgba16float", writeMask: 0 });
      if (this.aoActive) {
        if (!this.bloomEnabled) t.push(null);
        t.push({ format: SSAO_AMB_FORMAT, blend: blendAlpha, writeMask: amb ? GPUColorWrite.ALL : 0 });
        t.push({ format: SSAO_GBUF_FORMAT, writeMask: 0 }, { format: SSAO_NRM_FORMAT, writeMask: 0 });
      }
      return t;
    };
    //*Variante de los shaders de sprites/rects con @location(2) = (0, 0, 0, alfa):
    //mismo fs, el unico "return c;" final pasa a devolver tambien el ambiente.
    const withAmb = (code: string) => {
      const out = code
        .replace(/(@fragment fn fs\((.*)\)) -> @location\(0\) vec4f \{/,
          "struct SpriteAmbOut { @location(0) c: vec4f, @location(2) amb: vec4f };\n      $1 -> SpriteAmbOut {")
        .replace(/return c;(\s*\}\s*)$/, "return SpriteAmbOut(c, vec4f(0.0, 0.0, 0.0, c.a));$1");
      if (!out.includes("SpriteAmbOut {") || !out.includes("return SpriteAmbOut(")) throw new Error("WebGPUCanvas: no se pudo generar la variante SSAO de un shader de sprites");
      return out;
    };
    const spriteCode = (code: string) => (this.aoActive ? withAmb(code) : code);

    //Depth por fragmento: LessEqual preserva el painter en coplanares y
    //arregla planos intersectados/rotados donde el orden por centro miente.
    //*MSAA: todos los pipelines del pase principal comparten sampleCount
    //con sus attachments (el mip blit va aparte, a 1 sample).
    const multisample: GPUMultisampleState = { count: this.sampleCount };

    const depthTest = {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less-equal",
    } as GPUDepthStencilState;

    const rectModule = this.device.createShaderModule({ code: spriteCode(rectShader) });
    const imageModule = this.device.createShaderModule({ code: spriteCode(imageShader) });
    const patternModule = this.device.createShaderModule({ code: spriteCode(patternShader) });
    const meshModule = this.device.createShaderModule({ code: meshShader });
    //*Diagnostico WGSL: sin esto un error de compilacion solo se manifiesta
    //como pipeline/command/submit invalido (cadena opaca). Loguea linea exacta.
    for (const [name, mod] of [["mesh", meshModule]] as Array<[string, GPUShaderModule]>) {
      mod.getCompilationInfo().then((info) => {
        const errs = info.messages.filter((m) => m.type === "error");
        if (errs.length > 0) console.error(`WGSL ${name} compilation errors:`, errs);
        else if (info.messages.length > 0) console.warn(`WGSL ${name} messages:`, info.messages);
      });
    }

    const meshVertexBuffers: Array<GPUVertexBufferLayout | null> = [
      null,
      {
        //ver PACKED_VERTEX_BYTES (GlbPacker)
        arrayStride: PACKED_VERTEX_BYTES,
        attributes: [
          { format: "float32x3", offset: 0, shaderLocation: 0 },  // pos
          { format: "float32x2", offset: 12, shaderLocation: 1 }, // uv0
          { format: "float32x3", offset: 20, shaderLocation: 2 }, // normal
          { format: "float32x2", offset: 32, shaderLocation: 3 }, // uv1
          { format: "float32x4", offset: 40, shaderLocation: 4 }, // tangent
          { format: "unorm8x4", offset: 56, shaderLocation: 5 },  // color
        ],
      },
    ];

    this.shapePipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: rectModule,    entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: rectModule,    entryPoint: "fs", targets: mainTargets(blendAlpha, true) },
      primitive: { topology: "triangle-list" },
      depthStencil: depthTest,
      multisample
    });
    this.texturePipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: imageModule,   entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: imageModule,   entryPoint: "fs", targets: mainTargets(blendAlpha, true) },
      primitive: { topology: "triangle-list" },
      depthStencil: depthTest,
      multisample
    });

    this.patternPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: patternModule, entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: patternModule, entryPoint: "fs", targets: mainTargets(blendAlpha, true) },
      primitive: { topology: "triangle-list" },
      depthStencil: depthTest,
      multisample
    });

    //HUD (ignoreParallax): mismo shader, bypass total de depth (always + sin
    //escritura). No se puede omitir depthStencil: el main pass SIEMPRE lleva
    //depth attachment y pipeline/pass incompatibles invalidan el command buffer
    //(frame entero descartado). Mismo formato para compatibilidad de attachment.
    const depthBypass = {
      format: "depth24plus",
      depthWriteEnabled: false,
      depthCompare: "always",
    } as GPUDepthStencilState;
    this.shapeNoDepthPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: rectModule,    entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: rectModule,    entryPoint: "fs", targets: mainTargets(blendAlpha, true) },
      primitive: { topology: "triangle-list" },
      depthStencil: depthBypass,
      multisample
    });
    //*Mallas 3D: mismo depth que sprites (occlusion coherente sprite<->malla).
    //Buffer 0 sin usar (quads de sprites, slot del pipeline = null), buffer 1
    //= vertices del modelo. Variante HUD sin depth para ignoreParallax.
    //Cull back con frontFace por defecto (ccw, 1 cara): la conversion
    //(x,-y,-z) es una rotacion (no espeja) y pixel-Y-abajo -> NDC-Y-arriba es
    //la misma imagen, asi que las frontales glTF siguen siendo CCW en NDC.
    //BLEND: depth test sin write + orden lejos->cerca en CPU.
    const depthReadOnly = {
      format: "depth24plus",
      depthWriteEnabled: false,
      depthCompare: "less-equal",
    } as GPUDepthStencilState;
    const meshVs = { module: meshModule, entryPoint: "vs", buffers: meshVertexBuffers as any };
    //*Mallas con bloom: entry point fsBloom (MRT), 2o target sin blend
    //(gana el fragmento visible: el excedente ya va ponderado por su alfa).
    //*Con SSAO: fsAo/fsBloomAo (ambiente + G-buffer); solo las variantes que
    //escriben profundidad escriben el G-buffer (translucidas y HUD no).
    const meshFs = (gbuf: boolean) => {
      const targets: Array<GPUColorTargetState | null> = [{ format: this.format, blend: blendAlpha }];
      if (this.bloomEnabled) targets.push({ format: "rgba16float" });
      if (this.aoActive) {
        if (!this.bloomEnabled) targets.push(null);
        const wm = gbuf ? GPUColorWrite.ALL : 0;
        targets.push({ format: SSAO_AMB_FORMAT, blend: blendAlpha }, { format: SSAO_GBUF_FORMAT, writeMask: wm }, { format: SSAO_NRM_FORMAT, writeMask: wm });
      }
      const entryPoint = (this.bloomEnabled ? "fsBloom" : "fs") + (this.aoActive ? "Ao" : "");
      return { module: meshModule, entryPoint, targets };
    };
    this.ensureMeshLayouts();
    //*Composicion del bloom: triangulo fullscreen (sin vertex buffer), suma
    //aditiva one/one sobre la escena; el halo se tonemapea con el mismo modo.
    {
      const compositeModule = this.device.createShaderModule({ code: `
        ${tonemapWGSL}
        struct BloomParams { v: vec4f }; // [intensidad, toneMode, 0, 0]
        @group(0) @binding(0) var<uniform> bp: BloomParams;
        @group(0) @binding(1) var bs: sampler;
        @group(0) @binding(2) var bt: texture_2d<f32>;
        struct VOut { @builtin(position) p: vec4f, @location(0) uv: vec2f };
        @vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
          let xy = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
          return VOut(vec4f(xy * 2.0 - 1.0, 0.0, 1.0), vec2f(xy.x, 1.0 - xy.y));
        }
        @fragment fn fs(in: VOut) -> @location(0) vec4f {
          let b = textureSample(bt, bs, in.uv).rgb * bp.v.x;
          return vec4f(linearToSrgb(applyTonemap(b, bp.v.y)), 0.0);
        }
      ` });
      if (!this.bloomCompositeUniform) {
        this.bloomCompositeUniform = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      }
      this.bloomCompositePipeline = this.device.createRenderPipeline({
        layout: "auto",
        vertex: { module: compositeModule, entryPoint: "vs" },
        fragment: {
          module: compositeModule, entryPoint: "fs",
          targets: [{ format: this.format, blend: {
            color: { srcFactor: "one", dstFactor: "one", operation: "add" },
            alpha: { srcFactor: "zero", dstFactor: "one", operation: "add" },
          } }],
        },
        primitive: { topology: "triangle-list" },
      });
      this.bloomCompositeBg = null;
    }
    const mkMeshPipe = (depthStencil: GPUDepthStencilState, primitive: GPUPrimitiveState, a2c = false, blendPhase = 0, gbuf = true) =>
      this.device.createRenderPipeline({
        layout: this.meshPipelineLayout, vertex: meshVs as any,
        fragment: { ...meshFs(gbuf), constants: { A2C: a2c ? 1 : 0, BLEND_PHASE: blendPhase } } as any,
        primitive, depthStencil,
        multisample: { ...multisample, alphaToCoverageEnabled: a2c },
      });
    //*MASK: alpha-to-coverage (solo con MSAA) suaviza el borde del recorte.
    //Sin MSAA son identicos a depth/ds (cutoff con discard).
    const a2c = this.sampleCount > 1;
    this.meshPipes = {
      depth: mkMeshPipe(depthTest, { topology: "triangle-list", cullMode: "back" }),
      ds: mkMeshPipe(depthTest, { topology: "triangle-list" }),
      mask: mkMeshPipe(depthTest, { topology: "triangle-list", cullMode: "back" }, a2c),
      maskDS: mkMeshPipe(depthTest, { topology: "triangle-list" }, a2c),
      blendPre: mkMeshPipe(depthTest, { topology: "triangle-list", cullMode: "back" }, false, 1),
      blendPreDS: mkMeshPipe(depthTest, { topology: "triangle-list" }, false, 1),
      blendBack: mkMeshPipe(depthReadOnly, { topology: "triangle-list", cullMode: "front" }, false, 2, false),
      blendFront: mkMeshPipe(depthReadOnly, { topology: "triangle-list", cullMode: "back" }, false, 2, false),
      hud: mkMeshPipe(depthBypass, { topology: "triangle-list" }, false, 0, false),
    };
    this.textureNoDepthPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: imageModule,   entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: imageModule,   entryPoint: "fs", targets: mainTargets(blendAlpha, true) },
      primitive: { topology: "triangle-list" },
      depthStencil: depthBypass,
      multisample
    });
    this.patternNoDepthPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: patternModule, entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: patternModule, entryPoint: "fs", targets: mainTargets(blendAlpha, true) },
      primitive: { topology: "triangle-list" },
      depthStencil: depthBypass,
      multisample
    });

    //*Ejes XYZ del grid (line-list exacta cerca del origen). Mismo depth
    //que la escena para oclusión coherente.
    const gridModule = this.device.createShaderModule({ code: `
      struct VOut { @builtin(position) p: vec4f, @location(0) col: vec4f };
      @vertex fn vs(@location(0) pos: vec4f, @location(1) col: vec4f) -> VOut {
        return VOut(pos, col);
      }
      @fragment fn fs(@location(0) col: vec4f) -> @location(0) vec4f {
        if (col.a < 0.015) { discard; }
        return col;
      }
    `});
    this.gridPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: gridModule,
        entryPoint: "vs",
        buffers: [{
          arrayStride: 32,
          attributes: [
            { format: "float32x4", offset: 0, shaderLocation: 0 },
            { format: "float32x4", offset: 16, shaderLocation: 1 },
          ],
        }],
      },
      fragment: { module: gridModule, entryPoint: "fs", targets: mainTargets(blendAlpha) },
      primitive: { topology: "line-list" },
      depthStencil: depthTest,
      multisample
    });

    //*Grid infinito procedural (fullscreen): raycast al plano XZ/XY en el
    //fragment shader con fade por distancia (estilo Blender). Sin alcance
    //máximo ni límite de vértices; reutiliza el quad buffer de sprites.
    //NOTA: usa pinhole puro (invFar≈0); difiere de la proyección del motor
    //en ~Z/maxZ, invisible en el rango con fade. Escribe frag_depth con la
    //misma fórmula zClip de la escena para oclusión coherente.
    const gridInfModule = this.device.createShaderModule({ code: `
      struct GridU {
        eye: vec4f,   // xyz = ojo mundo, w = focalPx
        bx: vec4f,    // right xyz (R^-1 * +X), w = canvasW
        by: vec4f,    // up xyz (R^-1 * +Y), w = canvasH
        bz: vec4f,    // forward xyz (R^-1 * +Z), w = originY
        prm: vec4f,   // spacing, fadeStart, fadeEnd, planeMask (1=XZ,2=XY,4=YZ)
        dep: vec4f,   // near, invFar, usePerspective, showAxesFlag
        col: vec4f,   // rgb 0..1, opacity
      };
      @group(0) @binding(0) var<uniform> g: GridU;

      struct VOut { @builtin(position) p: vec4f, @location(0) uv: vec2f };
      @vertex fn vs(@location(0) pos: vec2f, @location(1) uv: vec2f) -> VOut {
        return VOut(vec4f(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0), uv);
      }

      struct FOut { @location(0) c: vec4f, @builtin(frag_depth) d: f32 };
      @fragment fn fs(@location(0) uv: vec2f) -> FOut {
        let W = g.bx.w;
        let H = g.by.w;
        if (W < 1.0 || H < 1.0 || g.eye.w < 1e-6) { discard; }
        let sx = uv.x * W;
        let sy = uv.y * H;
        let ox = sx - W * 0.5;
        let oy = sy - H * g.bz.w;
        var ro: vec3f;
        var rd: vec3f;
        if (g.dep.z > 0.5) {
          ro = g.eye.xyz;
          rd = normalize(g.bx.xyz * (ox / g.eye.w) + g.by.xyz * (oy / g.eye.w) + g.bz.xyz);
        } else {
          //*Orto: 1 unidad mundo = H px; rayos paralelos a forward.
          let pxW = 1.0 / max(H, 1.0);
          ro = g.eye.xyz + g.bx.xyz * (ox * pxW) + g.by.xyz * (oy * pxW);
          rd = g.bz.xyz;
        }
        //*Hits por plano (t < 0 = sin hit). Todo inline en el fs.
        //*prm.w es bitmask: 1 = XZ (y=0), 2 = XY (z=0), 4 = YZ (x=0).
        let mask = i32(g.prm.w + 0.5);
        var t0 = -1.0;
        var t1 = -1.0;
        var t2 = -1.0;
        if ((mask & 1) != 0) {
          let dn0 = dot(rd, vec3f(0.0, 1.0, 0.0));
          if (abs(dn0) > 1e-8) {
            let t = -dot(ro, vec3f(0.0, 1.0, 0.0)) / dn0;
            if (t > 0.0) { t0 = t; }
          }
        }
        if ((mask & 2) != 0) {
          let dn1 = dot(rd, vec3f(0.0, 0.0, 1.0));
          if (abs(dn1) > 1e-8) {
            let t = -dot(ro, vec3f(0.0, 0.0, 1.0)) / dn1;
            if (t > 0.0) { t1 = t; }
          }
        }
        if ((mask & 4) != 0) {
          let dn2 = dot(rd, vec3f(1.0, 0.0, 0.0));
          if (abs(dn2) > 1e-8) {
            let t = -dot(ro, vec3f(1.0, 0.0, 0.0)) / dn2;
            if (t > 0.0) { t2 = t; }
          }
        }
        //*Ordenar capas de cerca a lejos (red de 3; inválidos a 1e30).
        //*id: 0 = XZ (p2 = hp.xz), 1 = XY (p2 = hp.xy), 2 = YZ (p2 = hp.zy).
        if (t0 < 0.0) { t0 = 1e30; }
        if (t1 < 0.0) { t1 = 1e30; }
        if (t2 < 0.0) { t2 = 1e30; }
        var id0 = 0;
        var id1 = 1;
        var id2 = 2;
        if (t1 < t0) { let tt = t0; t0 = t1; t1 = tt; let ii = id0; id0 = id1; id1 = ii; }
        if (t2 < t1) { let tt = t1; t1 = t2; t2 = tt; let ii = id1; id1 = id2; id2 = ii; }
        if (t1 < t0) { let tt = t0; t0 = t1; t1 = tt; let ii = id0; id0 = id1; id1 = ii; }
        if (t0 > 1e29) { discard; }
        let sp = max(g.prm.x, 1e-4);
        let sp4 = sp * 4.0;
        //*fwidth SOLO en flujo uniforme (el driver lo exige): los p2 se
        //eligen por valor según id (legal), la llamada es incondicional.
        var p2_0 = vec2f(0.0);
        var p2_1 = vec2f(0.0);
        var p2_2 = vec2f(0.0);
        {
          let hp0 = ro + rd * min(t0, g.prm.z * 2.0);
          let hp1 = ro + rd * min(t1, g.prm.z * 2.0);
          let hp2 = ro + rd * min(t2, g.prm.z * 2.0);
          if (id0 == 0) { p2_0 = hp0.xz; } else if (id0 == 1) { p2_0 = hp0.xy; } else { p2_0 = hp0.zy; }
          if (id1 == 0) { p2_1 = hp1.xz; } else if (id1 == 1) { p2_1 = hp1.xy; } else { p2_1 = hp1.zy; }
          if (id2 == 0) { p2_2 = hp2.xz; } else if (id2 == 1) { p2_2 = hp2.xy; } else { p2_2 = hp2.zy; }
        }
        let fw0 = fwidth(p2_0) + vec2f(1e-6);
        let fw1 = fwidth(p2_1) + vec2f(1e-6);
        let fw2 = fwidth(p2_2) + vec2f(1e-6);
        //*Composición lejos -> cerca: en los huecos se ve la capa de atrás.
        var acc = vec4f(0.0);
        var zc = 0.0;
        var haveDepth = false;
        //*Composición lejos -> cerca (slots ya ordenados t0 <= t1 <= t2):
        //slot 2, luego slot 1, luego slot 0 encima de lo acumulado.
        //*Capa más lejana (slot 2).
        if (t2 < 1e29) {
          let hp2 = ro + rd * t2;
          let fade2 = 1.0 - smoothstep(g.prm.y, g.prm.z, t2);
          if (fade2 > 0.001) {
            let glMin2 = abs(fract(p2_2 / sp - 0.5) - 0.5) * sp;
            let aMin2 = 1.0 - smoothstep(vec2f(0.0), fw2 * 1.5, glMin2);
            let glMaj2 = abs(fract(p2_2 / sp4 - 0.5) - 0.5) * sp4;
            let aMaj2 = 1.0 - smoothstep(vec2f(0.0), fw2 * 1.5, glMaj2);
            //*Hueco donde corre un eje (u=0 o v=0 en p2): ahi manda el eje
            //coloreado, no la linea gris. Solo con ejes visibles.
            let gap2 = 1.0 - smoothstep(fw2 * 2.0, fw2 * 3.0, vec2f(abs(p2_2.x), abs(p2_2.y)));
            let lineA2 = max(aMin2.x, aMin2.y) * 0.45 + max(aMaj2.x, aMaj2.y) * 0.55;
            let a2 = g.col.a * fade2 * lineA2 * (1.0 - step(0.5, g.dep.w) * max(gap2.x, gap2.y));
            if (a2 >= 0.015) {
              acc = vec4f(g.col.rgb * a2, a2);
              if (g.dep.z > 0.5) {
                let qz2 = max(dot(hp2 - g.eye.xyz, g.bz.xyz), g.dep.x);
                zc = clamp(1.0 - ((1.0 / qz2) - g.dep.y) / ((1.0 / g.dep.x) - g.dep.y), 0.0, 1.0);
              } else {
                zc = 0.0;
              }
              haveDepth = true;
            }
          }
        }
        //*Capa media (slot 1).
        if (t1 < 1e29) {
          let hp1 = ro + rd * t1;
          let fade1 = 1.0 - smoothstep(g.prm.y, g.prm.z, t1);
          if (fade1 > 0.001) {
            let glMin1 = abs(fract(p2_1 / sp - 0.5) - 0.5) * sp;
            let aMin1 = 1.0 - smoothstep(vec2f(0.0), fw1 * 1.5, glMin1);
            let glMaj1 = abs(fract(p2_1 / sp4 - 0.5) - 0.5) * sp4;
            let aMaj1 = 1.0 - smoothstep(vec2f(0.0), fw1 * 1.5, glMaj1);
            let gap1 = 1.0 - smoothstep(fw1 * 2.0, fw1 * 3.0, vec2f(abs(p2_1.x), abs(p2_1.y)));
            let lineA1 = max(aMin1.x, aMin1.y) * 0.45 + max(aMaj1.x, aMaj1.y) * 0.55;
            let a1 = g.col.a * fade1 * lineA1 * (1.0 - step(0.5, g.dep.w) * max(gap1.x, gap1.y));
            if (a1 >= 0.015) {
              acc = vec4f(g.col.rgb * a1 + acc.rgb * (1.0 - a1), a1 + acc.a * (1.0 - a1));
              if (g.dep.z > 0.5) {
                let qz1 = max(dot(hp1 - g.eye.xyz, g.bz.xyz), g.dep.x);
                zc = clamp(1.0 - ((1.0 / qz1) - g.dep.y) / ((1.0 / g.dep.x) - g.dep.y), 0.0, 1.0);
              } else {
                zc = 0.0;
              }
              haveDepth = true;
            }
          }
        }
        //*Capa cercana (slot 0, encima de lo acumulado).
        {
          let hp0 = ro + rd * t0;
          let fade0 = 1.0 - smoothstep(g.prm.y, g.prm.z, t0);
          if (fade0 > 0.001) {
            let glMin0 = abs(fract(p2_0 / sp - 0.5) - 0.5) * sp;
            let aMin0 = 1.0 - smoothstep(vec2f(0.0), fw0 * 1.5, glMin0);
            let glMaj0 = abs(fract(p2_0 / sp4 - 0.5) - 0.5) * sp4;
            let aMaj0 = 1.0 - smoothstep(vec2f(0.0), fw0 * 1.5, glMaj0);
            let gap0 = 1.0 - smoothstep(fw0 * 2.0, fw0 * 3.0, vec2f(abs(p2_0.x), abs(p2_0.y)));
            let lineA0 = max(aMin0.x, aMin0.y) * 0.45 + max(aMaj0.x, aMaj0.y) * 0.55;
            let a0 = g.col.a * fade0 * lineA0 * (1.0 - step(0.5, g.dep.w) * max(gap0.x, gap0.y));
            if (a0 >= 0.015) {
              acc = vec4f(g.col.rgb * a0 + acc.rgb * (1.0 - a0), a0 + acc.a * (1.0 - a0));
              if (g.dep.z > 0.5) {
                let qz0 = max(dot(hp0 - g.eye.xyz, g.bz.xyz), g.dep.x);
                zc = clamp(1.0 - ((1.0 / qz0) - g.dep.y) / ((1.0 / g.dep.x) - g.dep.y), 0.0, 1.0);
              } else {
                zc = 0.0;
              }
              haveDepth = true;
            }
          }
        }
        if (acc.a < 0.015 || !haveDepth) { discard; }
        return FOut(vec4f(acc.rgb / max(acc.a, 1e-4), acc.a), zc);
      }
    `});
    this.gridInfPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex:   { module: gridInfModule, entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: gridInfModule, entryPoint: "fs", targets: mainTargets(blendAlpha) },
      primitive: { topology: "triangle-list" },
      depthStencil: depthTest,
      multisample
    });
    this.gridInfBindGroup = this.device.createBindGroup({
      layout: this.gridInfPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.gridUniformBuffer } }],
    });
    gridInfModule.getCompilationInfo().then((info) => {
      const errs = info.messages.filter((m) => m.type === "error");
      if (errs.length > 0) console.error("WGSL gridInf compilation errors:", errs);
      else if (info.messages.length > 0) console.warn("WGSL gridInf messages:", info.messages);
      //*Solo se usa el pipeline si compilo limpio: un shader invalido deja
      //el grid apagado en vez de invalidar todo el command buffer.
      this.gridInfReady = errs.length === 0;
    });

    //*Blit lineal para generar mipmaps (texturas rgba8unorm, sin blend ni depth).
    const mipModule = this.device.createShaderModule({ code: `
      struct Out { @builtin(position) p: vec4f, @location(0) uv: vec2f };
      @group(0) @binding(0) var s: sampler;
      @group(0) @binding(1) var t: texture_2d<f32>;
      @vertex fn vs(@location(0) pos: vec2f, @location(1) uv: vec2f) -> Out {
        return Out(vec4f(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0), uv);
      }
      @fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
        return textureSample(t, s, uv);
      }
    `});
    this.mipPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: { module: mipModule, entryPoint: "vs", buffers: [commonAttribs as any] },
      fragment: { module: mipModule, entryPoint: "fs", targets: [{ format: "rgba8unorm" }] },
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
    //*Grupos 0 (instancias + mundo) y 3 (luz direccional + puntuales) de
    //mallas: uno solo para las 7 variantes gracias al layout explicito.
    this.meshGlobalBg = this.device.createBindGroup({
      layout: this.meshBgls![0],
      entries: [
        { binding: 0, resource: { buffer: this.meshInstanceBuffer } },
        { binding: 1, resource: { buffer: this.worldDataBuffer } },
      ],
    });
    this.meshLightBg = this.device.createBindGroup({
      layout: this.meshBgls![3],
      entries: [{ binding: 0, resource: { buffer: this.lightingBuffer } }],
    });
  }
}
