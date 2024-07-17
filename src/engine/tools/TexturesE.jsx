import React from 'react';

import { MenuButton } from "../components/buttons";
import { requiredTextures } from '../../game/RequireFile';

class TexturesE extends React.Component {
  constructor(props) {super(props);}
  listB() {
    let textures = requiredTextures;
    return (
      Object.keys(textures).map((textureId) => (
        <div className={'border-4 flex flex-row w-[98%] relative my-1'}>
          <div className={'m-1 h-[7.75rem] w-56 '}
            style={{
              backgroundImage: ("url('" + textures[textureId] + "')"),
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
  render() {
    return (
      <div className='relative w-full h-full pt-5 flex flex-col'>
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