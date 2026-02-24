import gsap from "gsap";
import React from "react";
import { Decision } from "../engineComponents/ScriptNode.ts";
import { RenderEngine } from "./RenderEngine.tsx";

class UI extends React.Component{
  private static instance: UI;
  static getInstance(){
    return UI.instance;
  }
  

  mounted:boolean = false;
  decisions:Array<Decision>
  base:React.RefObject<HTMLDivElement>;
  decideRef:React.RefObject<HTMLDivElement>;
  constructor(props){
    super(props);
    UI.instance = this;
    this.decisions = [
      {label:"1", condition:(e)=>{return true;}},
      {label:"2", condition:(e)=>{return true;}},
      {label:"3"}
    ];
    this.base = React.createRef() as React.RefObject<HTMLDivElement>;
    this.decideRef = React.createRef() as React.RefObject<HTMLDivElement>;
  }
  componentDidMount(): void {
    UI.instance = this;
    if(!this.mounted){
      this.mounted = true;
      this.forceUpdate();
      this.openDecide();
    }
  }
  loadDecisions(decisions: Array<Decision>) {
    RenderEngine.getInstance().resume = false;
    this.decisions = decisions;
    this.forceUpdate();
    this.openDecide();
  }
  private closeDecide(finalDecision: Decision){
    const decideRef = this.decideRef.current;
    this.base.current.style.pointerEvents = "none";
    gsap.to(decideRef, {duration:0.15, height:0, opacity:0}).then(()=>{
      gsap.to(decideRef, {height:"fit-content"});
      RenderEngine.getInstance().resume = true;
      if("nextNode" in finalDecision){
        RenderEngine.getInstance().runNode(finalDecision.nextNode);
      }
    });
  }
  private openDecide(){
    const decideRef = this.decideRef.current;
    const h = decideRef.clientHeight;
    this.base.current.style.pointerEvents = "auto";
    gsap.to(decideRef, {height:0, overflowY:"hidden"}).then(()=>{
      gsap.to(decideRef, {opacity:1});
      gsap.to(decideRef, {duration:0.15, height:h});
    });
  }
  private decideOptions(){
    return this.decisions
      .filter((el)=>{return el.condition ? el.condition(RenderEngine.getInstance()) : true})
      .map((element,index) => (
      <span key={index} className="hover:invert-100 backdrop-opacity-50 cursor-pointer select-none" onClick={()=>{
        this.closeDecide(element);
      }}>
        {element.label}
      </span>      
    ));
  }
  private decideComponent(){
    const h = this.base.current?.clientHeight; 
    return <div ref={this.decideRef} className="relative border-2 h-fit opacity-0 my-auto mx-auto flex flex-col backdrop-blur-xs" style={{width:`${h}px`}}>
      {this.decideOptions()}
    </div>
  }
  render(){
    return <div ref={this.base} className="absolute w-full h-full top-0 left-0 flex">
      {this.decideComponent()}

    </div>
  }
}
export default UI;