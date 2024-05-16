import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import "./engine/res/css/fonts.css";
import { Template } from './Template';
// import { Test } from './Test';
import { EditTools } from './engine/tools/EditTools';
import { Laplace } from './engine/tools/Laplace';


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* <Laplace/>  */}
    <EditTools/>
    
  </React.StrictMode>
);

