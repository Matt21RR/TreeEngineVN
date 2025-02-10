import React from "react";
import $ from "jquery";
import { rAF } from "../logic/rAF";

class Canvas extends React.Component{
  constructor(props){
    super(props);
    this.CELGF = props.CELGF || ((error)=>console.error(error));
    this.id = "canvas"+performance.now();
    this.loopId = "loop"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");
    window.loopId = structuredClone(this.loopId);
    this.mounted = false;

    this.renderEngine = props.engine || {};

    this.windowHasFocus = true;

    this.fps = props.fps ? (props.fps > 0 ? props.fps : 24) : 24;//suggesed max fps = 24
    this.fpsCounter = 0;
    this.scale = props.scale || 1;//suggested scale for animated canvas = 0.55 | static canvas = 1

    this.interval = Math.round(1000 / this.fps);

    this.resolutionHeight = Math.floor(window.innerHeight * this.scale *window.devicePixelRatio);
    this.resolutionWidth = Math.floor(window.innerWidth * this.scale *window.devicePixelRatio); 

    this.element = React.createRef();
  
    this.stopEngine = false;
    this.engineThreads = 0;
    this.engineKilled = false;

    this.onLoad = props.onLoad || ((canvas)=>{})//Do something after the canvas params have been set
    this.onResize = props.onResize || ((canvas)=>{})//Do something after the canvas have been resized
    this.animateGraphics = props.animateGraphics || ((canvas)=>{})
    this.renderGraphics = props.renderGraphics ;

    this.afterEffects = props.afterEffects || ((canvas)=>{})
    

    //*Debug
    this.showFps = props.showFps || false;
    this.animatingElapsed = 0;
    this.renderingElapsed = 0;

    this.setFps = (x) => { 
      const canvas = this.element.current;
      if(canvas == null){return;}
      this.fps = x; 
      this.stopEngine = (x == 0) && !this.stopEngine; 
      this.interval = Math.floor(1000 / x); 
      if (!this.stopEngine) 
        this.onResize({scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight,context:canvas.getContext("2d")}); 
    }
    window.setFps = this.setFps;
    window.setScale = (x) => { this.scale = x;
      const canvas = this.element.current;
      canvas.getContext("2d").scale(x,x);
      this.onResize({scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight,context:canvas.getContext("2d")}); 
    }
  }
  
