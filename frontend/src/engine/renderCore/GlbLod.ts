import { MeshoptSimplifier } from "meshoptimizer/simplifier";
import { PACKED_VERTEX_FLOATS, type PackedGlbModel } from "./GlbPacker.ts";

/**
 * LOD de modelos GLB con meshoptimizer + cache en disco (`.lod`).
 *
 * Cada primitiva grande gana hasta 3 niveles simplificados que REUTILIZAN el
 * vertex buffer del modelo (solo anaden indices). Cada nivel guarda su error
 * geometrico absoluto (unidades modelo); en render se elige el nivel mas
 * simple cuyo error proyectado en pantalla sea <= lodMaxErrorPx.
 *
 * Generarlos cuesta segundos en escenas grandes, asi que se cachean en
 * `models/_lod/<archivo>.lod`, validados por sha256 del .glb + LOD_VERSION.
 * Modulo puro: corre en el worker y en el fallback inline.
 */

/** Subir si cambia el algoritmo, sus parametros o el orden del empaquetado:
 *  invalida todas las caches .lod existentes (se regeneran solas). */
//v2: los rangos son grupos por material (GlbPacker), no primitivas glTF.
export const LOD_VERSION = 2;

//*Parametros (prototipados con los modelos de game/models):
//niveles al 50/25/10 % de triangulos con error maximo 1/4/12 % del radio.
//Sin LockBorder (bloqueaba la reduccion en escenas de muchas piezas: las
//grietas quedan acotadas por el mismo error que controla la seleccion) y con
//Prune (quita piezas sueltas menores que el error: escombros, detalles).
const LOD_RATIOS = [0.5, 0.25, 0.1];
const LOD_ERRORS = [0.01, 0.04, 0.12];
const LOD_MIN_INDICES = 1000;
const LOD_MIN_REDUCTION = 0.8;

export interface LodLevel {
  /** Offset (en indices) dentro de `indices`. */
  offset: number;
  count: number;
  /** Error absoluto en unidades modelo. */
  error: number;
}

export interface LodData {
  /** lods[i] = niveles de la primitiva i (vacio = sin LOD). */
  prims: LodLevel[][];
  /** Indices de todos los niveles concatenados (apuntan al vertex buffer del modelo). */
  indices: Uint32Array<ArrayBuffer>;
}

export interface LodSource {
  file: string;
  size: number;
  sha256: string;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Genera los niveles de LOD de un modelo empaquetado (sin modificarlo). */
export async function buildLods(packed: PackedGlbModel): Promise<LodData> {
  await MeshoptSimplifier.ready;
  const radius = Math.max(packed.bounds.radius, 1e-6);
  const prims: LodLevel[][] = [];
  const chunks: Uint32Array[] = [];
  let total = 0;
  for (const p of packed.prims) {
    const levels: LodLevel[] = [];
    prims.push(levels);
    if (p.indexCount < LOD_MIN_INDICES) continue;
    let current: Uint32Array = new Uint32Array(packed.iData.subarray(p.firstIndex, p.firstIndex + p.indexCount));
    let prevCount = p.indexCount;
    for (let l = 0; l < LOD_RATIOS.length; l++) {
      const target = Math.min(Math.floor(p.indexCount * LOD_RATIOS[l] / 3) * 3, current.length);
      const [out, err] = MeshoptSimplifier.simplify(
        current, packed.vData, PACKED_VERTEX_FLOATS, target, radius * LOD_ERRORS[l],
        ["Sparse", "ErrorAbsolute", "Prune"],
      );
      //nivel inutil si apenas reduce respecto al anterior
      if (out.length > prevCount * LOD_MIN_REDUCTION) continue;
      levels.push({ offset: total, count: out.length, error: err });
      chunks.push(out);
      total += out.length;
      current = out;
      prevCount = out.length;
    }
  }
  const indices = new Uint32Array(total);
  let o = 0;
  for (const c of chunks) { indices.set(c, o); o += c.length; }
  return { prims, indices };
}

/** Anade los niveles al modelo: indices al final de iData y `lods` por primitiva. */
export function applyLods(packed: PackedGlbModel, lod: LodData): void {
  if (lod.prims.length !== packed.prims.length || lod.indices.length === 0) return;
  const baseCount = packed.prims.reduce((n, p) => Math.max(n, p.firstIndex + p.indexCount), 0);
  const total = baseCount + lod.indices.length;
  const padded = total + (packed.indexFormat === "uint16" ? (total & 1) : 0);
  const iData = packed.indexFormat === "uint16" ? new Uint16Array(padded) : new Uint32Array(padded);
  iData.set(packed.iData.subarray(0, baseCount));
  iData.set(lod.indices, baseCount);
  packed.iData = iData;
  let lodTris = 0;
  packed.prims.forEach((p, i) => {
    const levels = lod.prims[i];
    p.lods = levels.length ? levels.map((l) => ({ firstIndex: baseCount + l.offset, indexCount: l.count, error: l.error })) : undefined;
    lodTris += levels.length ? levels[levels.length - 1].count / 3 : p.indexCount / 3;
  });
  packed.stats.lodTris = Math.round(lodTris);
}

//*Formato .lod: "TLOD" | u32 largo cabecera | cabecera JSON (padding a 4) | indices u32.
const MAGIC = 0x444f4c54; // "TLOD" little-endian

export function encodeLodFile(lod: LodData, source: LodSource): Uint8Array<ArrayBuffer> {
  const header = new TextEncoder().encode(JSON.stringify({
    lodVersion: LOD_VERSION,
    source,
    prims: lod.prims.map((levels) => levels.map((l) => [l.offset, l.count, l.error])),
  }));
  const headerLen = header.length + ((4 - (header.length % 4)) % 4);
  const out = new Uint8Array(8 + headerLen + lod.indices.byteLength);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, headerLen, true);
  out.fill(0x20, 8, 8 + headerLen);
  out.set(header, 8);
  out.set(new Uint8Array(lod.indices.buffer, lod.indices.byteOffset, lod.indices.byteLength), 8 + headerLen);
  return out;
}

/** Lee un .lod; null si no es valido, es de otra version o de otro .glb. */
export function decodeLodFile(bytes: Uint8Array, expected: { sha256: string; primCount: number }): LodData | null {
  try {
    if (bytes.byteLength < 8) return null;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (dv.getUint32(0, true) !== MAGIC) return null;
    const headerLen = dv.getUint32(4, true);
    if (8 + headerLen > bytes.byteLength) return null;
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + headerLen)));
    if (header.lodVersion !== LOD_VERSION) return null;
    if (header.source?.sha256 !== expected.sha256) return null;
    if (!Array.isArray(header.prims) || header.prims.length !== expected.primCount) return null;
    const idxBytes = bytes.byteLength - 8 - headerLen;
    if (idxBytes % 4 !== 0) return null;
    //copia alineada (el offset puede no ser multiplo de 4 en la vista recibida)
    const indices = new Uint32Array(idxBytes / 4);
    new Uint8Array(indices.buffer).set(bytes.subarray(8 + headerLen));
    const prims: LodLevel[][] = header.prims.map((levels: number[][]) => levels.map(([offset, count, error]) => ({ offset, count, error })));
    for (const levels of prims) for (const l of levels) if (l.offset + l.count > indices.length) return null;
    return { prims, indices };
  } catch {
    return null;
  }
}
