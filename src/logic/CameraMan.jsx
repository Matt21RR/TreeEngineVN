import { Sine } from "gsap";
import gsap from "gsap";
import React from "react";
import { scrollTo } from "./scroll";
var ease = require("ease-component"); 
class Parallax{
  static parallaxElements = new Array();//for custom displacement
  static getElementDisplacementConstant(xCameraSpeed,yCameraSpeed,element){
    
  }
  static getElementFinalPosition(xCameraSpeed,yCameraSpeed){

  }
  static run(){

  }
}
class CameraMan{
  static cinematicEndFun = null;
  static cameraReference = document.getElementById("camera");//for movement
  static scaleCasterReference = document.getElementById("scaleCaster");//for zoom, re-scale
  static followInstruction(instruction){
    if(!("top" in instruction || "left" in instruction)){//gsap scale,gsap.to have a delay prop(I guess)
      gsap.to(this.scaleCasterReference,instruction.duration,Object.assign(instruction));
    }else{//camera movement
      gsap.delayedCall(instruction.delay,()=>{ 
        scrollTo(this.cameraReference, instruction ).then((e)=>{
          if("onComplete" in instruction){
            instruction.onComplete();//is a function
          }
        });
      });
    }
  }
  static run(instructions = new Array(),cinematicEnd = null,cameraRef = null){
    if(cinematicEnd != null){
      this.cinematicEndFun = cinematicEnd;
    }
    if(cameraRef != null){
      this.cameraReference = cameraRef;
      this.scaleCasterReference = cameraRef.childNodes[0];
    }
    var newInstruction = new Object();
    instructions.forEach(instruction => {
      newInstruction = new Object();
      //each instruction need to run at same time example: increase the zoom camera while moving camera to bottom and left
      //1- Inject the non setted options(zoom:1, delay:0[sec],duration:0[sec],ease:"")
      newInstruction = {
        duration:"duration" in instruction?instruction.duration * (("top" in instruction || "left" in instruction)?1000:1):0,
        delay:"delay" in instruction?instruction.delay:0,
        ["movement" in instruction?"behavior":""]:"movement" in instruction?instruction.movement:"instant",//smooth or instant

        ["top" in instruction?"top":
              ("left" in instruction?"left":"")
        ]:instruction["top" in instruction?"top":
                        ("left" in instruction?"left":"")
                      ],
        
      };
      if("top" in newInstruction){
        if (typeof newInstruction.top == "string"){
          newInstruction.top = newInstruction.top.replace("%","");
          newInstruction.top = (this.cameraReference.scrollTopMax/100) * (newInstruction.top*1);
        }
      }
      if("left" in newInstruction){
        if (typeof newInstruction.left == "string"){
          newInstruction.left = newInstruction.left.replace("%","");
          newInstruction.left = (this.cameraReference.scrollLeftMax/100) * (newInstruction.left*1);
        }
      }
      if("ease" in instruction){
        var easingFunction = null;
        var easingFunctionName = instruction.ease.split(".")[1];
        if(instruction.ease.indexOf("Sine") != -1){
          // console.log(Sine[easingFunctionName]);
          easingFunction = Sine[easingFunctionName];
        }
        newInstruction = Object.assign(newInstruction,{
          ["zoom" in instruction ? "ease" : "easing"]:easingFunction,
        });
        
      }
      if("zoom" in instruction){
        newInstruction = Object.assign(newInstruction,{width:(instruction.zoom*100)+"%",height:(instruction.zoom*100)+"%"});
        
        // newInstruction = Object.assign(newInstruction,{scale:instruction.zoom});
      }
      if("onComplete" in instruction){
        if(Array.isArray(instruction.onComplete)){
          newInstruction = Object.assign(newInstruction,{onComplete:()=>{this.run(instruction.onComplete)}});
        }
        else if(typeof instruction.onComplete === "object"){
          newInstruction = Object.assign(newInstruction,{onComplete:()=>{this.run([instruction.onComplete])}});
        }
      }
      if("cinematicEnd" in instruction){
        newInstruction = Object.assign(newInstruction,{onComplete:()=>{this.cinematicEndFun()}});
      }
      //and foreach prop tha isnt in a list
      const commonPropsList = ["zoom","onComplete","movement","duration","delay","ease","top","left"];
      Object.keys(instruction).forEach(prop => {
        if( commonPropsList.indexOf(prop) == -1){
          newInstruction = Object.assign(newInstruction,{[prop]:instruction[prop]});
        }
      });
      this.followInstruction(newInstruction);
    });
  }
}
export {CameraMan}