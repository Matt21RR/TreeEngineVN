/**
 * Parser minimo y estricto de contenedores GLB (glTF 2.0 binario).
 *
 * Alcance MVP (decision D1/D3): mallas estaticas (unlit/Lambert/Phong).
 * - Soporta: primitivas TRIANGLES (mode 4), POSITION VEC3/float, NORMAL VEC3/float,
 *   TEXCOORD_0 VEC2 (float o u8/u16 normalizado), indices u8/u16/u32 (o no
 *   indexado), transformaciones de nodos (matrix o TRS), `pbrMetallicRoughness`
 *   (baseColorFactor/baseColorTexture + metallic/roughness escalares),
 *   emissiveFactor/emissiveTexture, alphaMode/alphaCutoff/doubleSided,
 *   KHR_materials_transmission (aproximado como transparencia),
 *   KHR_materials_pbrSpecularGlossiness (difuso -> baseColor),
 *   KHR_materials_emissive_strength (escala el emisivo), texturas
 *   metallicRoughness/occlusion/normal, TEXCOORD_1 (lightmaps, por `texCoord`
 *   de cada textura), TANGENT, COLOR_0 y KHR_texture_transform,
 *   imagenes embebidas (bufferView) o `data:` URI.
 * - Rechaza con warning (nunca throw hacia el engine): modos no triangulo,
 *   skins, animaciones, materiales sin POSITION, imagenes con URI externa.
 *
 * Puro y sin dependencias del engine: reutilizable en Node para verificacion.
 */

export interface ParsedGlbImage {
  mimeType: string;
  data: Uint8Array;
}

export interface ParsedGlbMaterial {
  baseColorFactor: [number, number, number, number];
  /** Indice a `textures`, -1 = sin textura (solo factor). */
  baseColorTexture: number;
  /** 0 = dielectrico, 1 = metal. Default 0.0 si ausente (desviacion del spec
   *  glTF, que dice 1.0: con 1.0 los modelos sin factor explicito como
   *  asuka/gta quedarian sin difuso bajo luz). */
  metallic: number;
  /** 0 = espejo, 1 = mate. Default 1.0 (= spec glTF), modula shininess/spec. */
  roughness: number;
  /** Luz propia: se suma sin atenuar en modos Lambert/Phong. Default negro. */
  emissive: [number, number, number];
  /** Indice a `textures`, -1 = sin mapa de emisivo (solo factor). */
  emissiveTexture: number;
  /** OPAQUE (default) | MASK (cutout con alphaCutoff) | BLEND (transparente,
   *  sin escritura de profundidad, ordenado lejos->cerca). */
  alphaMode: "OPAQUE" | "MASK" | "BLEND";
  /** Umbral de descarte para MASK. Default 0.5 (= spec glTF). */
  alphaCutoff: number;
  /** true = doble cara (sin culling). Default false (= cull de traseras). */
  doubleSided: boolean;
  /** KHR_materials_transmission: 0 = opaco, 1 = cristal (luz que atraviesa).
   *  El motor no refracta: lo aproxima como transparencia. Default 0. */
  transmission: number;
  /** Indice a `textures` (canal R modula `transmission`), -1 = sin mapa. */
  transmissionTexture: number;
  /** Indice a `textures`: G = roughness, B = metallic (multiplican los
   *  factores). -1/ausente = solo factores. */
  metallicRoughnessTexture?: number;
  /** Indice a `textures` (canal R = oclusion ambiental). -1/ausente = sin AO. */
  occlusionTexture?: number;
  /** Intensidad de la oclusion (glTF `occlusionTexture.strength`). Default 1. */
  occlusionStrength?: number;
  /** Indice a `textures` (normal map en espacio tangente). -1/ausente = sin relieve. */
  normalTexture?: number;
  /** Escala XY del normal map (glTF `normalTexture.scale`). Default 1. */
  normalScale?: number;
  /** Set de UV (0 = TEXCOORD_0, 1 = TEXCOORD_1) de cada textura. Los lightmaps
   *  suelen ir en el 1 (p. ej. emisivo/oclusion horneados). Ausente = todo 0. */
  texCoords?: { base: number; emissive: number; mr: number; occlusion: number; normal: number; transmission: number };
  /** KHR_texture_transform por textura: matriz 2x3 [a, b, c, d, e, f] con
   *  u' = a*u + b*v + c, v' = d*u + e*v + f (= T * R * S del spec). Ausente o
   *  null = identidad. */
  texTransforms?: { base: TexTransform | null; emissive: TexTransform | null; mr: TexTransform | null; occlusion: TexTransform | null; normal: TexTransform | null; transmission: TexTransform | null };
}

