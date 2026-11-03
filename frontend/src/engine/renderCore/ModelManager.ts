import type { ParsedGlbBounds } from "./GlbParser.ts";
import { packedByteSize, type PackedGlbModel, type PackedGlbStats } from "./GlbPacker.ts";
import { loadGlbPacked, prepareCaches } from "./GlbWorkerClient.ts";
import { encodeTexFile } from "./GlbTex.ts";
import type { GlbPipelineResult } from "./GlbPipeline.ts";
import { encodeTexImages } from "./TexWorkerClient.ts";
import ResourceLoader from "./ResourceLoader.ts";
import RenderMiscWebGPU from "./RenderMiscWebGPU.ts";

/** Lo que el motor recuerda de un modelo ya subido a GPU (siempre en RAM). */
export interface ModelMeta {
  id: string;
  /** Ruta de proyecto del .glb (para volver a pedirlo si sale de la LRU). */
  path: string;
  bounds: ParsedGlbBounds;
  stats: PackedGlbStats;
  warnings: string[];
}

export interface CacheSyncResult {
  /** Archivos .lod/.tex huerfanos borrados. */
  removed: string[];
  /** Ids con .lod generado. */
  generated: string[];
  /** Ids con .tex generado. */
  texGenerated: string[];
}

const DEFAULT_CPU_CACHE_BUDGET = 128 * 1024 * 1024;
const DEFAULT_GPU_BUDGET = 1536 * 1024 * 1024;

/**
 * Cache de modelos 3D (GLB estaticos). Espejo del TextureManager: los
 * modelos persisten entre escenas (no se limpian en dataCleaner) hasta
 * `unloadModel`.
 * - Parseo + empaquetado + decode de imagenes en worker (GlbWorkerClient).
 * - Un modelo cuenta como registrado (`has`, `getBoundsRadius` > 0) solo
 *   cuando ya esta en GPU: antes no se encolan draws de un mesh inexistente.
 * - Los datos CPU empaquetados quedan en una LRU acotada por bytes (para el
 *   visor de herramientas); fuera de ella se vuelven a pedir por HTTP local.
 * - Carga perezosa: el arranque solo registra el indice (id -> archivo) y
 *   cada ModelObject pide su modelo cuando hace falta (RenderingDimentions).
 *   `preloadAll = true` recupera la precarga completa.
 * - Presupuesto de VRAM: al superar `gpuBudget` se expulsan de la GPU los
 *   modelos que llevan mas tiempo sin dibujarse (nunca los que se ven). Su
 *   caja se recuerda, asi que se recargan solos cuando vuelven a ser visibles.
 * - Caches generadas una vez por modelo: LOD (`models/_lod/`) y texturas BC7
 *   (`models/_tex/`). Al arrancar se borran las huerfanas y se generan en
 *   segundo plano las que faltan (ver syncCaches).
 */
