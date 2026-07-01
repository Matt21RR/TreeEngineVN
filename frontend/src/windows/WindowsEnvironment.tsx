import React from "react";
import Window from "./Window.tsx";
import { ConnectedComponent, Dictionary } from "../global.ts";
import { BaseButton } from "../tools/components/Buttons.tsx";


type WindowContent = {
  title: string,
  content: React.JSX.Element
  minimized: boolean,

  onResize?: ()=> void,
  minRes?: {width:number, height:number}
  resizeBlocked?: boolean
}


interface WindowsEnvironmentProps extends ConnectedComponent{
  windows: Dictionary<WindowContent>,
  mainContent: React.JSX.Element
}

interface WindowsEnvironmentState {
  renderSecondaryContent: boolean;
}

class WindowsEnvironment extends React.Component<WindowsEnvironmentProps, WindowsEnvironmentState>{
  minimizedTable: Array<string>
  previewTable: Array<string>
  renderingOrder: Array<string>
  constructor(props: WindowsEnvironmentProps){
    super(props);
    if(props.refAssigner){
      props.refAssigner(this);
    }
    if(!(props)){return;}
    this.state = {
      renderSecondaryContent: false
    };
    this.minimizedTable = Object.keys(this.props.windows);
    this.previewTable = [];
    this.renderingOrder = Object.keys(this.props.windows);
  }
  componentDidUpdate(prevProps: WindowsEnvironmentProps){
    if(prevProps.windows !== this.props.windows){
      const newKeys = Object.keys(this.props.windows);
      this.minimizedTable = this.minimizedTable.filter(key => newKeys.includes(key));
      this.previewTable = this.previewTable.filter(key => newKeys.includes(key));
      this.renderingOrder = newKeys;
    }
  }

  public showSecondaryContent(){
    if(!this.state.renderSecondaryContent){
      this.setState({ renderSecondaryContent: true });
    }
  }

  clickWindow(windowId: string){
    if(this.renderingOrder.indexOf(windowId) == (this.renderingOrder.length-1)){
      return;
    }
    let a = structuredClone(this.renderingOrder);
    a.splice(a.indexOf(windowId),1);
    a.push(windowId);
    this.renderingOrder = a;
    this.forceUpdate();
  }
  renderWindows(){
    if(!this.state.renderSecondaryContent){return;}
    const windowsContent = this.props.windows;
    return(
      Object.keys(windowsContent).map((contentId)=>{
        const windowAtTop = this.renderingOrder.indexOf(contentId)+1 == this.renderingOrder.length
        return (
        <div 
          className="relative"
          key={contentId}
          style={{
            zIndex:this.renderingOrder.indexOf(contentId)+1, 
            filter:
              `
                opacity(${windowAtTop ? 1 : .9}) 
                ${windowAtTop ? "" : "grayscale(.3)"}
              `
          }}
        >
          <Window 
            content={windowsContent[contentId].content} 
            minimize={
              ()=>{
                this.minimizedTable.push(contentId);
                this.previewTable.splice(
                  this.previewTable.indexOf(contentId),1
                );
                this.forceUpdate();
              }}
            minimized={this.minimizedTable.indexOf(contentId) != -1}
            preview={this.previewTable.indexOf(contentId) != -1}
            title={windowsContent[contentId].title} 
            onResize={windowsContent[contentId].onResize ?? (()=>{}) }
            minRes={windowsContent[contentId].minRes ?? {width:600,height:450} }
            resizeBlocked={windowsContent[contentId].resizeBlocked ?? false }
            clicked={()=>this.clickWindow(contentId)}
            reRender={()=>this.forceUpdate()}
          />
        </div>
      )})
    );  
  }
  renderTaskBar(){
    return(
      <div className="relative h-full min-w-12 bg-[#2f2f2fba] flex flex-col">
        {this.minimizedTable.map(contentId=>{return (
          <BaseButton
            key={contentId}
            action={()=>{this.minimizedTable.splice(this.minimizedTable.indexOf(contentId),1); this.forceUpdate();}}
            enter={()=>{this.previewTable.push(contentId); this.forceUpdate();}}
            leave={()=>{this.previewTable.splice(this.previewTable.indexOf(contentId),1); this.forceUpdate();}}
            style="text-white mx-auto p-1 hover:bg-white hover:bg-opacity-30 cursor-pointer"
            text = {contentId}
          />
        )})}
      </div>
    );
  }
  render(){
    return(
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
        <div className="absolute top-0 left-0 h-full w-full bg-[#2f2f2fba] flex">
          {this.renderTaskBar()}
          <div className="grow h-full">
            {this.props.mainContent}
          </div>
        </div>
        {this.renderWindows()}
      </div>
    );
  }
}

export {WindowsEnvironment}