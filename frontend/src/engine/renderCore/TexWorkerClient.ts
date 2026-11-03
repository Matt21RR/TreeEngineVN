import type { ParsedGlbImage } from "./GlbParser.ts";
import type { TexEncodedImage, TexKind } from "./GlbTex.ts";

/**
 * Pool de workers de codificacion BC7 (TexWorker). Codificar es lento
 * (segundos por textura de 2048^2) y cada imagen es independiente, asi que se
 * reparten entre varios workers. Se crea al primer uso y se cierra tras un
 * rato sin trabajo (cada worker retiene el WASM de basis, ~30 MB).
 * Sin workers se codifica en el hilo principal (mismo resultado, bloquea).
 */

type Job = {
  image: ParsedGlbImage; idx: number; kind: TexKind; maxTextureSize: number;
  resolve: (r: TexEncodedImage) => void; reject: (e: Error) => void;
};
type Slot = { worker: Worker; ready: Promise<boolean>; busy: Job | null };

const POOL_SIZE = Math.max(1, Math.min(4, (globalThis.navigator?.hardwareConcurrency ?? 2) - 2));
const IDLE_CLOSE_MS = 30000;
let slots: Slot[] = [];
const queue: Job[] = [];
let broken = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let nextReqId = 1;

function spawn(): Slot {
  const worker = new Worker(new URL("./TexWorker.ts", import.meta.url), { type: "module" });
  const slot: Slot = { worker, ready: Promise.resolve(false), busy: null };
  slot.ready = new Promise<boolean>((resolve) => {
    worker.addEventListener("message", (ev) => { if (ev.data?.type === "ready") resolve(true); });
    worker.addEventListener("error", (ev) => {
      console.warn("[TexWorkerClient] worker no disponible:", ev.message);
      broken = true;
      resolve(false);
      const job = slot.busy;
      slot.busy = null;
      if (job) job.reject(new Error("worker caido: " + ev.message));
    });
  });
  worker.addEventListener("message", (ev) => {
    const msg = ev.data;
    const job = slot.busy;
    if (!job || msg?.reqId === undefined) return;
    slot.busy = null;
    if (msg.type === "done") job.resolve(msg.result);
    else job.reject(new Error(msg.message));
    pump();
  });
  return slot;
}

function scheduleIdleClose() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (queue.length || slots.some((s) => s.busy)) return scheduleIdleClose();
    for (const s of slots) s.worker.terminate();
    slots = [];
  }, IDLE_CLOSE_MS);
}

async function runInline(job: Job) {
  try {
    const { encodeImageBC7 } = await import("./TexEncode.ts");
    job.resolve(await encodeImageBC7(job.image, job.idx, job.kind, job.maxTextureSize));
  } catch (err: any) {
    job.reject(err instanceof Error ? err : new Error(String(err)));
  }
}

function pump() {
  while (queue.length) {
    if (broken || typeof Worker === "undefined") { runInline(queue.shift()!); continue; }
    let slot = slots.find((s) => !s.busy);
    if (!slot && slots.length < POOL_SIZE) {
      try { slot = spawn(); slots.push(slot); } catch { broken = true; continue; }
    }
    if (!slot) break;
    const job = queue.shift()!;
    const s = slot;
    s.busy = job;
    s.ready.then((ok) => {
      if (!ok) { s.busy = null; runInline(job); return; }
      const data = job.image.data.slice().buffer as ArrayBuffer;
      s.worker.postMessage({ reqId: nextReqId++, image: { mimeType: job.image.mimeType, data }, idx: job.idx, kind: job.kind, maxTextureSize: job.maxTextureSize }, [data]);
    });
  }
  scheduleIdleClose();
}

/** Codifica una imagen a BC7 (entrada del .tex) en el pool. */
export function encodeTexImage(image: ParsedGlbImage, idx: number, kind: TexKind, maxTextureSize: number): Promise<TexEncodedImage> {
  return new Promise((resolve, reject) => {
    queue.push({ image, idx, kind, maxTextureSize, resolve, reject });
    pump();
  });
}

/** Codifica todas las imagenes de un modelo (las grandes primero, para
 *  repartir mejor). Una imagen que falla se omite: usara RGBA8 al cargar. */
export async function encodeTexImages(images: ParsedGlbImage[], kinds: TexKind[], maxTextureSize: number): Promise<{ encoded: TexEncodedImage[]; failed: number }> {
  const order = images.map((_, i) => i).sort((a, b) => images[b].data.byteLength - images[a].data.byteLength);
  let failed = 0;
  const results = await Promise.all(order.map((i) => encodeTexImage(images[i], i, kinds[i] ?? "color", maxTextureSize).catch((err) => {
    failed++;
    console.warn(`[TEX] imagen ${i} no codificable (se usara RGBA8):`, err);
    return null;
  })));
  return { encoded: results.filter((r): r is TexEncodedImage => !!r).sort((a, b) => a.idx - b.idx), failed };
}
