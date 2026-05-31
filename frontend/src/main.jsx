import ReactDOM from 'react-dom/client';
import './index.css';
import "./engine/resources/css/fonts.css";

import { Test } from './windows/Test.jsx';
import LoadGameToWindow from './engine/interpreteCodAlgo/game.js';

window.workRoute = "./";
window.projectRoute = window.workRoute + "game/";
window.zetas = new Set();

const root = ReactDOM.createRoot(document.getElementById('root'));

document.title = "TreeEngineVN";

LoadGameToWindow();

root.render(
  <>
  <Test/>
  </>
);
