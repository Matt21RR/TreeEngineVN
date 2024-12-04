import React from "react";
import { Button1, IconButton, InputList } from "./components/Buttons";
import Swal from "sweetalert2";
import { Chaos } from "../engine/renderCore/ChaosInterpreter";
class EngTools extends React.Component{
  constructor(props){
    super(props);
    this.scripts = {};
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
        ></InputList>
        <Button1 text={"Run!!"} action={()=>{
          engine.loadScript(this.scripts[Object.keys(this.scripts)[this.selectedScript]]);
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
  fpsControls(){
    const engine = this.props.engine;
    if("object" in engine.canvasRef){
      const canvas = engine.canvasRef.object;
      const fps = canvas.fps;
      return (
        <div className="flex flex-row text-white">
          <IconButton icon="minus" action={()=>{canvas.setFps(fps-1);this.forceUpdate();}}/>
          <input 
            className="bg-transparent" 
            type="number" 
            min={1} 
            max={125} 
            step={1} 
            defaultValue={fps} 
            onChange={(e)=>{
              var value = e.target.value;
              value = isNaN(value) ? 24 : value;
              value = value > 0 && value < 126 ? value : 24;
              canvas.setFps(value);this.forceUpdate();
            }}/>
          <IconButton icon="plus" action={()=>{canvas.setFps(fps+1);this.forceUpdate();}}/>
          <span>Target FPS: {fps}</span>
        </div>
      );
    }
  }
  render(){
    const engine = this.props.engine;
    return(<>
      <Button1 text="2DGrid" action={()=>{
        engine.showBounds = !engine.showBounds;
        this.forceUpdate();
      }}/>
      <Button1 text={"Perspective: "+engine.camera.usePerspective} action={()=>{
        engine.camera.usePerspective = !engine.camera.usePerspective;
        this.forceUpdate();
      }}/>
      <Button1 text={"Restart canvas"} action={()=>{
        const canvasObject = engine.canvasRef.object;
        engine.canvasRef.object.stopEngine = false;
        engine.canvasRef.object.engineKilled = false;
        engine.canvasRef.object.resizeTimeout = 0;
        engine.canvasRef.object.engineThreads = 0;
        engine.canvasRef.object.resolutionHeight = Math.floor(canvasObject.props.displayResolution.height * canvasObject.scale *window.devicePixelRatio);
        engine.canvasRef.object.resolutionWidth = Math.floor(canvasObject.props.displayResolution.width * canvasObject.scale *window.devicePixelRatio);
        const fps = canvasObject.props.fps ? (canvasObject.props.fps > 0 ? canvasObject.props.fps : 24) : 24;//suggesed max fps = 24
        engine.canvasRef.object.setFps(fps);
        engine.canvasRef.object.engine();
        this.forceUpdate();
      }}/>
      <Button1 text={"Draw triggers: "+engine.drawTriggers} action={()=>{
        engine.drawTriggers = !engine.drawTriggers;
        engine.forceUpdate();
        this.forceUpdate();
      }}/>
      <Button1 text={"Show fps: "+engine.showFps} action={()=>{
        engine.showFps = !engine.showFps;
        engine.canvasRef.object.showFps = !engine.canvasRef.object.showFps;
        this.forceUpdate();
        engine.canvasRef.object.forceUpdate();
      }}/>
      <Button1 text="Show camera data" action={()=>{
        Swal.fire({title:"cameraData",html:JSON.stringify(engine.camera).replaceAll(",","<br>")});
        this.forceUpdate();
      }}/>
      {this.scriptSelector()}
      {this.speedControls()}
      {this.fpsControls()}
    </>)
  }
}
export {EngTools}