class ModelManager{
  private meta = new Map<string, ModelMeta>();
  private inflight = new Map<string, Promise<void>>();
  //*LRU: el orden de insercion del Map es la recencia (get re-inserta).
  private cpuCache = new Map<string, { packed: PackedGlbModel; bytes: number }>();
  private cpuCacheBytes = 0;
  private cpuCacheBudget = DEFAULT_CPU_CACHE_BUDGET;
  //*Indice registrado (id -> ruta) sin cargar nada.
  private index = new Map<string, string>();
  //*Cajas de modelos cargados alguna vez: sobreviven a la expulsion de VRAM
  //para que el culling sepa si un modelo expulsado vuelve a verse.
  private knownBounds = new Map<string, ParsedGlbBounds>();
  //*Fallos de carga: no se reintentan en cada frame.
  private failed = new Set<string>();
  private warnedOverBudget = false;
  /** true = el arranque carga todo models.json (comportamiento anterior). */
  preloadAll = false;
  /** Distancia (unidades mundo, centro del objeto al ojo) a la que un
   *  ModelObject cuyo modelo nunca se cargo pide cargarlo (aun no hay caja
   *  para un culling exacto). */
  lazyLoadDistance = 4;
  /** VRAM maxima (bytes) para modelos antes de expulsar los no usados. */
  gpuBudget = DEFAULT_GPU_BUDGET;
  /** No se expulsa un modelo dibujado hace menos de esto (ms). */
  minIdleMs = 2000;
  /** Lado maximo de las texturas en px al cargar (0 = sin tope). */
  maxTextureSize = 2048;
  /** Un modelo cuya caja proyectada mide menos de esto (px) no se dibuja ni
   *  se carga (0 = desactivado). */
  minScreenPx = 3;
  /** LOD (meshoptimizer): niveles simplificados por primitiva, elegidos por
   *  error en pantalla. Se lee al cargar cada modelo. */
  lodEnabled = true;
  /** Cache de LOD en disco (models/_lod/<archivo>.lod):
   *  "sync" = al arrancar borra los .lod huerfanos y genera en segundo plano
   *  los que faltan; "lazy" = solo se generan/escriben al cargar cada modelo;
   *  "off" = se generan en memoria en cada carga, sin disco. */
  lodCache: "sync" | "lazy" | "off" = "sync";
  //*.lod ya resueltos en esta sesion (leidos, escritos o en cola): evita
  //generar dos veces el mismo modelo (carga normal vs cola del arranque).
  private lodDone = new Set<string>();
  private lodSyncScheduled = false;
  /** Texturas comprimidas BC7 (cache models/_tex/<archivo>.tex): ~4x menos
   *  VRAM y carga sin decodificar PNG/JPG. Codificar es lento (segundos por
   *  textura grande), asi que se hace una sola vez y en segundo plano:
   *  "sync" = al arrancar borra los .tex huerfanos y genera los que faltan;
   *  "lazy" = se generan tras cargar cada modelo que no lo tenga (la primera
   *  carga usa RGBA8); "off" = sin compresion (RGBA8 siempre). */
  texCompression: "sync" | "lazy" | "off" = "sync";
  //*.tex resueltos en esta sesion (leidos, escritos o en cola).
  private texDone = new Set<string>();
  private texQueue: Promise<void> = Promise.resolve();
  private _lodMaxErrorPx = 1;
  /** Error maximo de un LOD en pantalla (px): se usa el nivel mas simple que
   *  no se desvie mas que esto del original. 0 = siempre el original. */
  get lodMaxErrorPx(){ return this._lodMaxErrorPx; }
  set lodMaxErrorPx(px: number){
    this._lodMaxErrorPx = Math.max(0, Number(px) || 0);
    try { RenderMiscWebGPU.getInstance().setLodMaxErrorPx(this._lodMaxErrorPx); } catch { /* renderer aun no creado */ }
  }

  has(id: string): boolean{
    return this.meta.has(id);
  }

  isLoadedOrLoading(id: string): boolean{
    return this.meta.has(id) || this.inflight.has(id);
  }

  getMeta(id: string): ModelMeta | undefined{
    return this.meta.get(id);
  }

  /** @deprecated usar getMeta (ya no se guarda el modelo parseado completo). */
  get(id: string): ModelMeta | undefined{
    return this.meta.get(id);
  }

  registeredIds(): Array<string>{
    return [...this.meta.keys()];
  }

  /** Radio de la esfera envolvente (unidades modelo) o 0 si nunca se cargo.
   *  Se conserva tras expulsarlo de la VRAM (ver knownBounds). */
  getBoundsRadius(id: string): number{
    return (this.meta.get(id)?.bounds ?? this.knownBounds.get(id))?.radius ?? 0;
  }

  /** Semiextensiones de la caja del modelo (unidades modelo). La malla esta
   *  centrada en el centro de la caja, asi que la caja local es +-[hx,hy,hz].
   *  null si el modelo no esta en GPU. */
  getBoundsHalfExtents(id: string): [number, number, number] | null{
    const b = this.meta.get(id)?.bounds ?? this.knownBounds.get(id);
    if (!b) return null;
    return [(b.max[0] - b.min[0]) / 2, (b.max[1] - b.min[1]) / 2, (b.max[2] - b.min[2]) / 2];
  }

  /** Presupuesto en bytes de la cache CPU (0 = no guardar nada). */
  setCpuCacheBudget(bytes: number){
    this.cpuCacheBudget = Math.max(0, bytes);
    this.evictCpuCache();
  }