/** Matriz 2x3 de KHR_texture_transform (ver ParsedGlbMaterial.texTransforms). */
export type TexTransform = [number, number, number, number, number, number];

export interface ParsedGlbPrimitive {
  /** xyz xyz ... en espacio "mundo glTF" (jerarquia de nodos ya aplicada). */
  positions: Float32Array<ArrayBufferLike>;
  /** uv uv ... (relleno con 0,0 si la malla no trae TEXCOORD_0). */
  uvs: Float32Array<ArrayBufferLike>;
  /** xyz xyz ... normales en mundo glTF (ceros si la malla no trae NORMAL:
   *  el shader usa la normal geometrica de la cara como fallback). */
  normals: Float32Array<ArrayBufferLike>;
  /** true si la primitiva trae NORMAL valida (false = fallback a face-normal en shader). */
  hasNormals: boolean;
  /** uv uv ... de TEXCOORD_1 (lightmaps), null si no hay. */
  uvs1?: Float32Array<ArrayBufferLike> | null;
  /** xyzw ... TANGENT en mundo glTF (xyz normalizado, w = signo de la
   *  bitangente), null si no hay (el shader usa el marco por derivadas). */
  tangents?: Float32Array<ArrayBufferLike> | null;
  /** rgba ... COLOR_0 lineal (VEC3 -> alpha 1), null si no hay. */
  colors?: Float32Array<ArrayBufferLike> | null;
  indices: Uint32Array<ArrayBufferLike>;
  material: number;
}

/** Caja (AABB) y esfera envolvente en espacio glTF. `center` = centro de la
 *  caja (pivote del modelo), `radius` = distancia maxima de un vertice a el. */
export interface ParsedGlbBounds {
  center: [number, number, number];
  radius: number;
  min: [number, number, number];
  max: [number, number, number];
}

export interface ParsedGlbModel {
  primitives: ParsedGlbPrimitive[];
  materials: ParsedGlbMaterial[];
  /** textures[i] = indice a `images` (o -1 si no resoluble). */
  textures: number[];
  images: ParsedGlbImage[];
  bounds: ParsedGlbBounds;
  warnings: string[];
}

export interface ParseGlbOptions {
  /** true (default) = ceder el hilo periodicamente en bucles largos para no
   *  congelar la UI. En un worker no hace falta (false = sin cesiones). */
  cooperative?: boolean;
}

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const COMPONENT_BYTE_SIZE: Record<number, number> = {
  5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4,
};

const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16,
};

type Mat4 = Float32Array; // 16 numeros, column-major (convencion glTF)

function mat4Identity(): Mat4 {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function quatToMat4(q: [number, number, number, number]): Mat4 {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return new Float32Array([
    1 - (yy + zz), yz + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xy + wz, yz - wx, 1 - (xx + yy), 0,
    0, 0, 0, 1,
  ]);
}

function composeNodeMatrix(node: any): Mat4 {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    return new Float32Array(node.matrix);
  }
  const t: [number, number, number] = Array.isArray(node.translation) ? [node.translation[0] ?? 0, node.translation[1] ?? 0, node.translation[2] ?? 0] : [0, 0, 0];
  const s: [number, number, number] = Array.isArray(node.scale) ? [node.scale[0] ?? 1, node.scale[1] ?? 1, node.scale[2] ?? 1] : [1, 1, 1];
  const r: [number, number, number, number] = Array.isArray(node.rotation) ? [node.rotation[0] ?? 0, node.rotation[1] ?? 0, node.rotation[2] ?? 0, node.rotation[3] ?? 1] : [0, 0, 0, 1];
  const rot = quatToMat4(r);
  // M = T * R * S
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    out[c * 4] = rot[c * 4] * s[c];
    out[c * 4 + 1] = rot[c * 4 + 1] * s[c];
    out[c * 4 + 2] = rot[c * 4 + 2] * s[c];
    out[c * 4 + 3] = rot[c * 4 + 3];
  }
  out[12] = t[0]; out[13] = t[1]; out[14] = t[2];
  return out;
}

/** Matriz de normales (inversa-transpuesta del 3x3 lineal, salvo escala:
 *  la adjunta transpuesta, se renormaliza despues). Correcta con escala no
 *  uniforme; con TRS rigida equivale a rotar. Column-major, 9 numeros. */
