import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import "./res/css/style.css";
import { Template } from './Template';
import { Test } from './Test';
import { EditTools } from './tools/EditTools';


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Template/>
    {/* <EditTools/> */}
    
  </React.StrictMode>
);

