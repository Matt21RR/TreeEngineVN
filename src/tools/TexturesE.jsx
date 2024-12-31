import React from 'react';

import { Button1, MenuButton } from "./components/Buttons";

class TexturesE extends React.Component {
  constructor(props) {
    super(props);
    this.textures = []
    this.configRoute = "http://localhost/renderEngineBackend/game/img/textures.json";
    this.mounted = false;
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      this.fetchData();
    }
  }
  fetchData(){
    fetch(this.configRoute).then(res => {return res.json()}).then(data=>{
      this.textures = data;
      this.forceUpdate();
    });
  }
  listB() {
    return (
      Object.keys(this.textures).map((textureId) => (
        <div className={'border-4 flex flex-row w-[98%] relative my-1'}>
          <div className={'m-1 h-[7.75rem] w-56 '}
            style={{
              backgroundImage: ("url('" + this.textures[textureId].replace("./","http://localhost/renderEngineBackend/game/img/") + "')"),
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center"
            }}/>
          <div className='absolute right-4 top-1 text-white bg-black bg-opacity-40'>
            <MenuButton text={textureId} />
          </div>
        </div>
      )
      )
    );
  }
  upperControls(){
    return (
      <div className='flex flex-row'>
        <Button1 text="Reload" action={()=>{this.fetchData()}}/>
        <div className='mx-2 my-auto flex flex-row'>
          <div className='border-2 border-gray-200 my-auto text-sm text-white'>
            Index file route: {this.configRoute}
          </div>
        </div>
      </div>
    );
  }
  render() {
    return (
      <div className='relative w-full h-full pt-5 flex flex-col'>
        {this.upperControls()}
        <div className='relative h-full w-full text-white overflow-auto'>
          <div className='relative h-full w-full px-8 text-white grid-flow-row auto-rows-min md:grid-cols-4 grid-cols-3  grid'>
            {this.listB()}
          </div>
        </div>
        <div className='bottom-0 h-8 w-full flex flex-col relative'>
          <div className='relative w-fit my-auto mx-auto text-white text-sm'>
            The textures need to be defined manually in the script file
          </div>
        </div>
      </div>

    );
  }
}
export {TexturesE}