function normalMatrix(m: Mat4): Float64Array {
  const a00 = m[0], a10 = m[1], a20 = m[2];
  const a01 = m[4], a11 = m[5], a21 = m[6];
  const a02 = m[8], a12 = m[9], a22 = m[10];
  return new Float64Array([
    a11 * a22 - a12 * a21, a12 * a20 - a10 * a22, a10 * a21 - a11 * a20,
    a02 * a21 - a01 * a22, a00 * a22 - a02 * a20, a01 * a20 - a00 * a21,
    a01 * a12 - a02 * a11, a02 * a10 - a00 * a12, a00 * a11 - a01 * a10,
  ]);
}

function parseDataUri(uri: string): { mimeType: string; data: Uint8Array } | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(uri);
  if (!match || match[2] !== ";base64") return null;
  const b64 = match[3];
  const bin = new Uint8Array(Math.ceil((b64.length * 3) / 4));
  let written = 0;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Map<string, number>();
  for (let i = 0; i < chars.length; i++) lookup.set(chars[i], i);
  let buffer = 0, bits = 0;
  for (const ch of b64) {
    if (ch === "=") break;
    const v = lookup.get(ch);
    if (v === undefined) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bin[written++] = (buffer >> bits) & 0xff;
    }
  }
  return { mimeType: match[1] || "application/octet-stream", data: bin.subarray(0, written) };
}

/**
 * Decodifica base64 a bytes por bloques con cesiones al event loop.
 * Evita congelar el hilo principal varios segundos con archivos grandes
 * (un .glb de 46MB viaja como ~61MB de base64: atob + bucle charCodeAt
 * monoliticos bloquean la UI y el boot de la escena).
 * El tamano de bloque es multiplo de 4 para no romper grupos base64.
 */
export async function base64ToBytesAsync(b64: string, chunkChars = 4 * 1024 * 1024): Promise<Uint8Array> {
  const out = new Uint8Array(Math.ceil((b64.length * 3) / 4));
  let offset = 0;
  for (let i = 0; i < b64.length; i += chunkChars) {
    const bin = atob(b64.slice(i, Math.min(i + chunkChars, b64.length)));
    for (let j = 0; j < bin.length; j++) out[offset++] = bin.charCodeAt(j);
    if (i + chunkChars < b64.length) await new Promise((r) => setTimeout(r, 0));
  }
  return out.subarray(0, offset);
}

export type GlbProgressCallback = (fraction: number, label: string) => void;

type TypedArrayCtor = Int8ArrayConstructor | Uint8ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor;
const COMPONENT_ARRAY: Record<number, TypedArrayCtor> = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array,
};
//*Divisor de accessors `normalized` (glTF: signed = max(v / max, -1)).
const NORMALIZE_DIV: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

