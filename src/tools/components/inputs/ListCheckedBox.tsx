import React from "react";

type ListElement = {
  text:string,
  check:boolean,
  actionName?:string,
  action?:()=>void
}

interface ListCheckedBoxProps {
  list:Array<ListElement>
}

export default class ListCheckedBox extends React.Component<ListCheckedBoxProps>{
  actionButton(element:ListElement){
    if(element.actionName != undefined){
      return(
        <div 
        className={"cursor-pointer mx-1 p-[1px] my-auto rounded-md bg-teal-500 text-white w-fit h-fit text-[12px]" + ((!element.check) ? " hidden":"")} 
        onClick={()=>{element.action?.()}}>
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