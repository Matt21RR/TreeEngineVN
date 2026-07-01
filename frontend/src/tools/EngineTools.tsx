import React, { useEffect, useReducer, useState } from "react";
import { InputList} from "./components/InputList.tsx";
import { RenderEngine } from "../engine/renderCore/RenderEngine.tsx";
import InputCheck from "./components/inputs/InputCheck.tsx";
import { FileExists, ScanFiles, ToggleFullscreen } from "../../wailsjs/go/main/App.js";
import { Button1, IconButton } from "./components/Buttons.tsx";
import { sequencedPromiseWithResult } from "../engine/interpretators/new.ts";
import Swal from "sweetalert2";

function KeyFilesControls(){
    const [filesExist, setFilesExist] = useState<Map<string,KeyFileInfo>>( new Map ( [
    ["./game/main.txt", {exist:false, scanable:false, scanType:null}],
    ["./game/textures/textures.json", {exist:false, scanable:true, scanType:"texture"}],
    ["./game/sounds/sounds.json", {exist:false, scanable:true, scanType:"sound"}]
  ] ) );

  useEffect(()=>{
    checkIfKeyFilesExists();
  },[]);

  const checkIfKeyFilesExists = ()=>{
    sequencedPromiseWithResult(
      Array.from(filesExist.keys()).map(key=>()=>FileExists(key))
    ).then((results:boolean[])=>{
      const newMap = new Map(filesExist);
      results.forEach((exist,index)=>{
        const key = Array.from(filesExist.keys())[index];
        const value = filesExist.get(key);
        if(value){
          newMap.set(key,{...value, exist});
        }
      });
      setFilesExist(newMap);
    });
  }
  const existCheckIcons = ()=>{
    return <div className="text-white">
      {Array.from(filesExist).map(([key,value])=>{
        return <div className="flex" key={key}>
           <InputCheck key={key} label={key} checked={value.exist} uncheckedColor="bg-red-700"/>
           {
            value.scanable && <Button1 
              text={`Scan ${value.scanType}s`} 
              action={()=>{
                const route = key.split("/");
                const basePath = route.slice(0,route.length -1).join("/");
                console.log("Scanning files in: ", basePath, " of type: ", value.scanType);

                ScanFiles(basePath, value.scanType).then(e=>{
                  console.log(e);
                  Swal.fire({
                    title: `Scan result for ${value.scanType}s`,
                    html: `
                          <textarea spellcheck="false" class="h-96 w-full border rounded-md overflow-y-auto resize-none bg-stone-50">
                            ${JSON.stringify(e, null, "\t")}
                          </textarea>
                          <span class="text-[16px] leading-3 text-gray-800">
                            You can edit the json result from the textarea above.
                            Then copy and paste it to the corresponding file in your project to update the engine data.
                            The keys of the json are the tag or alias of the resources, so you can use them in your scripts to reference the resources.
                          </span>
                          `,
                    width: "800px"
                  });
                });
              }}
            />
          }    
        </div>
      })}
    </div>
  }

  return <>
    <Button1 text="Check files exists" action={()=>{
      checkIfKeyFilesExists();
    }}/>
    {existCheckIcons()}
  </>
}

interface EngineToolsProps {
  engine?: RenderEngine | null
}

interface KeyFileInfo {
  exist:boolean,
  scanable:boolean,
  scanType:"script"|"texture"|"sound"|null
}

