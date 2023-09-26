import React from "react";
import { Button1, IconButton } from "../components/buttons";

class PropertyEditor extends React.Component{
  constructor(props){
    super(props);
    this.state = {
      parentRoute:this.props.parentRoute,
      key:this.props.key, //A.K.A. value name
      value:this.props.value,
      type:2,//0 = array | 1 = object | 2 = property(default)
      dragging:false,
      initialClientPos:[0,0],
      initialWindowPos:[0,0]
    }
    this.keyRef = React.createRef();
    this.valueRef = React.createRef();
    this.windowRef = React.createRef();
  }
  setNewCoords(mouse){
    if(mouse.buttons == 0){
      this.setState({dragging:false});
      return;
    }
    const deltas = [mouse.clientX-this.state.initialClientPos[0],
                    mouse.clientY-this.state.initialClientPos[1]];
    const newLeft = ((100 / window.innerWidth) * deltas[0]) + this.state.initialWindowPos[0];
    const newTop = ((100 / window.innerHeight) * deltas[1]) + this.state.initialWindowPos[1];
    this.windowRef.current.style.left = newLeft + "%";
    this.windowRef.current.style.top = newTop + "%";
  }
  render(){
    return(
      <div 
        ref={this.windowRef}
        className=" text-white absolute -translate-x-1/2 -translate-y-1/2 w-[300px] h-[400px] bg-black border-[1px] border-blue-600 select-none"
        style={{top:"50%",left:"50%"}}
        >
        <div className=" bg-slate-700 text-sm w-full p-3 relative"
        onMouseDown={(e)=>{
          e.preventDefault(); 
          this.setState({
            initialClientPos:[e.clientX,e.clientY],
            initialWindowPos:[
              (this.windowRef.current.style.left.replace('%','') * 1),
              (this.windowRef.current.style.top.replace('%','') * 1)
            ],
            dragging:true
          })}}
        onMouseMove={(e)=>{if(this.state.dragging)this.setNewCoords(e)}}
        onMouseUp={(e)=>{this.setNewCoords(e);this.setState({dragging:false})}}>
          Valores de Propiedad
          <IconButton style="absolute w-4 h-4 top-1/2 right-0" icon="cross"/>  
        </div>
        <div className=" m-3">
          Clave:<input type="text"/>
          <br />
          <br />
          Valor:<input type="text"/>
          </div>
          <Button1 text="Guardar"/>
          <Button1 text="Cerrar"/>
      </div>
    );
  }
}
export {PropertyEditor}