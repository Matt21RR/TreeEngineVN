import ReactDOM from 'react-dom/client';
import './index.css';
import "./engine/resources/css/fonts.css";

import { Test } from './windows/Test.jsx';


window.workRoute = "./";
window.projectRoute = window.workRoute + "game/";
window.zetas = new Set();

const root = ReactDOM.createRoot(document.getElementById('root'));

document.title = "TreeEngineVN";

root.render(
  <Test/>
);
