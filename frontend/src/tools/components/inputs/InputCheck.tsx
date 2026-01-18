import React from "react";

interface InputCheckProps{
  id?: string,
  checked?:boolean
  label?: string
  action?: (checked?: boolean)=>void
  selfSet?: (self: InputCheck)=>void
}

export default class InputCheck extends React.Component<InputCheckProps>{
  id:string;
  checked:boolean;
  constructor(props){
    super(props);
    this.id = this.props.id ?? ("inputCheck" + String(window.performance.now()).replaceAll(".",""));
    this.checked = this.props.checked ?? false;

    //SelfSet
    this.props.selfSet?.(this);
  }
  render(){
    return(
      <div 
        onClick={()=>{
          this.checked = !this.checked;
          this.forceUpdate();
          this.props.action?.(this.checked)
        }}
        className="flex mx-3">
        <div className={"border-[1px] mr-1 h-[0.8rem] w-[0.8rem] my-auto border-white "+(this.checked ? "bg-green-700": "")}/>
        <span className="ml-1 my-auto">{this.props.label ?? "NOLABEL"}</span>
      </div>
    );
  }
}