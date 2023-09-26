import React from "react";
import trashIcon from "../res/engineRes/trash.svg";
import showIcon from "../res/engineRes/eye.svg";
import hideIcon from "../res/engineRes/eye-closed.svg";
import crossIcon from "../res/engineRes/cross.svg";
const icons ={
  trash:trashIcon,
  show:showIcon,
  hide:hideIcon,
  cross:crossIcon
}

class Button1 extends React.Component{
  render(){
    return(
      <div className={" cursor-pointer m-1 p-1 rounded-md bg-teal-500 text-white w-fit h-fit text-[12px]" + ((this.props.hide) ? " hidden":"")} onClick={()=>{this.props.action()}}>
        {this.props.text}
      </div>
    );
  }
}
class IconButton extends React.Component{
  constructor(props){
    super(props);
  }
  render(){
    return(
      <div className={"cursor-pointer max-w-10 max-h-10 -translate-x-1/2 -translate-y-1/2 "+ this.props.style} onClick={()=>{this.props.action()}}>
        <div className="w-full h-full bg-cover bg-no-repeat"
             style={{backgroundImage:"url('"+icons[this.props.icon]+"')"}} />
      </div>
    );
  }
}
class PauseButton extends React.Component{
  constructor(props){
    super(props);
  }
  render(){
    return(
      <div className="relative m-1 cursor-pointer text-white w-10 h-10" onClick={()=>{this.props.action()}}>
        <div className="left-1 absolute w-3 h-10 bg-white rounded-sm"/>
        <div className="right-1 absolute w-3 h-10 bg-white rounded-sm"/>
        {this.props.text}
      </div>
    );
  }
}
class MenuButton extends React.Component{
  constructor(props){
    super(props);
  }
  render(){
    this.textSize = (this.props.textSize != undefined ? this.props.textSize : 18)+"px";
    // console.log(this.props.hide);
    return(
      <div className={" cursor-pointer m-1 text-white w-fit h-fit hover:text-slate-400" + ((this.props.hide==true) ? " hidden":"")} onClick={this.props.action != undefined ? ()=>{this.props.action()} : ()=>{throw new Error("Accion para el botón con texto '"+this.props.text+"' no definida")}} style={{fontSize:this.textSize, fontFamily:"Harry Thin", letterSpacing:"0.15em", transform:"scaleY(0.9)",  filter: "invert(0%)"}}>
        {this.props.text}
      </div>
    );
  }
}
export {Button1, MenuButton, PauseButton, IconButton}