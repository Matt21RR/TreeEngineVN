import type { GlbProgressCallback } from "./GlbParser.ts";
import type { PackedGlbModel } from "./GlbPacker.ts";
import type { TexImageBC7 } from "./GlbTex.ts";
import { runGlbPipeline, type GlbPipelineOptions, type GlbPipelineResult } from "./GlbPipeline.ts";

/**
 * Carga de modelos GLB en Web Workers (ver GlbWorker): el hilo principal
 * solo recibe el resultado listo para subir a GPU. Pool pequeno para los
 * modelos que ResourceLoader pide en paralelo. Si los workers no arrancan
 * (entorno sin soporte, error de carga del modulo) se cae a la ruta inline
 * cooperativa (mismo pipeline, GlbPipeline), con el mismo resultado.
 */

export interface LoadedGlb {
  packed: PackedGlbModel;
  /** indice de imagen del modelo -> bitmap decodificado. */
  bitmaps: Map<number, ImageBitmap>;
  /** .lod recien generado para escribir en disco (ausente = cache valida o sin LOD). */
  lodFile?: Uint8Array<ArrayBuffer>;
  lodFromCache?: boolean;
  lodMs?: number;
  /** Imagenes en BC7 de la cache .tex (no estan en `bitmaps`). */
  compressed?: Map<number, TexImageBC7>;
  /** false = no habia .tex valido (generarlo); ausente = sin compresion. */
  texFromCache?: boolean;
  texMs?: number;
}

export interface LoadGlbOptions {
  onProgress?: GlbProgressCallback;
  /** true = transferir (vaciar) el buffer de entrada al worker en vez de
   *  copiarlo. Solo si el llamador ya no lo va a usar. */
  transfer?: boolean;
  /** Lado maximo de las texturas en px (0/ausente = sin tope). */
  maxTextureSize?: number;
  /** LOD: bytes del .lod en cache (null = no hay) y nombre del .glb. Ausente = sin LOD. */
  lod?: { cached: Uint8Array | null; file: string } | null;
  /** Texturas BC7: bytes del .tex en cache (null = no hay). Ausente = todo RGBA8. */
  tex?: { cached: Uint8Array | null } | null;
}

type Pending = {
  resolve: (r: GlbPipelineResult) => void;
  reject: (e: Error) => void;
  onProgress?: GlbProgressCallback;
};

type PoolWorker = { worker: Worker; ready: Promise<boolean>; pending: Map<number, Pending> };

const POOL_SIZE = Math.max(1, Math.min(2, (globalThis.navigator?.hardwareConcurrency ?? 2) - 1));
let pool: PoolWorker[] | null = null;
let workersBroken = false;
let nextReqId = 1;

function spawnWorker(): PoolWorker {
  const worker = new Worker(new URL("./GlbWorker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, Pending>();
  const ready = new Promise<boolean>((resolve) => {
    const onFirst = (ev: MessageEvent) => {
      if (ev.data?.type !== "ready") return;
      worker.removeEventListener("message", onFirst);
      resolve(true);
    };
    worker.addEventListener("message", onFirst);
    //*Fallo al cargar el modulo del worker: nunca llega "ready".
    worker.addEventListener("error", (ev) => {
      console.warn("[GlbWorkerClient] worker no disponible, se usa carga inline:", ev.message);
      workersBroken = true;
      resolve(false);
      for (const p of pending.values()) p.reject(new Error("worker caido: " + ev.message));
      pending.clear();
    });
  });
  worker.addEventListener("message", (ev: MessageEvent) => {
    const msg = ev.data;
    const p = msg?.reqId !== undefined ? pending.get(msg.reqId) : undefined;
    if (!p) return;
    if (msg.type === "progress") {
      p.onProgress?.(msg.fraction, msg.label);
    } else if (msg.type === "done") {
      pending.delete(msg.reqId);
      p.resolve({
        ...msg.result,
        bitmaps: new Map(msg.result.bitmaps),
        compressed: msg.result.compressed ? new Map(msg.result.compressed) : undefined,
      });
    } else if (msg.type === "error") {
      pending.delete(msg.reqId);
      p.reject(new Error(msg.message));
    }
  });
  return { worker, ready, pending };
}

function pickWorker(): PoolWorker | null {
  if (workersBroken || typeof Worker === "undefined") return null;
  try {
    if (!pool) pool = [];
    //*Crece hasta POOL_SIZE; despues, el worker con menos trabajo pendiente.
    if (pool.length < POOL_SIZE && pool.every((w) => w.pending.size > 0)) pool.push(spawnWorker());
    return pool.reduce((a, b) => (b.pending.size < a.pending.size ? b : a));
  } catch (err) {
    console.warn("[GlbWorkerClient] no se pudo crear el worker, se usa carga inline:", err);
    workersBroken = true;
    return null;
  }
}

async function run(bytes: Uint8Array, opts: GlbPipelineOptions, transfer: boolean): Promise<GlbPipelineResult> {
  const pw = pickWorker();
  //*"ready" antes de enviar: si el modulo no carga, los bytes siguen
  //intactos (no transferidos) para la ruta inline.
  if (!pw || !(await pw.ready)) return runGlbPipeline(bytes, { ...opts, cooperative: true });

  const whole = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength;
  const buffer = transfer && whole ? (bytes.buffer as ArrayBuffer) : (bytes.slice().buffer as ArrayBuffer);
  const lodCached = opts.lod?.cached ? (opts.lod.cached.slice().buffer as ArrayBuffer) : null;
  const texCached = opts.tex?.cached ? (opts.tex.cached.slice().buffer as ArrayBuffer) : null;
  const reqId = nextReqId++;
  const { onProgress, ...wireOpts } = opts;
  const transferList: Transferable[] = [buffer];
  if (lodCached) transferList.push(lodCached);
  if (texCached) transferList.push(texCached);
  return new Promise<GlbPipelineResult>((resolve, reject) => {
    pw.pending.set(reqId, { resolve, reject, onProgress });
    pw.worker.postMessage({
      reqId, bytes: buffer,
      opts: {
        ...wireOpts,
        lod: opts.lod ? { file: opts.lod.file, cached: lodCached } : null,
        tex: opts.tex ? { cached: texCached } : null,
      },
    }, transferList);
  });
}

/** Parsea + empaqueta (+ LOD) + decodifica un .glb (en worker si es posible). */
export async function loadGlbPacked(bytes: Uint8Array, opts: LoadGlbOptions = {}): Promise<LoadedGlb> {
  const r = await run(bytes, { maxTextureSize: opts.maxTextureSize ?? 0, lod: opts.lod ?? null, tex: opts.tex ?? null, onProgress: opts.onProgress }, !!opts.transfer);
  return {
    packed: r.packed!, bitmaps: r.bitmaps, lodFile: r.lodFile, lodFromCache: r.lodFromCache, lodMs: r.lodMs,
    compressed: r.compressed, texFromCache: r.texFromCache, texMs: r.texMs,
  };
}

/** Prepara caches de un .glb (prerender: sin imagenes decodificadas ni GPU):
 *  `lod` = generar el .lod; `tex` = devolver las imagenes y su uso para
 *  codificar el .tex (ver TexWorkerClient). */
export async function prepareCaches(bytes: Uint8Array, file: string, want: { lod: boolean; tex: boolean }): Promise<Pick<GlbPipelineResult, "lodFile" | "lodMs" | "texSource">> {
  const r = await run(bytes, { lod: want.lod ? { cached: null, file } : null, lodOnly: true, texPrep: want.tex }, true);
  return { lodFile: r.lodFile, lodMs: r.lodMs ?? 0, texSource: r.texSource };
}
