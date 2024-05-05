import React from "react";

import trash from "../res/engineRes/trash.svg";
import show from "../res/engineRes/eye.svg";
import hide from "../res/engineRes/eye-closed.svg";
import cross from "../res/engineRes/cross.svg";
import save from "../res/engineRes/save.svg";

import gsap from "gsap";
import $ from "jquery";
import './highlight-within-textarea/jquery.highlight-within-textarea.js';
import './highlight-within-textarea/jquery.highlight-within-textarea.css';

const icons ={
  trash:trash,
  show:show,
  hide:hide,
  cross:cross,
  save:save
}

class ListCheckedBox extends React.Component{
  actionButton(element){
    if(element.actionName != undefined){
      return(
        <div 
        className={" cursor-pointer mx-1 p-[1px] my-auto rounded-md bg-teal-500 text-white w-fit h-fit text-[12px]" + ((!element.check) ? " hidden":"")} 
        onClick={()=>{element.action()}}>
          {element.actionName}
        </div>
      );
    }
  }
  list(){
    return(
      this.props.list.map(element => (
        <div className="flex flex-row w-auto">
          <div className={"border-[1px] mr-1 h-4 w-4 my-auto border-white "+(element.check ? "bg-green-700": "")}/>
          {element.text}
          {this.actionButton(element)}
        </div>      
      ))
    );
  }
  render(){
    return(
      <div className="flex flex-col w-auto mx-1">
        {this.list()}
      </div>
    );
  }
}
class Button1 extends React.Component{
  render(){
    return(
      <div 
        className={" cursor-pointer m-1 p-1 rounded-md bg-teal-500 text-white w-fit h-fit text-[12px]" + ((this.props.hide) ? " hidden":"")} 
        onClick={()=>{this.props.action()}}
        onMouseEnter={()=>{if("enter" in this.props){this.props.enter();}}}
        onMouseLeave={()=>{if("leave" in this.props){this.props.leave();}}}>
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
      <div className={"cursor-pointer max-w-10 max-h-10 "+ ("style" in this.props ? this.props.style : "")} onClick={()=>{this.props.action()}}>
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
class InputTextArea extends React.Component {
  constructor(props) {
    super(props);
    window.lastInputIdAssigned = window.lastInputIdAssigned == undefined ? 0 : window.lastInputIdAssigned;
    this.state = {
      focus: false,
      inputMinHeight: 0,
      error: ((typeof this.props.changeValue) == "undefined") || (typeof this.props.value == "undefined") || !(typeof this.props.changeValue == "function"),
    }
    this.inputBoxRef = React.createRef();
    this.inputRef = React.createRef();
    this.id = "inputTextArea" + String(window.performance.now()).replaceAll(".","");
    this.handleClickOutside = this.handleClickOutside.bind(this);
    this.mounted = false;
  }
  componentDidMount() {
    if(!this.mounted){
      this.mounted = true;
      document.addEventListener("mousedown", this.handleClickOutside);
      $('#'+this.id).highlightWithinTextarea({
        highlight: [
            {
                highlight: 'new',
                className: 'text-red-700'
            },
            {
              highlight: ['GraphObject','Trigger','Animation','CodedRoutine','(',')','{','}'],
              className: 'text-[#357FBF]'
            },
            {
              highlight: /if( {0,})\(/g,
              className: 'text-[#DB974D]'
            },
            {
                highlight:[ / {1}={1} {1}/g , / {1}\+{1} {1}/g , / {1}\<{1} {1}/g , / {1}\>{1} {1}/g , / {1}\+={1} {1}/g , / {1}=={1} {1}/g],
                className: 'text-[#E53935]'
            },
            {
                highlight: '=>',
                className: 'text-[#DB974D]'
            },
            {
              highlight: [/\d/g,'[',']'],
              className: 'text-[#86DBFD]'
            },
            {
              highlight: /"(.*?)"/g,
              className: 'text-[#A18649]'
            },
            {
              highlight: ['SET','WAIT','SHOW'],
              className: 'text-green-600'
            },
            {//comentario
              highlight: /\/\/[^\*]\s*.*/g,
              className: 'text-[#6272A4]'
              
            },
            {//*comentario
              highlight: /\/\/\*\s*.*/g,
              className: 'text-[#98C379]'
              
            }
        ]
      });
      this.setState({
        inputMinHeight: this.inputBoxRef.current.offsetHeight,
      });
    }
  }
  
  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleClickOutside);
  }
  handleClickOutside(e) {
    if (this.inputBoxRef && !this.inputBoxRef.current.contains(e.target) && this.state.focus) {
      this.unhover();
    }
  }
  hover() {
    if (!this.state.error && (typeof this.props.changeValue == "function")) {
      this.setState({
        focus: true
      });
      let inputBoxRef = this.inputBoxRef.current;
      gsap.to(inputBoxRef, { borderColor: 'rgb(0, 115, 170)' });
    }
  }
  changeValue(){
    if(typeof this.props.changeValue == "function"){
      this.props.changeValue(this.inputRef.current.value);
    }
  }
  unhover() {
    if (this.state.focus) {
      this.setState({
        focus: false,
      }, () => {
        let inputBoxRef = this.inputBoxRef.current;
        gsap.to(inputBoxRef, { borderColor: '#000' });

        //*DevelopMode
        if (typeof this.props.changeValue == "undefined") {
          this.inputRef.current.value = "NoFunctionToCallback";
        }
        //*EndDevelopMode
      });
    }
  }

  render() {
    console.log(this.props.value);
    let height = typeof this.props.height == 'string' ? ' ' + this.props.height + ' ' : ' h-36 ';

    let fatherStyle = typeof this.props.fatherStyle == 'string' ? ' ' + this.props.fatherStyle + ' ' : '';
    return (
      <>
        <label htmlFor={this.id} onClick={() => { this.hover() }} className="p-0 m-0 relative h-full w-full">
          <div
            ref={this.inputBoxRef}
            className={"p-0 h-full select-none w-full bg-transparent overflow-x-hidden  " + fatherStyle}
          >
            <textarea
              className={height + "w-full resize-none outline-none align-top border-none bg-transparent text-transparent caret-white p-2"}
              type="text"
              defaultValue={"value" in this.props? this.props.value : ""}
              ref={this.inputRef}
              name={this.id}
              id={this.id}
              onChange={()=>this.changeValue()}
              onKeyUp={e => (e.key == "Tab" ? this.hover() : null)}
              onKeyDown={e => (e.key == "Tab" ? this.unhover(e) : null)} />
          </div>
        </label>
      </>
    );
  }
}
class InputText extends React.Component{
  render(){
    return(
      <input 
        className={" bg-black my-0.5 px-1 rounded-md text-white text-[12px] " + ("style" in this.props ? this.props.style : "") + ((this.props.hide) ? " hidden":"")} 
        onClick={()=>{if("action" in this.props){this.props.action()}}}
        onChange={(e)=>{if("change" in this.props){this.props.change(e.target.value)}}}
        onMouseEnter={()=>{if("enter" in this.props){this.props.enter();}}}
        onMouseLeave={()=>{if("leave" in this.props){this.props.leave();}}}
      />
    );
  }
}
export {Button1, MenuButton, PauseButton, IconButton, ListCheckedBox, InputTextArea, InputText}