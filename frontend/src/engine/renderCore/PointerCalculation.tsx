import React from "react";
import $ from "jquery";

import RenList from "../engineComponents/RenList.ts";
import { Trigger } from "../engineComponents/Trigger.ts";
import { mobileCheck, sortByReference } from "../logic/Misc.ts";
import { CanvasData } from "./Canvas.tsx";
import { RenderEngine } from "./RenderEngine.tsx";
import { Dictionary } from "../../global.ts";

class PointerCalculation extends React.Component{
  DOMElementId: string;
  isMobile: boolean;
  enteredTriggers: Array<string>;

  mouseListener: number;
  constructor(props){
    super(props);
    const engRef = RenderEngine.getInstance();
    this.DOMElementId = "triggersTarget"+engRef.id;

    this.isMobile = mobileCheck();
    this.enteredTriggers = [];
    this.mouseListener = 0;
  }
  dataCleaner(){//TODO: Implementar en RenderEngine
    this.enteredTriggers = [];
    document.body.style.cursor = "auto"
  }
  private checkTriggers(
    mouseEvent:React.MouseEvent|React.TouchEvent,
    action:string, 
    resolution: CanvasData["resolution"], 
    mouseVirtualPosition: {mX:number,mY:number}, 
    triggersRef: RenderEngine["triggers"],
    renderingOrderById: RenderEngine["renderingOrderById"],
    collisionLayer: RenderEngine["collisionLayer"]
  ){
    const mX = mouseVirtualPosition.mX;
    const mY = mouseVirtualPosition.mY;

    const reversedRenderOrderList = renderingOrderById;
    const triggersIdList = triggersRef.enabledList().map(e=>{return e.id});
    //!Bottleneck
    const objectsWithTriggersList = triggersRef.relatedToReversedList();
    //!Bottleneck
    const collisionedTriggers = collisionLayer.checkMouse(mX,mY,resolution).filter(e=>{return e in objectsWithTriggersList});
    
    this.triggersMouseCollisionManagement(collisionedTriggers,objectsWithTriggersList,reversedRenderOrderList,triggersRef,action);

    //*Check the triggers that wasn't assigned to a GraphObject
    for (const triggerId of triggersRef.relatedToNullList()){
      triggersRef.get(triggerId).check(mouseEvent,action);
    }

    if(action == "onMouseMove"){
      //onLeave part, activar el onLeave en todos aquellos triggers que no se activaron previamente
      this.onLeaveTriggerCheck(collisionedTriggers,triggersIdList,triggersRef);
    }
  }

  private calcMouseVirtualPosition(mouse:React.MouseEvent|React.TouchEvent,offset,action:string){

    let mX:number, mY:number, clientX:number, clientY:number;
    if(window.TouchEvent && mouse instanceof TouchEvent){
      if(action == "onHold"){
        clientX = mouse.touches[0].clientX;
        clientY = mouse.touches[0].clientY;
      }else{
        clientX = mouse.changedTouches[0].clientX;
        clientY = mouse.changedTouches[0].clientY;
      }
    }else{
      //@ts-ignore
      clientX = mouse.clientX;
      //@ts-ignore
      clientY = mouse.clientY;
    }
    clientX-=offset.left;
    clientY-=offset.top;

    //@ts-ignore
    mX = clientX/mouse.target.clientWidth;
    //@ts-ignore
    mY = clientY/mouse.target.clientHeight;

    return {mX,mY}
  }

  private triggersMouseCollisionManagement(
    collisionedTriggers:Array<string>,
    objectsWithTriggersList: Dictionary<Array<string>>,
    reversedRenderOrderList:Array<string>,
    triggers:RenList<Trigger>,
    action:string){
    
    for(const collisionedObjectId of sortByReference(collisionedTriggers,reversedRenderOrderList)){
      if(collisionedObjectId in objectsWithTriggersList){
        objectsWithTriggersList[collisionedObjectId].forEach(triggerId => {

          if(!this.enteredTriggers.includes(triggerId)){
            triggers.get(triggerId).check(RenderEngine.getInstance(),"onEnter");
            this.enteredTriggers.push(triggerId);
            document.body.style.cursor = "pointer";
          }

          try {
            triggers.get(triggerId).check(RenderEngine.getInstance(),action);
          } catch (error) {
            console.log("Error on trigger execution:",error,triggers.get(triggerId))
          }
        });
      }
      break;
    }
  }

  private onLeaveTriggerCheck(
    collisionedTriggers:Array<string>,
    triggersIdList:Array<string>,
    triggers:RenList<Trigger>
  ){
    //onLeave part, activar el onLeave en todos aquellos triggers que no se activaron previamente
    triggersIdList.forEach(triggerId => {
      const trigger = triggers.get(triggerId);
      if(this.enteredTriggers.includes(triggerId) && !collisionedTriggers.includes(trigger.relatedTo as string)){
        const trigger = triggers.get(triggerId);
        if(trigger.relatedTo != null){
          trigger.check(RenderEngine.getInstance(),"onLeave");
        }
        this.enteredTriggers.splice(this.enteredTriggers.indexOf(triggerId));
        //TODO: check if the mouse are not inside any graph asociated trigger
        if(!this.enteredTriggers.length){
          document.body.style.cursor = "auto";
        }
      }
    });
  }

  private mouseReciever(mouse:React.MouseEvent|React.TouchEvent,action:string){//check using mouse stats
    const engRef = RenderEngine.getInstance();
    if(!engRef.canvasRef){
      return;
    }
    const resolution = engRef.canvasRef.resolution;

    const offset = $("#"+this.DOMElementId).offset() as JQuery.Coordinates;

    const mouseVirtualPosition = this.calcMouseVirtualPosition(mouse,offset,action);

    const mX = mouseVirtualPosition.mX; 
    const mY = mouseVirtualPosition.mY;

    engRef.mouse.x = mX * (resolution.width/resolution.height);
    engRef.mouse.y = mY;

    this.checkTriggers(
      mouse,
      action,
      resolution,
      mouseVirtualPosition,
      engRef.triggers,
      engRef.renderingOrderById,
      engRef.collisionLayer
    )
  }
  render(){
    if(this.isMobile){
      return (
        <div className="absolute w-full h-full"
          id={this.DOMElementId}
          onTouchStart={(e)=>this.mouseReciever(e,"onHold")}
          onTouchEnd={(e)=>this.mouseReciever(e,"onRelease")}
          onTouchMove={
            (e)=>{
              if(this.mouseListener+(1000/40) < performance.now()){
                this.mouseListener = performance.now();
                this.mouseReciever(e,"onMouseMove");
              }
            }
          }
        />
      );
    }else{
      return (
        <div className="absolute w-full h-full"
          id={this.DOMElementId}
          onContextMenu={(e)=>{
            e.preventDefault();
            this.mouseReciever(e,"onContextMenu");
          }}
          onWheel={(e)=>{this.mouseReciever(e,"onWheel")}}
          onMouseDown={(e)=>this.mouseReciever(e,"onHold")}
          onMouseUp={(e)=>{e.preventDefault();this.mouseReciever(e,"onRelease")}}
          onMouseMove={
            (e)=>{
              if(this.mouseListener+(1000/40) < performance.now()){
                this.mouseListener = performance.now();
                this.mouseReciever(e,"onMouseMove");
              }
            }
          }
        />
      );
    }
  }
}

export default PointerCalculation