import React from "react";
import $ from "jquery";
import { rAF } from "../logic/rAF.ts";
import { RenderEngine } from "./RenderEngine.tsx";

type CanvasData = {
  object:Canvas,
  context:CanvasRenderingContext2D,
  resolution:{width:number,height:number,scale:number},
  fps:{promedio:{cps:number,fps:number},elapsed:number} | {}
}

interface CanvasProps{
  fps?:number;
  scale?:number;
  showFps?: boolean;

  engine:RenderEngine;

  renderGraphics : (canvasData: CanvasData) => Array<number>;
  animateGraphics : (deltaData: {promedio:{cps:number,fps:number},elapsed:number}) => void;
  onLoad? : (canvasData: CanvasData) => void;
  onResize? : (canvasData: CanvasData) => void;
  afterEffects?:Function;

  events:Function;

  displayResolution:{
    width:number,
    height:number
  }
}

class Canvas extends React.Component<CanvasProps>{
  id:string;
  loopId:string;
  mounted:boolean;

  renderEngine:RenderEngine;

  windowHasFocus:boolean;

  targetFps:number;
  fpsCounter:number;
  scale:number;

  interval:number;

  resolutionHeight:number;
  resolutionWidth:number;

  element:React.RefObject<HTMLCanvasElement>;

  stopEngine:boolean;
  engineThreads:number;
  engineKilled:boolean;

  onLoad : (canvasData: CanvasData) => void;
  onResize : (canvasData: CanvasData) => void;

  showFps: boolean;
  animatingElapsed: number;
  renderingElapsed: number;
  totalEngineElapsedTime: number;
   

  constructor(props: CanvasProps){
    super(props);

    if(props){
      this.targetFps = props.fps ? (props.fps > 0 ? props.fps : 24) : 24;//suggesed max fps = 24
      this.scale = props.scale ?? 1;//suggested scale for animated canvas = 0.55 | static canvas = 1

      this.renderEngine = props.engine;

      this.onLoad = props.onLoad ?? ((canvas:CanvasData)=>{})//Do something after the canvas params have been set
      this.onResize = props.onResize ?? ((canvas:CanvasData)=>{})//Do something after the canvas have been resized

      this.showFps = props.showFps ?? false;
    }


    this.id = "canvas"+performance.now();
    this.loopId = "loop"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");
    window.loopId = structuredClone(this.loopId);
    this.mounted = false;

    this.windowHasFocus = true;

    this.fpsCounter = 0;

    this.interval = Math.round(1000 / this.targetFps);

    this.resolutionHeight = Math.floor(window.innerHeight * this.scale *window.devicePixelRatio);
    this.resolutionWidth = Math.floor(window.innerWidth * this.scale *window.devicePixelRatio); 

    this.element = React.createRef() as React.RefObject<HTMLCanvasElement>;
  
    this.stopEngine = false;
    this.engineThreads = 0;
    this.engineKilled = false;

    //*Debug
    this.animatingElapsed = 0;
    this.renderingElapsed = 0;
    this.totalEngineElapsedTime = 0;
  }
  setFps(x:number){ 
    const canvas = this.element.current;
    if(canvas == null){return;}
    this.targetFps = x; 
    this.stopEngine = (x == 0) && !this.stopEngine; 
    this.interval = Math.floor(1000 / x); 
    if (!this.stopEngine) 
      this.onResize({
        object:this,
        context:canvas.getContext("2d") as CanvasRenderingContext2D,
        resolution:{width:this.resolutionWidth,height:this.resolutionHeight,scale:this.scale},
        fps:{}
      });
  }
  
