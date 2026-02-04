import React from "react";
import $ from "jquery";

interface InputTextProps {
  id?:string,
  style?:string,
  type?:string,
  hide?:boolean,
  defaultValue?: any,
  action?: (value?: string)=>void
  selfSet?: (self: HTMLInputElement)=>void
}

export default class InputText extends React.Component<InputTextProps>{
  id:string;
  mounted:boolean;
  constructor(props: InputTextProps){
    super(props);
    this.id = this.props.id || ("inputText" + String(window.performance.now()).replaceAll(".",""));
    this.mounted = false
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      this.props.selfSet?.($("#"+this.id).get(0) as HTMLInputElement);
    }
  }
  render(){
    return(
      <input 
        id={this.id}
        type={this.props.type ?? "text"}
        step={0.1}
        
        className={"bg-black my-0.5 px-1 h-4 min-h-4 w-36 min-w-36 rounded-md text-[12px] " + (this.props.style ?? "") + ((this.props.hide) ? " hidden":"")} 
        defaultValue={this.props.defaultValue ?? ""}
        onChange={(e)=>{this.props.action?.(e.target.value)}}
      />
    );
  }
}