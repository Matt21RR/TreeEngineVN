import React, { useEffect, useReducer, useState } from "react";
import { InputList} from "./components/InputList.tsx";
import { Chaos } from "../engine/interpretators/ChaosInterpreter.ts";
import { Dictionary } from "../global.ts";
import { RenderEngine } from "../engine/renderCore/RenderEngine.tsx";
import InputText from "./components/inputs/InputText.tsx";
import InputCheck from "./components/inputs/InputCheck.tsx";
import { ToggleFullscreen } from "../../wailsjs/go/main/App.js";
import { Button1, IconButton } from "./components/Buttons.tsx";

interface EngineToolsProps {
  engine: RenderEngine
}


export default function EngineTools(props:EngineToolsProps){
  const [scripts, setScripts] = useState<Dictionary<string>>({});
  const [sceneName, setSceneName] = useState("gameEntrypoint");
  const [selectedScript, setSelectedScript] = useState(0);

  const [_, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(()=>{
    checkAvailableScripts();
  },[]);

  const checkAvailableScripts = ()=>{
    const chaos = new Chaos();
    chaos.listScripts().then(scriptsId=>{
      setScripts(scriptsId);
    });
  }

  const scriptSelector = () => {
    const engine = props.engine;
    return (
      <div className="flex">
        <InputList 
          options={Object.keys(scripts)}
          action={(e)=>{setSelectedScript(e);}}
          value={0}
        />
        <InputText style="bg-white text-black" defaultValue={"gameEntrypoint"} action={(value)=>{
            setSceneName(value != "" ? value : "gameEntrypoint");
          }}/>
        <Button1 text={"Run!!"} action={()=>{
          engine.loadScript(scripts[Object.keys(scripts)[selectedScript]], sceneName);
        }}/>
      </div>
    );
  }
  const speedControls = () => {
    const engine = props.engine;
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
    const engine = props.engine;
    const camera = engine.camera;

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

      </div>
    );
  }

  const buttons = () => {
    const engine = props.engine;
    const canvasObject = engine.canvasRef.object;
    return <div className="flex gap-6">
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
        <Button1 text={"Draw collisions matrix: "+engine.drawCollisionsMatrix} action={()=>{
          engine.drawCollisionsMatrix = !engine.drawCollisionsMatrix;
          engine.forceUpdate();
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