  /** Arranque del juego: registra el indice y, solo si `preloadAll`, carga todo. */
  prepare(indexPath: string): Promise<null>{
    return this.preloadAll ? this.loadModel(indexPath) : this.registerIndex(indexPath).then(() => null);
  }

  /** Lee models.json y recuerda id -> ruta, sin cargar ningun modelo. */
  async registerIndex(indexPath: string): Promise<number>{
    const index = await ResourceLoader.readModelsIndex(indexPath);
    if (!index) {
      console.warn(`No models index at ${indexPath}, 3D models disabled.`);
      return 0;
    }
    for (const id of Object.keys(index)) this.index.set(id, ResourceLoader.modelPath(index[id]));
    this.scheduleLodSync();
    return this.index.size;
  }

  /** BC7 utilizable: activado y el dispositivo lo admite. */
  private texEnabled(): boolean{
    if (this.texCompression === "off") return false;
    try { return RenderMiscWebGPU.getInstance().supportsBC; } catch { return false; }
  }

  //*Sincronizacion de las caches al arrancar, en segundo plano (no bloquea
  //la escena). El nombre se conserva por compatibilidad: cubre .lod y .tex.
  private scheduleLodSync(){
    if (this.lodSyncScheduled) return;
    const lod = this.lodEnabled && this.lodCache === "sync";
    if (!lod && this.texCompression !== "sync") return;
    this.lodSyncScheduled = true;
    //el renderer puede no haber arrancado aun (supportsBC): se decide al ejecutar
    setTimeout(() => {
      const tex = this.texCompression === "sync" && this.texEnabled();
      this.syncCaches({ lod, tex }).catch((err) => console.warn("[CACHE] sincronizacion fallida:", err));
    }, 1500);
  }

  private cacheSyncRun: Promise<CacheSyncResult | null> | null = null;

  /** Solo la cache de LOD (compatibilidad): ver syncCaches. */
  syncLodCache(): Promise<CacheSyncResult | null>{
    return this.syncCaches({ lod: true, tex: false });
  }

  /** Sincroniza las caches de modelos: borra los .lod/.tex de modelos que ya
   *  no estan en el indice y genera, de uno en uno y sin tocar la GPU, los que
   *  faltan (primero el .lod, rapido; despues el .tex, lento). Llamadas
   *  concurrentes comparten la misma ejecucion. null = sin almacen. */
  syncCaches(want: { lod: boolean; tex: boolean } = { lod: this.lodEnabled, tex: this.texEnabled() }): Promise<CacheSyncResult | null>{
    if (!this.cacheSyncRun) {
      this.lodSyncScheduled = true;
      this.cacheSyncRun = this.doSyncCaches(want).finally(() => { this.cacheSyncRun = null; });
    }
    return this.cacheSyncRun;
  }

