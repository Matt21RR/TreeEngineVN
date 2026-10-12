import React from "react";

import './highlight-within-textarea/jquery.highlight-within-textarea.js';
//@ts-ignore
import './highlight-within-textarea/jquery.highlight-within-textarea.css';

import icons from "./Icons.ts";

export const smallToolbarButtonClass = "text-[13px] leading-none px-1.5 py-1 rounded bg-neutral-800/80 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 border border-neutral-600"

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

type ToolbarButtonProps = BaseButtonProps & {
  extraClass?:string,
  title?:string
}

export function ToolbarButton (props: ToolbarButtonProps){
  return(
    <button
      type="button"
      title={props.title}
      className={`${smallToolbarButtonClass} ${props.extraClass ?? ""} ${props.style ?? "mx-0.5 my-1"} ${props.hide ? "hidden":""}`}
      onClick={()=>{props.action?.()}}
      onMouseEnter={()=>{props.enter?.();}}
      onMouseLeave={()=>{props.leave?.();}}
      style={{ cursor: "pointer" }}>
      {props.text}
    </button>
  );
}

export function Button1 (props: Button1Props){
  return(
    <ToolbarButton
      text={props.text}
      action={props.action}
      enter={props.enter}
      leave={props.leave}
      hide={props.hide}
      style={props.style}
      extraClass={props.color}
    />
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
        // fontFamily:"Harry Thin", 
        letterSpacing:"0.1em", 
        transform:"scaleY(0.9)",  
        filter: "invert(0%)"}}>
      {props.text}
    </div>
  );
}