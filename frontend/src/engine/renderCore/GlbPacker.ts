import type { ParsedGlbBounds, ParsedGlbImage, ParsedGlbMaterial, ParsedGlbModel } from "./GlbParser.ts";

/**
 * Empaquetado GPU de un modelo GLB ya parseado: genera los arrays finales
 * (vertices intercalados + indices) listos para `createBuffer`, sin tocar la
 * GPU. Puro y sin dependencias del engine: corre igual en el hilo principal
 * que en el worker (GlbWorker), y su salida es transferible.
 */

export interface PackedGlbPrim {
  firstIndex: number;
  indexCount: number;
  /** Indice a `materials` (siempre valido). */
  material: number;
  /** Niveles de LOD (ver GlbLod): rangos de iData que reutilizan los mismos
   *  vertices, de menos a mas simplificados; error absoluto en unidades modelo. */
  lods?: Array<{ firstIndex: number; indexCount: number; error: number }>;
}

export interface PackedGlbStats {
  /** Draws por modelo tras agrupar por material (ver packGlbForGpu). */
  prims: number;
  /** Primitivas originales del glTF. */
  srcPrims?: number;
  verts: number;
  tris: number;
  /** Triangulos en el nivel mas simple de LOD (ausente = sin LOD). */
  lodTris?: number;
}

/** Vertice empaquetado: 60 B = 15 floats. Offsets en bytes:
 *  pos f32x3 @0 | uv0 f32x2 @12 | normal f32x3 @20 | uv1 f32x2 @32 |
 *  tangent f32x4 @40 | color unorm8x4 @56 (float 14 = 4 bytes de color). */
export const PACKED_VERTEX_BYTES = 60;
export const PACKED_VERTEX_FLOATS = PACKED_VERTEX_BYTES / 4;

export interface PackedGlbModel {
  /** Vertices intercalados (ver PACKED_VERTEX_BYTES), centrados en
   *  bounds.center y rotados PI sobre X (glTF Y-up -> engine Y-abajo). El
   *  float 14 de cada vertice NO es un float: son los 4 bytes del color. */
  vData: Float32Array<ArrayBuffer>;
  /** u16 si el modelo tiene < 65536 vertices (longitud par: el buffer GPU
   *  debe medir multiplo de 4 bytes), u32 en otro caso. */
  iData: Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
  indexFormat: "uint16" | "uint32";
  prims: PackedGlbPrim[];
  materials: ParsedGlbMaterial[];
  textures: number[];
  /** Bytes propios (copiados): no retienen el BIN completo del .glb. */
  images: ParsedGlbImage[];
  bounds: ParsedGlbBounds;
  stats: PackedGlbStats;
  warnings: string[];
}

/** Bytes de CPU que ocupa un modelo empaquetado (presupuesto de la LRU). */
export function packedByteSize(p: PackedGlbModel): number {
  let n = p.vData.byteLength + p.iData.byteLength;
  for (const img of p.images) n += img.data.byteLength;
  return n;
}

/** Decodifica las imagenes embebidas a ImageBitmaps, en paralelo (gta trae
 *  3 PNG 4K: secuencial sumaba ~1s por imagen). Funciona en hilo principal
 *  y en workers. Una imagen no decodificable se omite (se usara blanco). */
export async function decodeGlbImages(images: ParsedGlbImage[], maxTextureSize = 0, skip?: { has(i: number): boolean }): Promise<Map<number, ImageBitmap>> {
  const bitmaps = new Map<number, ImageBitmap>();
  await Promise.all(images.map(async (img, i) => {
    if (skip?.has(i)) return; //ya viene comprimida (cache .tex)
    try {
      let bmp = await createImageBitmap(new Blob([img.data as unknown as BlobPart], { type: img.mimeType }));
      //*Tope de resolucion (0 = sin tope): una 4096^2 ocupa 85 MB en GPU
      //con mips, una 2048^2 21 MB. Se reduce aqui (worker) antes de subir.
      const big = Math.max(bmp.width, bmp.height);
      if (maxTextureSize > 0 && big > maxTextureSize) {
        const k = maxTextureSize / big;
        const resized = await createImageBitmap(bmp, {
          resizeWidth: Math.max(1, Math.round(bmp.width * k)),
          resizeHeight: Math.max(1, Math.round(bmp.height * k)),
          resizeQuality: "high",
        });
        bmp.close();
        bmp = resized;
      }
      bitmaps.set(i, bmp);
    } catch (imgErr) {
      console.warn(`Model image ${i} no decodificable (se usa blanco):`, imgErr);
    }
  }));
  return bitmaps;
}

const DEFAULT_MATERIAL: ParsedGlbMaterial = {
  baseColorFactor: [1, 1, 1, 1], baseColorTexture: -1, metallic: 0, roughness: 1,
  emissive: [0, 0, 0], emissiveTexture: -1, alphaMode: "OPAQUE", alphaCutoff: 0.5, doubleSided: false,
  transmission: 0, transmissionTexture: -1,
};

