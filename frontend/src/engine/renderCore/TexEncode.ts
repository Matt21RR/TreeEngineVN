import type { ParsedGlbImage } from "./GlbParser.ts";
import { bc7LevelSizes, deflateRaw, type TexEncodedImage, type TexKind } from "./GlbTex.ts";

/**
 * Codificacion de una imagen a BC7 para la cache .tex (ver GlbTex): decodifica
 * la imagen (con el tope de resolucion, a multiplo de 4 como exige BC en
 * WebGPU), la codifica a UASTC con mips (basis_universal, WASM de
 * ktx2-encoder), la transcodifica a BC7 y la comprime con deflate. Lento
 * (segundos por textura grande): solo corre al generar la cache, en los
 * workers de TexWorker, nunca al cargar.
 */

type BasisModule = any;
let basisPromise: Promise<BasisModule> | null = null;

/** Modulo basis (codificador + transcodificador en el mismo WASM). */
export function getBasis(): Promise<BasisModule> {
  if (!basisPromise) {
    basisPromise = import("ktx2-encoder").then((K: any) => {
      const Enc = K.BrowserBasisEncoder ?? K.NodeBasisEncoder;
      return new Enc().init();
    });
    basisPromise.catch(() => { basisPromise = null; });
  }
  return basisPromise;
}

const mult4 = (n: number) => Math.max(4, Math.ceil(n / 4) * 4);

/** Tamano final de una imagen: tope de resolucion y multiplo de 4. */
export function targetSize(width: number, height: number, maxTextureSize: number): [number, number] {
  const big = Math.max(width, height);
  const k = maxTextureSize > 0 && big > maxTextureSize ? maxTextureSize / big : 1;
  return [mult4(Math.round(width * k)), mult4(Math.round(height * k))];
}

let gl: WebGL2RenderingContext | null | undefined;

/** RGBA8 sin premultiplicar de una imagen del .glb, ya redimensionada. */
export async function decodeImageRGBA(img: ParsedGlbImage, maxTextureSize: number): Promise<{ rgba: Uint8Array; width: number; height: number }> {
  const blob = new Blob([img.data as unknown as BlobPart], { type: img.mimeType });
  const probe = await createImageBitmap(blob);
  const [width, height] = targetSize(probe.width, probe.height, maxTextureSize);
  const same = width === probe.width && height === probe.height;
  probe.close();
  //premultiplyAlpha "none": el color de pixeles casi transparentes no se pierde
  const bmp = await createImageBitmap(blob, {
    premultiplyAlpha: "none",
    ...(same ? {} : { resizeWidth: width, resizeHeight: height, resizeQuality: "high" as ResizeQuality }),
  });
  try {
    //*WebGL2 lee los pixeles tal cual (un canvas 2D los premultiplica).
    if (gl === undefined) gl = new OffscreenCanvas(4, 4).getContext("webgl2", { premultipliedAlpha: false }) as WebGL2RenderingContext | null;
    if (gl) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const rgba = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb);
      gl.deleteTexture(tex);
      return { rgba, width, height };
    }
    const ctx = new OffscreenCanvas(width, height).getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    return { rgba: new Uint8Array(ctx.getImageData(0, 0, width, height).data.buffer), width, height };
  } finally {
    bmp.close();
  }
}

/** Rellena el RGB de los texels totalmente transparentes con el de sus
 *  vecinos opacos (edge padding): su color no se ve, pero los mips y el
 *  filtrado lo mezclan con el borde (halos claros u oscuros en hojas y
 *  rejas con mascara alfa). Lo que queda lejos de todo borde toma el color
 *  medio de lo opaco. In-place. */
