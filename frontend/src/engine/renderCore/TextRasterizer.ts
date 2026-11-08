import { TextLine } from "../logic/Misc.ts";

/**
 * Rasteriza texto ya maquetado (TextLine en px de pantalla, ver wrapText) a
 * una textura por objeto, para dibujarlo como un quad mas de la cola WebGPU.
 *
 * - El contenido se identifica con una clave independiente de la escala
 *   (posiciones normalizadas por fontSize): un zoom solo re-rasteriza cuando
 *   el tamano en pantalla se aleja lo bastante del rasterizado.
 * - Si las lineas desbordan la caja, el quad crece simetricamente para no
 *   mover el centro (pivote de rotacion del shader).
 * - Los slots que dejan de usarse se liberan solos (endFrame).
 */

export type TextQuad = { id: string; x: number; y: number; width: number; height: number };

type Slot = {
  contentKey: string;
  rasterFontSize: number;
  lastUsedFrame: number;
};

export type TextUploader = {
  upload(id: string, source: HTMLCanvasElement, w: number, h: number): void;
  release(id: string): void;
  maxTextureSize(): number;
};

/** Ampliar mas de esto respecto al raster se veria borroso: re-rasterizar. */
const MAX_UPSCALE = 1.1;
/** Reducir hasta aqui lo cubren los mipmaps. */
const MIN_DOWNSCALE = 0.6;
/** Frames sin uso antes de liberar la textura de un objeto. */
const RELEASE_AFTER_FRAMES = 120;

export default class TextRasterizer {
  private slots = new Map<string, Slot>();
  private frame = 0;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(private uploader: TextUploader) {}

  private getContext(): CanvasRenderingContext2D | null {
    if (!this.ctx) {
      //HTMLCanvasElement (no OffscreenCanvas): asegura acceso a document.fonts
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d");
    }
    return this.ctx;
  }

  /**
   * Garantiza que la textura del objeto refleja el texto y devuelve el quad
   * (en px de pantalla) donde dibujarla. null = nada que dibujar.
   */
  ensure(
    objectId: string,
    corner: { x: number; y: number },
    boxWidth: number,
    boxHeight: number,
    lines: Array<TextLine>,
    fontSize: number,
    fontFamily: string,
    color: string,
    filter: string
  ): TextQuad | null {
    if (fontSize <= 0 || boxWidth <= 0 || lines.length === 0) return null;
    if (lines.every(l => l.value.length === 0)) return null;

    //*Desborde vertical (lineas centradas en y con textBaseline "middle") y
    //horizontal (glifos que sobresalen): expansion simetrica.
    const half = fontSize * 0.5;
    let top = 0, bottom = boxHeight;
    for (const l of lines) {
      const ly = l.y - corner.y;
      if (ly - half < top) top = ly - half;
      if (ly + half > bottom) bottom = ly + half;
    }
    const padY = Math.max(-top, bottom - boxHeight, 0);
    const padX = fontSize * 0.15;
    const quadW = boxWidth + padX * 2;
    const quadH = boxHeight + padY * 2;
    if (quadH <= 0) return null;

    const id = "txt:" + objectId;
    const q = (n: number) => Math.round((n / fontSize) * 100) / 100;
    const contentKey =
      `${fontFamily}|${color}|${filter}|${q(boxWidth)}x${q(boxHeight)}|` +
      lines.map(l => `${q(l.x - corner.x)},${q(l.y - corner.y)}:${l.value}`).join("\n");

    const slot = this.slots.get(id);
    const ratio = slot ? fontSize / slot.rasterFontSize : 0;
    if (!slot || slot.contentKey !== contentKey || ratio > MAX_UPSCALE || ratio < MIN_DOWNSCALE) {
      if (!this.raster(id, corner, lines, fontSize, fontFamily, color, filter, padX, padY, quadW, quadH)) return null;
      this.slots.set(id, { contentKey, rasterFontSize: fontSize, lastUsedFrame: this.frame });
    } else {
      slot.lastUsedFrame = this.frame;
    }

    return { id, x: corner.x - padX, y: corner.y - padY, width: quadW, height: quadH };
  }

  private raster(
    id: string,
    corner: { x: number; y: number },
    lines: Array<TextLine>,
    fontSize: number,
    fontFamily: string,
    color: string,
    filter: string,
    padX: number,
    padY: number,
    quadW: number,
    quadH: number
  ): boolean {
    const ctx = this.getContext();
    if (!ctx || !this.canvas) return false;

    //Escala de raster: 1 px de textura = 1 px de pantalla, salvo que exceda el limite
    const maxSize = this.uploader.maxTextureSize() || 4096;
    const scale = Math.min(1, maxSize / quadW, maxSize / quadH);
    const w = Math.max(1, Math.ceil(quadW * scale));
    const h = Math.max(1, Math.ceil(quadH * scale));

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;   //redimensionar tambien resetea el estado del contexto
      this.canvas.height = h;
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
    }

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.filter = filter && filter !== "none" ? filter : "none";
    const ox = corner.x - padX;
    const oy = corner.y - padY;
    for (const l of lines) {
      if (l.value.length > 0) ctx.fillText(l.value, l.x - ox, l.y - oy);
    }
    ctx.filter = "none";

    this.uploader.upload(id, this.canvas, w, h);
    return true;
  }

  /** Avanza el contador y libera las texturas de objetos que ya no dibujan texto. */
  endFrame() {
    this.frame++;
    if (this.frame % 30 !== 0) return;
    for (const [id, slot] of this.slots) {
      if (this.frame - slot.lastUsedFrame > RELEASE_AFTER_FRAMES) {
        this.uploader.release(id);
        this.slots.delete(id);
      }
    }
  }
}
