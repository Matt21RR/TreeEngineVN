import React  from "react";
import { WindowsEnvironment } from "./WindowsEnvironment";
import { RenderEngine } from "../engine/renderCore/RenderEngine.tsx";
import { ObjectsE } from "../tools/SubTools";
import EngineTools from "../tools/EngineTools";
import { FileExplorer } from "../tools/FileExplorer";
import TexturesE from "../tools/TexturesE.tsx";
import TriggersE from "../tools/TriggersE.tsx";
import Guide from "../tools/Guide.tsx";

class Test extends React.Component{
  constructor(props){
    super(props);
    this.state = {
      engine: null
    };
    this.hide = false;

    this.ObjectsERef = {};
    this.windowsEnvironment = null; 
    this.mounted = false;
  }
  render(){
    const engine = this.state.engine;
    return(<>
      <WindowsEnvironment 
        refAssigner={(env)=>{this.windowsEnvironment = env;}}
        mainContent={
          <RenderEngine
            showFps
            developmentDeviceHeight={1080}
            cyclesPerSecond={60}
            setEngine={(engine)=>{
              this.setState({ engine }, () => {
                this.windowsEnvironment?.showSecondaryContent();
              });
            }}/>
        }
        windows={{
          fileExplorer:{
            title:"File Explorer",
            content:<FileExplorer/>,
            disabled:engine == null
          },
          triggers:{
            title:"In-scene Triggers",
            content: engine ? <TriggersE engine={engine} objectsERef={this.ObjectsERef} reRender={()=>{this.windowsEnvironment?.forceUpdate();}} /> : <div className="text-white p-4">Waiting for engine...</div>,
            disabled:engine == null
          },
          objectsInfo:{
            title:"In-scene GraphObjects",
            content: engine ? <ObjectsE 
              engine={engine} 
              reRender={()=>{this.windowsEnvironment?.forceUpdate()}} 
              selfRef={(ref)=>{
                this.ObjectsERef = ref; 
                this.windowsEnvironment?.forceUpdate();
              }}/>
              : <div className="text-white p-4">Waiting for engine...</div>,
            disabled:engine == null
          },
          engTools:{
            title:"EngineTools",
            content: engine ? <EngineTools engine={engine} reRender={()=>{this.windowsEnvironment?.forceUpdate()}}/> : <div className="text-white p-4">Waiting for engine...</div>,
            disabled:engine == null
          },
          textures:{
            title:"Textures",
            content:<TexturesE/>,
            disabled:engine == null
          },
          guide:{
            title:"Guide",
            content:<Guide/>,
          }
        }}
      
      />
    </>);
  }
}

export {Test}