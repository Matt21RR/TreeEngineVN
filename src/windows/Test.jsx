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
    this.engine = null;
    this.hide = false;

    this.ObjectsERef = {};
    this.windowsEnvironment = new WindowsEnvironment(); 
    this.mounted = false;
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
            setEngine={(engine)=>{this.engine=engine; env.forceUpdate(); this.forceUpdate();}}/>
        }
        content={{
          fileExplorer:{
            title:"File Explorer",
            content:<FileExplorer/>,
            minimized:false,
            disabled:this.engine == null
          },
          triggers:{
            title:"Triggers en escena",
            content:<TriggersE  engine={this.engine} objectsERef={this.ObjectsERef} reRender={()=>{env.forceUpdate();}} />,
            minimized:true,
            disabled:this.engine == null
          },
          objectsInfo:{
            title:"Objetos en escena",
            content:<ObjectsE engine={this.engine} reRender={()=>{env.forceUpdate()}} selfRef={(ref)=>{this.ObjectsERef = ref; env.forceUpdate();}}/>,
            minimized:true,
            disabled:this.engine == null
          },
          engTools:{
            title:"Herramientas del motor",
            content:<EngineTools engine={this.engine} reRender={()=>{env.forceUpdate()}}/>,
            minimized:true,
            disabled:this.engine == null
          },
          editorKeys:{
            title:"Shorcuts",
            content:<EditorKeys/>,
            minimized:false,
            disabled:this.engine == null
          },
          textures:{
            title:"Texturas",
            content:<TexturesE/>,
            minimized:false,
            disabled:this.engine == null
          },
        }}
      
      />
    </>);
  }
}

export {Test}