  private async doSyncCaches(want: { lod: boolean; tex: boolean }): Promise<CacheSyncResult | null>{
    const lodStore = ResourceLoader.lodStore(), texStore = ResourceLoader.texStore();
    const lodHave = want.lod ? await lodStore.list() : [];
    const texHave = want.tex ? await texStore.list() : [];
    if (lodHave === null || texHave === null) return null; //sin almacen (p.ej. vite sin backend)
    const result: CacheSyncResult = { removed: [], generated: [], texGenerated: [] };
    const lodNames = new Set<string>(), texNames = new Set<string>();
    for (const path of this.index.values()) {
      lodNames.add(ResourceLoader.lodName(path));
      texNames.add(ResourceLoader.texName(path));
    }
    for (const name of lodHave) {
      if (name.endsWith(".lod") && !lodNames.has(name) && await lodStore.remove(name)) result.removed.push(name);
    }
    for (const name of texHave) {
      if (name.endsWith(".tex") && !texNames.has(name) && await texStore.remove(name)) result.removed.push(name);
    }
    const lodSet = new Set(lodHave), texSet = new Set(texHave);
    const queue = [...this.index].map(([id, path]) => ({
      id, path,
      lod: want.lod && !lodSet.has(ResourceLoader.lodName(path)),
      tex: want.tex && !texSet.has(ResourceLoader.texName(path)),
    })).filter((j) => j.lod || j.tex);
    const nLod = queue.filter((j) => j.lod).length, nTex = queue.filter((j) => j.tex).length;
    if (result.removed.length || queue.length) console.info(`[CACHE] ${result.removed.length} huerfanos borrados; por generar: ${nLod} .lod, ${nTex} .tex.`);

    for (const job of queue) {
      //la carga normal pudo haberlo resuelto mientras tanto
      const lod = job.lod && !this.lodDone.has(job.id) && !this.inflight.has(job.id);
      const tex = job.tex && !this.texDone.has(job.id);
      if (!lod && !tex) continue;
      if (lod) this.lodDone.add(job.id);
      if (tex) this.texDone.add(job.id);
      try {
        const t0 = performance.now();
        const bytes = await ResourceLoader.fetchBinary(job.path);
        const { lodFile, lodMs, texSource } = await prepareCaches(bytes, job.path.split("/").pop()!, { lod, tex });
        if (lod && lodFile && await lodStore.write(ResourceLoader.lodName(job.path), lodFile)) {
          result.generated.push(job.id);
          console.info(`[LOD] '${job.id}' generado en ${lodMs} ms (${(lodFile.byteLength / 1048576).toFixed(1)} MB, total ${Math.round(performance.now() - t0)} ms).`);
        }
        if (tex && texSource && await this.buildTexFile(job.id, job.path, texSource)) result.texGenerated.push(job.id);
      } catch (err) {
        if (lod) this.lodDone.delete(job.id);
        if (tex) this.texDone.delete(job.id);
        console.warn(`[CACHE] no se pudo generar la cache de '${job.id}':`, err);
      }
      //cede entre modelos: la cola es de baja prioridad
      await new Promise((r) => setTimeout(r, 50));
    }
    if (result.generated.length || result.texGenerated.length) console.info(`[CACHE] sincronizada: ${result.generated.length} .lod y ${result.texGenerated.length} .tex generados.`);
    return result;
  }

  //*Codifica las imagenes de un modelo a BC7 (pool de TexWorker) y escribe su .tex.
  private async buildTexFile(id: string, path: string, src: NonNullable<GlbPipelineResult["texSource"]>): Promise<boolean>{
    const t0 = performance.now();
    const { encoded, failed } = await encodeTexImages(src.images, src.kinds, this.maxTextureSize);
    const file = encodeTexFile(encoded, { file: path.split("/").pop()!, size: src.size, sha256: src.sha256 }, this.maxTextureSize);
    const ok = await ResourceLoader.texStore().write(ResourceLoader.texName(path), file);
    if (ok) console.info(`[TEX] '${id}': ${encoded.length} texturas BC7${failed ? ` (${failed} fallidas)` : ""} en ${Math.round((performance.now() - t0) / 100) / 10} s (${(file.byteLength / 1048576).toFixed(1)} MB).`);
    return ok;
  }

  //*Modo "lazy" (o modelo cargado antes de que el arranque lo procesara):
  //genera el .tex tras la carga, de uno en uno, sin bloquearla.
  private queueTexBuild(id: string, path: string){
    if (this.texDone.has(id)) return;
    this.texDone.add(id);
    this.texQueue = this.texQueue.then(async () => {
      try {
        const bytes = await ResourceLoader.fetchBinary(path);
        const { texSource } = await prepareCaches(bytes, path.split("/").pop()!, { lod: false, tex: true });
        if (texSource) await this.buildTexFile(id, path, texSource);
      } catch (err) {
        this.texDone.delete(id);
        console.warn(`[TEX] no se pudo generar '${id}':`, err);
      }
    });
  }

  /** Ids del indice registrado (cargados o no). */
  indexedIds(): Array<string>{
    return [...this.index.keys()];
  }

  /** El id existe en el indice (o ya esta cargado). */
  isKnown(id: string): boolean{
    return this.index.has(id) || this.meta.has(id);
  }

  hasIndex(): boolean{
    return this.index.size > 0;
  }

