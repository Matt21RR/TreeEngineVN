import React from "react";
import { Window } from "./SubTools";

class WindowsEnvironment extends React.Component{
  constructor(props){
    super(props);
    // this.windowsContent = {};
    this.windowsContent = this.props.windowsContent;
    this.windows = this.buildWindowsTable(this.windowsContent);
    this.executionTable = {}
    Object.keys(this.windows).map(windowId=>{Object.assign(this.executionTable, {[windowId]:true})})
    this.renderingOrder = Object.keys(this.windows);
    console.log(this.windowsContent,this.windows,this.executionTable,this.renderingOrder);
  }
  buildWindowsTable(windowsContent){
    var res = {};
    Object.keys(windowsContent).map(contentId=>{
      const window = <Window 
          content={
            ()=>windowsContent[contentId].content
          } 
          title={windowsContent[contentId].title} 
          onResize={"onResize" in windowsContent[contentId] ? windowsContent[contentId].onResize : ()=>{console.log("nada en Windows")}}
          minRes={"minRes" in windowsContent[contentId] ? windowsContent[contentId].minRes : {width:400,height:300} }
          resizeBlocked={"resizeBlocked" in windowsContent[contentId] ? windowsContent[contentId].resizeBlocked : false }
          clicked={()=>this.clickWindow(contentId)}
          // exit={()=>this.props.exit()}
        />;
      Object.assign(res,{[contentId]:window});
    });
    return res;
  }
  componentDidMount(){}
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
    console.log(this.renderingOrder);
    var windows = [];
    Object.keys(this.executionTable).filter(windowId=>{return this.executionTable[windowId]}).map(windowId=>{Object.assign(windows,{[windowId]:this.windows[windowId]})});
    return(
      Object.keys(windows).map((windowId)=>(
        <div 
          className="relative" 
          style={{
            zIndex:this.renderingOrder.indexOf(windowId)+1, 
            filter:"opacity("+(this.renderingOrder.indexOf(windowId)+1 == this.renderingOrder.length ? 1 : .9)+") "+(this.renderingOrder.indexOf(windowId)+1 != this.renderingOrder.length ? "grayscale(.3)" : "")}}
        >
          {windows[windowId]}
        </div>
        
      ))
    );  
  }
  renderTaskBar(){
    return(
      <div className="absolute top-0 left-0 h-full w-12 bg-[#2f2f2fba]">


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