import React from "react";
import { GameSaveLogic } from "../logic/GameSaveLogic";
import {MenuButton} from "../components/buttons";
import {RenderEngine} from "../renderCore/RenderEngine";

class MainMenu extends React.Component{
  render(){
    return(
      <div className="flex-row absolute w-full h-full ">
          {/* <div
          className="absolute h-full w-full"
          style={{ 
            backgroundImage:"url('"+gameFiles.mainMenuBackgroundGif+"')",
            backgroundSize:"cover",
            backgroundRepeat:"no-repeat",
            filter:"blur(1.5px) hue-rotate(340deg)"
          }}>

          </div> */}
        {/* <RenderEngine /> */}
          
        <div className="absolute ml-16 h-auto bottom-[4%]">
          <MenuButton text="Continuar" hide={GameSaveLogic.getSavedGames().length  == 0} action={()=>{
            var lastSavedGame = GameSaveLogic.getSavedGames().at(-1);
            this.props.loadSavedGame(lastSavedGame.node,lastSavedGame.storyVars,()=>{this.props.changeSection(2);});
            }}/>
          <MenuButton text="Cargar Partida" hide={GameSaveLogic.getSavedGames().length  == 0} action={()=>this.props.changeSection(1)}/>
          <MenuButton text="Nueva Partida"  action={() => {this.props.loadNewGame(()=>{this.props.changeSection(2);});}}/>
          <MenuButton text="Opciones" action={()=>{this.props.changeSection(3);}}/>
          <MenuButton text="Develop tools" action={()=>{this.props.changeSection(4);}}/>
          <MenuButton text="Salir"/>
        </div>
      </div>
    );
  }
}
export {MainMenu}