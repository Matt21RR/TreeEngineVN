import React, { useEffect, useState } from 'react';

import { Dictionary } from '../global.ts';
import { RequestFile, ScanFiles } from '../../wailsjs/go/main/App.js';
import { Button1, MenuButton } from './components/Buttons.tsx';
import type { PackedGlbModel } from '../engine/renderCore/GlbPacker.ts';
import { loadGlbPacked } from '../engine/renderCore/GlbWorkerClient.ts';
import ResourceLoader from '../engine/renderCore/ResourceLoader.ts';
import ModelViewer from './ModelViewer.tsx';
import Swal from 'sweetalert2';

interface ModelMeta {
  id: string;
  file: string;
  model?: PackedGlbModel;
  error?: string;
  progress?: number;
}

export default function ModelsE({ engine }: { engine?: any }) {
  const [models, setModels] = useState<Dictionary<string>>({});
  const [metas, setMetas] = useState<Dictionary<ModelMeta>>({});
  const [previewId, setPreviewId] = useState<string>("");
  const configRoute = window.projectRoute + "models/models.json";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    RequestFile(configRoute)
      .then(res => atob(res))
      .then(res => JSON.parse(res))
      .then((data: Dictionary<string>) => {
        setModels(data);
      })
      .catch(() => setModels({}));
  };

  const analyze = (id: string) => {
    const file = models[id];
    if (!file) return;
    setMetas(prev => ({ ...prev, [id]: { id, file, progress: 0 } }));
    ResourceLoader.fetchBinary(ResourceLoader.modelPath(file))
      .then(bytes => loadGlbPacked(bytes, {
        transfer: true,
        //*Progreso de parseo (visible con modelos pesados).
        onProgress: (f) => setMetas(prev => {
          const cur = prev[id];
          if (!cur || cur.model) return prev;
          return { ...prev, [id]: { ...cur, progress: Math.round(f * 100) } };
        }),
      }))
      .then(({ packed, bitmaps }) => {
        for (const bmp of bitmaps.values()) bmp.close();
        setMetas(prev => ({ ...prev, [id]: { id, file, model: packed } }));
      })
      .catch((e: any) => setMetas(prev => ({
        ...prev, [id]: { id, file, error: String(e?.message ?? e).slice(0, 200) }
      })));
  };

  const scan = () => {
    ScanFiles("game/models", "model").then((e: any) => {
      Swal.fire({
        title: "Scan result for models",
        html: `<textarea spellcheck="false" class="h-96 w-full border rounded-md overflow-y-auto resize-none bg-stone-50">${JSON.stringify(e, null, "\t")}</textarea>`,
        width: "800px"
      });
    });
  };

  const listB = () => {
    return Object.keys(models).filter(k => !k.startsWith("_")).map((modelId) => {
      const meta = metas[modelId];
      const { prims = 0, verts = 0, tris = 0 } = meta?.model?.stats ?? {};
      return (
        <div className={'border-4 flex flex-col w-[98%] relative my-1 p-2'} key={modelId}>
          <div className='flex flex-row gap-2 items-center'>
            <MenuButton text={modelId} />
            <span className="text-xs text-gray-300">{models[modelId]}</span>
            <Button1 text="Analizar" action={() => analyze(modelId)} />
            {meta?.model && <Button1 text={previewId === modelId ? "Cerrar preview" : "Preview"} action={() => setPreviewId(previewId === modelId ? "" : modelId)} />}
          </div>
          {meta?.error && <div className="text-red-400 text-xs">Error: {meta.error}</div>}
          {meta && !meta.model && !meta.error && (
            <div className="text-xs text-gray-300 mt-1">Analizando{meta.progress != null ? ` ${meta.progress}%` : "..."}</div>
          )}
          {meta?.model && (
            <div className="text-xs text-white mt-1">
              <div>primitivas: {prims} | verts: {verts} | tris: {tris} | r: {meta.model.bounds.radius.toFixed(3)}</div>
              <div>materiales: {meta.model.materials.length} (tex: {meta.model.materials.map(m => m.baseColorTexture).join(",")}) | imagenes: {meta.model.images.map(i => i.mimeType + ":" + i.data.length).join(", ") || "ninguna"}</div>
              {meta.model.warnings.length > 0 && <div className="text-yellow-300">warnings: {meta.model.warnings.join(" | ")}</div>}
              {previewId === modelId && <ModelViewer model={meta.model} snippetId={modelId} compact />}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className='relative w-full h-full pt-5 flex flex-col'>
      <div className='flex flex-row gap-2'>
        <Button1 text="Reload" action={() => { fetchData(); }} />
        <Button1 text="Scan models" action={scan} />
        <Button1 text="Recargar modelos" action={() => {
          //*Re-registra models.json en caliente (cubre ediciones manuales del
          //indice sin reiniciar). Carga perezosa: los modelos se cargan al
          //usarse; con modelManager.preloadAll se cargan todos ahora.
          if(!engine?.modelManager){
            Swal.fire("Sin engine", "Abre una escena primero.", "warning");
            return;
          }
          engine.modelManager.prepare(configRoute)
            .then(()=>Swal.fire("Indice de modelos actualizado", "", "success"))
            .catch((e: any)=>Swal.fire("Error", String(e?.message ?? e).slice(0, 200), "error"));
        }} />
        <div className='mx-2 my-auto flex flex-row'>
          <div className='border-2 border-gray-200 my-auto text-sm text-white'>
            Index file route: {configRoute}
          </div>
        </div>
      </div>
      <div className='relative h-full w-full text-white overflow-auto'>
        <div className='relative h-full w-full px-8 text-white grid-flow-row auto-rows-min md:grid-cols-2 grid-cols-1 grid'>
          {listB()}
        </div>
      </div>
    </div>
  );
}
