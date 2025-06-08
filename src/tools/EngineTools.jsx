import React from "react";
import { Button1, IconButton, InputCheck, InputList, InputText } from "./components/Buttons.jsx";
import { Chaos } from "../engine/interpretators/ChaosInterpreter.ts";
class EngineTools extends React.Component{
  constructor(props){
    super(props);
    this.scripts = {};
    this.sceneName = "gameEntrypoint";
    this.selectedScript = 0;
    this.mounted = false;
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      const chaos = new Chaos();
      chaos.listScripts().then(scriptsId=>{
        this.scripts = scriptsId;
        this.forceUpdate();
      })
    }
  }

  scriptSelector(){
    const engine = this.props.engine;
    return (
      <div className="flex">
        <InputList 
          options={Object.keys(this.scripts)}
          action={(e)=>{this.selectedScript = e;}}
          value={0}
        />
        <InputText style="bg-white text-black" defaultValue={"gameEntrypoint"} action={(value)=>{
            this.sceneName = value != "" ? value : "gameEntrypoint";
          }}/>
        <Button1 text={"Run!!"} action={()=>{
          engine.loadScript(this.scripts[Object.keys(this.scripts)[this.selectedScript]], this.sceneName);
          const chaos = new Chaos();
          chaos.listScripts().then(scriptsId=>{
            this.scripts = scriptsId;
            this.forceUpdate();
          })
        }}/>
      </div>
    );
  }
  speedControls(){
    const engine = this.props.engine;
    return (
      <div className="flex flex-row text-white">
        <IconButton icon="minus" action={()=>{engine.engineSpeed-= 0.1;this.forceUpdate();}}/>
        <Button1 text={engine.stopEngine ? "Play" : "Stop"} action={()=>{
          engine.stopEngine = !engine.stopEngine;
          this.forceUpdate();
        }}/>
        <IconButton icon="plus" action={()=>{engine.engineSpeed+= 0.1;this.forceUpdate();}}/>
        <span>Engine speed: {engine.engineSpeed.toFixed(2)}</span>
      </div>
    );
  }
  cameraControls(){
    
    const engine = this.props.engine;
    return (
      <div className="flex flex-col text-white">
        {JSON.stringify(engine.camera.position)}
        <InputCheck label="Use perspective" checked={engine.camera.usePerspective} action={(res)=>{engine.camera.usePerspective = res}}/>
        <div className="flex ">
          X
          <IconButton icon="minus" action={()=>{engine.camera.position.x-= 0.1;this.forceUpdate();}}/>
          <IconButton icon="plus" action={()=>{engine.camera.position.x+= 0.1;this.forceUpdate();}}/>
        </div>
        <div className="flex ">
          Y
          <IconButton icon="minus" action={()=>{engine.camera.position.y-= 0.1;this.forceUpdate();}}/>
          <IconButton icon="plus" action={()=>{engine.camera.position.y+= 0.1;this.forceUpdate();}}/>
        </div>
        <div className="flex ">
          Z
          <IconButton icon="minus" action={()=>{engine.camera.position.z-= 0.1;this.forceUpdate();}}/>
          <IconButton icon="plus" action={()=>{engine.camera.position.z+= 0.1;this.forceUpdate();}}/>
        </div>

      </div>
    );
  }
  fpsControls(){
    const engine = this.props.engine;
    if("object" in engine.canvasRef){
      const canvasObject = engine.canvasRef.object;
      const fps = canvasObject.fps;
      return (
        <div className="flex flex-row text-white">
          <IconButton icon="minus" action={()=>{canvasObject.setFps(fps-1);this.forceUpdate();}}/>
          <input 
            className="bg-transparent" 
            type="number" 
            min={1} 
            max={300} 
            step={1} 
            defaultValue={fps} 
            onChange={(e)=>{
              var value = parseFloat(e.target.value) || 24;
              value = value > 0 ? value : 24;
              canvasObject.setFps(value);
              this.forceUpdate();
            }}/>
          <IconButton icon="plus" action={()=>{canvasObject.setFps(fps+1);this.forceUpdate();}}/>
          <span>Target FPS: {fps}</span>
        </div>
      );
    }
  }
  render(){
    const engine = this.props.engine;
    const canvasObject = engine.canvasRef.object;
    return(<>
      {/* <Button1 text="2DGrid" action={()=>{
        engine.showBounds = !engine.showBounds;
        this.forceUpdate();
      }}/> */}
      <Button1 text={`Perspective: ${engine.camera.usePerspective}`} action={()=>{
        engine.camera.usePerspective = !engine.camera.usePerspective;
        this.forceUpdate();
      }}/>
      <Button1 text={"Restart canvas"} action={()=>{
        canvasObject.resetEngine();
        this.forceUpdate();
      }}/>
      <Button1 text={"Draw triggers: "+engine.drawTriggers} action={()=>{
        engine.drawTriggers = !engine.drawTriggers;
        engine.forceUpdate();
        this.forceUpdate();
      }}/>
      <Button1 text={"Draw collisions matrix: "+engine.drawCollisionsMatrix} action={()=>{
        engine.drawCollisionsMatrix = !engine.drawCollisionsMatrix;
        engine.forceUpdate();
        this.forceUpdate();
      }}/>
      <Button1 text={"Show fps: "+engine.showFps} action={()=>{
        engine.showFps = !engine.showFps;
        canvasObject.showFps = !canvasObject.showFps;
        this.forceUpdate();
        canvasObject.forceUpdate();
      }}/>
      {this.scriptSelector()}
      {this.speedControls()}
      {this.cameraControls()}
      {this.fpsControls()}
    </>)
  }
}
export {EngineTools}