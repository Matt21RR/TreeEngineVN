import React from 'react';
import { GameSaveLogic } from '../logic/GameSaveLogic';
import { MenuButton } from "../components/buttons";
class SavedGamesScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      thumbnails: new Object(),
      gameSavedList : (GameSaveLogic.getSavedGames()),
    }
  }
  componentDidMount() {
    GameSaveLogic.getSavedGamesThumbnails((thumbnails) => {
      this.setState({
        thumbnails: thumbnails
      });
    });
  }
  savedGamesList() {
    let gameSavedList = this.state.gameSavedList.reverse();
    return (
      gameSavedList.map((e, index) => (
        <div className={' border-4 flex flex-row w-full relative my-4'}
        >
          <div className={'m-2 h-36 w-72 '}
            style={{
              backgroundImage: (e.saveDate in this.state.thumbnails ? "url('" + this.state.thumbnails[e.saveDate] + "')" : ""),
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center"
            }}></div>
          <div className='absolute right-4 top-2 text-white'>
            <MenuButton text="Cargar Partida" action={() => {
              this.props.loadSavedGame(e.node,e.storyVars,()=>{this.props.changeSection(2);});
              }} />
          </div>
          <div className='absolute right-4 top-10 text-white'>
            <MenuButton text="Borrar" action={() => {
              GameSaveLogic.deleteSavedGame((index-(gameSavedList.length-1)) * -1,()=>{
                this.setState({gameSavedList : (GameSaveLogic.getSavedGames())});
              });
              }} />
          </div>
          <div className='absolute right-0 mx-4 bottom-2'>{new Date(e.saveDate).toLocaleDateString() + " " + new Date(e.saveDate).toLocaleTimeString()}</div>

        </div>
      )
      )
    );
  }
  render() {
    return (
      <div className='absolute top-0 left-0 w-full h-full pt-20 pb-12'>
        <div className='absolute top-0 h-16 w-full flex flex-col'>
          <div className='my-auto mx-6 text-white'>
            <MenuButton text="Volver" action={() => this.props.changeSection(0)} />
          </div>
          <div className='absolute right-8 my-auto text-white top-1/2 text-lg' style={{transform:"translate(0%,-50%)"}}>PARTIDAS GUARDADAS</div>
          
        </div>
        <div className='relative h-full text-white overflow-auto'>
          <div className='relative h-full w-7/10 mx-auto text-white'>
          {this.savedGamesList()}
          </div>
        </div>
      </div>

    );
  }
}
export { SavedGamesScreen }