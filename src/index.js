import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import "./engine/res/css/fonts.css";
import { Template } from './Template';
// import { Test } from './Test';
import { EditTools } from './engine/tools/EditTools';


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <EditTools/>
    
  </React.StrictMode>
);

