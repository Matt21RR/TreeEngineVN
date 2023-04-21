import gsap from "gsap";
import React from "react";
import { MenuButton, Button1 } from "../components/buttons";
import TextareaAutosize from 'react-textarea-autosize';
import { generateRndRGBColor } from "../logic/Misc";
import trashIcon from "../res/engineRes/trash.svg";
class MoveButton extends React.Component {
  render(){
    return(
      <div className="relative rotate-90 w-4 h-4 mx-[2px]">
        <div className="absolute left-0 w-2 h-4 border-[1px] flex">
          <span className="bottom-[-20%] absolute">{"<"}</span>
        </div>
        <div className="absolute right-0 w-2 h-4 border-[1px]">
          <span className="bottom-[-20%] absolute">{">"}</span>  
        </div>
      </div>
    );
  }
}
class DeleteButton extends React.Component {
  render(){
    return(
      <div className="relative w-4 h-4 mx-[2px] border-[1px]">
        <div className="absolute top-0 left-0 w-full h-full" style={{backgroundImage:"url('"+trashIcon+"')",backgroundSize:"contain"}}/>
      </div>
    );
  }
}
class NodePropsEditor extends React.Component{
  constructor(props){
    super(props);
    this.state = {
      nodeInfo: this.props.node,//replace with node id
      nodeId:this.props.nodeId,
      showing: false,
    }
    this.target = React.createRef();
  }
  componentDidUpdate(){
    console.log(this.props.interpretedMode);

    console.log(this.props.nodeId);
    if(this.props.showing && !this.state.showing){
      this.setState({showing:true,nodeInfo:this.props.node},()=>{
        if(this.props.interpretedMode){//if need to interpret the editor script copy, then get the node
      
        }else{//else get the node directly from the uninterpreted scrip't

        }
        //fadeInAnimation
        gsap.to(this.target.current,0.5,{opacity:1});
        gsap.to(this.target.current.childNodes[1],0.5,{right:"0px"});
      });
    }else if(!this.props.showing && this.state.showing){
      this.setState({showing:false},()=>{
        //fadeOutAnimation
        gsap.to(this.target.current,0.5,{opacity:0});
        gsap.to(this.target.current.childNodes[1],0.5,{right:"-400px"});
      });
    }
  }
  propertiesOperationButtons(){
    if(!this.props.interpretedMode){
      return(<>
        <MoveButton text="Agregar indice"/>
        <DeleteButton/>
      </>)
    }
    return(<></>)
  }
  renderLista(lista = new Array()){
    return(
      lista.map((element,index) => (
        <>
          <div className="flex">
            {this.propertiesOperationButtons()}
            {index}:
          </div>
          {this.renderPropiedades(element)}
        </>
        ))
    );
  }
  renderObjetoConditional(objeto,key){
    if(typeof objeto[key] == "object"){
      return(
        <>
          <div className="flex">
          {this.propertiesOperationButtons()}
          {key}:
          </div>
          {this.renderPropiedades(objeto[key],key)}
        </>
      )
    }else{
      return(
        <>
          <div className="flex">
          {this.propertiesOperationButtons()}
          {key}:
          {this.renderPropiedades(objeto[key],key)}
          </div>
          
        </>
      )
    }

  }
  renderObjeto(objeto = new Object()){
    return(
      Object.keys(objeto).map((key,index) => (
        <div>
            {this.renderObjetoConditional(objeto,key)}
        </div>
        ))
        
    );
  }
  renderPropiedad(valorPropiedad = new String(),nombrePropiedad = new String()){
    //Agregar condicionales para valor tipo numerico y valor tipo archivo/imagen
    return(
      <TextareaAutosize className=" rounded-md px-1" defaultValue={valorPropiedad} style={{backgroundColor:"black",width:"200px",borderWidth:"1px",borderColor:"#40404075"}} />
      // <input className=" rounded-md px-1 border-2" type="text" value={valorPropiedad} style={{backgroundColor:"#262626"}}/>
    );
  }
  renderPropiedades(info = this.state.nodeInfo,nombrePropiedad = null){
    //Si la propiedad está definida como un array u objeto, hay que repetir
    //Si no parar
    if(Array.isArray(info)){
      return(
        <div className="ml-2 pt-1" style={{borderLeft:"#40404075 solid 1px", borderTop:"#40404075 dotted 2px"}}>
          {this.renderLista(info)}
          
        </div>
      );
    }else if(typeof info == "object"){
      const rgbColor = generateRndRGBColor(35);
      return(
        <div className="ml-2 pl-1 pt-1" style={{borderLeft:"#40404075 solid 1px", borderTop:"#40404075 dotted 2px", backgroundColor:rgbColor}}>
          {this.renderObjeto(info)}
        </div>
      );
    }else{
      return(
        <>
        {this.renderPropiedad(info)}
        </>
      );
    }
  }
  render(){
    return(
      <div ref={this.target} className={"absolute top-0 left-0 w-full h-full opacity-0" + (!this.state.showing? " pointer-events-none" : "")}>
        <div className="absolute top-0 left-0 w-full h-full"
          style={{
            opacity:0.5,
            backgroundColor:"#000000"
          }}>

        </div>
        <div className="text-white overflow-x-hidden"
          style={{
            // transform:"translate(-50%,50%)",
            right:"-400px",
            top:"0%",
            height:"100%",
            width:"550px",
            position:"absolute",
            backgroundColor:"black",
            fontSize:"13.5px",
            fontFamily:"consolas",
            color:"rgb(200,200,200)"
          }}>
            <div className="absolute w-full h-fit"
              style={{
                left:"20px",
                top:"10px",
              }}>
                {"Propiedades del nodo"+(this.props.interpretedMode? " interpretadas": " sin interpretar")}
                <br /><br />
                {this.renderPropiedades()}
            </div>
            <div className="absolute top-2 right-2">
              <MenuButton text="Cerrar" action={()=>{this.props.close()}}/>
            </div>
        </div>
      </div>
    )
  }
}
export {NodePropsEditor}