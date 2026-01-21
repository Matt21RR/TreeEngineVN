import React from "react";

import './highlight-within-textarea/jquery.highlight-within-textarea.js';
//@ts-ignore
import './highlight-within-textarea/jquery.highlight-within-textarea.css';

import icons from "./Icons.ts";

type BaseButtonProps = {
  style?:string,
  hide?:boolean,
  action?: ()=>void,
  enter?: ()=>void,
  leave?: ()=>void,
  text: string
}

export function BaseButton (props:BaseButtonProps){
  return(
    <div 
      className={`${props.style ?? ""} ${props.hide ? "hidden":""}`} 
      onClick={()=>{props.action?.()}}
      onMouseEnter={()=>{props.enter?.();}}
      onMouseLeave={()=>{props.leave?.();}}>
      {props.text}
    </div>
  );
}

type Button1Props = BaseButtonProps & {
  color?:string,
}

export function Button1 (props: Button1Props){
  return(
    <div 
      className={`cursor-pointer p-1 rounded-md ${props.color || "bg-teal-700"} text-white w-fit h-fit text-[12px] ${props.style ?? "m-1"} ${props.hide ? "hidden":""}`} 
      onClick={()=>{props.action?.()}}
      onMouseEnter={()=>{props.enter?.();}}
      onMouseLeave={()=>{props.leave?.();}}>
      {props.text}
    </div>
  );
}

type IconButtonProps = {
  style?:string,
  hide?:boolean,
  action?: ()=>void,
  enter?: ()=>void,
  leave?: ()=>void,
  color?:string,
  iconStyle?:string,
  icon:string
}

export function IconButton (props: IconButtonProps){
  return(
    <div 
      className={`cursor-pointer flex ${props.style ?? "h-6 w-6 m-1"} ${props.hide ? "hidden":""}`} 
      onClick={()=>{props.action?.()}}>
      <div 
        className={`bg-cover bg-no-repeat ${props.iconStyle ?? "w-full h-full"}`}
        style={{backgroundImage:`url("${icons[props.icon]}")`}} />
    </div>
  );
}

type MenuButtonProps = BaseButtonProps & {
  textSize?: number
}

export function MenuButton (props: MenuButtonProps){
  return(
    <div 
      className={`cursor-pointer m-1 text-white w-fit h-fit hover:text-slate-400 ${props.style ?? ""} ${props.hide ? "hidden":""}`} 
      onClick={()=>{props.action?.()}} 
      style={{
        fontSize: (props.textSize ?? 18)+"px", 
        fontFamily:"Harry Thin", 
        letterSpacing:"0.15em", 
        transform:"scaleY(0.9)",  
        filter: "invert(0%)"}}>
      {this.props.text}
    </div>
  );
}