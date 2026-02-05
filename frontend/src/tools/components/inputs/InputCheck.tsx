import React, { useEffect, useState } from "react";

interface InputCheckProps{
  id?: string,
  checked?:boolean
  label?: string
  action?: (checked?: boolean)=>void
  uncheckedColor?: string
}

export default function InputCheck (props: InputCheckProps){
  const [checked, setChecked] = useState(props.checked ?? false);

  useEffect(()=>{
    setChecked(props.checked);
  },[props]);

  return(
    <div 
      onClick={()=>{
        props.action?.(!checked);
      }}
      className="flex mx-3">
      <div className={"border mr-1 h-[0.8rem] w-[0.8rem] my-auto border-white "+(checked ? "bg-green-700": (props.uncheckedColor || ""))}/>
      <span className="ml-1 my-auto">{props.label ?? "NOLABEL"}</span>
    </div>
  );
}