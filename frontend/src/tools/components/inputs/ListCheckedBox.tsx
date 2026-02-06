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

export default function ListCheckedBox (props:ListCheckedBoxProps){
  const actionButton = (element:ListElement) => {
    if(element.actionName != undefined){
      return(
        <div 
          className={`cursor-pointer mx-1 p my-auto rounded-md bg-teal-500 text-white w-fit h-fit text-[12px] ${(!element.check) ? "hidden":""}`}
          onClick={()=>{element.action?.()}}>
            {element.actionName}
        </div>
      );
    }
  }
  const list = () => {
    return(
      props.list.map(element => (
        <div className="flex flex-row w-auto">
          <div className={`border mr-1 h-4 w-4 my-auto border-white ${element.check ? "bg-green-700": ""}`}/>
          {element.text}
          {actionButton(element)}
        </div>      
      ))
    );
  }

  return(
    <div className="flex flex-col w-auto mx-1">
      {list()}
    </div>
  );

}