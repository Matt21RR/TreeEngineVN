import React, { useEffect, useState } from 'react';

import { Button1, MenuButton } from "./components/Buttons.jsx";
import { Dictionary } from '../global.ts';

export default function TexturesE (){
  const [textures, setTextures] = useState<Dictionary<string>>({});
  const configRoute = window.backendRoute + "/renderEngineBackend/game/img/textures.json";
  const texturesDir = window.backendRoute + "/renderEngineBackend/game/img/";

  useEffect(()=>{
      fetchData();
  },[]);

  const fetchData = ()=>{
    fetch(configRoute).then(res => {return res.json()}).then(data=>{
      setTextures(data);
    });
  };

  const listB = () => {
    return (
      Object.keys(textures).map((textureId) => (
        <div className={'border-4 flex flex-row w-[98%] relative my-1'}>
          <div className={'m-1 h-[7.75rem] w-56 '}
            style={{
              backgroundImage: ("url('" + textures[textureId].replace("./",texturesDir) + "')"),
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

  const upperControls = () => {
    return (
      <div className='flex flex-row'>
        <Button1 text="Reload" action={()=>{fetchData()}}/>
        <div className='mx-2 my-auto flex flex-row'>
          <div className='border-2 border-gray-200 my-auto text-sm text-white'>
            Index file route: {configRoute}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='relative w-full h-full pt-5 flex flex-col'>
      {upperControls()}
      <div className='relative h-full w-full text-white overflow-auto'>
        <div className='relative h-full w-full px-8 text-white grid-flow-row auto-rows-min md:grid-cols-4 grid-cols-3  grid'>
          {listB()}
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