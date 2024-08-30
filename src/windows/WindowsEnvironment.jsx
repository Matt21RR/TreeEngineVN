import React from "react";
import { Window } from "../engine/tools/SubTools";
import { BaseButton } from "../engine/components/buttons";

class WindowsEnvironment extends React.Component{
  constructor(props){
    super(props);
    if(!(this.props)){return;}
    // this.windowsContent = {};
    this.windowsContent = "content" in this.props ? this.props.content : {};
    this.executionTable = {};
    this.minimizedTable = [];
    this.previewTable = [];
    Object.keys(this.windowsContent).map(windowId=>{Object.assign(this.executionTable, {[windowId]:true})});
    Object.keys(this.windowsContent).map(windowId=>{if("minimized" in this.windowsContent[windowId]){this.minimizedTable.push(windowId);}});
    // console.log(this.minimizedTable);
    this.renderingOrder = Object.keys(this.windowsContent);
    // console.log(this.windowsContent,this.executionTable,this.renderingOrder);
  }
  clickWindow(windowId){
    if(this.renderingOrder.indexOf(windowId) == (this.renderingOrder.length-1)){
      return;
    }
    var a = structuredClone(this.renderingOrder);
    a.splice(a.indexOf(windowId),1);
    a.push(windowId);
    this.renderingOrder = a;
    this.forceUpdate();
  }
  renderWindows(){
    const windowsContent = this.props.content;
    return(
      Object.keys(this.executionTable).filter(
        windowId=>{return this.executionTable[windowId]}
      ).map((contentId)=>(
        <div 
          className="relative" 
          style={{
            zIndex:this.renderingOrder.indexOf(contentId)+1, 
            filter:"opacity("+(this.renderingOrder.indexOf(contentId)+1 == this.renderingOrder.length ? 1 : .9)+") "+(this.renderingOrder.indexOf(contentId)+1 != this.renderingOrder.length ? "grayscale(.3)" : "")}}
        >
          <Window 
            content={()=>windowsContent[contentId].content} 
            minimize={()=>{this.minimizedTable.push(contentId);this.previewTable.splice(this.previewTable.indexOf(contentId),1);this.forceUpdate();}}
            minimized={this.minimizedTable.indexOf(contentId) != -1}
            preview={this.previewTable.indexOf(contentId) != -1}
            title={windowsContent[contentId].title} 
            onResize={"onResize" in windowsContent[contentId] ? windowsContent[contentId].onResize : ()=>{}}
            minRes={"minRes" in windowsContent[contentId] ? windowsContent[contentId].minRes : {width:400,height:300} }
            resizeBlocked={"resizeBlocked" in windowsContent[contentId] ? windowsContent[contentId].resizeBlocked : false }
            clicked={()=>this.clickWindow(contentId)}
            reRender={()=>this.forceUpdate()}
          />
        </div>
        
      ))
    );  
  }
  renderTaskBar(){
    return(
      <div className="absolute top-0 left-0 h-full min-w-[3rem] bg-[#2f2f2fba] flex flex-col">
        {this.minimizedTable.map(contentId=>{return (
          <BaseButton
            action={()=>{this.minimizedTable.splice(this.minimizedTable.indexOf(contentId),1);this.forceUpdate();}}
            enter={()=>{this.previewTable.push(contentId); this.forceUpdate();}}
            leave={()=>{this.previewTable.splice(this.previewTable.indexOf(contentId),1);this.forceUpdate();}}
            style="text-white mx-auto p-2 hover:bg-white hover:bg-opacity-30 cursor-pointer"
            text = {contentId}
          />
        )})}
      </div>
    );
  }
  render(){
    return(
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden bg-black">
        {this.renderWindows()}
        {this.renderTaskBar()}
      </div>
    );
  }
}

export {WindowsEnvironment}