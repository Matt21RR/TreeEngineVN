import type { PackedGlbModel } from "./GlbPacker.ts";

/**
 * Texturas comprimidas en GPU (BC7) de los modelos GLB.
 *
 * Cada imagen del .glb se codifica UNA vez a UASTC (basis_universal, ver
 * TexEncode) y se transcodifica a BC7, que es lo que se guarda: transcodificar
 * UASTC->BC7 cuesta ~0,4 s por textura de 2048^2, demasiado para cada carga.
 * Asi, cargar es solo leer bytes e inflarlos (deflate nativo del navegador) y
 * subirlos con writeTexture: sin decodificar PNG/JPG y con 1 B/px en VRAM
 * (RGBA8 = 4 B/px).
 *
 * Cache en `models/_tex/<archivo>.glb.tex`, validada por sha256 del .glb +
 * TEX_VERSION + maxTextureSize (el tope se aplica antes de codificar).
 * Este modulo es puro (sin basis): lo usan el worker de carga y el inline.
 */

/** Subir si cambia la codificacion o el formato: invalida todas las .tex. */
//v2: edge padding de los texels transparentes antes de codificar.
export const TEX_VERSION = 2;

/** Uso de la imagen en los materiales: decide los parametros de codificacion
 *  (mips en espacio sRGB, renormalizar normales). */
export type TexKind = "color" | "linear" | "normal";

/** Imagen BC7 lista para subir: niveles de mip concatenados (el 0 primero). */
export interface TexImageBC7 {
  width: number;
  height: number;
  levels: number;
  data: Uint8Array<ArrayBuffer>;
}

/** Imagen codificada tal como se guarda en el .tex (payload = BC7 deflate-raw). */
export interface TexEncodedImage {
  idx: number;
  kind: TexKind;
  width: number;
  height: number;
  levels: number;
  rawLength: number;
  payload: Uint8Array;
}

export interface TexSource {
  file: string;
  size: number;
  sha256: string;
}

/** Bytes de cada nivel BC7 (bloques 4x4 de 16 B; los mips pequenos ocupan un bloque). */
export function bc7LevelSizes(width: number, height: number, levels: number): number[] {
  const out: number[] = [];
  for (let l = 0; l < levels; l++) {
    const w = Math.max(1, width >> l), h = Math.max(1, height >> l);
    out.push(Math.ceil(w / 4) * Math.ceil(h / 4) * 16);
  }
  return out;
}

/** Uso de cada imagen del modelo segun sus materiales. Una imagen usada como
 *  color y como dato se trata como color (es lo que mas se ve). */
export function imageKinds(packed: PackedGlbModel): TexKind[] {
  const kinds: TexKind[] = packed.images.map(() => "linear");
  const rank = { linear: 0, normal: 1, color: 2 } as const;
  const mark = (tex: number | undefined, kind: TexKind) => {
    if (tex === undefined || tex < 0) return;
    const img = packed.textures[tex];
    if (img === undefined || img < 0 || img >= kinds.length) return;
    if (rank[kind] > rank[kinds[img]]) kinds[img] = kind;
  };
  for (const m of packed.materials) {
    mark(m.baseColorTexture, "color");
    mark(m.emissiveTexture, "color");
    mark(m.normalTexture, "normal");
  }
  return kinds;
}

//*Formato .tex: "TTEX" | u32 largo cabecera | cabecera JSON (padding a 4) | payloads.
const MAGIC = 0x58455454; // "TTEX" little-endian

interface TexHeader {
  texVersion: number;
  source: TexSource;
  maxTextureSize: number;
  images: Array<{ idx: number; kind: TexKind; width: number; height: number; levels: number; rawLength: number; offset: number; length: number }>;
}

