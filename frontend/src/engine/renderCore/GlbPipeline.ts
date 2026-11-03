import { parseGlb, type GlbProgressCallback } from "./GlbParser.ts";
import { decodeGlbImages, packGlbForGpu, type PackedGlbModel } from "./GlbPacker.ts";
import { applyLods, buildLods, decodeLodFile, encodeLodFile, sha256Hex } from "./GlbLod.ts";
import type { ParsedGlbImage } from "./GlbParser.ts";
import { decodeTexFile, imageKinds, type TexImageBC7, type TexKind } from "./GlbTex.ts";

/**
 * Pipeline de carga de un .glb, comun al worker (GlbWorker) y al fallback
 * inline (GlbWorkerClient): parseo -> empaquetado -> LOD (de la cache .lod si
 * es valida, si no generados) -> texturas BC7 de la cache .tex (si es valida)
 * -> decodificacion de las imagenes restantes.
 */
export interface GlbPipelineOptions {
  maxTextureSize?: number;
  /** LOD: `cached` = bytes del .lod existente (null = no hay). */
  lod?: { cached: Uint8Array | null; file: string } | null;
  /** Texturas BC7: `cached` = bytes del .tex existente (null = no hay).
   *  Ausente = sin compresion (todo RGBA8). */
  tex?: { cached: Uint8Array | null } | null;
  /** Solo preparar caches (prerender): sin imagenes decodificadas ni GPU. */
  lodOnly?: boolean;
  /** Con lodOnly: devolver tambien las imagenes y su uso para codificar el .tex. */
  texPrep?: boolean;
  onProgress?: GlbProgressCallback;
  cooperative?: boolean;
}

export interface GlbPipelineResult {
  packed: PackedGlbModel | null;
  bitmaps: Map<number, ImageBitmap>;
  /** .lod nuevo para escribir en disco (ausente = la cache era valida o sin LOD). */
  lodFile?: Uint8Array<ArrayBuffer>;
  lodFromCache?: boolean;
  /** ms dedicados al LOD (generacion o lectura de la cache). */
  lodMs?: number;
  /** Imagenes ya en BC7 (cache .tex valida): no estan en `bitmaps`. */
  compressed?: Map<number, TexImageBC7>;
  /** true = el .tex era valido; false = no habia o no valia (hay que generarlo). */
  texFromCache?: boolean;
  texMs?: number;
  /** texPrep: material para codificar el .tex fuera del pipeline. */
  texSource?: { images: ParsedGlbImage[]; kinds: TexKind[]; sha256: string; size: number };
}

export async function runGlbPipeline(bytes: Uint8Array, opts: GlbPipelineOptions = {}): Promise<GlbPipelineResult> {
  //hash antes del parseo (el buffer de entrada no se modifica)
  const sha256 = opts.lod || opts.tex || opts.texPrep ? await sha256Hex(bytes) : "";
  const size = bytes.byteLength;
  const parsed = await parseGlb(bytes, opts.onProgress, { cooperative: opts.cooperative ?? true });
  const packed = packGlbForGpu(parsed);

  const result: GlbPipelineResult = { packed, bitmaps: new Map() };
  if (opts.lod) {
    const t0 = performance.now();
    let lod = opts.lod.cached ? decodeLodFile(opts.lod.cached, { sha256, primCount: packed.prims.length }) : null;
    result.lodFromCache = !!lod;
    if (!lod) {
      lod = await buildLods(packed);
      result.lodFile = encodeLodFile(lod, { file: opts.lod.file, size, sha256 });
    }
    applyLods(packed, lod);
    result.lodMs = Math.round(performance.now() - t0);
  }
  const maxTextureSize = opts.maxTextureSize ?? 0;
  if (opts.lodOnly) {
    if (opts.texPrep) result.texSource = { images: packed.images, kinds: imageKinds(packed), sha256, size };
    result.packed = null;
    return result;
  }
  if (opts.tex) {
    const t0 = performance.now();
    const compressed = opts.tex.cached && packed.images.length
      ? await decodeTexFile(opts.tex.cached, { sha256, maxTextureSize, imageCount: packed.images.length })
      : null;
    result.texFromCache = !!compressed || packed.images.length === 0;
    if (compressed) result.compressed = compressed;
    result.texMs = Math.round(performance.now() - t0);
  }
  result.bitmaps = await decodeGlbImages(packed.images, maxTextureSize, result.compressed);
  return result;
}