export function bleedTransparentRGB(rgba: Uint8Array, width: number, height: number, passes = 16): void {
  const n = width * height;
  let filled = new Uint8Array(n);
  let holes = 0, r = 0, g = 0, b = 0, opaque = 0;
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] > 0) {
      filled[i] = 1; opaque++;
      r += rgba[i * 4]; g += rgba[i * 4 + 1]; b += rgba[i * 4 + 2];
    } else holes++;
  }
  if (!holes || !opaque) return;
  for (let pass = 0; pass < passes && holes; pass++) {
    const next = filled.slice();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (filled[i]) continue;
      let sr = 0, sg = 0, sb = 0, c = 0;
      if (x > 0 && filled[i - 1]) { const o = (i - 1) * 4; sr += rgba[o]; sg += rgba[o + 1]; sb += rgba[o + 2]; c++; }
      if (x < width - 1 && filled[i + 1]) { const o = (i + 1) * 4; sr += rgba[o]; sg += rgba[o + 1]; sb += rgba[o + 2]; c++; }
      if (y > 0 && filled[i - width]) { const o = (i - width) * 4; sr += rgba[o]; sg += rgba[o + 1]; sb += rgba[o + 2]; c++; }
      if (y < height - 1 && filled[i + width]) { const o = (i + width) * 4; sr += rgba[o]; sg += rgba[o + 1]; sb += rgba[o + 2]; c++; }
      if (!c) continue;
      rgba[i * 4] = sr / c; rgba[i * 4 + 1] = sg / c; rgba[i * 4 + 2] = sb / c;
      next[i] = 1; holes--;
    }
    filled = next;
  }
  if (!holes) return;
  r /= opaque; g /= opaque; b /= opaque;
  for (let i = 0; i < n; i++) if (!filled[i]) { rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; }
}

/** RGBA8 (lado multiplo de 4) -> niveles BC7 concatenados (mips hasta 1x1). */
export function encodeRGBAToBC7(basis: BasisModule, rgba: Uint8Array, width: number, height: number, kind: TexKind): { data: Uint8Array<ArrayBuffer>; levels: number } {
  const enc = new basis.BasisEncoder();
  let ktx2: Uint8Array;
  try {
    enc.setDebug(false);
    enc.setStatusOutput?.(false); //sin trazas por cada slice en la consola
    enc.setPrintStats?.(false);
    enc.setCreateKTX2File(true);
    enc.setUASTC(true);
    enc.setPackUASTCFlags(0); //nivel mas rapido: ~4x mas rapido que el 1, calidad casi igual
    enc.setKTX2UASTCSupercompression(false);
    if (kind === "normal") enc.setNormalMapPreset();
    enc.setPerceptual(kind === "color");
    enc.setKTX2AndBasisSRGBTransferFunc(kind === "color");
    enc.setMipGen(true);
    enc.setMipSRGB(kind === "color");
    enc.setMipRenormalize(kind === "normal");
    enc.setMipSmallestDimension(1);
    if (enc.setSliceSourceImage(0, rgba, width, height, 0 /* RAW */) === false) throw new Error("setSliceSourceImage fallo");
    const out = new Uint8Array(Math.ceil(width * height * 4 * 1.5) + 65536);
    const len = enc.encode(out);
    if (!(len > 0)) throw new Error("codificacion UASTC fallida");
    ktx2 = out.subarray(0, len);
  } finally {
    enc.delete();
  }

  const file = new basis.KTX2File(ktx2);
  try {
    if (!file.isValid() || !file.startTranscoding()) throw new Error("KTX2 invalido");
    const levels = file.getLevels();
    const sizes = bc7LevelSizes(width, height, levels);
    const data = new Uint8Array(sizes.reduce((a, b) => a + b, 0));
    const fmt = basis.transcoder_texture_format.cTFBC7_RGBA.value;
    let off = 0;
    for (let l = 0; l < levels; l++) {
      if (file.getImageTranscodedSizeInBytes(l, 0, 0, fmt) !== sizes[l]) throw new Error(`nivel ${l}: tamano BC7 inesperado`);
      const dst = data.subarray(off, off + sizes[l]);
      if (!file.transcodeImage(dst, l, 0, 0, fmt, 0, -1, -1)) throw new Error(`nivel ${l}: transcodificacion fallida`);
      off += sizes[l];
    }
    return { data, levels };
  } finally {
    file.close();
    file.delete();
  }
}

/** Imagen del .glb -> entrada del .tex (BC7 + deflate). */
export async function encodeImageBC7(img: ParsedGlbImage, idx: number, kind: TexKind, maxTextureSize: number): Promise<TexEncodedImage> {
  const basis = await getBasis();
  const { rgba, width, height } = await decodeImageRGBA(img, maxTextureSize);
  if (kind !== "normal") bleedTransparentRGB(rgba, width, height);
  const { data, levels } = encodeRGBAToBC7(basis, rgba, width, height, kind);
  const payload = await deflateRaw(data);
  return { idx, kind, width, height, levels, rawLength: data.byteLength, payload };
}
