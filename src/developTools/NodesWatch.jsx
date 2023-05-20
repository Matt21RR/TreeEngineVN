import gsap from "gsap";
import React from "react";
import { Button1,MenuButton } from "../components/buttons";
import { NodesBuilder } from "../logic/NodesBuilder";
import { GameEnvironment } from "../sections/GameEnvironment";
import { NodeEditorWindow } from "./NodeEditorWindow";
import { NodeBuilder } from "../logic/NodeBuilder";
class NodesWatch extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      unIntrepretedGameScript: NodesBuilder.getUninterpretedGameScript(),
      requiredNodes: NodesBuilder.getRequiredNodesList(NodesBuilder.getUninterpretedGameScript()),
      gameScript: this.props.gameScript,
      nodeToEdit: new Object(),
      gameFiles: new Array(),
      showNodeEditorWindow:false,
    }
    this.componentMounted = false;
    this.nodesRef = React.createRef();
  }
  componentDidMount() {
    if (!this.componentMounted) {
      this.componentMounted = true;
      this.setState({unIntrepretedGameScript: NodesBuilder.getUninterpretedGameScript(), requiredNodes: NodesBuilder.getRequiredNodesList(NodesBuilder.getUninterpretedGameScript())},()=>{
        console.log(this.state.requiredNodes);
      });
    }
  }
  createANode() {
    var res = [...this.state.unIntrepretedGameScript];
    const inmediatePreviousNode = structuredClone(res.at(-1));
    res.push(Object.assign({
      id: inmediatePreviousNode.id+"+1",
      idNodoPrevio:inmediatePreviousNode.id
    }));
    this.setState({
      unIntrepretedGameScript: res,
      gameScript: NodesBuilder.buildGameScript(structuredClone(res)),
    })
  }
  displaceANode(nodeIndex, direction) {
    var nodes = structuredClone(this.state.unIntrepretedGameScript);
    const node = nodes[nodeIndex];
    nodes.splice(nodeIndex, 1);
    nodes.splice(nodeIndex + (direction), 0, node);
    //Forced compoments remount
    gsap.to(this.nodesRef.current, 0.2, {
      opacity: 0, onComplete: () => {
        this.setState({
          gameScript: new Array(),
          unIntrepretedGameScript: new Array()
        }, () => {
          this.setState({
            unIntrepretedGameScript: nodes,
            gameScript: NodesBuilder.buildGameScript(structuredClone(nodes))
          }, () => {
            gsap.to(this.nodesRef.current, 0.2, { opacity: 1 })
          })
        });
      }
    })
  }
  removeANode(nodeIndex){
    //if this node are recicled, refuse to delete
    var nodes = structuredClone(this.state.unIntrepretedGameScript);
    nodes.splice(nodeIndex, 1);
    //Forced compoments remount
    gsap.to(this.nodesRef.current, 0.2, {
      opacity: 0, onComplete: () => {
        this.setState({
          gameScript: new Array(),
          unIntrepretedGameScript: new Array()
        }, () => {
          this.setState({
            unIntrepretedGameScript: nodes,
            gameScript: NodesBuilder.buildGameScript(structuredClone(nodes))
          }, () => {
            gsap.to(this.nodesRef.current, 0.2, { opacity: 1 })
          })
        });
      }
    })
  }
  nodesList() {
    return (
      this.state.gameScript.map((node, index) => (
        <div>
          <span className="text-white">Nodo #{node.id}</span>
          <div className="relative w-48 h-28 m-2" 
            style={{border:NodeBuilder.getFadeOutTriggerDuration(node) == 0 && NodeBuilder.checkIfInstantNode(node)? "yellow solid": !NodeBuilder.haveNextNode(node)?"red solid":""}}
            >
            <div className="absolute w-full h-full pointer-events-none">
              <GameEnvironment
                test={node}
                developMode={true}
                storyVars={new Object()}
                actualNode={node.id}
                gameScript={this.state.gameScript}
                changeSection={(dummy) => { }}

                loadSavedGame={(actualNode, storyVars, onComplete) => { }}
                aspectRatioCalc={(op) => { this.aspectRatioCalc(op) }}
              />
            </div>
            <div className="absolute bottom-1 left-1">
              <Button1 text="<" action={() => { this.displaceANode(index, -1) }} hide={index == 0 || this.state.requiredNodes.indexOf(node.id) != -1} />
            </div>
            <div className="absolute bottom-1 left-1/2" style={{ transform: "translateX(-50%)" }}>
              <Button1 text="Editar" action={() => {this.setState({showNodeEditorWindow:true,nodeToEdit:node.id})}} />
            </div>
            <div className="absolute bottom-1 right-1">
              <Button1 text=">" action={() => { this.displaceANode(index, 1) }} hide={index == (this.state.gameScript.length - 1) || this.state.requiredNodes.indexOf(node.id) != -1} />
            </div>
            <div className="absolute top-1 right-1">
              <Button1 text="X" action={() => { this.displaceANode(index, 1) }} hide={this.state.requiredNodes.indexOf(node.id) != -1}/>
            </div>
          </div>
        </div>
      ))
    );
  }
  addANodeBox() {
    return (
      <div>
        <span >Nodo #</span>
        <div className="relative w-48 h-28 m-2 bg-green-600 flex cursor-pointer" onClick={() => { this.createANode() }}>
          <div className="mx-auto my-auto pointer-events-none select-none">
            Añadir un nodo
          </div>
        </div>
      </div>
    )
  }
  renderNodeEditorWindow(){
    return(
      <>
        <NodeEditorWindow
          nodeToEdit={this.state.nodeToEdit}
          unInterpretedGameScript={this.state.unIntrepretedGameScript}
          gameScript={this.state.gameScript}
          showing={this.state.showNodeEditorWindow}
          close={()=>{this.setState({showNodeEditorWindow:false})}}
        />
      </>
    );
  }
  render() {
    return (
      <>
        <div className="lg:px-6 md:px-4 px-3 absolute h-full w-full overflow-auto">
          <div className='relative top-0 h-16 w-full flex flex-col'>
            <div className='absolute right-8 my-auto text-white top-1/2 text-lg' style={{transform:"translate(0%,-50%)"}}>Haz clic sobre un nodo para editarlo</div>
            <div className='my-auto mx-6 text-white'>
              <MenuButton text="Volver" action={() => this.props.changeSection(0)} />
            </div>
          </div>
          <div className="flex flex-wrap pt-6" ref={this.nodesRef}>
            {this.nodesList()}
            {this.addANodeBox()}
          </div>
          {this.renderNodeEditorWindow()}
        </div>
      </>
    );
  }
}
export { NodesWatch }