  /** Pide un modelo del indice si no esta cargado (carga perezosa). Las
   *  peticiones repetidas comparten promesa; un fallo no se reintenta.
   *  null = id desconocido o fallido. */
  requestModel(id: string): Promise<void> | null{
    if (this.meta.has(id)) return Promise.resolve();
    if (this.failed.has(id)) return null;
    const path = this.index.get(id);
    if (!path) return null;
    return this.loadOne(id, path).catch((err) => {
      this.failed.add(id);
      console.warn(`Model '${id}' no se pudo cargar:`, err);
    });
  }

  /** VRAM estimada de los modelos en GPU (bytes). */
  gpuBytesUsed(): number{
    const rm = RenderMiscWebGPU.getInstance();
    let total = 0;
    for (const id of this.meta.keys()) total += rm.getModelGpuBytes(id);
    return total;
  }

  setGpuBudget(bytes: number){
    this.gpuBudget = Math.max(0, bytes);
    this.enforceGpuBudget(null);
  }

  /** Expulsa de la GPU los modelos menos recientes (no dibujados en
   *  `minIdleMs`) hasta quedar dentro de `gpuBudget`. `keep` = recien cargado. */
  private enforceGpuBudget(keep: string | null){
    const rm = RenderMiscWebGPU.getInstance();
    let used = this.gpuBytesUsed();
    if (used <= this.gpuBudget) return;
    const now = performance.now();
    const candidates = [...this.meta.keys()]
      .filter((id) => id !== keep && !this.inflight.has(id) && now - rm.getModelLastDrawn(id) > this.minIdleMs)
      .sort((a, b) => rm.getModelLastDrawn(a) - rm.getModelLastDrawn(b));
    for (const id of candidates) {
      if (used <= this.gpuBudget) break;
      used -= rm.getModelGpuBytes(id);
      this.unloadModel(id);
      console.info(`Model '${id}' expulsado de VRAM (presupuesto ${(this.gpuBudget / 1048576).toFixed(0)} MB).`);
    }
    if (used > this.gpuBudget && !this.warnedOverBudget) {
      this.warnedOverBudget = true;
      console.warn(`Modelos visibles ocupan ${(used / 1048576).toFixed(0)} MB, por encima del presupuesto de VRAM (${(this.gpuBudget / 1048576).toFixed(0)} MB).`);
    }
  }

  /** Carga los modelos de un models.json (omite los ya cargados o en curso).
   *  `onlyIds` limita la carga a esos ids (herramientas/harness). */
  loadModel(indexPath:string, onlyIds?: string[]): Promise<null>{
    return ResourceLoader.readModelsIndex(indexPath).then(async (index) => {
      if (!index) {
        console.warn(`No models index at ${indexPath}, skipping 3D preload.`);
        return null;
      }
      for (const id of Object.keys(index)) this.index.set(id, ResourceLoader.modelPath(index[id]));
      this.scheduleLodSync();
      const ids = Object.keys(index).filter((id) => !onlyIds || onlyIds.includes(id));
      await Promise.all(ids.map((id) => {
        if (this.meta.has(id)) {
          console.warn(id + " already in engine model cache");
          return null;
        }
        return this.loadOne(id, ResourceLoader.modelPath(index[id]))
          .catch((err) => console.warn(`Model '${id}' descartado:`, err));
      }));
      return null;
    });
  }

  /** Carga un modelo concreto; cargas concurrentes del mismo id comparten promesa. */
  loadOne(id: string, path: string): Promise<void>{
    const running = this.inflight.get(id);
    if (running) return running;
    const job = this.doLoad(id, path).finally(() => this.inflight.delete(id));
    this.inflight.set(id, job);
    return job;
  }

