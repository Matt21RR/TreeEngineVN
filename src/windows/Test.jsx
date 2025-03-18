import React  from "react";
import { WindowsEnvironment } from "./WindowsEnvironment";
import { RenderEngine } from "../engine/renderCore/RenderEngine.tsx";
import { KeyboardTrigger } from "../engine/engineComponents/Trigger.ts";
import { ObjectsE } from "../tools/SubTools";
import { EngineTools } from "../tools/EngineTools";
import { FileExplorer } from "../tools/FileExplorer";
import { EditorKeys } from "../tools/EditorKeys";
import { TexturesE } from "../tools/TexturesE";
import { TriggersE } from "../tools/TriggersE.jsx";

class Test extends React.Component{
  constructor(props){
    super(props);
    this.engine = new RenderEngine();
    this.hide = false;

    this.ObjectsERef = {};
    this.windowsEnvironment = new WindowsEnvironment(); 
    this.mounted = false;
  }
  editionKeys(){
    const engine = this.engine;
    const kTDef = {};//Key triggers definition
    kTDef.KeyP = {
      onPress:()=>{
        this.editing = !this.editing;
        this.engine.camera.usePerspective = this.editing;
      }
    };
    kTDef.KeyR = {
      onPress:()=>{
        engine.camera.position.x = 0.5;
        engine.camera.position.y = 0.5;
        engine.camera.position.z = 0;
      }
    }
    kTDef.KeyW = {
      onHold:()=>{engine.camera.position.z += .1;}
    }
    kTDef.KeyS = {
      onHold:()=>{engine.camera.position.z -= .1;}
    }
    kTDef.KeyA = {
      onHold:()=>{engine.camera.position.x -= .1;}
    }
    kTDef.KeyD = {
      onHold:()=>{engine.camera.position.x += .1;}
    }
    kTDef.Space={
      onHold:()=>{engine.camera.position.y -= .1;}
    }
    kTDef.ShiftRight={
      onHold:()=>{engine.camera.position.y += .1;}
    }

    Object.keys(kTDef).forEach(keyDef => {
      kTDef[keyDef].keys = keyDef;
      this.engine.keyboardTriggers.push(new KeyboardTrigger(kTDef[keyDef]));
    });
    this.forceUpdate();
  }
  render(){
    const env = this.windowsEnvironment;
    return(<>
      <WindowsEnvironment 
        setEnvironment={(env)=>{this.windowsEnvironment = env;}}
        mainContent={
          <RenderEngine
            showFps
            developmentDeviceHeight={1080}
            cyclesPerSecond={60}
            setEngine={(engine)=>{this.engine=engine; window.terminal = (code) =>{ code(engine); }; this.editionKeys(); env.forceUpdate();}}/>
        }
        content={{
          fileExplorer:{
            title:"File Explorer",
            content:<FileExplorer/>,
            minimized:false
          },
          triggers:{
            title:"Triggers en escena",
            content:<TriggersE  engine={this.engine} objectsERef={this.ObjectsERef} reRender={()=>{env.forceUpdate();}} />,
            minimized:true
          },
          objectsInfo:{
            title:"Objetos en escena",
            content:<ObjectsE engine={this.engine} reRender={()=>{env.forceUpdate()}} selfRef={(ref)=>{this.ObjectsERef = ref; env.forceUpdate();}}/>,
            minimized:true
          },
          engTools:{
            title:"Herramientas del motor",
            content:<EngineTools engine={this.engine} reRender={()=>{env.forceUpdate()}}/>,
            minimized:true
          },
          editorKeys:{
            title:"Shorcuts",
            content:<EditorKeys/>,
            minimized:false
          },
          textures:{
            title:"Texturas",
            content:<TexturesE/>,
            minimized:false
          },
        }}
      
      />
    </>);
  }
}

export {Test}