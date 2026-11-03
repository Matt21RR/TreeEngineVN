import React, { useEffect, useRef, useState } from 'react';

import { decodeGlbImages, type PackedGlbModel } from '../engine/renderCore/GlbPacker.ts';
import { loadGlbPacked } from '../engine/renderCore/GlbWorkerClient.ts';
import WebGPUCanvas from '../engine/renderCore/WebGPUCanvas.ts';

interface ModelViewerProps {
  /** Bytes crudos del .glb (si no se pasa `model` ya parseado). */
  data?: Uint8Array;
  /** Modelo ya empaquetado (evita doble parseo, ej. ModelsE tras "Analizar"). */
  model?: PackedGlbModel;
  /** Id en el ModelManager del motor: si el motor ya lo cargo, se reutilizan
   *  sus datos (cache LRU o re-fetch por HTTP local) y solo se sube a la GPU
   *  del visor. Requiere que la escena haya hecho loadModel. */
  engineModelId?: string;
  /** Si se indica, muestra snippet copiable `new ModelObject` con este id. */
  snippetId?: string;
  className?: string;
}

/**
 * Visor 3D aislado: turntable unlit del modelo en su propio canvas WebGPU.
 * Autocontenido (parsea + decodifica + sube a GPU) para poder usarse tanto
 * en el explorador de archivos (Multimedia) como en ModelsE.
 */