  private async doLoad(id: string, path: string){
    const t0 = performance.now();
    const useLod = this.lodEnabled;
    const useDisk = useLod && this.lodCache !== "off";
    const useTex = this.texEnabled();
    //.glb, su .lod y su .tex en paralelo (ausente = null)
    const [bytes, cachedLod, cachedTex] = await Promise.all([
      ResourceLoader.fetchBinary(path),
      useDisk ? ResourceLoader.fetchOptional(ResourceLoader.lodPath(path)) : Promise.resolve(null),
      useTex ? ResourceLoader.fetchOptional(ResourceLoader.texPath(path)) : Promise.resolve(null),
    ]);
    const mb = bytes.length / (1024 * 1024);
    const tParse = performance.now();
    const { packed, bitmaps, lodFile, lodFromCache, lodMs, compressed, texFromCache } = await loadGlbPacked(bytes, {
      transfer: true,
      maxTextureSize: this.maxTextureSize,
      lod: useLod ? { cached: cachedLod, file: path.split("/").pop()! } : null,
      tex: useTex ? { cached: cachedTex } : null,
    });
    const tUp = performance.now();
    if (useLod) {
      this.lodDone.add(id);
      //.lod nuevo (no habia o era invalido): se escribe en segundo plano
      if (lodFile && useDisk) {
        ResourceLoader.lodStore().write(ResourceLoader.lodName(path), lodFile)
          .then((ok) => { if (ok) console.info(`[LOD] '${id}' cache escrita (${(lodFile.byteLength / 1048576).toFixed(1)} MB).`); });
      }
    }
    if (useTex) {
      if (texFromCache) this.texDone.add(id);
      else this.queueTexBuild(id, path); //sin .tex valido: esta carga usa RGBA8
    }
    try {
      await RenderMiscWebGPU.getInstance().preloadModel(id, packed, bitmaps, compressed);
    } finally {
      //las texturas ya estan copiadas en GPU
      for (const bmp of bitmaps.values()) bmp.close();
    }
    this.meta.set(id, { id, path, bounds: packed.bounds, stats: packed.stats, warnings: packed.warnings });
    this.knownBounds.set(id, packed.bounds);
    this.index.set(id, path);
    this.putCpuCache(id, packed);
    this.enforceGpuBudget(id);
    const lodInfo = useLod ? ` | LOD ${lodFromCache ? "cache" : "generado"} ${lodMs} ms, ${Math.round(packed.stats.tris / 1000)}k -> ${Math.round((packed.stats.lodTris ?? packed.stats.tris) / 1000)}k tris` : "";
    const texInfo = useTex ? ` | TEX ${compressed?.size ?? 0} BC7${bitmaps.size ? ` + ${bitmaps.size} RGBA8` : ""}` : "";
    console.info(`Model '${id}': ${mb.toFixed(2)} MB, ${packed.stats.prims} prims, ${packed.stats.verts} verts | descarga ${Math.round(tParse - t0)} ms, parseo+decode ${Math.round(tUp - tParse)} ms, subida GPU ${Math.round(performance.now() - tUp)} ms${lodInfo}${texInfo}.`);
  }

  /** Datos CPU empaquetados de un modelo registrado (LRU o re-fetch). */
  async getPacked(id: string): Promise<PackedGlbModel | null>{
    const hit = this.cpuCache.get(id);
    if (hit) {
      this.cpuCache.delete(id);
      this.cpuCache.set(id, hit);
      return hit.packed;
    }
    const meta = this.meta.get(id);
    if (!meta) return null;
    const bytes = await ResourceLoader.fetchBinary(meta.path);
    const { packed, bitmaps } = await loadGlbPacked(bytes, { transfer: true, maxTextureSize: this.maxTextureSize });
    for (const bmp of bitmaps.values()) bmp.close();
    if (this.meta.has(id)) this.putCpuCache(id, packed);
    return packed;
  }

  /** Libera el modelo de GPU y de las caches. Un ModelObject que lo use
   *  deja de dibujarse hasta que se vuelva a cargar. */
  unloadModel(id: string){
    this.meta.delete(id);
    this.dropCpuCache(id);
    RenderMiscWebGPU.getInstance().unloadModel(id);
  }

  private putCpuCache(id: string, packed: PackedGlbModel){
    this.dropCpuCache(id);
    const bytes = packedByteSize(packed);
    if (bytes > this.cpuCacheBudget) return;
    this.cpuCache.set(id, { packed, bytes });
    this.cpuCacheBytes += bytes;
    this.evictCpuCache();
  }

  private dropCpuCache(id: string){
    const prev = this.cpuCache.get(id);
    if (!prev) return;
    this.cpuCacheBytes -= prev.bytes;
    this.cpuCache.delete(id);
  }

  private evictCpuCache(){
    for (const [id] of this.cpuCache) {
      if (this.cpuCacheBytes <= this.cpuCacheBudget) break;
      this.dropCpuCache(id);
    }
  }
}

export default ModelManager
