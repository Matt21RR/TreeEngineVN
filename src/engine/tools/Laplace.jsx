import React from "react";
import { Window } from "../components/Window";
import { WindowsEnvironment } from "./WindowsEnvironment";
import { RenderEngine } from "../renderCore/RenderEngine";


class Laplace extends React.Component{

  render(){
    const id = "rengine" + String(window.performance.now()).replaceAll(".","");
    return(
      <WindowsEnvironment
        windowsContent={{
          clock:{
            content:<RenderEngine id={id}/>,
            title:"Clock",
            onResize:()=>{console.log("a")}
          }
        }}
      />
    );
  }
}
export {Laplace}