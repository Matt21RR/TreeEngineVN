import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import "./engine/resources/css/fonts.css";

import { Test } from './windows/Test.jsx';


window.backendRoute = "http://127.0.0.1"
window.workRoute = window.backendRoute + "/renderEngineBackend/";
window.projectRoute = window.workRoute + "game/";

const root = ReactDOM.createRoot(document.getElementById('root'));

document.title = "TreeEngineVN";

root.render(
  <Test/>
);
