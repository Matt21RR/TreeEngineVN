import gsap from "gsap";
import React from "react";
import { GameEnvironment } from "../sections/GameEnvironment";
import { Button1, MenuButton } from "../components/buttons";
import { ImageViewer } from "./ImageViewer";
import { NodePropsEditor } from "./NodePropsEditor";
import { generateRndRGBColor } from "../logic/Misc";
import { NodesBuilder } from "../logic/NodesBuilder";

class LateralToolBar extends React.Component{
  constructor(props){
    super(props);
  }
  renderButtons(){
    const optionsList = [
      {action:this.props.close,text:"cerrar",icon:""},
      {action:this.props.showNodeInterpretedPropsEditor,text:"propiedadesDelNodoInterpretadas",icon:""},
      {action:this.props.showNodeUninterpretedPropsEditor,text:"propiedadesDelNodoSinInterpretar",icon:""},
      {action:()=>{},text:"elementosPredefinidos",icon:""}
    ];
    return(
      optionsList.map((option)=>(
        <div title={option.title} className="w-14 h-14 border-[1px] cursor-pointer" style={{backgroundColor:generateRndRGBColor()}} onClick={()=>{option.action()}}>
          {option.text}
        </div>
      ))
    );
  }
  render(){
    return(
      <div className=" w-14 h-full absolute bg-slate-600 flex flex-col">
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
  gameEnvironmentEditorCanvas(){
    return(
      <div className="absolute top-0 left-0">

      </div>
    );
  }
  renderNodePropsEditor(){
    if(this.state.showing){
      return(
        <NodePropsEditor
          showing={this.state.showNodePropsEditor}
          interpretedMode={this.state.showInterpretedProps}
          node={NodesBuilder.nodeFinder(this.state.node,this.state.showInterpretedProps?this.state.gameScript:this.state.unInterpretedGameScript)}
          close={()=>{this.setState({showNodePropsEditor:false})}}
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
      </div>
    );
  }
}
export {NodeEditorWindow}