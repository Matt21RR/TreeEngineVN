import React, { useEffect, useReducer, useState } from "react";
import { InputList} from "./components/InputList.tsx";
import { RenderEngine } from "../engine/renderCore/RenderEngine.tsx";
import InputCheck from "./components/inputs/InputCheck.tsx";
import { FileExists, ScanFiles, ToggleFullscreen } from "../../wailsjs/go/main/App.js";
import { Button1, IconButton } from "./components/Buttons.tsx";
import { sequencedPromiseWithResult } from "../engine/interpretators/new.ts";
import Swal from "sweetalert2";
import RenderMiscWebGPU from "../engine/renderCore/RenderMiscWebGPU.ts";

function KeyFilesControls(){
    const [filesExist, setFilesExist] = useState<Map<string,KeyFileInfo>>( new Map ( [
    ["./game/main.txt", {exist:false, scanable:false, scanType:null}],
    ["./game/textures/textures.json", {exist:false, scanable:true, scanType:"texture"}],
    ["./game/models/models.json", {exist:false, scanable:true, scanType:"model"}],
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
  scanType:"script"|"texture"|"sound"|"model"|null
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
    const engine = props.engine;
    const camera = engine?.camera;
    if(!engine || !camera){
      return <div className="text-white">Engine not ready.</div>;
    }
    const sens = engine.inputManager?.rotationSensitivity ?? 0.005;

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
        <div className="flex gap-2">
          Sensibilidad rueda:
          <IconButton icon="minus" action={()=>{if(engine.inputManager){engine.inputManager.rotationSensitivity = Math.max(0.0005, sens - 0.001); forceUpdate();}}}/>
          <IconButton icon="plus" action={()=>{if(engine.inputManager){engine.inputManager.rotationSensitivity = Math.min(0.05, sens + 0.001); forceUpdate();}}}/>
          {sens.toFixed(4)} rad/px
        </div>
        <div className="flex gap-2">
          <Button1 text="Reset vista" action={()=>{engine.resetWorldRotation(); forceUpdate();}}/>
          <span>Yaw: {( (camera.position.yaw ?? 0) * 180 / Math.PI ).toFixed(1)}° Pitch: {( (camera.position.pitch ?? 0) * 180 / Math.PI ).toFixed(1)}°</span>
        </div>

      </div>
    );
  }

  //*Niveles discretos del range: el input nativo no soporta pasos no uniformes.
  const ANISO_LEVELS = [0, 2, 4, 8, 16];
  const LIGHTING_MODES = ["Off (unlit)", "Lambert", "Phong", "PBR"];
  const TONE_MODES = ["none", "aces", "agx", "neutral"];

  const graphicsControls = () => {    const engine = props.engine;
    const camera = engine?.camera;
    if(!engine || !camera){
      return <div className="text-white">Engine not ready.</div>;
    }
    const current = camera.globalAnisotropy ?? 2;
    const index = Math.max(ANISO_LEVELS.indexOf(current), 0);
    const lightMode = camera.globalLighting ?? 0;
    const light = camera.globalLight ?? { azim: 0.6, elev: 0.8, ambient: 0.35, shininess: 32, specStrength: 0.5 };
    const setLight = (patch: any) => {
      camera.globalLight = { ...(camera.globalLight ?? {}), ...patch };
      forceUpdate();
    };
    const bloom = camera.globalBloom ?? { enabled: false, threshold: 1, intensity: 0.6, radius: 4 };
    const setBloom = (patch: any) => {
      camera.globalBloom = { ...bloom, ...patch };
      forceUpdate();
    };
    const ao = camera.globalAO ?? { enabled: false, radius: 0.05, intensity: 1, bias: 0.02, power: 1.5, debug: false };
    const setAO = (patch: any) => {
      camera.globalAO = { ...ao, ...patch };
      forceUpdate();
    };
    const points: Array<any> = camera.globalPointLights ?? [];
    const setPoints = (next: Array<any>) => {
      camera.globalPointLights = next;
      forceUpdate();
    };
    const setPoint = (i: number, patch: any) => {
      const next = points.map((p, j) => j === i ? { ...p, ...patch } : p);
      setPoints(next);
    };
    const toHex = (pl: any) => {
      const h = (v: any) => Math.max(0, Math.min(255, Math.round((Number(v) || 0) * 255))).toString(16).padStart(2, "0");
      return `#${h(pl.r ?? 1)}${h(pl.g ?? 1)}${h(pl.b ?? 1)}`;
    };
    const fromHex = (hex: string) => ({
      r: parseInt(hex.slice(1, 3), 16) / 255,
      g: parseInt(hex.slice(3, 5), 16) / 255,
      b: parseInt(hex.slice(5, 7), 16) / 255,
    });
    return (
      <div className="flex flex-col text-white gap-2">
        <div className="flex gap-2 items-center">
          <span>Anisotropía: {(current <= 1) ? "Off (original)" : `${current}x`}</span>
          <input
            type="range"
            min={0}
            max={ANISO_LEVELS.length - 1}
            step={1}
            value={index}
            onChange={(e)=>{
              camera.globalAnisotropy = ANISO_LEVELS[Number(e.target.value)] ?? 2;
              forceUpdate();
            }}
          />
        </div>
        <div className="flex gap-2 items-center">
          <span>Antialiasing (MSAA):</span>
          <select
            className="text-black"
            value={RenderMiscWebGPU.preferredMsaa}
            onChange={(e)=>{
              RenderMiscWebGPU.setPreferredMsaa(Number(e.target.value) === 1 ? 1 : 4);
              forceUpdate();
            }}
          >
            <option value={1}>Off</option>
            <option value={4}>4x</option>
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <span>Tonemap 3D:</span>
          <select
            className="text-black"
            value={camera.globalToneMapping ?? "none"}
            onChange={(e)=>{ camera.globalToneMapping = e.target.value as any; forceUpdate(); }}
          >
            {TONE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <span>Exposición: {(camera.globalExposure ?? 1).toFixed(2)}</span>
          <input
            type="range" min={0.1} max={4} step={0.05} value={camera.globalExposure ?? 1}
            onChange={(e)=>{ camera.globalExposure = Number(e.target.value); forceUpdate(); }}
          />
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex gap-1 items-center">
            <input type="checkbox" checked={!!bloom.enabled} onChange={(e)=>{ setBloom({ enabled: e.target.checked }); }} />
            Bloom 3D
          </label>
          {bloom.enabled && (
            <>
              <span>Umbral: {(bloom.threshold ?? 1).toFixed(2)}</span>
              <input type="range" min={0} max={3} step={0.05} value={bloom.threshold ?? 1}
                onChange={(e)=>{ setBloom({ threshold: Number(e.target.value) }); }} />
              <span>Intensidad: {(bloom.intensity ?? 0.6).toFixed(2)}</span>
              <input type="range" min={0} max={3} step={0.05} value={bloom.intensity ?? 0.6}
                onChange={(e)=>{ setBloom({ intensity: Number(e.target.value) }); }} />
              <span>Radio: {(bloom.radius ?? 4).toFixed(0)}px</span>
              <input type="range" min={1} max={32} step={1} value={bloom.radius ?? 4}
                onChange={(e)=>{ setBloom({ radius: Number(e.target.value) }); }} />
            </>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex gap-1 items-center">
            <input type="checkbox" checked={!!ao.enabled} onChange={(e)=>{ setAO({ enabled: e.target.checked }); }} />
            AO 3D
          </label>
          {/*Solo el buffer de AO a pantalla completa (enciende el AO si estaba apagado)*/}
          <label className="flex gap-1 items-center">
            <input type="checkbox" checked={!!ao.enabled && !!ao.debug} onChange={(e)=>{ setAO(e.target.checked ? { enabled: true, debug: true } : { debug: false }); }} />
            Solo AO
          </label>
          {ao.enabled && (
            <>
              <span>Radio: {(ao.radius ?? 0.05).toFixed(3)}</span>
              <input type="range" min={0.005} max={0.5} step={0.005} value={ao.radius ?? 0.05}
                onChange={(e)=>{ setAO({ radius: Number(e.target.value) }); }} />
              <span>Intensidad: {(ao.intensity ?? 1).toFixed(2)}</span>
              <input type="range" min={0} max={3} step={0.05} value={ao.intensity ?? 1}
                onChange={(e)=>{ setAO({ intensity: Number(e.target.value) }); }} />
              <span>Bias: {(ao.bias ?? 0.02).toFixed(2)}</span>
              <input type="range" min={0} max={0.5} step={0.01} value={ao.bias ?? 0.02}
                onChange={(e)=>{ setAO({ bias: Number(e.target.value) }); }} />
            </>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <span>Iluminación: {LIGHTING_MODES[lightMode] ?? LIGHTING_MODES[0]}</span>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={lightMode}
            onChange={(e)=>{
              camera.globalLighting = Number(e.target.value);
              forceUpdate();
            }}
          />
        </div>
        {lightMode > 0 && (
          <>
            <div className="flex gap-2 items-center">
              <span>Azim: {((light.azim ?? 0.6) * 180 / Math.PI).toFixed(0)}°</span>
              <input
                type="range" min={-Math.PI} max={Math.PI} step={0.05} value={light.azim ?? 0.6}
                onChange={(e)=>{ setLight({ azim: Number(e.target.value) }); }}
              />
              <span>Elev: {((light.elev ?? 0.8) * 180 / Math.PI).toFixed(0)}°</span>
              <input
                type="range" min={-1.2} max={1.5} step={0.05} value={light.elev ?? 0.8}
                onChange={(e)=>{ setLight({ elev: Number(e.target.value) }); }}
              />
            </div>
            <div className="flex gap-2 items-center">
              <span>Amb: {(light.ambient ?? 0.35).toFixed(2)}</span>
              <input
                type="range" min={0} max={1} step={0.05} value={light.ambient ?? 0.35}
                onChange={(e)=>{ setLight({ ambient: Number(e.target.value) }); }}
              />
              {lightMode === 3 && (
                <>
                  <span>Intensidad: {(light.intensity ?? 1).toFixed(2)}</span>
                  <input
                    type="range" min={0} max={4} step={0.05} value={light.intensity ?? 1}
                    onChange={(e)=>{ setLight({ intensity: Number(e.target.value) }); }}
                  />
                </>
              )}
              {lightMode === 2 && (
                <>
                  <span>Shin: {(light.shininess ?? 32).toFixed(0)}</span>
                  <input
                    type="range" min={1} max={128} step={1} value={light.shininess ?? 32}
                    onChange={(e)=>{ setLight({ shininess: Number(e.target.value) }); }}
                  />
                  <span>Spec: {(light.specStrength ?? 0.5).toFixed(2)}</span>
                  <input
                    type="range" min={0} max={2} step={0.05} value={light.specStrength ?? 0.5}
                    onChange={(e)=>{ setLight({ specStrength: Number(e.target.value) }); }}
                  />
                </>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span>Puntuales (máx 4, sin sombras): {points.length === 0 ? "ninguna" : `${points.length}`}</span>
              {points.map((pl: any, i: number) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <span>#{i + 1}</span>
                  <label>X<input type="number" step={0.05} value={pl.x ?? 0} className="w-16 text-black"
                    onChange={(e)=>{ setPoint(i, { x: Number(e.target.value) }); }} /></label>
                  <label>Y<input type="number" step={0.05} value={pl.y ?? 0} className="w-16 text-black"
                    onChange={(e)=>{ setPoint(i, { y: Number(e.target.value) }); }} /></label>
                  <label>Z<input type="number" step={0.05} value={pl.z ?? 0} className="w-16 text-black"
                    onChange={(e)=>{ setPoint(i, { z: Number(e.target.value) }); }} /></label>
                  <label>Rango<input type="number" min={0} step={0.1} value={pl.range ?? 0} className="w-16 text-black"
                    onChange={(e)=>{ setPoint(i, { range: Math.max(0, Number(e.target.value)) }); }} /></label>
                  <label>Int<input type="number" min={0} step={0.1} value={pl.intensity ?? 0} className="w-16 text-black"
                    onChange={(e)=>{ setPoint(i, { intensity: Math.max(0, Number(e.target.value)) }); }} /></label>
                  <input type="color" value={toHex(pl)}
                    onChange={(e)=>{ setPoint(i, fromHex(e.target.value)); }} />
                  <Button1 text="Quitar" action={()=>{ setPoints(points.filter((_, j) => j !== i)); }}/>
                </div>
              ))}
              {points.length < 4 && (
                <Button1 text="Añadir puntual" action={()=>{
                  setPoints([...points, { x: 0.5, y: 0.5, z: 1, range: 2, r: 1, g: 0.9, b: 0.8, intensity: 1 }]);
                }}/>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  const gridControls = () => {
    const engine = props.engine;
    const camera = engine?.camera as any;
    if(!engine || !camera){
      return <div className="text-white">Engine not ready.</div>;
    }
    const showGrid = camera.showGrid ?? false;
    const showXZ = camera.showGridXZ !== false;
    const showXY = !!camera.showGridXY;
    const showYZ = !!camera.showGridYZ;
    const size = camera.gridSize ?? 4;
    const divisions = camera.gridDivisions ?? 16;
    const opacity = camera.gridOpacity ?? 0.5;
    const showAxes = camera.showAxes !== false;
    return (
      <div className="flex flex-col text-white gap-2">
        <div className="flex gap-2 items-center">
          <InputCheck
            label={`Grid 3D: ${showGrid ? "on" : "off"}`}
            checked={showGrid}
            action={(res:boolean)=>{camera.showGrid = res; forceUpdate();}}/>
          <InputCheck
            label="Ejes XYZ"
            checked={showAxes}
            action={(res:boolean)=>{camera.showAxes = res; forceUpdate();}}/>
        </div>
        {showGrid && (
          <>
            <div className="flex gap-2 items-center">
              <span>Planos:</span>
              <InputCheck
                label="XZ"
                checked={showXZ}
                action={(res:boolean)=>{camera.showGridXZ = res; forceUpdate();}}/>
              <InputCheck
                label="XY"
                checked={showXY}
                action={(res:boolean)=>{camera.showGridXY = res; forceUpdate();}}/>
              <InputCheck
                label="YZ"
                checked={showYZ}
                action={(res:boolean)=>{camera.showGridYZ = res; forceUpdate();}}/>
            </div>
            <div className="flex gap-2 items-center">
              <span>Escala: {Number(size).toFixed(1)}</span>
              <input
                type="range" min={1} max={20} step={0.5} value={size}
                onChange={(e)=>{camera.gridSize = Number(e.target.value); forceUpdate();}}
              />
              <span>Divisiones: {divisions}</span>
              <input
                type="range" min={2} max={64} step={1} value={divisions}
                onChange={(e)=>{camera.gridDivisions = Number(e.target.value); forceUpdate();}}
              />
            </div>
            <div className="flex gap-2 items-center">
              <span>Opacidad: {Number(opacity).toFixed(2)}</span>
              <input
                type="range" min={0.05} max={1} step={0.05} value={opacity}
                onChange={(e)=>{camera.gridOpacity = Number(e.target.value); forceUpdate();}}
              />
              <span>Color:</span>
              <input
                type="color" value={camera.gridColor ?? "#8a93a6"}
                onChange={(e)=>{camera.gridColor = e.target.value; forceUpdate();}}
              />
            </div>
          </>
        )}
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
    <hr className="text-gray-200 my-1"/>
    {gridControls()}
    <hr className="text-gray-200 my-1"/>
    {graphicsControls()}
  </div>)
}