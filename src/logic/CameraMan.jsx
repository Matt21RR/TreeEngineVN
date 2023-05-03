import { Sine } from "gsap";
import gsap from "gsap";
import React from "react";
import { scrollTo } from "./scroll";
var ease = require("ease-component");
class Parallax {
  
  static ogELements = new Array();//array of htmlElements
  static layersZpos = new Array();
  static elementsComputedPercentageSize = new Array();//for custom displacement
  static displayDigitalRepresentationZ = 0;//point-Z where display digital represetation are
  static userPerspectiveAngle = 90;
  static setDisplayDigitalRepresentationZ(number) {
    this.displayDigitalRepresentationZ = number
  }
  static setUserPerspectiveAngle(number) {
    this.userPerspectiveAngle = number;
  }
  static setScreenElements() {
    this.ogElements = [].concat(
      Array.from(document.getElementsByClassName("fondo")),
      Array.from(document.getElementsByClassName("character")),
      Array.from(document.getElementsByClassName("capaSuperior")));
    for (let index = 0; index < this.ogElements.length; index++) {
      const layerZpos = this.ogElements[index].getAttribute("layerzpos");
      this.layersZpos.push(layerZpos != null && layerZpos != "null" ? layerZpos.replace(/\D/g,'') : null);
    }
  }
  static calcParallaxElementsSize() {
    const clientHeight = document.getElementById("camera").clientHeight;
    this.elementsComputedPercentageSize = {};
    const clientUnitaryHeightPercentageConstant = 100 / clientHeight;
    const algoPerspectiveAngle = (this.userPerspectiveAngle / 2) * (Math.PI / 180);
    const tangencialConstant = Math.tan(algoPerspectiveAngle) * 2;
    this.layersZpos.forEach(layerZpos => {
      if(layerZpos != null){
        const perspectiveDiff = this.displayDigitalRepresentationZ - layerZpos;
        const toAddSize = perspectiveDiff * tangencialConstant;
        const computedPercentageSize = clientUnitaryHeightPercentageConstant * (clientHeight + toAddSize);
        this.elementsComputedPercentageSize.push(computedPercentageSize);
      }else{
        this.elementsComputedPercentageSize.push(100);
      }
    });
  }
  static setParallaxSize(){
    this.elementsComputedPercentageSize.forEach((newSize,index) => {
      this.ogELements[index].parentElement.style.width = newSize+"%";
      this.ogELements[index].parentElement.style.height = newSize+"%"; 
    });
  }
  static moveElements(movementInstruction){
    for (let index = 0; index < this.ogElements.length; index++) {
      if(this.layersZpos[index] != null){
        const parentElement = this.ogElements[index].parentElement.parentElement;
        scrollTo(parentElement, movementInstruction).then((e) => {
          console.log("Layer Movement done!!");
        });
      }
    }
  }
  static checkParallaxScene(){
    const elements = [].concat(
      Array.from(document.getElementsByClassName("fondo")),
      Array.from(document.getElementsByClassName("character")),
      Array.from(document.getElementsByClassName("capaSuperior")));
    for (let index = 0; index < elements.length; index++) {
      const layerZpos = elements[index].getAttribute("layerzpos");
      if(layerZpos != null && layerZpos != "null"){
        return true;
      }
    }
    return false
  }
  static run(_displayDigitalRepresentationZ,_userPerspectiveAngle,_movementInstruction) {
    this.setDisplayDigitalRepresentationZ(_displayDigitalRepresentationZ);
    this.setUserPerspectiveAngle(_userPerspectiveAngle);
    this.setScreenElements();
    this.calcParallaxElementsSize();
    this.setParallaxSize();
    //move the scroll of the father box

  }
}
class CameraMan {
  static cinematicEndFun = null;
  static cameraReference = document.getElementById("camera");//for movement
  static scaleCasterReference = document.getElementById("scaleCaster");//for zoom, re-scale
  static followInstruction(instruction) {
    if (!("top" in instruction || "left" in instruction)) {//gsap scale,gsap.to have a delay prop(I guess)
      gsap.to(this.scaleCasterReference, instruction.duration, Object.assign(instruction));
    } else {//camera movement
      gsap.delayedCall(instruction.delay, () => {
        if(Parallax.checkParallaxScene()){//parallax movement
          console.warn("The elements in this scene are parallaxables")
        }else{//simple camera with zoom movement
          scrollTo(this.cameraReference, instruction).then((e) => {
            if ("onComplete" in instruction) {
              instruction.onComplete();//is a function
            }
          });
        }
      });
    }
  }
  static run(instructions = new Array(), cinematicEnd = null, cameraRef = null) {
    //!Improvement for the future:Do both scroll movements at same time (top and left). It also could reduce the quantity of CameraMan instruction lines
    if (cinematicEnd != null) {
      this.cinematicEndFun = cinematicEnd;
    }
    if (cameraRef != null) {
      this.cameraReference = cameraRef;
      this.scaleCasterReference = cameraRef.childNodes[0];
    }
    var newInstruction = new Object();
    instructions.forEach(instruction => {
      newInstruction = new Object();
      //each instruction need to run at same time example: increase the zoom camera while moving camera to bottom and left
      //1- Inject the non setted options(zoom:1, delay:0[sec],duration:0[sec],ease:"")
      newInstruction = {
        duration: "duration" in instruction ? instruction.duration * (("top" in instruction || "left" in instruction) ? 1000 : 1) : 0,
        delay: "delay" in instruction ? instruction.delay : 0,
        ["movement" in instruction ? "behavior" : ""]: "movement" in instruction ? instruction.movement : "instant",//smooth or instant

        ["top" in instruction ? "top" :
          ("left" in instruction ? "left" : "")
        ]: instruction["top" in instruction ? "top" :
          ("left" in instruction ? "left" : "")
          ],

      };
      if ("top" in newInstruction) {
        if (typeof newInstruction.top == "string") {
          newInstruction.top = newInstruction.top.replace("%", "") * 1;
          newInstruction.top = ((this.cameraReference.scrollHeight - this.cameraReference.clientHeight) / 100) * (newInstruction.top * 1);
        }
      }
      if ("left" in newInstruction) {
        if (typeof newInstruction.left == "string") {
          newInstruction.left = newInstruction.left.replace("%", "") * 1;
          newInstruction.left = ((this.cameraReference.scrollWidth - this.cameraReference.clientWidth) / 100) * (newInstruction.left * 1);
        }
      }
      if ("ease" in instruction) {
        var easingFunction = null;
        var easingFunctionName = instruction.ease.split(".")[1];
        if (instruction.ease.indexOf("Sine") != -1) {
          // console.log(Sine[easingFunctionName]);
          easingFunction = Sine[easingFunctionName];
        }
        newInstruction = Object.assign(newInstruction, {
          ["zoom" in instruction ? "ease" : "easing"]: easingFunction,
        });

      }
      if ("zoom" in instruction) {
        newInstruction = Object.assign(newInstruction, { width: (instruction.zoom * 100) + "%", height: (instruction.zoom * 100) + "%" });

        // newInstruction = Object.assign(newInstruction,{scale:instruction.zoom});
      }
      if ("onComplete" in instruction) {
        if (Array.isArray(instruction.onComplete)) {
          newInstruction = Object.assign(newInstruction, { onComplete: () => { this.run(instruction.onComplete) } });
        }
        else if (typeof instruction.onComplete === "object") {
          newInstruction = Object.assign(newInstruction, { onComplete: () => { this.run([instruction.onComplete]) } });
        }
      }
      if ("cinematicEnd" in instruction) {
        newInstruction = Object.assign(newInstruction, { onComplete: () => { this.cinematicEndFun() } });
      }
      //and foreach prop tha isnt in a list
      const commonPropsList = ["zoom", "onComplete", "movement", "duration", "delay", "ease", "top", "left"];
      Object.keys(instruction).forEach(prop => {
        if (commonPropsList.indexOf(prop) == -1) {
          newInstruction = Object.assign(newInstruction, { [prop]: instruction[prop] });
        }
      });
      //console.warn("running camera instruction:");
      //console.log(newInstruction);
      //console.log("compiled from:");
      //console.log(instruction);
      this.followInstruction(newInstruction);
    });
  }
}
export { CameraMan }