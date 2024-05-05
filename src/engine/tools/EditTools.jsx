import React from "react";
import { RenderEngine } from "../renderCore/RenderEngine";

import { Trigger } from "../engineComponents/Trigger";

import { Button1 } from "../components/buttons";
import { SoundsE, TriggersE, StatesE, ObjectsE} from "./SubTools";
import { ScriptE } from "./ScriptE";
import { TexturesE } from "./TexturesE";

class EditTools extends React.Component {
  constructor(props){
    super(props);
    this.engine = new RenderEngine();
    this.hide = false;
    this.hideSubTools = false;
    this.editing = false;
    this.subToolToShow = "";
    this.renderingSubTools = {
      scriptEditor : true,
      textures : false,
      sounds : false,
      triggers : false,
      states : false
    }
    this.renderingOrder = ["scriptWindow",
      "texturesWindow",
      "soundsWindow",
      "triggersWindow",
      "statesWindow"];
    this.ObjectsERef = {};

    this.mounted = false;
  }
  editionKeys(){
    const engine = this.engine;
    const kTDef = {};//Key triggers definition
    kTDef.KeyR = {
      onPress:()=>{
        this.editing = !this.editing;
        console.log("Perspectiva: "+this.editing);
        if(this.editing){
          this.engine.camera.usePerspective = true;
        }else{
          this.engine.camera.usePerspective = false;
        }
      }
    };

    kTDef.KeyW = {
      onHold:()=>{
        engine.camera.position.z += .1;
      }
    }
    kTDef.KeyS = {
      onHold:()=>{
        engine.camera.position.z -= .1;
      }
    }
    kTDef.KeyA = {
      onHold:()=>{
        engine.camera.position.x -= .1;
      }
    }
    kTDef.KeyD = {
      onHold:()=>{
        engine.camera.position.x += .1;
      }
    }
    kTDef.Space={
      onHold:()=>{
        engine.camera.position.y -= .1;
      }
    }
    kTDef.ShiftLeft={
      onHold:()=>{
        engine.camera.position.y += .1;
      }
    }

    Object.keys(kTDef).forEach(keyDef => {
      kTDef[keyDef].id = keyDef;
      this.engine.keyboardTriggers.push(new Trigger(kTDef[keyDef]));
    });
    this.forceUpdate();
  }
  clickWindow(windowId){
    if(this.renderingOrder.indexOf(windowId) == (this.renderingOrder.length-1)){
      return;
    }
    var a = structuredClone(this.renderingOrder);
    a.splice(a.indexOf(windowId),1);
    a.push(windowId);
    this.renderingOrder = a;
    console.log(a);
    this.forceUpdate();
  }
  showSubTool(){
    const scriptWindow = this.renderingSubTools.scriptEditor ? 
    <ScriptE
      clicked={()=>{this.clickWindow("scriptWindow")}}
      engine={this.engine} 
      toolsRef={this}
      reRender={()=>{this.forceUpdate();}} 
      exit={()=>{this.renderingSubTools.scriptEditor = false; this.forceUpdate();}}/> 
      :<></>;

    const texturesWindow = this.renderingSubTools.textures ? 
    <TexturesE
      clicked={()=>{this.clickWindow("texturesWindow")}}
      engine={this.engine} 
      reRender={()=>{this.forceUpdate();}} 
      exit={()=>{this.renderingSubTools.textures = false; this.forceUpdate();}}/>
      :<></>;

    const soundsWindow = this.renderingSubTools.sounds ?
    <SoundsE 
      clicked={()=>{this.clickWindow("soundsWindow")}}
      engine={this.engine} 
      reRender={()=>{this.forceUpdate();}} 
      exit={()=>{this.renderingSubTools.sounds = false; this.forceUpdate();}}/> 
      :<></>;

    const triggersWindow = this.renderingSubTools.triggers ? 
    <TriggersE 
      clicked={()=>{this.clickWindow("triggersWindow")}}
      engine={this.engine} 
      objectsERef={this.ObjectsERef}
      reRender={()=>{this.forceUpdate();}} 
      exit={()=>{this.renderingSubTools.triggers = false; this.forceUpdate();}}/>
      :<></>;

    const statesWindow = this.renderingSubTools.states ? 
    <StatesE 
      clicked={()=>{this.clickWindow("statesWindow")}}
      engine={this.engine} 
      objectsERef={this.ObjectsERef}
      reRender={()=>{this.forceUpdate();}} 
      exit={()=>{this.renderingSubTools.states = false; this.forceUpdate();}}/>
      :<></>;

    var windows = {
      scriptWindow : scriptWindow,
      texturesWindow : texturesWindow,
      soundsWindow : soundsWindow,
      triggersWindow : triggersWindow,
      statesWindow : statesWindow};
    return(
      Object.keys(windows).map((windowId)=>(
        <div 
          className="relative" 
          style={{
            zIndex:this.renderingOrder.indexOf(windowId)+1, 
            filter:"opacity("+(this.renderingOrder.indexOf(windowId)+1 == this.renderingOrder.length ? 1 : .5)+") "+(this.renderingOrder.indexOf(windowId)+1 != this.renderingOrder.length ? "grayscale(.8)" : "")}}
        >
          {windows[windowId]}
        </div>
        
      ))
    );  
  }
  showSubToolsFather(){
    if(this.engine != null && !this.hide){
      return(
        <>
        
        <div className="absolute pointer-events-none top-0 left-0 w-full h-full overflow-hidden">
          {this.showSubTool()}
        </div>
        </>
      );
    }
  }
  showMainTools(){
    if(this.engine != null && !this.hide){
      return(
        <div className="bg-[#2f2f2fba] flex text-white max-h-[200px]"
          style={{gridColumn: "1 / 5",
                  gridRow: "5 / 7"}}>
          <div className="flex flex-col">
            <Button1 text="2DGrid" action={()=>{
              this.engine.showCanvasGrid = !this.engine.showCanvasGrid;
              this.forceUpdate();
            }}/>
            <Button1 text="Script" action={()=>{
              this.renderingSubTools.scriptEditor = true;
              this.forceUpdate();
            }}/>
            <Button1 text="Textures" action={()=>{
              this.renderingSubTools.textures = true;
              this.forceUpdate();
            }}/>
            <Button1 text="Sounds" action={()=>{
              this.renderingSubTools.sounds = true;
              this.forceUpdate();
            }}/>
            <Button1 text="Triggers" action={()=>{
              this.renderingSubTools.triggers = true;
              this.forceUpdate();
            }}/>
          </div>
          <ObjectsE engine={this.engine} reRender={()=>{this.forceUpdate()}} selfRef={(ref)=>{this.ObjectsERef = ref; this.forceUpdate();}}/>
        </div>
      );
    }
  }
  render(){
    return(
      <>
        <RenderEngine setEngine={(engine)=>{this.engine=engine; console.log(this.engine); this.editionKeys(); this.forceUpdate();}}/>
        <div className={"w-full max-h-[200px] absolute bottom-0"+(this.hide?"hidden":"")} id="GUI">
          {this.showMainTools()}
        </div>
        <div className="absolute top-0 left-0">
          <Button1 
              action={()=>{
                this.hide = !this.hide;
                this.forceUpdate();}}
              text={this.hide?"Mostrar":"Ocultar"}
            />
        </div>

        {this.showSubToolsFather()}
      </>
    )
  }
}
export {EditTools}