export async function parseGlb(data: Uint8Array, onProgress?: GlbProgressCallback, opts?: ParseGlbOptions): Promise<ParsedGlbModel> {
  const warnings: string[] = [];
  const warn = (msg: string) => {
    if (!warnings.includes(msg)) warnings.push(msg);
    console.warn("[GlbParser] " + msg);
  };
  //*Cesion cooperativa (hilo principal): los bucles largos ceden el hilo cada
  //64k iteraciones para no congelar la UI con mallas grandes (gta.glb). El
  //chequeo es sincrono: solo se paga un `await` cuando de verdad se cede
  //(un await por elemento costaba un microtask por vertice).
  const cooperative = opts?.cooperative !== false;
  const shouldYield = (i: number) => cooperative && (i & 0xffff) === 0xffff;
  const yieldNow = () => new Promise((r) => setTimeout(r, 0));

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.byteLength < 12) throw new Error("GLB demasiado corto (< 12 bytes)");
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error("magic GLB invalido");
  if (view.getUint32(4, true) !== 2) throw new Error("version GLB != 2");
  const totalLength = view.getUint32(8, true);
  if (totalLength !== data.byteLength) throw new Error(`longitud GLB incoherente (${totalLength} vs ${data.byteLength})`);

  let jsonDoc: any = null;
  let bin: Uint8Array | null = null;
  let cursor = 12;
  while (cursor + 8 <= data.byteLength) {
    const chunkLength = view.getUint32(cursor, true);
    const chunkType = view.getUint32(cursor + 4, true);
    const chunkData = data.subarray(cursor + 8, cursor + 8 + chunkLength);
    if (chunkType === CHUNK_JSON) jsonDoc = JSON.parse(new TextDecoder().decode(chunkData));
    else if (chunkType === CHUNK_BIN) bin = chunkData;
    cursor += 8 + chunkLength;
  }
  if (!jsonDoc) throw new Error("GLB sin chunk JSON");
  if (!bin) throw new Error("GLB sin chunk BIN");
  const binBytes: Uint8Array = bin;
  const binView = new DataView(binBytes.buffer, binBytes.byteOffset, binBytes.byteLength);

  const bufferViews: any[] = jsonDoc.bufferViews ?? [];
  const accessors: any[] = jsonDoc.accessors ?? [];

  //*Copia densa (sin stride) de un accessor en su tipo nativo. Fast path:
  //datos compactos y alineados (el caso normal: glTF exige alineacion) se
  //copian de golpe con una vista tipada; si no (interleaved o desalineado),
  //lectura por DataView elemento a elemento.
  const readRaw = async (acc: any, index: number) => {
    const bv = bufferViews[acc.bufferView];
    if (!bv) throw new Error(`bufferView ${acc.bufferView} inexistente (accessor ${index})`);
    const ct: number = acc.componentType;
    const compSize = COMPONENT_BYTE_SIZE[ct];
    const components = TYPE_COMPONENTS[acc.type];
    const Ctor = COMPONENT_ARRAY[ct];
    if (!compSize || !components || !Ctor) throw new Error(`accessor ${index}: componentType ${ct}/type ${acc.type} no soportado`);
    if (acc.sparse !== undefined) throw new Error(`accessor ${index}: sparse no soportado en MVP`);
    const tight = compSize * components;
    const stride: number = bv.byteStride || tight;
    const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const count: number = acc.count;
    const n = count * components;
    if (count > 0 && base + (count - 1) * stride + tight > binBytes.byteLength) {
      throw new Error(`accessor ${index}: fuera del chunk BIN`);
    }
    const absOff = binBytes.byteOffset + base;
    if (stride === tight && absOff % compSize === 0) {
      return { raw: new Ctor(binBytes.buffer as ArrayBuffer, absOff, n), ct, count, components, isView: true };
    }
    const raw = new Ctor(n);
    for (let i = 0; i < count; i++) {
      const rowOff = base + i * stride;
      for (let c = 0; c < components; c++) {
        const off = rowOff + c * compSize;
        raw[i * components + c] =
          ct === 5126 ? binView.getFloat32(off, true) :
          ct === 5125 ? binView.getUint32(off, true) :
          ct === 5123 ? binView.getUint16(off, true) :
          ct === 5122 ? binView.getInt16(off, true) :
          ct === 5121 ? binView.getUint8(off) : binView.getInt8(off);
      }
      if (shouldYield(i)) await yieldNow();
    }
    return { raw, ct, count, components, isView: false };
  };

  //Lee un accessor como Float32Array (float o entero `normalized`) o
  //Uint32Array (enteros sin signo). Siempre devuelve memoria propia: nunca
  //una vista del BIN (para no retenerlo entero).
  const readAccessor = async (index: number): Promise<{ values: Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>; count: number; components: number }> => {
    const acc = accessors[index];
    if (!acc) throw new Error(`accessor ${index} inexistente`);
    const { raw, ct, count, components, isView } = await readRaw(acc, index);
    if (ct === 5126) {
      const f = raw as Float32Array;
      return { values: isView ? f.slice() : (f as Float32Array<ArrayBuffer>), count, components };
    }
    if (acc.normalized === true) {
      const div = NORMALIZE_DIV[ct];
      const out = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) out[i] = Math.max(raw[i] / div, -1);
      return { values: out, count, components };
    }
    if (ct === 5121 || ct === 5123 || ct === 5125) {
      //new Uint32Array(typed) copia (y ensancha u8/u16)
      return { values: new Uint32Array(raw as Uint8Array | Uint16Array | Uint32Array), count, components };
    }
    throw new Error(`accessor ${index}: componentType ${ct} con signo sin normalized no soportado`);
  };

  // --- Imagenes ---
  const images: ParsedGlbImage[] = [];
  for (const img of jsonDoc.images ?? []) {
    if (img.bufferView !== undefined) {
      const bv = bufferViews[img.bufferView];
      if (!bv) { warn(`imagen con bufferView ${img.bufferView} inexistente (omitida)`); continue; }
      images.push({
        mimeType: img.mimeType ?? "application/octet-stream",
        data: bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength),
      });
    } else if (typeof img.uri === "string" && img.uri.startsWith("data:")) {
      const decoded = parseDataUri(img.uri);
      if (!decoded) { warn("imagen data: URI no base64 (omitida)"); continue; }
      images.push(decoded);
    } else {
      warn(`imagen con URI externa '${img.uri ?? img.name ?? "?"}' no soportada en MVP (omitida)`);
    }
  }

  // --- Texturas: indice -> imagen ---
  const textures: number[] = [];
  for (const tex of jsonDoc.textures ?? []) {
    const src = tex.source ?? -1;
    textures.push(src >= 0 && src < images.length ? src : -1);
    if (textures[textures.length - 1] === -1) warn("textura sin imagen resoluble (usara color plano)");
  }

  // --- Materiales ---
  const materials: ParsedGlbMaterial[] = [];
  for (const mat of jsonDoc.materials ?? []) {
    //*KHR_materials_pbrSpecularGlossiness (extension antigua, p.ej. tardis):
    //el color vive en diffuseFactor/diffuseTexture. Se mapea a metallic-
    //roughness basico (difuso -> baseColor, roughness = 1 - glossiness);
    //sin esto el material quedaba blanco y sin textura.
    const sg = mat.pbrMetallicRoughness ? null : mat.extensions?.KHR_materials_pbrSpecularGlossiness;
    const pbr = mat.pbrMetallicRoughness ?? (sg ? {
      baseColorFactor: sg.diffuseFactor,
      baseColorTexture: sg.diffuseTexture,
      metallicFactor: 0,
      roughnessFactor: Number.isFinite(sg.glossinessFactor) ? 1 - sg.glossinessFactor : 0,
    } : {});
    const f = pbr.baseColorFactor ?? [1, 1, 1, 1];
    const texIdx = pbr.baseColorTexture?.index ?? -1;
    const e = mat.emissiveFactor ?? [0, 0, 0];
    const emiTexIdx = mat.emissiveTexture?.index ?? -1;
    //KHR_materials_emissive_strength: multiplica emissiveFactor (HDR).
    const esRaw = mat.extensions?.KHR_materials_emissive_strength?.emissiveStrength;
    const emStrength = Number.isFinite(esRaw) && esRaw > 0 ? esRaw : 1;
    const amRaw = mat.alphaMode;
    const alphaMode = amRaw === "BLEND" ? "BLEND" : amRaw === "MASK" ? "MASK" : "OPAQUE";
    if (amRaw !== undefined && amRaw !== "OPAQUE" && alphaMode === "OPAQUE") {
      warn(`alphaMode '${amRaw}' desconocido (se usa OPAQUE)`);
    }
    const acRaw = mat.alphaCutoff;
    const tr = mat.extensions?.KHR_materials_transmission;
    const trTexIdx = tr?.transmissionTexture?.index ?? -1;
    const texOrNone = (info: any) => {
      const i = info?.index ?? -1;
      return i >= 0 && i < textures.length ? i : -1;
    };
    //Set de UV de cada textura: solo 0/1 (TEXCOORD_2+ no se cargan).
    const tcOf = (info: any) => {
      //KHR_texture_transform.texCoord sustituye al texCoord del textureInfo
      const tc = info?.extensions?.KHR_texture_transform?.texCoord ?? info?.texCoord ?? 0;
      if (tc > 1) { warn(`textura con texCoord ${tc} no soportado (se usa TEXCOORD_0)`); return 0; }
      return tc === 1 ? 1 : 0;
    };
    //*KHR_texture_transform: offset/rotation/scale -> matriz 2x3 T*R*S.
    //rotation en radianes (antihoraria en UV): R = [cos sin; -sin cos].
    const txOf = (info: any): TexTransform | null => {
      const t = info?.extensions?.KHR_texture_transform;
      if (!t) return null;
      const num = (v: any, d: number) => (Number.isFinite(v) ? v : d);
      const ox = num(t.offset?.[0], 0), oy = num(t.offset?.[1], 0);
      const sx = num(t.scale?.[0], 1), sy = num(t.scale?.[1], 1);
      const r = num(t.rotation, 0);
      if (ox === 0 && oy === 0 && sx === 1 && sy === 1 && r === 0) return null;
      const c = Math.cos(r), sn = Math.sin(r);
      return [c * sx, sn * sy, ox, -sn * sx, c * sy, oy];
    };
    const ns = mat.normalTexture?.scale;
    const os = mat.occlusionTexture?.strength;
    materials.push({
      baseColorFactor: [f[0] ?? 1, f[1] ?? 1, f[2] ?? 1, f[3] ?? 1],
      baseColorTexture: texIdx >= 0 && texIdx < textures.length ? texIdx : -1,
      //sin factor: 0 (desviacion historica), salvo que haya mapa MR: entonces
      //1 (= glTF) para que el canal B del mapa decida que es metal
      metallic: Number.isFinite(pbr.metallicFactor) ? Math.min(Math.max(pbr.metallicFactor, 0), 1) : (pbr.metallicRoughnessTexture ? 1 : 0),
      roughness: Number.isFinite(pbr.roughnessFactor) ? Math.min(Math.max(pbr.roughnessFactor, 0), 1) : 1,
      emissive: [(e[0] ?? 0) * emStrength, (e[1] ?? 0) * emStrength, (e[2] ?? 0) * emStrength],
      emissiveTexture: emiTexIdx >= 0 && emiTexIdx < textures.length ? emiTexIdx : -1,
      alphaMode,
      alphaCutoff: Number.isFinite(acRaw) ? Math.min(Math.max(acRaw, 0), 1) : 0.5,
      doubleSided: mat.doubleSided === true,
      transmission: Number.isFinite(tr?.transmissionFactor) ? Math.min(Math.max(tr.transmissionFactor, 0), 1) : 0,
      transmissionTexture: trTexIdx >= 0 && trTexIdx < textures.length ? trTexIdx : -1,
      metallicRoughnessTexture: texOrNone(pbr.metallicRoughnessTexture),
      occlusionTexture: texOrNone(mat.occlusionTexture),
      occlusionStrength: Number.isFinite(os) ? Math.min(Math.max(os, 0), 1) : 1,
      normalTexture: texOrNone(mat.normalTexture),
      normalScale: Number.isFinite(ns) ? ns : 1,
      texCoords: {
        base: tcOf(pbr.baseColorTexture),
        emissive: tcOf(mat.emissiveTexture),
        mr: tcOf(pbr.metallicRoughnessTexture),
        occlusion: tcOf(mat.occlusionTexture),
        normal: tcOf(mat.normalTexture),
        transmission: tcOf(tr?.transmissionTexture),
      },
      texTransforms: {
        base: txOf(pbr.baseColorTexture),
        emissive: txOf(mat.emissiveTexture),
        mr: txOf(pbr.metallicRoughnessTexture),
        occlusion: txOf(mat.occlusionTexture),
        normal: txOf(mat.normalTexture),
        transmission: txOf(tr?.transmissionTexture),
      },
    });
  }
  if (materials.length === 0) {
    materials.push({ baseColorFactor: [1, 1, 1, 1], baseColorTexture: -1, metallic: 0, roughness: 1, emissive: [0, 0, 0], emissiveTexture: -1, alphaMode: "OPAQUE", alphaCutoff: 0.5, doubleSided: false, transmission: 0, transmissionTexture: -1 });
  }

  // --- Geometria: recorre escenas aplicando TRS de nodos ---
  const primitives: ParsedGlbPrimitive[] = [];
  const meshes: any[] = jsonDoc.meshes ?? [];
  const nodes: any[] = jsonDoc.nodes ?? [];
  const scenes: any[] = jsonDoc.scenes ?? [];
  const rootNodes: number[] = scenes.length > 0 ? (scenes[jsonDoc.scene ?? 0]?.nodes ?? []) : nodes.map((_: any, i: number) => i);
  //*Progreso por bytes del BIN consumidos (aprox: accessors + horneado).
  const totalBytes = binBytes.length || 1;
  let consumedBytes = 0;
  let lastReported = -1;
  const report = async (label: string) => {
    const f = Math.min(consumedBytes / totalBytes, 1);
    if (f - lastReported > 0.05 || f >= 1) {
      lastReported = f;
      onProgress?.(f, label);
      //ceder solo al emitir progreso: deja pintar la barra en hilo principal
      if (cooperative) await yieldNow();
    }
  };

  const visitNode = async (nodeIndex: number, parentMatrix: Mat4): Promise<void> => {
    const node = nodes[nodeIndex];
    if (!node) { warn(`nodo ${nodeIndex} inexistente (omitido)`); return; }
    const world = mat4Multiply(parentMatrix, composeNodeMatrix(node));
    if (node.mesh !== undefined) {
      const mesh = meshes[node.mesh];
      if (!mesh) { warn(`malla ${node.mesh} inexistente (omitida)`); }
      else for (const prim of mesh.primitives ?? []) {
        const mode = prim.mode ?? 4;
        if (mode !== 4) { warn(`primitiva con mode ${mode} no triangulo (omitida)`); continue; }
        const attrs = prim.attributes ?? {};
        if (attrs.POSITION === undefined) { warn("primitiva sin POSITION (omitida)"); continue; }
        const pos = await readAccessor(attrs.POSITION);
        if (!(pos.values instanceof Float32Array) || pos.components !== 3) {
          warn("POSITION no es VEC3/float (omitida)"); continue;
        }
        const vertCount = pos.count;
        const baked = new Float32Array(vertCount * 3);
        const src = pos.values as Float32Array<ArrayBufferLike>;
        const m = world;
        for (let i = 0; i < vertCount; i++) {
          const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2];
          baked[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12];
          baked[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
          baked[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
          if (shouldYield(i)) await yieldNow();
        }
        consumedBytes += vertCount * 12;
        await report("geometria");
        let uvs: Float32Array<ArrayBufferLike> = new Float32Array(vertCount * 2);
        const matIndex = prim.material ?? 0;
        const mat = materials[matIndex] ?? materials[0];
        if (attrs.TEXCOORD_0 !== undefined) {
          const uv = await readAccessor(attrs.TEXCOORD_0);
          if (uv.values instanceof Float32Array && uv.components === 2 && uv.count === vertCount) {
            uvs = uv.values as Float32Array<ArrayBufferLike>;
          } else {
            warn("TEXCOORD_0 con formato inesperado (uvs en 0)");
          }
        } else if (mat.baseColorTexture !== -1) {
          warn("material texturado sin TEXCOORD_0 (uvs en 0)");
        }
        let indices: Uint32Array<ArrayBufferLike>;
        if (prim.indices !== undefined) {
          const idx = await readAccessor(prim.indices);
          if (!(idx.values instanceof Uint32Array) || idx.components !== 1) {
            warn("indices con formato inesperado (primitiva omitida)"); continue;
          }
          indices = idx.values as Uint32Array<ArrayBufferLike>;
        } else {
          indices = new Uint32Array(vertCount);
          for (let i = 0; i < vertCount; i++) indices[i] = i;
        }
        //*NORMAL (iluminacion Lambert/Phong): misma jerarquia que POSITION.
        //Sin NORMAL la primitiva queda en ceros y el shader usa la normal
        //geometrica de la cara (derivadas) como fallback.
        let normals: Float32Array<ArrayBufferLike> = new Float32Array(vertCount * 3);
        let hasNormals = false;
        if (attrs.NORMAL !== undefined) {
          const nrm = await readAccessor(attrs.NORMAL);
          if (nrm.values instanceof Float32Array && nrm.components === 3 && nrm.count === vertCount) {
            const nsrc = nrm.values as Float32Array<ArrayBufferLike>;
            //cofactores calculados una vez por primitiva, no por vertice
            const c = normalMatrix(world);
            for (let i = 0; i < vertCount; i++) {
              const x = nsrc[i * 3], y = nsrc[i * 3 + 1], z = nsrc[i * 3 + 2];
              const nx = c[0] * x + c[3] * y + c[6] * z;
              const ny = c[1] * x + c[4] * y + c[7] * z;
              const nz = c[2] * x + c[5] * y + c[8] * z;
              const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
              const il = len < 1e-12 ? 0 : 1 / len;
              normals[i * 3] = nx * il; normals[i * 3 + 1] = ny * il; normals[i * 3 + 2] = nz * il;
              if (shouldYield(i)) await yieldNow();
            }
            hasNormals = true;
            consumedBytes += vertCount * 12;
            await report("geometria");
          } else {
            warn("NORMAL con formato inesperado (primitiva sin iluminacion: fallback unlit)");
          }
        }
        //*TEXCOORD_1 (lightmaps): tal cual, como TEXCOORD_0.
        let uvs1: Float32Array<ArrayBufferLike> | null = null;
        if (attrs.TEXCOORD_1 !== undefined) {
          const uv1 = await readAccessor(attrs.TEXCOORD_1);
          if (uv1.values instanceof Float32Array && uv1.components === 2 && uv1.count === vertCount) {
            uvs1 = uv1.values as Float32Array<ArrayBufferLike>;
          } else {
            warn("TEXCOORD_1 con formato inesperado (se usa TEXCOORD_0)");
          }
        }
        //*TANGENT (normal mapping): xyz con la parte lineal de la matriz del
        //nodo (las tangentes viven en la superficie: se transforman como
        //posiciones, no como normales); w = signo de la bitangente, invertido
        //si la matriz espeja (det < 0).
        let tangents: Float32Array<ArrayBufferLike> | null = null;
        if (attrs.TANGENT !== undefined) {
          const tan = await readAccessor(attrs.TANGENT);
          if (tan.values instanceof Float32Array && tan.components === 4 && tan.count === vertCount) {
            const tsrc = tan.values as Float32Array<ArrayBufferLike>;
            const m = world;
            const det = m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
            const wSign = det < 0 ? -1 : 1;
            tangents = new Float32Array(vertCount * 4);
            for (let i = 0; i < vertCount; i++) {
              const x = tsrc[i * 4], y = tsrc[i * 4 + 1], z = tsrc[i * 4 + 2];
              const tx = m[0] * x + m[4] * y + m[8] * z;
              const ty = m[1] * x + m[5] * y + m[9] * z;
              const tz = m[2] * x + m[6] * y + m[10] * z;
              const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
              const il = len < 1e-12 ? 0 : 1 / len;
              tangents[i * 4] = tx * il; tangents[i * 4 + 1] = ty * il; tangents[i * 4 + 2] = tz * il;
              tangents[i * 4 + 3] = (tsrc[i * 4 + 3] < 0 ? -1 : 1) * wSign;
              if (shouldYield(i)) await yieldNow();
            }
          } else {
            warn("TANGENT con formato inesperado (se usa el marco por derivadas)");
          }
        }
        //*COLOR_0 (color/luz por vertice): float o entero normalizado, VEC3/VEC4.
        let colors: Float32Array<ArrayBufferLike> | null = null;
        if (attrs.COLOR_0 !== undefined) {
          const col = await readAccessor(attrs.COLOR_0);
          if (col.values instanceof Float32Array && (col.components === 3 || col.components === 4) && col.count === vertCount) {
            const csrc = col.values as Float32Array<ArrayBufferLike>;
            if (col.components === 4) {
              colors = csrc;
            } else {
              colors = new Float32Array(vertCount * 4);
              for (let i = 0; i < vertCount; i++) {
                colors[i * 4] = csrc[i * 3]; colors[i * 4 + 1] = csrc[i * 3 + 1]; colors[i * 4 + 2] = csrc[i * 3 + 2]; colors[i * 4 + 3] = 1;
              }
            }
          } else {
            warn("COLOR_0 con formato inesperado (se ignora)");
          }
        }
        consumedBytes += indices.length * 4;
        await report("geometria");
        if (indices.length % 3 !== 0) warn("nº indices no multiplo de 3 (se dibuja igual)");
        primitives.push({ positions: baked, uvs, normals, hasNormals, uvs1, tangents, colors, indices, material: matIndex < materials.length ? matIndex : 0 });
      }
    }
    for (const child of node.children ?? []) await visitNode(child, world);
  };
  const identity = mat4Identity();
  for (const root of rootNodes) await visitNode(root, identity);

  if (jsonDoc.skins?.length > 0) warn("skins presentes: animacion esqueletica ignorada (malla en pose base)");
  if (jsonDoc.animations?.length > 0) warn("animaciones presentes: ignoradas en MVP (props estaticos)");

  // --- Caja + esfera envolvente ---
  //*Centro = centro de la AABB (no el centroide de vertices: las zonas
  //densas desplazaban el pivote y agrandaban el radio).
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const p of primitives) {
    const ps = p.positions;
    for (let i = 0, v = 0; i < ps.length; i += 3, v++) {
      const x = ps[i], y = ps[i + 1], z = ps[i + 2];
      if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
      if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
      if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
      if (shouldYield(v)) await yieldNow();
    }
  }
  let center: [number, number, number] = [0, 0, 0];
  let radius = 0;
  if (min[0] <= max[0]) {
    center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    let r2 = 0;
    for (const p of primitives) {
      const ps = p.positions;
      for (let i = 0, v = 0; i < ps.length; i += 3, v++) {
        const dx = ps[i] - center[0], dy = ps[i + 1] - center[1], dz = ps[i + 2] - center[2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r2) r2 = d2;
        if (shouldYield(v)) await yieldNow();
      }
    }
    radius = Math.sqrt(r2);
  } else {
    min.fill(0); max.fill(0);
  }
  onProgress?.(1, "listo");

  return { primitives, materials, textures, images, bounds: { center, radius, min, max }, warnings };
}