export default function ModelViewer({ data, model, engineModelId, snippetId, className, compact }: ModelViewerProps & { compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("cargando...");
  const [parsed, setParsed] = useState<PackedGlbModel | null>(model ?? null);
  const [error, setError] = useState("");
  const reusedFromEngine = useRef(false);

  useEffect(() => {
    reusedFromEngine.current = false;
    if (model) {
      setParsed(model);
      setError("");
      return;
    }
    let alive = true;
    (async () => {
      try {
        //*Reutiliza los datos del motor si ya cargo este modelo.
        if (engineModelId) {
          const mm = (window as any).engineRef?.modelManager;
          const cached = mm?.has(engineModelId) ? await mm.getPacked(engineModelId) : null;
          if (cached) {
            if (!alive) return;
            console.info(`[ModelViewer] '${engineModelId}': reutilizando datos del motor.`);
            reusedFromEngine.current = true;
            setParsed(cached);
            setError("");
            setStatus("ok (motor)");
            return;
          } else {
            console.info(`[ModelViewer] '${engineModelId}': no esta en el motor, decodificando bytes.`);
          }
        }
        if (!data) {
          if (!alive) return;
          setError("sin datos");
          setStatus("sin datos");
          return;
        }
        const { packed: m, bitmaps } = await loadGlbPacked(data, {
          onProgress: (f) => { if (alive) setStatus(`cargando ${Math.round(f * 100)}%`); },
        });
        //el visor re-decodifica al subir a su propio device
        for (const bmp of bitmaps.values()) bmp.close();
        if (!alive) return;
        setParsed(m);
        setError("");
      } catch (e: any) {
        if (!alive) return;
        setParsed(null);
        setError(String(e?.message ?? e).slice(0, 200));
        setStatus("parse error");
      }
    })();
    return () => { alive = false; };
  }, [data, model, engineModelId]);

  useEffect(() => {
    if (!parsed) return;
    let alive = true;
    let raf = 0;
    let observer: ResizeObserver | null = null;
    let renderer: WebGPUCanvas | null = null;
    (async () => {
      try {
        const canvas = canvasRef.current!;
        const wrap = wrapRef.current!;
        //*Dimensionado responsivo: el backing store sigue al contenedor
        //(CSS x DPR, tope absoluto para acotar fill-rate). El canvas WebGPU
        //sigue al tamano solo; ppu/centro se calculan por frame (ver loop).
        const fitCanvasToWrap = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const bw = Math.min(Math.max(Math.floor(wrap.clientWidth * dpr), 2), 1600);
          const bh = Math.min(Math.max(Math.floor(wrap.clientHeight * dpr), 2), 1600);
          if (canvas.width !== bw || canvas.height !== bh) {
            canvas.width = bw;
            canvas.height = bh;
          }
        };
        fitCanvasToWrap();
        const w = new WebGPUCanvas();
        renderer = w;
        const ctx = canvas.getContext("webgpu");
        if (!ctx) { setStatus("sin WebGPU"); return; }
        await w.init(ctx);
        w.setDepthRange(0.02, 10000);
        //*Origen de camara centrado (si no, c0 queda en (W/2,0) y la
        //correccion perspectiva cizalla en vertical).
        w.setWorldCameraPos(0.5, 0.5);
        const bitmaps = await decodeGlbImages(parsed.images);
        try {
          await w.preloadModel("preview", parsed, bitmaps);
        } finally {
          for (const bmp of bitmaps.values()) bmp.close();
        }
        if (!alive) { w.unloadModel("preview"); return; }
        setStatus(reusedFromEngine.current ? "ok (motor)" : "ok");
        observer = new ResizeObserver(() => { fitCanvasToWrap(); });
        observer.observe(wrap);
        const radius = Math.max(parsed.bounds.radius, 1e-6);
        //*Profundidad real aunque la posicion sea orto: con depthP=0 el
        //shader deja zClip=0 en todo y las primitivas se sobrescriben en
        //orden de dibujado (efecto rayos-X). zc holgado => perspectiva
        //suave (r~=1) + oclusion correcta por fragmento.
        const zc = radius * 10 + 0.5;
        let yaw = 0;
        let last = performance.now();
        const loop = (now: number) => {
          if (!alive) return;
          yaw += ((now - last) / 1000) * 0.6;
          last = now;
          const W = canvas.width, H = canvas.height;
          const ppu = (Math.min(W, H) * 0.35) / radius;
          w.queueMesh({
            id: "preview", x: W / 2, y: H / 2, width: 0, height: 0,
            rotation: 0, pitch: 0.15, yaw, roll: 0, ppu,
            depthZ: zc, depthP: ppu, ignoreWorldRotation: 0,
          });
          w.render();
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e: any) {
        setStatus("error: " + String(e?.message ?? e).slice(0, 120));
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      if (renderer?.hasModel("preview")) renderer.unloadModel("preview");
    };
  }, [parsed]);

  if (error) {
    return <div className="text-red-400 text-xs">No se pudo leer el modelo: {error}</div>;
  }
  if (!parsed) {
    return <div className="text-xs text-gray-300">{status}</div>;
  }

  const { prims, verts, tris } = parsed.stats;

  return (
    <div className={className ?? ""}>
      <div ref={wrapRef} className={compact ? "relative aspect-[4/3] w-full" : "relative min-h-[120px] w-full flex-1"}>
        <canvas ref={canvasRef} width={320} height={240} className="absolute inset-0 h-full w-full border border-gray-600" />
      </div>
      <div className="text-xs text-gray-300">
        {status} | prims: {prims} | verts: {verts} | tris: {tris} | r: {parsed.bounds.radius.toFixed(3)}
        {parsed.materials.length > 0 && (
          <> | mats: {parsed.materials.map(m => `${m.baseColorTexture}${m.alphaMode !== "OPAQUE" ? ":" + m.alphaMode : ""}${m.doubleSided ? ":DS" : ""}`).join(",")}</>
        )}
      </div>
      {parsed.warnings.length > 0 && (
        <div className="text-xs text-yellow-300">warnings: {parsed.warnings.join(" | ")}</div>
      )}
      {snippetId && (
        <pre className="bg-black bg-opacity-40 p-1 mt-1 text-xs text-white select-all shrink-0 max-h-48 overflow-auto">
{`${snippetId} = new ModelObject({
  enabled: true,
  model: "${snippetId}",
  x: 0.5,
  y: 0.5,
  scale: 0.15
})`}
        </pre>
      )}
    </div>
  );
}
