import React from "react";
import scroll from "scroll";
import { Button1, PauseButton } from "../components/buttons";
import { CameraMan } from "../logic/CameraMan";
import { NodesBuilder } from "../logic/NodesBuilder";
import { Characters } from "./Characters";
import { DialogosPersonajes } from "./DialogosPersonajes";
import { DialogosUsuario } from "./DialogosUsuario";
import { Fondo } from "./fondo";
import { PauseMenu } from "./PauseMenu";
var ease = require("ease-component"); 

class GameEnvironment extends React.Component {
  constructor(props) {
    super(props);
    
    this.state = {
      actualNode: this.props.actualNode !== null ? this.props.actualNode : "-1",
      phase: 0,//1 - Draw scenario & upper scenario(capaSuperior) & music | 2 - Draw characters | 3 - Play dialogs | 4 - show player dialogs
      triggerFadeOutAnimations: false,
      showMenuPausa: false,
      storyVars: this.props.storyVars != null ? this.props.storyVars : new Object(),
      dummy:null,
      instantNodeWarn:false,
      noNextNodeWarn:false
    }
    this.gameScript = this.props.gameScript;
    this.nextNode = undefined;
    this.fadeOutTriggerDuration = 0;
    this.componentMounted = false;
    this.cameraReference = React.createRef();
  }
  componentDidMount() {
    window.ease = ease;
    window.scroll = scroll;
    if (!this.componentMounted) {
      this.componentMounted = true;
      this.setState({
        noNextNodeWarn:!("nodoSiguiente" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript))
      });
      window.setTimeout(() => {
        this.setPhase();
      }, 2);
    }
  }
  componentDidUpdate(){
    if(this.props.developMode == true && this.props.gameScript != this.gameScript){
      this.gameScript = this.props.gameScript;
      if(this.state.dummy == null){
        this.setState({dummy : undefined});
      }else{
        this.setState({dummy : null});
      }
    }
  }
  addAStoryVar(name, value) {
    this.setState({
      storyVars: structuredClone(Object.assign(this.state.storyVars, { [name]: value }))
    });
  }
  getAAnimationDuration(animation) {
    // console.warn(animation);
    let animationDuration = 0;
    if ("duration" in animation) {
      animationDuration += animation.duration;
    }
    if ("delay" in animation) {
      animationDuration += animation.delay;
    }
    return animationDuration;
  }
  setFadeOutTriggerDuration() {
    const actualNode = NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript);
    var triggerDuration = 0;
    if("escenario" in actualNode){
      if ("fadeOut" in actualNode.escenario.fondo) {

        triggerDuration = this.getAAnimationDuration(actualNode.escenario.fondo.fadeOut);
      }
      if ("personajes" in actualNode.escenario) {
        actualNode.escenario.personajes.forEach(element => {
          if ("fadeOut" in element) {
            triggerDuration = this.getAAnimationDuration(element.fadeOut) > triggerDuration ? this.getAAnimationDuration(element.fadeOut) : triggerDuration;
          }
        });
      }
      if ("capaSuperior" in actualNode.escenario) {
        if (!Array.isArray(actualNode.escenario.capaSuperior)) {
          if ("fadeOut" in actualNode.escenario.capaSuperior) {
            triggerDuration = this.getAAnimationDuration(actualNode.escenario.capaSuperior.fadeOut) > triggerDuration ? this.getAAnimationDuration(actualNode.escenario.capaSuperior.fadeOut) : triggerDuration;
          }
        } else {
          actualNode.escenario.capaSuperior.forEach(element => {
            if ("fadeOut" in element) {
              triggerDuration = this.getAAnimationDuration(element.fadeOut) > triggerDuration ? this.getAAnimationDuration(element.fadeOut) : triggerDuration;
            }
          });
        }
      }
      if ("musica" in actualNode.escenario) {
        actualNode.escenario.musica.forEach(element => {
          if ("fadeOut" in element) {
            triggerDuration = this.getAAnimationDuration(element.fadeOut) > triggerDuration ? this.getAAnimationDuration(element.fadeOut) : triggerDuration;
          }
        });
      }
    }
    if("dialogo" in actualNode){
      if ("personaje" in actualNode.dialogo) {
        actualNode.dialogo.personaje.forEach(element => {
          if ("fadeOut" in element) {
            triggerDuration = this.getAAnimationDuration(element.fadeOut) > triggerDuration ? this.getAAnimationDuration(element.fadeOut) : triggerDuration;
          }
        });
      }
    }
    this.fadeOutTriggerDuration = triggerDuration;//if this thing is 0 and there's no dialogs set alarm
    if(triggerDuration == 0){
      this.checkIfInstantNode(actualNode);
    }
  }
  checkIfInstantNode(actualNode){
    var res = true;
    if ("cinematica" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript)) {
      res = false;//!add a recursive search of total duration
    }else if("dialogo" in actualNode){
      if ("personaje" in actualNode.dialogo) {
        if (actualNode.dialogo.personaje.length > 0){//no alarm
          res = false;
        }
      }else if ("usuario" in actualNode.dialogo) {
        if (actualNode.dialogo.usuario.length > 0){//no alarm
          res = false;
        }
      }
    }
    this.setState({instantNodeWarn:res});
  }
  setNextNode(nextNode = null, onComplete = null) {
    if (nextNode != null) {
      this.nextNode = nextNode;
      if (onComplete != null) {
        onComplete();
      }
    } else {
      this.nextNode = NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).nodoSiguiente;
      this.setPhase();
    }
  }
  setPhase() {
    // console.log("ActualNode: "+this.state.actualNode);
    switch (this.state.phase) {
      case 0://start phase 1 - Run CameraMan, at end:Draw scenario & upper scenario(capaSuperior) & music
      this.setState({ phase: 1 }, () => {
        // console.log("Fase de dibujo de escenario, escenario superior y inicializacion de musica iniciada");
        this.setFadeOutTriggerDuration();
        if("escenario" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript)){
          if("fondo" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).escenario){

          }else{
            this.setPhase();
          }
        }else{
          this.setPhase();
        }
      });
        break;
      case 1://start phase 2 - Draw characters
        this.setState({ phase: 2 }, () => {
          // console.log("Fase de dibujo de personajes iniciada");
          if ("personajes" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript)) {
            if (NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).personajes.length > 0) {

            } else {
              this.setPhase();
            }
          } else {
            this.setPhase();
          }
        });
        break;
      case 2://start phase 3 - Play dialogs
        this.setState({ phase: 3 }, () => {
          // console.log("Fase de dialogos de personajes iniciada");
          if ("dialogo" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript)) {
            if ("personaje" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).dialogo) {
              if (NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).dialogo.personaje.length > 0) {

              } else {
                this.setPhase();
              }
            } else {
              this.setPhase();
            }
          } else {
            this.setPhase();
          }
        });
        break;
      case 3://start phase 4 - show player dialogs
        //trigger the default setNextNode when no player dialogs
        this.setState({ phase: 4 }, () => {
          // console.log("Fase de dialogos del usuario iniciada");
          if ("dialogo" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript)) {
            if ("usuario" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).dialogo) {
              if (NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).dialogo.usuario.length > 0) {

              } else {
                this.setNextNode();
              }
            } else {
              this.setNextNode();
            }
          } else {
            this.setNextNode();
          }
        });
        break;
      case 4://change actual node
        //request the fadeOuts before load the next node
        this.goNextNode();
        break;
    }
  }
  goNextNode() {
    this.setState({ triggerFadeOutAnimations: true }, () => {
      window.setTimeout(() => {
        
          if ("cinematica" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript)) {
            let self = this;
            CameraMan.run(NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).cinematica,()=>{
              if(!this.state.instantNodeWarn && (self.nextNode != undefined && self.nextNode != null)){
                this.setState({
                  triggerFadeOutAnimations: false,
                  phase: 0,
                  actualNode: self.nextNode,
                }, () => {
                  this.setPhase();
                });
              }
            },this.cameraReference.current);
          }else{
            let self = this;
            if(!this.state.instantNodeWarn && (self.nextNode != undefined && self.nextNode != null)){
              this.setState({
                triggerFadeOutAnimations: false,
                phase: 0,
                actualNode: self.nextNode,
              }, () => {
                this.setPhase();
              });
            }
          }
          
        
      }, this.fadeOutTriggerDuration);
    });
  }
  execPhase1Fondo() {
    if (this.state.phase > 0) {
      if("escenario" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript)){
        if("fondo" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).escenario){
          return (
            <Fondo
              fondo={NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).escenario.fondo}
              triggerNextPhase={() => {this.setPhase();}}
              triggerFadeOutAnimations={this.state.triggerFadeOutAnimations}
            />
          );
        }
      }
    }
    return (<></>);
  }
  execPhase1CapaSuperior() {
    if(this.state.phase > 0 && ("escenario" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript))){
      if ("capaSuperior" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).escenario) {
        if (!Array.isArray(NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).escenario.capaSuperior)) {
          return (
            <Fondo
              fondo={NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).escenario.capaSuperior}
              triggerFadeOutAnimations={this.state.triggerFadeOutAnimations}
            />
          );
        }
        else if(NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).escenario.capaSuperior.length > 0) {
          return (
            <>
              <Characters
                characters={NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).escenario.capaSuperior}
                triggerNextPhase={() => { console.log("dummyTrigger") }}
                triggerFadeOutAnimations={this.state.triggerFadeOutAnimations}
                capaSuperior={"karl"}
              />
            </>
          );
        }
      }
    }
    return (<></>);
  }
  execPhase2() {
    if (this.state.phase > 1) {
      if ("escenario" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript)) {
        if ("personajes" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).escenario) {
          if (NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).escenario.personajes.length > 0) {
            // console.log("Call to draw");
            return (
              <Characters
                characters={NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).escenario.personajes}
                triggerNextPhase={() => { this.setPhase() }}
                triggerFadeOutAnimations={this.state.triggerFadeOutAnimations}
              />
            );
          }
        }
      }
    }
    return (<></>);
  }
  execPhase3() {
    if (this.state.phase > 2) {
      if ("dialogo" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript)) {
        if ("personaje" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).dialogo) {
          if (NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).dialogo.personaje.length > 0) {
            return (
              <DialogosPersonajes
                dialogs={NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).dialogo.personaje}
                triggerNextPhase={() => { this.setPhase() }} />
            )
          }
        }
      }
    }
    return (<></>);
  }
  execPhase4() {
    if (this.state.phase > 3) {
      if ("dialogo" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript)) {
        if ("usuario" in NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).dialogo) {
          if (NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).dialogo.usuario.length > 0) {
            return (
              <DialogosUsuario
                dialogs={NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript).dialogo.usuario}
                addAStoryVar={(name, value) => { this.addAStoryVar(name, value) }}
                triggerNextPhase={(nextNode) => { this.setNextNode(nextNode, () => { this.setPhase(); }) }} />
            );
          }
        }
      }
    }
    return (<></>);
  }
  render() {
    return (
      <div className="absolute h-full w-full" style={{zoom:this.props.developMode != undefined?"20%":""}}>
        <div className="relative h-full w-full overflow-hidden" id="gameCanvasScreenshotTarget">
          <div ref={this.cameraReference} className="relative h-full w-full overflow-hidden" style={{}} id="camera">
            <div className="relative h-full w-full overflow-hidden" style={{transformOrigin: "0 0"}} id="scaleCaster">
              {this.execPhase1Fondo()}
              {this.execPhase2()}
              {this.execPhase1CapaSuperior()}
            </div>
          </div>
          {this.execPhase3()}
          {this.execPhase4()}
          

          <div className={"absolute top-2 left-2" + (this.props.developMode == true? " hidden": "")}>
            <PauseButton action={() => { this.setState({ showMenuPausa: true }) }} text="" />
          </div>
        </div>
        <div className={"top-0 absolute h-full w-full overflow-hidden" + (this.state.showMenuPausa ? "" : " pointer-events-none")  + (this.props.developMode == true? " hidden": "")}>
          <PauseMenu
            showing={this.state.showMenuPausa}
            reanudar={() => { this.setState({ showMenuPausa: false }) }}
            volverAlMenuPrincipal={() => { this.props.changeSection(0); }}
            actualNode={this.state.actualNode}
            dataToSave={this.state.storyVars}

            aspectRatioCalc={(op)=>{this.props.aspectRatioCalc(op)}}
          />
        </div>
      </div>
    );
  }
}
export { GameEnvironment }