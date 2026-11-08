import React, { useEffect, useMemo, useState } from 'react';
import $ from "jquery";
import InputScript from "./components/inputs/InputScript.tsx";
import AudioPlayer from './AudioPlayer.tsx';
import ModelViewer from './ModelViewer.tsx';
import Swal from 'sweetalert2';

import {SelectedFileProperties} from './FileExplorer.tsx';
import { Request, RequestFile, RequestFileWithMime } from '../../wailsjs/go/main/App.js';
import { decodeBase64Utf8 } from '../engine/logic/Misc.ts';
import { IconButton, ToolbarButton } from './components/Buttons.tsx';
import { RenderEngine } from '../engine/renderCore/RenderEngine.tsx';

type MultimediaProps = {
  setSelected: (indexFiles: number) => void;
  info: SelectedFileProperties;
  show: boolean;
  close: ()=>void
}

/** Visor .glb como componente (hooks propios): bytes via data-URL -> ModelViewer. */
function ModelPreview({ src, name, engineModelId }: { src: string; name: string; engineModelId?: string }) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState("");
  //*Si el motor ya tiene el modelo parseado no se descarga nada (ver
  //Multimedia: content queda vacio a proposito en ese caso).
  const engineCached = !!engineModelId && !!(window as any).engineRef?.modelManager?.has(engineModelId);
  console.info(`[ModelPreview] render '${name}' bytes=${!!bytes} engineModelId=${engineModelId} cached=${engineCached}`);
  useEffect(() => {
    if (engineModelId && (window as any).engineRef?.modelManager?.has(engineModelId)) return;
    if (!src) return;
    //*Fetch del data-URL con abort + marca de frescura (evita que un fetch
    //lento pise bytes ya validos con otra cosa, p.ej. HTML).
    const ctrl = new AbortController();
    let alive = true;
    (async () => {
      try {
        const r = await fetch(src, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`fetch: ${r.status}`);
        const buf = await r.arrayBuffer();
        if (alive) setBytes(new Uint8Array(buf));
      } catch (e: any) {
        if (alive && e?.name !== "AbortError") setLoadError(String(e?.message ?? e).slice(0, 160));
      }
    })();
    return () => { alive = false; ctrl.abort(); };
  }, [src, name, engineModelId]);
  if (loadError) {
    return <div className='mx-auto my-auto text-red-400 text-sm p-4'>No se pudo cargar: {loadError}</div>;
  }
  if (!bytes && !engineCached) {
    return <div className='mx-auto my-auto text-white text-sm'>Cargando modelo...</div>;
  }
  return (
    <div className='absolute inset-0 p-3 flex flex-col gap-2 overflow-hidden'>
      <ModelViewer data={bytes ?? undefined} engineModelId={engineModelId} snippetId={engineModelId ?? name.replace(/\.[^.]+$/, "")} className="flex min-h-0 flex-1 flex-col" />
    </div>
  );
}

//*Indice de modelos cacheado (resuelve archivo -> id del motor).
let modelsIndexCache: Promise<Record<string, string>> | null = null;
function getModelsIndex(): Promise<Record<string, string>> {
  if (!modelsIndexCache) {
    modelsIndexCache = RequestFile(window.projectRoute + "models/models.json")
      .then(res => atob(res))
      .then(text => JSON.parse(text))
      .catch(() => ({}));
  }
  return modelsIndexCache;
}

