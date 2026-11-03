/// <reference lib="webworker" />
import { encodeImageBC7 } from "./TexEncode.ts";

/**
 * Worker de codificacion de texturas a BC7 (cache .tex, ver TexEncode).
 * Protocolo (TexWorkerClient):
 *   <- { type: "ready" }
 *   -> { reqId, image: { mimeType, data: ArrayBuffer }, idx, kind, maxTextureSize }
 *   <- { reqId, type: "done", result: TexEncodedImage }  (payload transferido)
 *   <- { reqId, type: "error", message }
 */
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (ev: MessageEvent<any>) => {
  const { reqId, image, idx, kind, maxTextureSize } = ev.data;
  try {
    const result = await encodeImageBC7({ mimeType: image.mimeType, data: new Uint8Array(image.data) }, idx, kind, maxTextureSize);
    ctx.postMessage({ reqId, type: "done", result }, [result.payload.buffer as ArrayBuffer]);
  } catch (err: any) {
    ctx.postMessage({ reqId, type: "error", message: String(err?.message ?? err) });
  }
};

ctx.postMessage({ type: "ready" });
