import React from "react";
import $ from "jquery";
import { rAF } from "../logic/rAF";
import { canvasInstances } from "../logic/canvasInstaces";

class Canvas extends React.Component{
  constructor(props){
    super(props);
    this.CELGF = this.props.CELGF != undefined ? this.props.CELGF : (error)=>console.error(error);
    this.id = "canvas"+performance.now();
    this.mounted = false;

    this.static = this.props.static ? this.props.static : false;
    this.fps = this.props.fps ? (this.props.fps > 0 ? this.props.fps : 24) : 24;//suggesed max fps = 24
    this.scale = this.props.scale ? this.props.scale : 1;//suggested scale for animated canvas = 0.55 | static canvas = 1

    this.interval = Math.round(1000 / this.fps);

    this.resolutionHeight = Math.floor(window.innerHeight * this.scale *window.devicePixelRatio);
    this.resolutionWidth = Math.floor(window.innerWidth * this.scale *window.devicePixelRatio); 

    this.element = React.createRef();

    this.stopEngine = false;
    this.resizeTimeout = 0; 
    this.engineThreads = 0;
    this.engineKilled = false;

    this.onLoad = this.props.onLoad ? this.props.onLoad : (canvas)=>{}//Do something after the canvas params have been set
    this.onResize = this.props.onResize ? this.props.onResize : (canvas)=>{}//Do something after the canvas have been resized
    this.animateGraphics = this.props.animateGraphics ? this.props.animateGraphics : (canvas)=>{}
    this.renderGraphics = this.props.renderGraphics ? this.props.renderGraphics : (canvas,fps)=>{
      canvas.context.clearRect(0, 0, canvas.resolutionWidth, canvas.resolutionHeight);//cleanning window
      canvas.context.beginPath();
      canvas.context.fillStyle = "orange";
      canvas.context.font = (12*this.scale)+"px Verdana";
      canvas.context.fillText("FpsAdjustValue: "+fps.fpsAdjustValue, 5, 30*this.scale);
      canvas.context.fillText("AverageFps(Last 5 seconds): "+fps.promedio, 5, 45*this.scale);
      canvas.context.fillText("Interval: "+fps.elapsed, 5, 60*this.scale);
      canvas.context.fillText("Threads: "+this.engineThreads, 5, 75*this.scale);
      canvas.context.fillText("Resolution: "+this.resolutionWidth+"x"+this.resolutionHeight, 5, 90*this.scale);
      canvas.context.fillText("scale: "+this.scale, 5, 105*this.scale);
      canvas.context.closePath();
      canvas.context.fill();
    }

    this.afterEffects = this.props.afterEffects ? this.props.afterEffects : (canvas)=>{}
    

    //*Debug
    this.debug = false;
    this.showFps = this.props.showFps;

    window.setFps = (x) => { 
      this.fps = x; 
      this.stopEngine = (x == 0) && !this.stopEngine; 
      this.interval = Math.floor(1000 / x); 
      if (!this.stopEngine) 
        this.onResize({scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight}); 
    }
    window.getFps = () => {return this.fps;}
    window.setScale = (x) => { this.scale = x;
      const canvas = this.element.current;
      canvas.getContext("2d").scale(x,x);
      this.onResize({scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight,context:canvas.getContext("2d")}); 
    }
    window.setDebug = (x) => { this.debug = x; }
    window.setShowFps = (x) => { this.showFps = x; }
  }
  
