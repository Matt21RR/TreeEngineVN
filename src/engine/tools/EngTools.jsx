import React from "react";
import { RenderEngine } from "../renderCore/RenderEngine";
import { Button1 } from "../components/buttons";
import Swal from "sweetalert2";

class EngTools extends React.Component{
  constructor(props){super(props);}
  render(){
    const engine = this.props.engine
    return(<>
      <Button1 text="2DGrid" action={()=>{
        engine.showCanvasGrid = !engine.showCanvasGrid;
        this.forceUpdate();
      }}/>
      <Button1 text={"Perspective: "+engine.camera.usePerspective} action={()=>{
        engine.camera.usePerspective = !engine.camera.usePerspective;
        this.forceUpdate();
      }}/>
      <Button1 text="Show camera data" action={()=>{
        Swal.fire({title:"cameraData",html:JSON.stringify(engine.camera).replaceAll(",","<br>")});
        this.forceUpdate();
      }}/>
    </>)
  }
}
export {EngTools}