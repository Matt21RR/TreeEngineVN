import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import "./engine/res/css/fonts.css";

import { Test } from './windows/Test';
import { RenderEngine } from './engine/renderCore/RenderEngine';

import studio from '@theatre/studio'
import * as core from '@theatre/core';
import { game } from './game/js';
import Swal from 'sweetalert2';

const runEditor = (engine = new RenderEngine)=>{
  const project = core.getProject("Rengine Editor")
  const sheet = project.sheet("Editor tools")

  const camera = sheet.object("camera", {
    id:"engineCamera",
    maxZ:core.types.number(10000,{nudgeMultiplier:0.01}),
    origin:{
      x:core.types.number(0.5,{nudgeMultiplier:0.01}),
      y:core.types.number(0.5,{nudgeMultiplier:0.01})
    },
    position:{
      x:core.types.number(0.5,{nudgeMultiplier:0.01}),
      y:core.types.number(0.5,{nudgeMultiplier:0.01}),
      z:core.types.number(0,{nudgeMultiplier:0.01}),
      angle:core.types.number(0,{nudgeMultiplier:0.01})
    },
    usePerspective:false
  });

  camera.onValuesChange((v)=>{
    engine.camera = v;
  });
};



const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* <Test/> */}
    <div className='absolute h-full w-full'>
      <RenderEngine 
        aspectRatio="undefined"
        avoidResizeBlackout
        clientSideResources 
        showFps
        setEngine={(engine = new RenderEngine)=>{

          Swal.fire("Controles",`
            Ajustar zoom: Y, U
            <br>
            Avanzar/Retroceder: W, S
            <br>
            Girar: K, L
            <br>
            Disparar: Espacio
            `).then(()=>{game(engine);})
          // runEditor(engine);
          // engine.loadTexture("https://cataas.com/cat","cat")
          //   .then(()=>{
          //     engine.graphArray.push(new engine.graphObject({
          //       texture:"cat",
          //       enabled:true,
          //       x:0.5,
          //       y:0.5
          //     }));
          //   });          
        }}/>
    </div>
  </React.StrictMode>
);

