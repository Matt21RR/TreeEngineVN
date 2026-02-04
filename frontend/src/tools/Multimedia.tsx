import React, { useEffect, useState } from 'react';
import $ from "jquery";
import InputScript from "./components/inputs/InputScript.tsx";
import AudioPlayer from './AudioPlayer.tsx';
import Swal from 'sweetalert2';

import {SelectedFileProperties} from './FileExplorer.tsx';
import { Request, RequestFile, RequestFileWithMime } from '../../wailsjs/go/main/App.js';
import { Button1, IconButton } from './components/Buttons.tsx';

type MultimediaProps = {
  setSelected: (indexFiles: number) => void;
  info: SelectedFileProperties;
  show: boolean;
  close: ()=>void
}

export default function Multimedia ({setSelected, info, show, close}: MultimediaProps) {
  const [activateSwitch, setActivateSwitch] = useState(true);
  const [content, setContent] = useState("");
  const [editorId, setEditorId] = useState("");
  const [mime, setMime] = useState("");

  useEffect(()=>{
    console.log(editorId,info);
    setEditorId("multimediaTextEditor" + String(window.performance.now()).replaceAll(".",""))
    const src = info.src;
    const mime = src.split(".").at(-1) == "json" ? "text" : info.mime;
    setMime(mime); //! Plausible err
    if(mime == "text"){
      RequestFile( src )
        .then(res=>{
          setContent(atob(res));
      });
    }else{
      console.warn(src);
      //TODO: check this
      RequestFileWithMime( "./" + src )
        .then(res=>{
          setContent(res);
      });
    }
  }, [] );

  const updateTextContent = (content: string) => {
    const route = info.route;
    Request({route: route, action: "update", content: content})
    .then((response) => {
      Swal.fire("Guardado", "", "success");
      return JSON.parse(response);
    });
  }

  const text = ()=>{
    const name = info.name;
    return(
      <>
        <InputScript
          height={"h-full"} 
          fatherStyle={"bg-black bg-opacity-70"}
          defaultValue={content}
          id={editorId}
          onControl={{Enter:(e)=>{
            e.preventDefault(); 
          }}}
        />
        <Button1 
          text="Save changes" 
          style="absolute bottom-2 right-2"
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
          }}/>
      </>
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
      <div className='absolute top-0 left-0 h-full w-full' 
        style={{
          backgroundImage: `url(' ${src} ')`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "contain"
        }}
      />
    );
  }
  const switcher = (src: string) => {
    if(show && mime != "" && activateSwitch && src != ""){
      return {text,audio,video,image}[mime](src);
    }
  }
  const closeBtn = (index: number, limit: number) => {
    return(
      <>
        <IconButton icon="cross" style="absolute top-0 right-0 h-7 w-7 m-1 p-1 backdrop-invert" action={ close }/>
        <IconButton 
          icon="arrow" 
          hide={index<1} 
          style="absolute top-1/2 left-0 h-7 w-7 m-1 p-1 backdrop-invert" 
          action={()=>{
            setActivateSwitch(false);
            setSelected(index-1);
            setActivateSwitch(true);
          }}/>
        <IconButton 
          icon="arrow" 
          hide={index>=(limit)}
          style="absolute top-1/2 right-0 h-7 w-7 m-1 p-1 backdrop-invert rotate-180" 
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
      <div className='absolute top-0 px-2 text-xs py-1 backdrop-contrast-[.55] backdrop-blur-md -translate-x-1/2 left-1/2'>
        {info.name}
      </div>
      {closeBtn(info.index, info.actualContentLength-1)}
    </div>
  );

}