import React from "react";
import { Window } from "../components/Window";
import { WindowsEnvironment } from "./WindowsEnvironment";
import { RenderEngine } from "../renderCore/RenderEngine";

import $ from "jquery";
//import Plotly from 'plotly.js-dist-min'
import Plot from "react-plotly.js";

class PlotC extends React.Component{
  constructor(props){
    super(props);
    this.mounted = false;
    this.plotRef = React.createRef();
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      this.props.setResizeFunc(()=>{this.plotRef.current.resizeHandler(); console.log("resizing");});
    }
  }
  render(){
    var trace1 = {
      x: [1, 2, 3, 4],
      y: [10, 15, 13, 17],
      mode: 'markers'
    };
    
    var trace2 = {
      x: [2, 3, 4, 5],
      y: [16, 5, 11, 9],
      mode: 'lines'
    };
    
    var trace3 = {
      x: [1, 2, 3, 4],
      y: [12, 9, 15, 12],
      mode: 'lines+markers'
    };
    
    var data = [ trace1, trace2, trace3 ];
    
    var layout = {
      title:'Line and Scatter Plot',
      autosize:true
    };
    return(
      <div className="relative w-full h-full" id={this.id}>
        <Plot 
          ref={this.plotRef}
          data={data} 
          layout={layout} 
          config={{responsive:true}}
          useResizeHandler
          style={{ width: "100%", height: "100%", position:"relative" }}
          />
      </div>
    );
  }
}

class Laplace extends React.Component{
  constructor(props){
    super(props);
    this.plotResizeFunc = ()=>{console.log("nada")}
  }
  render(){
    const id1 = "rengine" + String(window.performance.now()).replaceAll(".","");
    return(
      <WindowsEnvironment
        windowsContent={{
          clock:{
            content:<RenderEngine id={id1}/>,
            title:"Simulación",
            onResize:()=>{console.log("a")}
          },
          plot:{
            content:<PlotC setResizeFunc={(fun)=>{this.plotResizeFunc = fun}}/>,
            title:"Plot",
            onResize:()=>{this.plotResizeFunc()}
          }
        }}
      />
    );
  }
}
export {Laplace}