export function packGlbForGpu(model: ParsedGlbModel): PackedGlbModel {
  let vertCount = 0, indexCount = 0;
  for (const p of model.primitives) {
    vertCount += p.positions.length / 3;
    indexCount += p.indices.length;
  }
  const bc = model.bounds.center;
  const F = PACKED_VERTEX_FLOATS;
  const vData = new Float32Array(vertCount * F);
  const vBytes = new Uint8Array(vData.buffer);
  const useU16 = vertCount < 65536;
  const iData = useU16 ? new Uint16Array(indexCount + (indexCount & 1)) : new Uint32Array(indexCount);
  const materials = model.materials.length > 0 ? model.materials : [DEFAULT_MATERIAL];
  const prims: PackedGlbPrim[] = [];

  let vo = 0, io = 0;
  const primVo: number[] = []; //primer vertice de cada primitiva
  for (const p of model.primitives) {
    const n = p.positions.length / 3;
    const nrm = p.hasNormals && p.normals.length >= n * 3 ? p.normals : null;
    const uv1 = p.uvs1 && p.uvs1.length >= n * 2 ? p.uvs1 : p.uvs;
    const tan = p.tangents && p.tangents.length >= n * 4 ? p.tangents : null;
    const col = p.colors && p.colors.length >= n * 4 ? p.colors : null;
    for (let v = 0; v < n; v++) {
      const o = (vo + v) * F;
      //*Rotacion PI sobre X: (x,y,z)->(x,-y,-z). El motor usa +Y hacia abajo
      //en pantalla y camara mirando +Z: un modelo glTF Y-up queda upright y
      //de frente, sin espejar (rotacion propia).
      vData[o] = p.positions[v * 3] - bc[0];
      vData[o + 1] = -(p.positions[v * 3 + 1] - bc[1]);
      vData[o + 2] = -(p.positions[v * 3 + 2] - bc[2]);
      vData[o + 3] = p.uvs[v * 2] ?? 0;
      vData[o + 4] = p.uvs[v * 2 + 1] ?? 0;
      if (nrm) {
        const nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
        const il = 1 / Math.max(Math.sqrt(nx * nx + ny * ny + nz * nz), 1e-12);
        vData[o + 5] = nx * il;
        vData[o + 6] = -ny * il;
        vData[o + 7] = -nz * il;
      }
      //sin NORMAL quedan en 0: el fragment usa la normal geometrica de la cara
      //uv1: TEXCOORD_1, o el mismo TEXCOORD_0 si no hay (lightmap = textura normal)
      vData[o + 8] = uv1[v * 2] ?? 0;
      vData[o + 9] = uv1[v * 2 + 1] ?? 0;
      if (tan) {
        //misma rotacion que normales; w intacto (rotacion propia, sin espejo)
        vData[o + 10] = tan[v * 4];
        vData[o + 11] = -tan[v * 4 + 1];
        vData[o + 12] = -tan[v * 4 + 2];
        vData[o + 13] = tan[v * 4 + 3];
      }
      //sin TANGENT queda (0,0,0,0): el fragment usa el marco por derivadas
      const cb = o * 4 + 56;
      if (col) {
        for (let c = 0; c < 4; c++) vBytes[cb + c] = Math.round(Math.min(Math.max(col[v * 4 + c], 0), 1) * 255);
      } else {
        vBytes[cb] = 255; vBytes[cb + 1] = 255; vBytes[cb + 2] = 255; vBytes[cb + 3] = 255;
      }
    }
    primVo.push(vo);
    vo += n;
  }

  //*Agrupacion por material: las primitivas comparten vertex buffer, asi que
  //las de un mismo material se fusionan concatenando sus indices = 1 draw por
  //material (el metro: 1988 primitivas -> 59 draws). Grupos en orden de
  //primera aparicion. Las BLEND solo se fusionan con la BLEND anterior si es
  //del mismo material: entre materiales transparentes distintos se conserva
  //el orden original del glTF (el orden de mezcla importa).
  const groups: Array<{ material: number; members: number[] }> = [];
  const byMaterial = new Map<number, (typeof groups)[number]>();
  let lastBlend: (typeof groups)[number] | undefined;
  model.primitives.forEach((p, i) => {
    const material = p.material >= 0 && p.material < materials.length ? p.material : 0;
    const blend = materials[material].alphaMode === "BLEND";
    let g = blend ? (lastBlend?.material === material ? lastBlend : undefined) : byMaterial.get(material);
    if (!g) {
      g = { material, members: [] };
      groups.push(g);
      if (!blend) byMaterial.set(material, g);
    }
    if (blend) lastBlend = g;
    g.members.push(i);
  });
  for (const g of groups) {
    const firstIndex = io;
    for (const i of g.members) {
      const src = model.primitives[i].indices, base = primVo[i];
      for (let k = 0; k < src.length; k++) iData[io + k] = src[k] + base;
      io += src.length;
    }
    prims.push({ firstIndex, indexCount: io - firstIndex, material: g.material });
  }

  return {
    vData,
    iData,
    indexFormat: useU16 ? "uint16" : "uint32",
    prims,
    materials,
    textures: model.textures,
    images: model.images.map((img) => ({ mimeType: img.mimeType, data: img.data.slice() })),
    bounds: model.bounds,
    stats: { prims: prims.length, srcPrims: model.primitives.length, verts: vertCount, tris: Math.floor(indexCount / 3) },
    warnings: model.warnings,
  };
}