export default function Multimedia ({setSelected, info, show, close}: MultimediaProps) {
  const [activateSwitch, setActivateSwitch] = useState(true);
  const [content, setContent] = useState("");
  const [editorId, setEditorId] = useState("");
  const [mime, setMime] = useState("");
  //*Id del modelo en models.json cuando el archivo es un .glb.
  const [engineModelId, setEngineModelId] = useState<string | undefined>(undefined);

  useEffect(()=>{
    setEditorId("multimediaTextEditor" + String(window.performance.now()).replaceAll(".",""))
    const src = info.src;
    const mime = src.split(".").at(-1) == "json" ? "text" : info.mime;
    setMime(mime); //! Plausible err
    if (/\.glb$/i.test(info.name)) {
      //*Si el motor ya parseo este modelo, no descargar nada: el visor
      //reutiliza el parseo (ahorra decenas de MB de transferencia+reparseo).
      getModelsIndex().then(idx => {
        const entry = Object.keys(idx).find(k => idx[k].replace("./", "") === info.name);
        if (entry) setEngineModelId(entry);
        const cached = entry && (window as any).engineRef?.modelManager?.has(entry);
        if (cached) return;
        RequestFileWithMime( "./" + src )
          .then(res=>{
            setContent(res);
        });
      });
      return;
    }
    if(mime == "text"){
      RequestFile( src )
        .then(res=>{
          setContent(decodeBase64Utf8(res));
      });
    }else{
      console.warn(src);
      //TODO: check this
      RequestFileWithMime( "./" + src )
        .then(res=>{
          setContent(res);
      });
    }
    return () => { console.info(`[Multimedia] unmount '${info.name}'`); };
  }, [] );

  //*Stable reference: a new object on every render made InputScript treat its props as changed
  const scriptControls = useMemo(() => ({
    Enter: (e: React.KeyboardEvent) => { e.preventDefault(); }
  }), []);

  const updateTextContent = (content: string) => {
    const route = info.route;
    Request({route: route, action: "update", content: content})
    .then((response) => {
      //*The editor preview caches the project scripts (for "include"): refresh them after saving
      RenderEngine.getInstance()?.chaosInstance?.invalidateScriptsCache?.();
      Swal.fire("Saved", "", "success");
      return JSON.parse(response);
    });
  }

  const text = ()=>{
    const name = info.name;
    return(
      <div className="flex flex-row w-full">
        <InputScript
          scriptRoute={info.route}
          height={"h-full"} 
          fatherStyle={"bg-black bg-opacity-70"}
          defaultValue={content}
          id={editorId}
          onControl={scriptControls}
          bottomRightSlot={
            <ToolbarButton
              text="Save changes"
              action={()=>{
                Swal.fire({
                  text: 'Are you sure want to save the changes done to "'+name+'"?',
                  showDenyButton: false,
                  showConfirmButton: true,
                  confirmButtonColor:"green",
                  showCancelButton: true,
                  confirmButtonText: "Yes",
                  cancelButtonText: "Cancel",
                }).then((result) => {
                  if (result.isConfirmed) {
                    const text = $("#"+editorId).val() as string;
                    updateTextContent(text);
                  }
                });
              }}
            />
          }
        />
      </div>
    );
  }
  
  const audio = (src:string) => {
    return(
      <div className='mx-auto my-auto w-120'>
        <AudioPlayer src={src} ext={info.name.split(".").at(-1)} />
      </div>
    );
  }

  const video = (src: string) => {
    return(
      <video src={src} controls={true} className='h-full mx-auto my-auto'/>
    );
  }
  const image = (src: string) => {
    return(
      <div className='absolute top-0 left-0 h-full w-full ' 
        style={{
          backgroundImage: `url(' ${src} ')`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "contain"
        }}
      />
    );
  }
  const unsupported = (src: string) => {
    return(
      <div className='mx-auto my-auto text-center text-white text-sm p-4'>
        <div>Sin vista previa para este tipo de archivo</div>
        <div className='text-xs text-gray-300 mt-1'>{info.name} ({mime || "mime desconocido"})</div>
      </div>
    );
  }
  const switcher = (src: string) => {
    //if(show && mime != "" && activateSwitch && src != ""){
    if(show && mime != "" && activateSwitch){
      //*Sin contenido aun: no montar nada (un fetch("") resolveria contra la
      //propia pagina y envenenaria al visor 3D con HTML en vez del .glb).
      if(!src && !engineModelId) return <>Cargando...</>;
      //*Ruteo por extension para modelos: el mime olfateado por el backend
      //para .glb es incierto (octet-stream u otro) y no debe tumbar el visor.
      if (/\.glb$/i.test(info.name)) return <ModelPreview src={src} name={info.name} engineModelId={engineModelId} />;
      if (/\.gltf$/i.test(info.name)) {
        return <div className='mx-auto my-auto text-center text-white text-sm p-4'>
          <div>Solo se soportan GLB binarios en el MVP (.gltf suelto no)</div>
          <div className='text-xs text-gray-300 mt-1'>{info.name}</div>
        </div>;
      }
      const renderer = {text,audio,video,image}[mime] ?? unsupported;
      return renderer(src);
    }
    return <>No content to show {show? "true" : "false"} {mime}</>
  }
  const closeBtn = (index: number, limit: number) => {
    return(
      <>
        <IconButton icon="cross" style="absolute top-0 right-3 h-6 w-6 m-1 p-1 backdrop-contrast-[.75] backdrop-blur-sm" action={ close }/>
        <IconButton 
          icon="arrow" 
          hide={index<1} 
          style="absolute top-1/2 left-0 h-6 w-6 my-1 p-0.5 backdrop-contrast-[.75] backdrop-blur-sm" 
          action={()=>{
            setActivateSwitch(false);
            setSelected(index-1);
            setActivateSwitch(true);
          }}/>
        <IconButton 
          icon="arrow" 
          hide={index>=(limit)}
          style="absolute top-1/2 right-3 h-6 w-6 m-1 p-0.5 backdrop-contrast-[.75] backdrop-blur-sm rotate-180" 
          action={()=>{
            setActivateSwitch(false);
            setSelected(index+1);
            setActivateSwitch(true);
          }}/>
      </>
    );
  }

  return (
    <div className={"absolute bg-black bg-opacity-40 top-0 left-0 h-full w-full backdrop-blur-md flex" + ((!show) ? " hidden":"")}>
      {switcher(content)}
      <div className='absolute top-0 px-2 text-xs py-1 backdrop-contrast-[.75] backdrop-blur-sm -translate-x-1/2 left-1/2'>
        {info.name}
      </div>
      {closeBtn(info.index, info.actualContentLength-1)}
    </div>
  );

}