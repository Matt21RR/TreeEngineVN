import gsap from "gsap";
import React from "react";
import { GameEnvironment } from "../sections/GameEnvironment";
import { Button1, MenuButton } from "../components/buttons";
import { ImageViewer } from "./ImageViewer";
import { NodePropsEditor } from "./NodePropsEditor";
import { generateRndRGBColor } from "../logic/Misc";
import { NodesBuilder } from "../logic/NodesBuilder";
import { PropertyEditor } from "./PropertyEditor";

class LateralToolBar extends React.Component{
  constructor(props){
    super(props);
  }
  renderButtons(){
    const optionsList = [
      {action:this.props.close,text:"Cerrar",icon:""},
      {action:this.props.showNodeInterpretedPropsEditor,text:"Propiedades Del Nodo Interpretadas",icon:""},
      {action:this.props.showNodeUninterpretedPropsEditor,text:"Propiedades Del Nodo Sin Interpretar",icon:""},
      {action:()=>{},text:"Elementos Predefinidos",icon:""}
    ];
    return(
      optionsList.map((option)=>(
        <div 
          className="flex flex-row cursor-pointer pointer-events-auto"
          onClick={()=>{option.action()}}
          onMouseOver={(e)=>{e.target.childNodes[1].style.width = e.target.childNodes[1].childNodes[0].scrollWidth+"px";}}
          onMouseOut={(e)=>{e.target.childNodes[1].style.width = "0px";}}
          >
          <div 
            className="w-14 h-14 border-[1px] pointer-events-none" 
            style={{backgroundColor:generateRndRGBColor()}} 
            />
          <div className="relative w-0 h-14 bg-orange-800 overflow-hidden pointer-events-none flex flex-col">
            <div className="mt-auto px-2 mb-2 text-sm w-max h-fit">
              {option.text}
            </div>
          </div>
        </div>
      ))
    );
  }
  render(){
    return(
      <div className=" w-auto h-full absolute bg-[#00000043] flex flex-col text-white">
        {this.renderButtons()}
      </div>
    );
  }
}
class NodeEditorWindow extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      node: this.props.nodeToEdit,
      gameScript:this.props.gameScript,
      unInterpretedGameScript: this.props.unInterpretedGameScript,
      showImageViewer: false,
      showNodePropsEditor:false,
      showInterpretedProps:false,
      showing: false,
    }
    this.target = React.createRef();
  }
  componentDidMount(){
    console.log(this.props.nodeToEdit,
      this.props.gameScript,
      this.props.unInterpretedGameScript)
  }
  componentDidUpdate(){
    if(this.props.showing && !this.state.showing){
      this.setState({showing:true,node:this.props.nodeToEdit,gameScript:this.props.gameScript,unInterpretedGameScript: this.props.unInterpretedGameScript,},()=>{
        //fadeInAnimation
        gsap.to(this.target.current,0.5,{opacity:1});
      });
    }else if(!this.props.showing && this.state.showing){
      this.setState({showing:false},()=>{
        //fadeOutAnimation
        gsap.to(this.target.current,0.5,{opacity:0});
      });
    }
  }
  gameEnvironmentPreview() {
    return (
      <GameEnvironment
        developMode={true}
        storyVars={new Object()}
        actualNode={0}
        gameScript={NodesBuilder.nodeFinder(this.state.node,this.state.showInterpretedProps?this.state.unInterpretedGameScript:this.state.gameScript)}
        changeSection={(dummy) => { }}

        loadSavedGame={(actualNode, storyVars, onComplete) => { }}
        aspectRatioCalc={(op) => { this.aspectRatioCalc(op) }}
      />
    );
  }
  renderNodePropsEditor(){
    if(this.state.showing){
      return(
        <NodePropsEditor //HERE
          showing={this.state.showNodePropsEditor}
          interpretedMode={this.state.showInterpretedProps}
          node={NodesBuilder.nodeFinder(this.state.nodethis.state.showInterpretedProps?this.state.gameScript:this.state.unInterpretedGameScript)}
          close={()=>{this.setState({showNodePropsEditor:false})}}

          updateNodeData={(node)=>{this.props.updateNodeData(node)}}
        />
      );
    }
  }
  renderImageViewer(){
    return(
      <ImageViewer
        showing={this.state.showImageViewer}
        close={()=>{this.setState({showImageViewer:false})}}
      />
    );
  }
  render() {
    return (
      <div ref={this.target} className={("absolute w-full h-full overflow-hidden top-0 left-0 opacity-0")+(this.state.showing?"":" pointer-events-none")}>
        <div className="relative w-full h-full top-0 left-0">
          <LateralToolBar
            close={()=>{this.props.close()}}
            showNodeUninterpretedPropsEditor={()=>{this.setState({showNodePropsEditor:true,showInterpretedProps:false})}}
            showNodeInterpretedPropsEditor={()=>{this.setState({showNodePropsEditor:true,showInterpretedProps:true})}}
          />
          {this.renderNodePropsEditor()}
          {this.renderImageViewer()}
          
        </div>
        <PropertyEditor/>
      </div>
    );
  }
}
export {NodeEditorWindow}