  componentDidUpdate(){
    const resH = Math.floor(this.props.displayResolution.height * this.scale * window.devicePixelRatio);
    const resW = Math.floor(this.props.displayResolution.width * this.scale * window.devicePixelRatio);
    
    if(resH != this.resolutionHeight || resW != this.resolutionWidth){
      window.finalWarn = 0;
      if(!this.engineKilled && canvasInstances.checker(this.props.id,this.id)){
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
      if(this.props.CELGF == undefined){
        console.warn("a CELGF - Critical Error Log Graphic Interface, wasn't provided");
        console.warn("fallbacking to console output")
      }

      //Check if a hardcoded id was asigned
      if(this.props.id == undefined){
        this.CELGF("Critical error");
        this.CELGF("hardcoded id wasn't provided");
        return;
      }
      canvasInstances.loader(this.props.id,this.id);
      //set resolution
      this.resolutionHeight = Math.floor(this.props.displayResolution.height * this.scale *window.devicePixelRatio);
      this.resolutionWidth = Math.floor(this.props.displayResolution.width * this.scale *window.devicePixelRatio);
      //set dimensions
      document.getElementById(this.id).width = this.resolutionWidth;
      document.getElementById(this.id).height = this.resolutionHeight;

      let self = this;
      $(window).on("blur", function (e) {
        if(!self.engineKilled){
          self.stopEngine = true;
        }
      });
      $(window).on("focus", function (e) {
        if(!self.engineKilled && canvasInstances.checker(self.props.id,self.id)){
          self.stopEngine = true;
          window.finalWarn = 0;
          setTimeout(() => {
              self.stopEngine = false;
              if(self.engineThreads != 0)
                self.engineThreads = 0;
              self.engine();
          }, 200);
        }
      });
      //set the every graphic object data
      this.onLoad({context:this.element.current.getContext("2d"),scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight});
      //call engine
      this.engine();

    }
  }
  engine() {
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
        this.props.events({context:context,scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight,fps:fps});
        animator(fps);
      } catch (error) {//!Kill engine
        this.stopEngine = true;
        this.engineKilled = true;
        console.error("Engine killed due a error in the events logic");
        console.error(error.stack);
      }
    }

    var animator = (fps) => {
      //*ANIMATE
      try {
        this.props.animateGraphics({context:context,scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight,fps:fps.maxFps});
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
        renderer(fps);
      } catch (error) {//!KILL ENGINE
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

      this.renderGraphics({object:this,context:context,scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight,fps:fps});

      const actualGlobalAlpha = context.globalAlpha;

      this.afterEffects({context:context,scale:this.scale,resolutionWidth:this.resolutionWidth,resolutionHeight:this.resolutionHeight,fps:fps});

      if(this.showFps){
        context.filter = 'none';
        context.globalAlpha = 1;
        context.beginPath();
        context.fillStyle = "orange";
        context.font = (12*this.scale)+"px Terminal";
        context.fillText("Redengine v0.0.0", 5, 15*this.scale);
        context.fillText("Fps: "+fps.promedio, 5, 30*this.scale);
        context.fillText("Interval: "+fps.elapsed.toFixed(4), 5, 45*this.scale);
        context.fillText("Threads: "+this.engineThreads, 5, 60*this.scale);
        context.fillText("Res: "+this.resolutionWidth+"x"+this.resolutionHeight, 5, 75*this.scale);
        context.fillText("scale: "+this.scale+" : "+(Math.floor(window.devicePixelRatio*100)/100), 5, 90*this.scale);
        context.closePath();
        context.fill();
        context.globalAlpha = actualGlobalAlpha;
      }
    }
    var then = performance.now();
    var fpsArray = [], fpsAdjustValue = 1.01,promedio = this.fps;
    var drawnFrames = 0, startTimer = 0, now,maxFps = 0;
    var draw = (newtime) => {
      if(!canvasInstances.checker(this.props.id,this.id)){
        this.CELGF("Multicalling to draw detected");
        this.CELGF("killing engine recall");
        return;
      }            
      if(this.stopEngine){
        this.engineThreads--;
        return;
      }
      if(this.engineThreads >1)
        return;
      if(fpsAdjustValue>2){
        fpsArray = []; fpsAdjustValue = 1;promedio = this.fps;
        drawnFrames = 0; startTimer = 0; maxFps = 0;
      }
      rAF.modelTwo(draw,this.interval);
      
      now = newtime;

      const elapsed = newtime - then;
      if(this.fps == 60){
        //!! in 60fps mode this shit don't check the events?
        animator({maxFps:maxFps,fpsAdjustValue:fpsAdjustValue.toFixed(4),promedio:promedio,elapsed:elapsed});
        return;
      }

      if (elapsed >= this.interval/fpsAdjustValue) {
        drawnFrames++;
        then = now - elapsed * (fpsAdjustValue-1.0001568);
        startTimer += elapsed;
        if(startTimer >1000){
          maxFps=drawnFrames-1;
          startTimer=0;
          drawnFrames=1;
          fpsArray.push(maxFps);
          if(fpsArray.length>5){
            fpsArray.shift();
            promedio = 0;
            fpsArray.forEach(element => {
              promedio +=element;
            });
            promedio/=5;
          }
        }
        checkEvents({maxFps:maxFps,fpsAdjustValue:fpsAdjustValue.toFixed(4),promedio:promedio,elapsed:elapsed});
      }
    }

    try {
      this.engineThreads++;
      console.warn("Re-executing set timeout",this.engineThreads);     
      draw();
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