  componentDidUpdate(){
    const resH = Math.floor(this.props.displayResolution.height * this.scale * window.devicePixelRatio);
    const resW = Math.floor(this.props.displayResolution.width * this.scale * window.devicePixelRatio);
    
    if(resH != this.resolutionHeight || resW != this.resolutionWidth){
      if(!this.engineKilled){
        const canvas = this.element.current;
        this.resolutionHeight = resH;
        this.resolutionWidth = resW;
        //set dimensions
        canvas.width = this.resolutionWidth;
        canvas.height = this.resolutionHeight;
        //set the reset function
        this.onResize({scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight,context:canvas.getContext("2d")});
      }
    } 
  }
  componentDidMount(){
    if (!this.mounted) { 
      this.mounted = true;
      //check if a CELGF was provided
      if(!this.props.CELGF){
        console.warn("a CELGF - Critical Error Log Graphic Interface, wasn't provided");
        console.warn("fallbacking to console output")
      }
      //set resolution
      this.resolutionHeight = Math.floor(this.props.displayResolution.height * this.scale *window.devicePixelRatio);
      this.resolutionWidth = Math.floor(this.props.displayResolution.width * this.scale *window.devicePixelRatio);
      //set dimensions
      document.getElementById(this.id).width = this.resolutionWidth;
      document.getElementById(this.id).height = this.resolutionHeight;

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
          window.rAFLastTime = window.performance.now();
        }
      });
      //set the every graphic object data
      this.onLoad({context:this.element.current.getContext("2d"),scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight});
      //call engine

      this.engine(this.loopId);

    }
  }
  // Engine starter
  engine(loopId) {
    if(loopId != this.loopId){
      return;
    }
    if(this.element == null){
      console.log("element reference error")
      this.element = React.createRef();
    }
    const canvas = this.element.current;
    if(canvas == null){
      console.log("canvas reference error")
      return;
    }
    var context = canvas.getContext("2d");

    var checkEvents = (fps) => {
      try {
        this.props.events(fps);
        animator(fps);
      } catch (error) {//!Kill engine
        this.stopEngine = true;
        this.engineKilled = true;
        console.error("Engine killed due a error in the events logic");
        console.error(error);
      }
    }

    var animator = (fps) => {
      //*ANIMATE
      try {
        const animateStartAt = performance.now();
        this.props.animateGraphics({context:context,scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight,fps:fps.maxCps});
        this.animatingElapsed = performance.now()-animateStartAt;
      } catch (error) {//!KILL ENGINE
        context.clearRect(0, 0, canvas.resolutionWidth, canvas.resolutionHeight);//cleanning window
        context.filter = 'none';
        context.globalAlpha = 1;
        context.beginPath();
        context.fillStyle = "orange";
        context.font = (12*this.scale)+"px Terminal";
        context.fillText("Engine Killed due fatal error during animating process in line: "+error.lineNumber, 5, 15*this.scale);
        context.fillText("-error message:", 5, 35*this.scale);
        context.fillText("  "+error, 5, 50*this.scale);
        context.fillText("-function executed when the engine crashed:", 5, 70*this.scale);
        context.fillText("=============================================================================================================================",
                        5, 85*this.scale);
        const funcCode = error.stack.toString().split("\n");
        funcCode.forEach((codeLine,index) => {
          context.fillText(codeLine, 5, (100*this.scale)+(15*index));
        });
        context.fillText("============================================================================================================================", 
                        5, (100*this.scale)+(funcCode.length*15));
        context.closePath();
        context.fill();
        this.stopEngine = true;
        this.engineKilled = true;
        console.error("Engine Killed due fatal error during animating process process",error);
        return;
      }
      //*RENDER
      try {
        // this.halfCycle = !this.halfCycle;
        // if(this.halfCycle && this.windowHasFocus){
        if(this.windowHasFocus){
          renderer(fps);
          this.fpsCounter++;
        }
      }catch (error) {//!KILL ENGINE
        context.clearRect(0, 0, canvas.resolutionWidth, canvas.resolutionHeight);//cleanning window
        context.filter = 'none';
        context.globalAlpha = 1;
        context.beginPath();
        context.fillStyle = "white";
        context.font = (12*this.scale)+"px Terminal";
        context.fillText("Engine Killed due fatal error during rendering process in line: "+error.lineNumber, 5, 15*this.scale);
        context.fillText("-error message:", 5, 35*this.scale);
        context.fillText("  "+error, 5, 50*this.scale);
        context.fillText("-function executed when the engine crashed:", 5, 70*this.scale);
        context.fillText("=============================================================================================================================", 5, 85*this.scale);
        const funcCode = error.stack.toString().split("\n");
        funcCode.forEach((codeLine,index) => {
          context.fillText(codeLine, 5, (100*this.scale)+(15*index));
        });
        context.fillText("=============================================================================================================================", 5, (100*this.scale)+(funcCode.length*15));
        context.closePath();
        context.fill();
        this.stopEngine = true;
        this.engineKilled = true;
        console.error("Engine Killed due fatal error during rendering process");
        console.log(error);
      }
    }
    var renderer = (fps) => {

      context.filter = 'none';
      
      const renderingStartAt = performance.now();
      const [orderingTime,infoAdjudicationTime,drawingTime,debugTime,objectsToRender,dimsTimers] = this.renderGraphics({object:this,context:context,scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight,fps:fps});
      this.renderingElapsed = performance.now()-renderingStartAt;

      const actualGlobalAlpha = context.globalAlpha;

      if(this.showFps){
        context.globalCompositeOperation = "darker";
        context.filter = 'none';
        context.globalAlpha = 1;
        context.beginPath();
        context.fillStyle = "orange";
        context.font = (12*this.scale)+"px Terminal";
        context.fillText("CPS: "+fps.promedio.cps + "/ FPS: "+fps.promedio.fps, 5, 15*this.scale);
        context.fillText("Interval: "+fps.elapsed.toFixed(4), 5, 30*this.scale);
        var mOrigin = this.renderEngine.mouse.origin;
        if(mOrigin != null){
          if(!(mOrigin in this.renderEngine.dimentionsPack)){
            this.renderEngine.mouse.origin = null;
            console.log("that mouse origin don't exists anymore: "+mOrigin);
            mOrigin = null;
          }
        }
        var mouse = {
          x : mOrigin == null ? this.renderEngine.mouse.x : this.renderEngine.mouse.x - this.renderEngine.dimentionsPack[mOrigin].x/this.resolutionHeight,
          y : mOrigin == null ? this.renderEngine.mouse.y : this.renderEngine.mouse.y - (this.renderEngine.dimentionsPack[mOrigin].y/this.resolutionHeight),
        };
        context.fillText("Mouse: x:"+mouse.x.toFixed(2)+" ,y:"+mouse.y.toFixed(2)+" ,origin:"+mOrigin, 5, 45*this.scale);
        context.fillText("Res: "+this.resolutionWidth+"x"+this.resolutionHeight, 5, 60*this.scale);
        context.fillText("scale: "+this.scale+" : "+(Math.floor(window.devicePixelRatio*100)/100), 5, 75*this.scale);
        context.fillText("Keys: "+this.renderEngine.pressedKeys.join(" "),5,90*this.scale);
        context.fillText("GPU: "+(this.renderingElapsed).toFixed(2) + "ms" ,5,105*this.scale);
        context.fillText("CPU: "+(this.animatingElapsed).toFixed(2) + "ms" ,5,120*this.scale);
        context.fillText("cycle:"+(this.renderingElapsed+this.animatingElapsed).toFixed(2) + "ms" ,5,135*this.scale);
        context.fillText("OrdeGrap: "+(orderingTime.map((d)=>{return d.toFixed(2)})) + "ms" ,5,150*this.scale);
        context.fillText("AdjuTime: "+(infoAdjudicationTime).toFixed(2) + "ms" ,5,165*this.scale);
        context.fillText("DrawTime: "+(drawingTime).toFixed(2) + "ms" ,5,180*this.scale);
        context.fillText("DebuTime: "+(debugTime).toFixed(2) + "ms" ,5,195*this.scale);
        context.fillText(dimsTimers ,5,210*this.scale);

        context.fillText("Objects: "+ objectsToRender ,5,275*this.scale);
        context.closePath();
        context.fill();
        context.globalAlpha = actualGlobalAlpha;
        context.globalCompositeOperation = "source-over";
      }
      if(this.props.debugMessage){
        var debug = this.props.debugMessage
        if(typeof debug == "string" || typeof debug == "function"){
          debug = [debug]
        }
        context.globalCompositeOperation = "darker";
        context.filter = 'none';
        context.globalAlpha = 1;
        context.beginPath();
        context.fillStyle = "orange";
        context.font = (12*this.scale)+"px Terminal";
        debug.forEach((t,i)=>{
          if(typeof t == "function"){
            t = t()
          }
          context.fillText(t, 5, 15*(i+1)*this.scale);
        })
        context.closePath();
        context.fill();
        context.globalAlpha = actualGlobalAlpha;
        context.globalCompositeOperation = "source-over";
      }
    }
    var promedio = {cps:this.fps,fps:this.fps};
    var drawnFrames = 0, startTimer = window.performance.now(),maxCps = 0;
    var draw = (elapsed,lId) => {          
      const operativeTimeStartedAt = performance.now();
      if(this.stopEngine){
        this.engineThreads--;
        return;
      }
      if(this.engineThreads >1)
        return;
      

      drawnFrames++;

      if(performance.now()-startTimer >1000){
        maxCps=drawnFrames-1;
        startTimer = window.performance.now();
        drawnFrames=1;
        promedio.fps = this.fpsCounter;
        promedio.cps = maxCps;
        this.fpsCounter = 0;
      }

      checkEvents({promedio:promedio,elapsed:elapsed});

      if(lId == this.loopId){
        rAF.modelThree(draw,(1000 / this.fps),operativeTimeStartedAt,lId);
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
export {Canvas}