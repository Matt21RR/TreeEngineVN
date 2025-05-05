import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import "./engine/res/css/fonts.css";

import { Test } from './windows/Test.jsx';
import { RenderEngine } from './engine/renderCore/RenderEngine.tsx';

import { game } from './game/js.js';
import Swal from 'sweetalert2';

window.backendRoute = "http://127.0.0.1"
window.workRoute = window.backendRoute + "/renderEngineBackend/";
window.projectRoute = window.workRoute + "game/";

const root = ReactDOM.createRoot(document.getElementById('root'));

document.title = "RenderEngine";

root.render(
  <>
    <Test/>
    {/* <div className='absolute h-full w-full'>
      <RenderEngine 
        aspectRatio="undefined"
        avoidResizeBlackout
        clientSideResources 
        showFps
        cyclesPerSecond={60}
        setEngine={(engine)=>{

          Swal.fire("Controles",`
            Ajustar zoom: Y, U
            <br>
            Avanzar/Retroceder: W, S
            <br>
            Girar: K, L
            <br>
            Disparar: Espacio
            `).then(()=>{game(engine);})      
        }}/>
    </div> */}
  </>
);

