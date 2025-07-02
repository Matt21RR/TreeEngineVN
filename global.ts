import { RenderEngine } from "./src/engine/renderCore/RenderEngine";

declare global{
  interface Window {
    engineRef:RenderEngine;
    backendRoute:string;
    setUsePerspective:Function;
  }
}