export function encodeTexFile(images: TexEncodedImage[], source: TexSource, maxTextureSize: number): Uint8Array<ArrayBuffer> {
  let offset = 0;
  const entries = images.map((img) => {
    const e = { idx: img.idx, kind: img.kind, width: img.width, height: img.height, levels: img.levels, rawLength: img.rawLength, offset, length: img.payload.byteLength };
    offset += img.payload.byteLength;
    return e;
  });
  const header = new TextEncoder().encode(JSON.stringify({ texVersion: TEX_VERSION, source, maxTextureSize, images: entries } satisfies TexHeader));
  const headerLen = header.length + ((4 - (header.length % 4)) % 4);
  const out = new Uint8Array(8 + headerLen + offset);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, headerLen, true);
  out.fill(0x20, 8, 8 + headerLen);
  out.set(header, 8);
  for (let i = 0; i < images.length; i++) out.set(images[i].payload, 8 + headerLen + entries[i].offset);
  return out;
}

/** Cabecera de un .tex si es valido para este .glb y tope; null si no. */
function readTexHeader(bytes: Uint8Array, expected: { sha256: string; maxTextureSize: number; imageCount: number }): { header: TexHeader; base: number } | null {
  try {
    if (bytes.byteLength < 8) return null;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (dv.getUint32(0, true) !== MAGIC) return null;
    const headerLen = dv.getUint32(4, true);
    if (8 + headerLen > bytes.byteLength) return null;
    const header: TexHeader = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + headerLen)));
    if (header.texVersion !== TEX_VERSION) return null;
    if (header.source?.sha256 !== expected.sha256) return null;
    if (header.maxTextureSize !== expected.maxTextureSize) return null;
    if (!Array.isArray(header.images)) return null;
    const base = 8 + headerLen;
    for (const e of header.images) {
      if (!(e.idx >= 0 && e.idx < expected.imageCount)) return null;
      if (e.width % 4 || e.height % 4 || e.levels < 1) return null;
      if (base + e.offset + e.length > bytes.byteLength) return null;
      if (e.rawLength !== bc7LevelSizes(e.width, e.height, e.levels).reduce((a, b) => a + b, 0)) return null;
    }
    return { header, base };
  } catch {
    return null;
  }
}

/** Lee un .tex: imagen -> BC7 listo para subir. null si no es valido (otra
 *  version, otro .glb, otro tope o datos corruptos). */
export async function decodeTexFile(bytes: Uint8Array, expected: { sha256: string; maxTextureSize: number; imageCount: number }): Promise<Map<number, TexImageBC7> | null> {
  const parsed = readTexHeader(bytes, expected);
  if (!parsed) return null;
  const out = new Map<number, TexImageBC7>();
  try {
    await Promise.all(parsed.header.images.map(async (e) => {
      const data = await inflateRaw(bytes.subarray(parsed.base + e.offset, parsed.base + e.offset + e.length), e.rawLength);
      if (data.byteLength !== e.rawLength) throw new Error("tamano inflado distinto");
      out.set(e.idx, { width: e.width, height: e.height, levels: e.levels, data });
    }));
  } catch {
    return null;
  }
  return out;
}

async function streamThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, sizeHint = 0): Promise<Uint8Array<ArrayBuffer>> {
  const writer = stream.writable.getWriter();
  writer.write(bytes as Uint8Array<ArrayBuffer>).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  let out = new Uint8Array(sizeHint || bytes.byteLength);
  let len = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (len + value.byteLength > out.byteLength) {
      const grown = new Uint8Array(Math.max(out.byteLength * 2, len + value.byteLength));
      grown.set(out.subarray(0, len));
      out = grown;
    }
    out.set(value, len);
    len += value.byteLength;
  }
  return len === out.byteLength ? out : out.slice(0, len);
}

export function deflateRaw(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  return streamThrough(bytes, new CompressionStream("deflate-raw"));
}

export function inflateRaw(bytes: Uint8Array, rawLength: number): Promise<Uint8Array<ArrayBuffer>> {
  return streamThrough(bytes, new DecompressionStream("deflate-raw"), rawLength);
}
