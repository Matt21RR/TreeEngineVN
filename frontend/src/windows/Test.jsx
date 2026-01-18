import React  from "react";
import { WindowsEnvironment } from "./WindowsEnvironment";
import { RenderEngine } from "../engine/renderCore/RenderEngine.tsx";
import { ObjectsE } from "../tools/SubTools";
import EngineTools from "../tools/EngineTools";
import { FileExplorer } from "../tools/FileExplorer";
import TexturesE from "../tools/TexturesE.tsx";
import { TriggersE } from "../tools/TriggersE.tsx";

class Test extends React.Component{
  constructor(props){
    super(props);
    this.engine = null;
    this.hide = false;

    this.ObjectsERef = {};
    this.windowsEnvironment = null; 
    this.mounted = false;
  }
  render(){
    return(<>
      <WindowsEnvironment 
        refAssigner={(env)=>{this.windowsEnvironment = env;}}
        mainContent={
          <RenderEngine
            showFps
            developmentDeviceHeight={1080}
            cyclesPerSecond={60}
            setEngine={(engine)=>{this.engine=engine; this.windowsEnvironment.renderSecondaryContent = true; this.windowsEnvironment.forceUpdate(); this.forceUpdate();}}/>
        }
        windows={{
          fileExplorer:{
            title:"File Explorer",
            content:<FileExplorer/>,
            minimized:false,
            disabled:this.engine == null
          },
          triggers:{
            title:"Triggers en escena",
            content:<TriggersE  engine={this.engine} objectsERef={this.ObjectsERef} reRender={()=>{this.windowsEnvironment.forceUpdate();}} />,
            minimized:true,
            disabled:this.engine == null
          },
          objectsInfo:{
            title:"Objetos en escena",
            content:<ObjectsE 
              engine={this.engine} 
              reRender={()=>{this.windowsEnvironment.forceUpdate()}} 
              selfRef={(ref)=>{
                this.ObjectsERef = ref; 
                this.windowsEnvironment.forceUpdate();
              }}/>,
            minimized:true,
            disabled:this.engine == null
          },
          engTools:{
            title:"Herramientas del motor",
            content:<EngineTools engine={this.engine} reRender={()=>{this.windowsEnvironment.forceUpdate()}}/>,
            minimized:true,
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