  componentDidUpdate(){
    const resH = Math.floor(this.props.displayResolution.height * this.scale * window.devicePixelRatio);
    const resW = Math.floor(this.props.displayResolution.width * this.scale * window.devicePixelRatio);
    
    if(resH != this.resolutionHeight || resW != this.resolutionWidth){
      if(!this.engineKilled){
        const canvas = this.element.current;
        if(canvas){
          this.resolutionHeight = resH;
          this.resolutionWidth = resW;
          //set dimensions
          canvas.width = this.resolutionWidth;
          canvas.height = this.resolutionHeight;
          //set the reset function
          this.onResize({
            object:this,
            context:canvas.getContext("2d") as CanvasRenderingContext2D,
            resolution:{width:this.resolutionWidth,height:this.resolutionHeight,scale:this.scale},
            fps:{}});
        }
      }
    } 
  }
  componentDidMount(){
    if (!this.mounted) { 
      this.mounted = true;
      const canvas = this.element.current;
      //set resolution
      this.resolutionHeight = Math.floor(this.props.displayResolution.height * this.scale *window.devicePixelRatio);
      this.resolutionWidth = Math.floor(this.props.displayResolution.width * this.scale *window.devicePixelRatio);
      //set dimensions
      if(canvas){
        canvas.width = this.resolutionWidth;
        canvas.height = this.resolutionHeight;
      }

      let self = this;
      $(window).off("blur");
      $(window).on("blur", function (e) {
        if(self.windowHasFocus){
          self.renderEngine.pressedKeys = [];
          self.windowHasFocus = false;
        }
      });
      $(window).off("focus");
      $(window).on("focus", function (e) {
        if(!self.engineKilled && !self.windowHasFocus){
          self.windowHasFocus = true;
        }
      });
      //set the every graphic object data
      if(canvas){
        this.onLoad({
          object:this,
          context:canvas.getContext("2d") as CanvasRenderingContext2D,
          resolution:{width:this.resolutionWidth,height:this.resolutionHeight,scale:this.scale},
          fps:{}});
      }else{
        console.error("Error on the canvas reference");
      }
      //call engine
      this.engine(this.loopId);
    }
  }
  canvasWriter(text:Array<string>,origin:{x:number,y:number},lineHeight:number){
    const canvas = this.element.current;
    if(canvas){
      const context = canvas.getContext("2d");
      if(context){
        context.font = (12*this.scale)+"px Terminal";
        context.fillStyle = "orange";
        context.filter = 'none';
        context.globalAlpha = 1;
        context.beginPath();

        text.forEach((line,index) => {
           context.fillText(
            line,
            origin.x*this.scale,
            (origin.y+(index*lineHeight))*this.scale
          );
        });
        context.closePath();
        context.fill();
      }
    }
  }
  resetEngine(){
    this.stopEngine = false;
    this.engineKilled = false;
    this.engineThreads = 0;
    this.resolutionHeight = Math.floor(this.props.displayResolution.height * this.scale *window.devicePixelRatio);
    this.resolutionWidth = Math.floor(this.props.displayResolution.width * this.scale *window.devicePixelRatio);
    const fps = this.props.fps ? (this.props.fps > 0 ? this.props.fps : 24) : 24;//suggesed max fps = 24
    this.setFps(fps);
    this.engine(this.loopId);
  }
  // Engine starter
  engine(loopId:string) {
    if(loopId != this.loopId){
      return;
    }
    if(this.element == null){
      console.error("element reference error");
      this.element = React.createRef() as React.RefObject<HTMLCanvasElement>;
    }
    const canvas = this.element.current;
    if(canvas == null){
      console.error("canvas reference error");
      return;
    }
    var context = canvas.getContext("2d") as CanvasRenderingContext2D;

    var checkEvents = (fps:{promedio:{cps:number,fps:number},elapsed:number}) => {
      try {
        this.props.events();
        animator(fps);
      } catch (error) {//!Kill engine
        this.stopEngine = true;
        this.engineKilled = true;
        console.error("Engine killed due an error in the events logic");
        console.error(error);
      }
    }

    var animator = (fps:{promedio:{cps:number,fps:number},elapsed:number}) => {
      //*ANIMATE
      try {
        const animateStartAt = performance.now();
        this.props.animateGraphics(fps);
        this.animatingElapsed = performance.now()-animateStartAt;
      } catch (error) {//!KILL ENGINE
        context.clearRect(0, 0, canvas.width, canvas.height);//cleanning window

        var errorData: Array<string> = [
          "Engine Killed due fatal error during animating process in line: "+error.lineNumber,
          "-error message:",
          "  "+error,
          "-function executed when the engine crashed:",
          "============================================================================================================================="
        ];

        errorData = errorData.concat(error.stack.toString().split("\n"));
        errorData.push("=============================================================================================================================");

        this.canvasWriter(errorData,{x:5,y:15},15);

        this.stopEngine = true;
        this.engineKilled = true;
        console.error("Engine Killed due fatal error during animating process process",error);
        debugger;
        return;
      }
      //*RENDER
      try {
        if(this.windowHasFocus){
          renderer(fps);
          this.fpsCounter++;
        }
      }
      catch (error) {//!KILL ENGINE
        context.clearRect(0, 0, canvas.width, canvas.height);//cleanning window

        var errorData: Array<string> = [
          "Engine Killed due fatal error during rendering process in line: "+error.lineNumber,
          "-error message:",
          "  "+error,
          "-function executed when the engine crashed:",
          "============================================================================================================================="
        ];
        errorData = errorData.concat(error.stack.toString().split("\n"));
        errorData.push("=============================================================================================================================");

        this.canvasWriter(errorData,{x:5,y:15},15);

        this.stopEngine = true;
        this.engineKilled = true;
        console.error("Engine Killed due fatal error during rendering process");
        console.log(error);
        debugger;
      }
    }
    var renderer = (fps:{promedio:{cps:number,fps:number},elapsed:number}) => {

      context.filter = 'none';
      
      const renderingStartAt = performance.now();
      const [
        orderingTime,
        infoAdjudicationTime,
        drawingTime,
        debugTime,
        objectsToRender,
        updateColsTime
      ] = this.props.renderGraphics({
        object:this,
        context:context,
        resolution:{width:this.resolutionWidth,height:this.resolutionHeight,scale:this.scale},
        fps:fps});
      this.renderingElapsed = performance.now()-renderingStartAt;

      const actualGlobalAlpha = context.globalAlpha;

      if(this.showFps){
        var mouse = this.renderEngine.mouse;

        const fpsData: Array<string> = [
          "CPS: "+fps.promedio.cps + "/ FPS: "+fps.promedio.fps,
          "Interval: "+fps.elapsed.toFixed(4),
          "Mouse: x:"+mouse.x.toFixed(2)+" ,y:"+mouse.y.toFixed(2),
          "Res: "+this.resolutionWidth+"x"+this.resolutionHeight,
          "EngTime: "+this.totalEngineElapsedTime.toFixed(2) + "ms",
          "Keys: "+this.renderEngine.pressedKeys.join(" "),
          "GPU: "+(this.renderingElapsed).toFixed(2) + "ms" ,
          "CPU: "+(this.animatingElapsed).toFixed(2) + "ms" ,
          "cycle:"+(this.renderingElapsed+this.animatingElapsed).toFixed(2) + "ms" ,
          "OrderingTime: "+(orderingTime).toFixed(2) + "ms" ,
          "AdjuTime: "+(infoAdjudicationTime).toFixed(2) + "ms" ,
          "DrawTime: "+(drawingTime).toFixed(2) + "ms" ,
          "DebuTime: "+(debugTime).toFixed(2) + "ms" ,
          "",
          "UpdColsT: "+(updateColsTime).toFixed(2) + "ms",
          "Objects: "+ objectsToRender
        ];
        this.canvasWriter(fpsData,{x:5,y:15},15);

        context.globalAlpha = actualGlobalAlpha;
        context.globalCompositeOperation = "source-over";
      }
    }
    var promedio = {cps:this.targetFps,fps:this.targetFps};
    var drawnFrames = 0, startTimer = window.performance.now(),maxCps = 0;
    var draw = (engDelta:number,lId:string) => {       

      if(engDelta <0){
        debugger;
      }

      const operativeTimeStartedAt = performance.now();
      if(this.stopEngine || this.engineThreads >1){
        this.engineThreads--;
        return;
      }
      
      drawnFrames++;

      if(performance.now()-startTimer >1000){
        maxCps=drawnFrames-1;
        startTimer = window.performance.now();
        drawnFrames=1;
        promedio.fps = this.fpsCounter;
        promedio.cps = maxCps;
        this.fpsCounter = 0;
      }

      if(lId == this.loopId){
        rAF.modelFour(draw,(1000 / this.targetFps),operativeTimeStartedAt,lId);
      }

      if(this.windowHasFocus){
        this.totalEngineElapsedTime += engDelta;   
        checkEvents({promedio:promedio,elapsed:engDelta});
      }else{
        checkEvents({promedio:promedio,elapsed:0});
      }
    }

    try { 
      this.engineThreads++;
      draw(0,loopId);
    } catch (error) {
      console.log("in line:"+ error.lineNumber);
      console.log(error);
    }
  }
  render(){
    return(
      <canvas 
        id={this.id}
        ref={this.element}
        width={this.resolutionWidth}
        height={this.resolutionHeight}
        className="h-full w-full pointer-events-none absolute">
      </canvas>
    );
  }
}
export {Canvas,CanvasData}