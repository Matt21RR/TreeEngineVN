import React from "react";
import $ from "jquery";

interface InputTextAreaProps {
  id?:string,
  style?:string,
  type?:string,
  hide?:boolean,
  defaultValue?: any,
  action?: (value?: string)=>void
  selfSet?: (self: HTMLInputElement)=>void
}

export default class InputTextArea extends React.Component<InputTextAreaProps>{
  id:string;
  mounted:boolean;
  constructor(props: InputTextAreaProps){
    super(props);
    this.id = this.props.id || ("inputTextArea" + String(window.performance.now()).replaceAll(".",""));
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
      <textarea 
        id={this.id}
        className={"bg-gray-950 h-4 min-h-4 w-36 min-w-36 resize my-0.5 px-1 rounded-md text-[12px] " + (this.props.style ?? "") + ((this.props.hide) ? " hidden":"")} 
        defaultValue={this.props.defaultValue ?? ""}
        onChange={(e)=>{this.props.action?.(e.target.value)}}
        />
    );
  }
}