/// <reference lib="webworker" />
import { runGlbPipeline, type GlbPipelineOptions } from "./GlbPipeline.ts";

/**
 * Worker de carga de modelos: parseo GLB + empaquetado GPU + LOD + decodificacion
 * de imagenes fuera del hilo principal (ver GlbPipeline). Protocolo (GlbWorkerClient):
 *   <- { type: "ready" } al arrancar
 *   -> { reqId, bytes: ArrayBuffer, opts: { maxTextureSize?, lod?: { file, cached: ArrayBuffer|null },
 *          tex?: { cached: ArrayBuffer|null }, lodOnly?, texPrep? } }
 *   <- { reqId, type: "progress", fraction, label }
 *   <- { reqId, type: "done", result: { packed, bitmaps: [imgIdx, ImageBitmap][], lodFile?, lodFromCache?, lodMs?,
 *          compressed?: [imgIdx, TexImageBC7][], texFromCache?, texMs?, texSource? } }  (transferidos)
 *   <- { reqId, type: "error", message }
 */
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (ev: MessageEvent<{ reqId: number; bytes: ArrayBuffer; opts: any }>) => {
  const { reqId, bytes, opts } = ev.data;
  try {
    const pipelineOpts: GlbPipelineOptions = {
      maxTextureSize: opts?.maxTextureSize ?? 0,
      lodOnly: !!opts?.lodOnly,
      lod: opts?.lod ? { file: opts.lod.file, cached: opts.lod.cached ? new Uint8Array(opts.lod.cached) : null } : null,
      tex: opts?.tex ? { cached: opts.tex.cached ? new Uint8Array(opts.tex.cached) : null } : null,
      texPrep: !!opts?.texPrep,
      cooperative: false,
      onProgress: (fraction, label) => ctx.postMessage({ reqId, type: "progress", fraction, label }),
    };
    const r = await runGlbPipeline(new Uint8Array(bytes), pipelineOpts);
    const transfer: Transferable[] = [...r.bitmaps.values()];
    if (r.packed) {
      transfer.push(r.packed.vData.buffer, r.packed.iData.buffer);
      for (const img of r.packed.images) transfer.push(img.data.buffer as ArrayBuffer);
    }
    if (r.lodFile) transfer.push(r.lodFile.buffer);
    if (r.compressed) for (const t of r.compressed.values()) transfer.push(t.data.buffer);
    //texSource.images son las mismas copias que packed.images (packed es null en lodOnly)
    if (r.texSource && !r.packed) for (const img of r.texSource.images) transfer.push(img.data.buffer as ArrayBuffer);
    ctx.postMessage({
      reqId, type: "done",
      result: {
        packed: r.packed, bitmaps: [...r.bitmaps], lodFile: r.lodFile, lodFromCache: r.lodFromCache, lodMs: r.lodMs,
        compressed: r.compressed ? [...r.compressed] : undefined, texFromCache: r.texFromCache, texMs: r.texMs, texSource: r.texSource,
      },
    }, transfer);
  } catch (err: any) {
    ctx.postMessage({ reqId, type: "error", message: String(err?.message ?? err) });
  }
};

ctx.postMessage({ type: "ready" });
