import gsap from "gsap";
import React from "react";
import { GameSaveLogic } from "../logic/GameSaveLogic";
import { MenuButton } from "../components/buttons";
import { SavedGamesScreen } from "./SavedGamesScreen";
import { Config } from "./Config";
class PauseMenu extends React.Component{
  constructor(props){
    super(props);
    this.state = {
      showing : false,
      tryingExit: false,
      tryingMainMenu: false,
      tryingSavedGamesScreen: false,
      tryingConfig: false
    }
    this.target = React.createRef();
    this.exitTarget = React.createRef();
    this.savedGamesScreenTarget = React.createRef();
    this.configScreenTarget = React.createRef();
  }
  componentDidUpdate(){
    if(this.props.showing && !this.state.showing){
      this.setState({showing:true},()=>{
        //fadeInAnimation
        gsap.to(this.target.current,0.5,{opacity:1});
        gsap.to(this.target.current.childNodes[1],0.5,{left:"0px"});
      });
    }else if(!this.props.showing && this.state.showing){
      this.setState({showing:false},()=>{
        //fadeOutAnimation
        gsap.to(this.target.current,0.5,{opacity:0});
        gsap.to(this.target.current.childNodes[1],0.5,{left:"-400px"});
      });
    }
  }
  exitWarn(){
    return(
      <div ref={this.exitTarget} className={"absolute top-0 left-0 w-full h-full "+(!(this.state.tryingExit || this.state.tryingMainMenu)?"pointer-events-none":"")}
      style={{
        opacity:0.0,
        backgroundColor:"rgba(0, 0, 0, 0.7)"
      }}>
        <div className="absolute top-1/2 left-1/2 p-3" 
          style={{
            transform:"translate(-50%,-50%)",
            backgroundColor:"black",
            color:"white"
          }}>
            <div className="p-1 pb-2">
              {this.state.tryingExit?"Estas seguro de que deseas salir al escritorio?" : "Estas seguro que deseas volver al menu principal?"}
            </div>
            <div className="ml-3">
              <MenuButton text="Guardar y Salir" action={()=>{
                GameSaveLogic.saveGame(this.props.actualNode,false,this.props.dataToSave,()=>{
                  if(this.state.tryingMainMenu){
                    //*VOLVER AL MENU PRINCIPAL
                    this.props.volverAlMenuPrincipal();
                  }else{
                    //!CERRAR EL JUEGO
                  }
                });
              }}/>
              <MenuButton text="Salir" action={()=>{
                if(this.state.tryingMainMenu){
                  //*VOLVER AL MENU PRINCIPAL
                  this.props.volverAlMenuPrincipal();
                }else{
                  //!CERRAR EL JUEGO
                }
              }}/>
              <MenuButton text="Cancelar"  
                action={()=>{
                  this.setState({tryingExit: false,tryingMainMenu:false},()=>{
                    gsap.to(this.exitTarget.current,0.5,{opacity:0});
                  });
                  }}/>
            </div>
        </div>
      </div>
    );
  }
  savedGamesScreen(){
    return(
      <div ref={this.savedGamesScreenTarget} className={"absolute top-0 left-0 w-full h-full "+(!(this.state.tryingSavedGamesScreen)?"pointer-events-none":"")}
      style={{
        opacity:0.0,
        backgroundColor:"rgba(0, 0, 0, 0.6)"
      }}>
        <SavedGamesScreen
            loadSavedGame={(actualNode,storyVars,dummyFun)=>{this.props.loadSavedGame((actualNode,storyVars,()=>{
              //maybe add a hide function for this
              this.props.reanudar();
            }))}}
            changeSection={(dummyVar) => { 
              //close this pause menu
              this.setState({tryingSavedGamesScreen:false},()=>{
                gsap.to(this.savedGamesScreenTarget.current,0.5,{opacity:0});
              });
            }}
          />
      </div>
    );
  }
  configScreen(){
    return(
      <div ref={this.configScreenTarget} className={"absolute top-0 left-0 w-full h-full "+(!(this.state.tryingConfig)?"pointer-events-none":"")}
      style={{
        opacity:0.0,
        backgroundColor:"rgba(0, 0, 0, 0.6)"
      }}>
        <Config
            changeSection={(dummyVar) => { 
              //close this pause menu
              this.setState({tryingConfig:false},()=>{
                gsap.to(this.configScreenTarget.current,0.5,{opacity:0});
              });
            }}

            aspectRatioCalc={(op)=>{this.props.aspectRatioCalc(op)}}
          />
      </div>
    );
  }
  render(){
    return(
      <div ref={this.target} className={"absolute top-0 left-0 w-full h-full opacity-0" + (!this.state.showing? " pointer-events-none" : "")}>
        <div className="absolute top-0 left-0 w-full h-full"
          style={{
            opacity:0.5,
            backgroundColor:"#000000"
          }}>

        </div>
        <div className="text-white overflow-hidden"
          style={{
            // transform:"translate(-50%,50%)",
            left:"-400px",
            top:"0%",
            height:"100%",
            width:"250px",
            position:"absolute",
            backgroundColor:"black"
          }}>
            <div className="absolute w-full h-fit"
              style={{
                left:"20px",
                bottom:"20px",
              }}>
                Juego En Pausa
                <MenuButton text="Reanudar" action={()=>{this.props.reanudar()}}/>
                <MenuButton text="Guardado Rapido" action={()=>{GameSaveLogic.saveGame(this.props.actualNode,false,this.props.dataToSave,()=>{})}}/>
                <MenuButton text="Cargar Partida" action={()=>{this.setState({tryingSavedGamesScreen: true},()=>{
                    gsap.to(this.savedGamesScreenTarget.current,0.5,{opacity:1});
                  })}}/>
                <MenuButton text="Ajustes" action={()=>{this.setState({tryingConfig: true},()=>{
                    gsap.to(this.configScreenTarget.current,0.5,{opacity:1});
                  })}}/>
                <MenuButton text="Menu Principal"  action={()=>{this.setState({tryingMainMenu: true},()=>{
                    gsap.to(this.exitTarget.current,0.5,{opacity:1});
                  })}}/>
                <MenuButton text="Salir" action={()=>{this.setState({tryingExit: true},()=>{
                    gsap.to(this.exitTarget.current,0.5,{opacity:1});
                  })}}/>
            </div>
        </div>
        {this.exitWarn()}
        {this.savedGamesScreen()}
        {this.configScreen()}
      </div>
    )
  }
}
export {PauseMenu}