export default function EngineTools(props:EngineToolsProps){
  const [scenes, setScenes] = useState<Array<string>>([]);
  const [sceneName, setSceneName] = useState("gameEntrypoint");
  const [selectedScript, setSelectedScript] = useState(0);

  const [_, forceUpdate] = useReducer(x => x + 1, 0);

  const checkAvailableScenes = ()=>{
    if(!props.engine) {
      setScenes([]);
      return;
    }
    setScenes(Object.keys(props.engine.chaosInstance.scenes));
  }

  useEffect(()=>{
    checkAvailableScenes();
  },[props.engine]);

  const scriptSelector = () => {
    const engine = props.engine;
    if(!engine){
      return <div className="text-white">Engine not ready yet.</div>;
    }
    return (
      <div className="flex align-middle">
        <InputList 
          options={scenes}
          action={(e)=>{setSceneName(scenes[e]);}}
          value={0}
        />
        <Button1 text={"Run!!"} action={()=>{
          engine.refreshChaosAndRunScene(sceneName);
        }}/>
        <Button1 text={"Check available scenes"} action={()=>{
          checkAvailableScenes();
        }}/>
      </div>
    );
  }

  const speedControls = () => {
    const engine = props.engine;
    if(!engine){
      return <div className="text-white">Engine not ready.</div>;
    }
    return (
      <div className="flex flex-row text-white">
        <IconButton icon="minus" action={()=>{engine.engineSpeed-= 0.1; forceUpdate();}}/>
        <Button1 text={engine.stopEngine ? "Play" : "Stop"} action={()=>{
          engine.stopEngine = !engine.stopEngine;
          forceUpdate();
        }}/>
        <IconButton icon="plus" action={()=>{engine.engineSpeed+= 0.1; forceUpdate();}}/>
        <span>Engine speed: {engine.engineSpeed.toFixed(2)}</span>
      </div>
    );
  }

  const cameraControls = () => {
    const camera = props.engine?.camera;
    if(!camera){
      return <div className="text-white">Engine not ready.</div>;
    }

    return (
      <div className="flex flex-col text-white">
        <InputCheck 
          label="Use perspective" 
          checked={camera.usePerspective} 
          action={(res:boolean)=>{camera.usePerspective = res; forceUpdate();}}/>
        <div className="flex gap-2">
          X:
          <IconButton icon="minus" action={()=>{camera.position.x-= 0.1; forceUpdate();}}/>
          <IconButton icon="plus" action={()=>{camera.position.x+= 0.1; forceUpdate();}}/>
          {camera.position.x}
        </div>
        <div className="flex gap-2">
          Y:
          <IconButton icon="minus" action={()=>{camera.position.y-= 0.1; forceUpdate();}}/>
          <IconButton icon="plus" action={()=>{camera.position.y+= 0.1; forceUpdate();}}/>
          {camera.position.y}
        </div>
        <div className="flex gap-2">
          Z:
          <IconButton icon="minus" action={()=>{camera.position.z-= 0.1; forceUpdate();}}/>
          <IconButton icon="plus" action={()=>{camera.position.z+= 0.1; forceUpdate();}}/>
          {camera.position.z} 
        </div>

        <div className="flex gap-2">
          Pitch:
          <IconButton icon="minus" action={()=>{camera.position.pitch = (camera.position.pitch ?? 0) - Math.PI/180 * 5; forceUpdate();}}/>
          <IconButton icon="plus" action={()=>{camera.position.pitch = (camera.position.pitch ?? 0) + Math.PI/180 * 5; forceUpdate();}}/>
          {( (camera.position.pitch ?? 0) * 180 / Math.PI ).toFixed(1)}°
        </div>
        <div className="flex gap-2">
          Yaw:
          <IconButton icon="minus" action={()=>{camera.position.yaw = (camera.position.yaw ?? 0) - Math.PI/180 * 5; forceUpdate();}}/>
          <IconButton icon="plus" action={()=>{camera.position.yaw = (camera.position.yaw ?? 0) + Math.PI/180 * 5; forceUpdate();}}/>
          {( (camera.position.yaw ?? 0) * 180 / Math.PI ).toFixed(1)}°
        </div>
        <div className="flex gap-2">
          Roll:
          <IconButton icon="minus" action={()=>{camera.position.roll = (camera.position.roll ?? 0) - Math.PI/180 * 5; forceUpdate();}}/>
          <IconButton icon="plus" action={()=>{camera.position.roll = (camera.position.roll ?? 0) + Math.PI/180 * 5; forceUpdate();}}/>
          {( (camera.position.roll ?? 0) * 180 / Math.PI ).toFixed(1)}°
        </div>

      </div>
    );
  }

  const buttons = () => {
    const engine = props.engine;
    if(!engine){
      return <div className="text-white">Engine not ready.</div>;
    }
    const canvasObject = engine.canvasRef.object;
    return <div className="flex">
      <div>
        <Button1 text={`Perspective: ${engine.camera.usePerspective}`} action={()=>{
          engine.camera.usePerspective = !engine.camera.usePerspective;
        }}/>
        <Button1 text={"Restart canvas"} action={()=>{
          canvasObject.resetEngine();
        }}/>
        <Button1 text={"Draw triggers: "+engine.drawTriggers} action={()=>{
          engine.drawTriggers = !engine.drawTriggers;
          engine.forceUpdate();
        }}/>
      </div>
      <div>
        <Button1 text={"Switch draw collisions matrix"} action={()=>{
          engine.drawCollisionsMatrix = !engine.drawCollisionsMatrix;
          // engine.forceUpdate();
        }}/>
        <Button1 text={"Show fps: "+engine.showFps} action={()=>{
          engine.showFps = !engine.showFps;
          canvasObject.showFps = !canvasObject.showFps;
          forceUpdate();
          canvasObject.forceUpdate();
        }}/>

        <Button1 text="Toggle fullscreen"
          action={()=>{ToggleFullscreen()}}
        />
      </div>
      <div className="flex border-l border-white">
        {KeyFilesControls()}
      </div>
    </div>
  }


  return(<div>
    {buttons()}
    <hr className="text-gray-200 my-1"/>
    {scriptSelector()}
    <hr className="text-gray-200 my-1"/>
    {speedControls()}
    {cameraControls()}
  </div>)
}