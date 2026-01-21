import React from "react";
import $ from "jquery";
import { Dictionary } from "../../../global.ts";

import '../highlight-within-textarea/jquery.highlight-within-textarea.js';
//@ts-ignore
import '../highlight-within-textarea/jquery.highlight-within-textarea.css';

interface InputTextAreaProps {
  action?:(string)=>void,
  value?:string,
  id?:string
  defaultValue?:string,
  height?:string,
  fatherStyle?:string
  onControl:Dictionary<(e:React.KeyboardEvent)=>void>
} 

interface InputTextAreaState {
  focus: boolean;
  error: boolean;
}

export default class InputTextArea extends React.Component<InputTextAreaProps, InputTextAreaState> {
  inputBoxRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  id:string;
  mounted:boolean;
  caretPosWhenBlur:{start:number, end:number};

  constructor(props) {
    super(props);
    this.state = {
      focus: false,
      error: !(this.props.action),
    }
    this.inputBoxRef = React.createRef();
    this.inputRef = React.createRef();
    this.id = this.props.id ?? ("inputTextArea" + String(window.performance.now()).replaceAll(".",""));
    this.handleClickOutside = this.handleClickOutside.bind(this);
    this.mounted = false;
    this.caretPosWhenBlur = {start:0,end:0};
  }
  componentDidMount() {
    if(!this.mounted){
      this.mounted = true;
      document.addEventListener("mousedown", this.handleClickOutside);
      //@ts-ignore
      $('#'+this.id).highlightWithinTextarea({
        highlight: [
            {
              highlight: [/^(move)\s+(\w+)\s+(to)\s+(\w+)\s*\n/gm, /^(move)\s+(\w+)\s+(to)\s+(\w+)\s+(in)\s+(\d+)\s*\n/gm],
              secondPassRegex:/\b(move|to|in)\b/g,
              className: 'text-amber-700'
            },
            {
              highlight: /\/\/[^\*]\s*.*/g,
              className: 'text-[#6272A4]'
              
            },
            {
              highlight: /\/\/\*\s*.*/g,
              className: 'text-[#98C379]'
            },
            {
              highlight: ['GraphObject','TextureAnim','Trigger','KeyboardTrigger','Animation','CodedRoutine','Actor','StageMark','(',')','{','}'],
              className: 'text-[#357FBF]'
            },
            {
              highlight: [/if( {0,})\(/g,/([^A-Za-z\d\w]{0,1})let( {1,})/g,/([^A-Za-z\d\w]{0,1})const( {1,})/g],
              className: 'text-[#DB974D]'
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
              highlight:[ /={1}/g , /\+{1}/g , /-{1}/g , /\*{1}/g , /\/{1}/g , /\<{1}/g , /\>{1}/g , /\+={1}/g , /=={1}/g, 'new'],
              className: 'text-[#E53935]'
            },
            {
              highlight: [/"(.*?)"/g],
              className: 'text-[#A18649]'
            },
            {
              highlight: [/^\s*(set){1}(\W)/gm,/^\s*(run){1}(\W)/gm,/^\s*(play){1}(\W)/gm,/^\s*(wait){1}(\W)/gm,/^\s*(resume){1}(\W)/gm,/^\s*(show){1}(\W)/gm,/^\s*(load){1}(\W)/gm,/^\s*(speak){1}(\W)/gm,/^\s*(narration){1}(\W)/gm],
              className: 'text-green-600'
            }
        ]
      });
      this.inputRef.current.value = this.props.defaultValue ?? "";
      $('#'+this.id).trigger("load");
    }
  }
  componentDidUpdate(){
    this.inputRef.current.value = this.props.defaultValue ?? "";
    $('#'+this.id).trigger("load");
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
    if (!this.state.error && (typeof this.props.action == "function")) {
      this.setState({
        focus: true
      });
      let inputBoxRef = this.inputBoxRef.current;
      gsap.to(inputBoxRef, { borderColor: 'rgb(0, 115, 170)' });
    }
  }
  action(){
    this.props.action?.(this.inputRef.current.value);
  }
  unhover() {
    if (this.state.focus) {
      this.setState({
        focus: false,
      }, () => {
        let inputBoxRef = this.inputBoxRef.current;
        gsap.to(inputBoxRef, { borderColor: '#000' });

        //*DevelopMode
        if (typeof this.props.action == "undefined") {
          this.inputRef.current.value = "NoFunctionToCallback";
        }
        //*EndDevelopMode
      });
    }
  }

  render() {
    let height = this.props.height ? ' ' + this.props.height + ' ' : ' h-36 ';

    let fatherStyle = this.props.fatherStyle ? ' ' + this.props.fatherStyle + ' ' : 'bg-transparent';
    return (
      <>
        <label htmlFor={this.id} onClick={() => { this.hover() }} className="p-0 m-0 relative h-full w-full">
          <div
            ref={this.inputBoxRef}
            className={"p-0 h-full select-none w-full overflow-x-hidden " + fatherStyle}
          >
            <textarea
              className={height + "w-full resize-none outline-none align-top border-none bg-transparent text-transparent caret-white p-2"}
              onBlur={(e)=>{
                const element = $("#"+this.id).get(0) as HTMLTextAreaElement;
                var start = element.selectionStart;
                var end = element.selectionEnd;
                this.caretPosWhenBlur = {start:start,end:end};
              }}
              defaultValue={this.props.value ?? ""}
              ref={this.inputRef}
              name={this.id}
              id={this.id}
              spellCheck={false}
              onChange={()=>this.action()}
              onKeyUp={e => {
                if(e.key == "Tab"){e.preventDefault();}
              }}
              onKeyDown={e => {
                if(e.ctrlKey){
                  if("onControl" in this.props){
                    if(e.key in this.props.onControl){this.props.onControl[e.key](e);}
                  }
                }else{
                  if (e.key == 'Tab') {
                    e.preventDefault();
                    const element = $("#"+this.id).get(0) as HTMLTextAreaElement;
                    var start = element.selectionStart;
                    var end = element.selectionEnd;
                
                    if(e.shiftKey){
                      // set textarea value to: text before caret + tab + text after caret
                      element.value = element.value.substring(0, start-2) + element.value.substring(end);
                      // put caret at right position again
                      element.selectionStart =
                      element.selectionEnd = start - 2;
                    }else{
                      // set textarea value to: text before caret + tab + text after caret
                      element.value = element.value.substring(0, start) +
                      "  " + element.value.substring(end);
                      
                      // put caret at right position again
                      element.selectionStart =
                      element.selectionEnd = start + 2;
                    }
                
                    this.action();
                    $('#'+this.id).trigger("load");
                  }
                  if (e.key == 'Enter') { //Avoid autoscroll on enter
                    e.preventDefault();
                    const element = $("#"+this.id).get(0) as HTMLTextAreaElement;
                    var start = element.selectionStart;
                    var end = element.selectionEnd;
                
                    // set textarea value to: text before caret + tab + text after caret
                    element.value = element.value.substring(0, start) +
                      '\r\n' + element.value.substring(end);
                
                    this.action();
                    $('#'+this.id).trigger("load");
                    // this.forceUpdate();
                    // put caret at right position again
                    element.selectionStart = element.selectionEnd = start+1;
                  }
                }
              }} />
          </div>
        </label>
      </>
    );
  }
}