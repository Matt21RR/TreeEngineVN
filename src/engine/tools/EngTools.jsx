import React from "react";
import { Button1, IconButton } from "../components/buttons";
import Swal from "sweetalert2";
class EngTools extends React.Component{
  constructor(props){super(props);}
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
        engine.showCanvasGrid = !engine.showCanvasGrid;
        this.forceUpdate();
      }}/>
      <Button1 text={"Perspective: "+engine.camera.usePerspective} action={()=>{
        engine.camera.usePerspective = !engine.camera.usePerspective;
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
      {this.speedControls()}
      {this.fpsControls()}
    </>)
  }
}
export {EngTools}