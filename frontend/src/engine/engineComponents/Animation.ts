import { Dictionary } from "../../global.ts";
import { ExtendedObjects } from "../logic/ExtendedObjects.ts";
import { RenderEngine } from "../renderCore/RenderEngine.tsx";
import GraphObject from "./GraphObject.ts";

import * as ease from "ease-component";


class Animation{
  #id:string
  #relatedTo:string
  #ease:Function
  #done:boolean
  #loops:number
  #reverse:number
  #reversing:boolean
  #looped:number
  #infinite:boolean
  #loopback:boolean
  #duration:number
  #elapsed:number
  #tElapsed:number
  #enabled:boolean
  #pendingTimersFix:boolean
  #startedAt:number
  #dStartedAt: number
  #delay: number
  #to: Dictionary
  #toKeys: Array<string>
  #from: Dictionary
  #onComplete: Function|null

  #keyframes:  Dictionary
  #timestamps: Array<number>
  #actualKeyFrameNumber:number
  #timeline

  constructor(aInfo: Dictionary){
    this.#id = aInfo.id;
    this.#relatedTo = aInfo.relatedTo; //the gO related to the animation
    this.#ease = aInfo.ease ? ease[aInfo.ease] : ease["linear"];
    this.#done = aInfo.done ?? false;
    this.#loops = "loops" in aInfo ? aInfo.loops*(aInfo.loopback?2:1) : 1;//by default 1 loop
    this.#reverse = "reverse" in aInfo ? 1 : 0;//if the animation are played in reverse
    this.#reversing = "reverse" in aInfo;//control Var
    this.#looped = 1;
    this.#infinite = aInfo.infinite || false;//infinite looping
    this.#loopback = "loopback" in aInfo ? true : false;//repeat the animation in reverse after end
    this.#duration = aInfo.duration || 0;
    this.#elapsed = 0;
    this.#tElapsed = 0;//total time elapsed
    this.#enabled = aInfo.enabled || false;
    this.#pendingTimersFix = false;
    this.#startedAt = NaN;
    this.#dStartedAt = NaN;
    this.#delay = aInfo.delay || NaN;
    this.#to = {};
    this.#toKeys = [];
    this.#onComplete = aInfo.onComplete || null;
    
    this.#keyframes = aInfo.keyframes || {};
    this.#timestamps = Object.keys(this.#keyframes).map(e=>parseFloat(e));
    this.#actualKeyFrameNumber =  -1;
    this.#timeline = [];//controla los tiempos de cada frame de forma independiente
  }

  print() {
    const output = `Animation {
      id: ${this.#id},
      relatedTo: ${this.#relatedTo},
      ease: ${this.#ease},
      done: ${this.#done},
      loops: ${this.#loops},
      reverse: ${this.#reverse},
      reversing: ${this.#reversing},
      looped: ${this.#looped},
      infinite: ${this.#infinite},
      loopback: ${this.#loopback},
      duration: ${this.#duration},
      elapsed: ${this.#elapsed},
      tElapsed: ${this.#tElapsed},
      enabled: ${this.#enabled},
      pendingTimersFix: ${this.#pendingTimersFix},
      startedAt: ${this.#startedAt},
      dStartedAt: ${this.#dStartedAt},
      delay: ${this.#delay},
      to: ${JSON.stringify(this.#to)},
      from: ${JSON.stringify(this.#from)},
      onComplete: ${this.#onComplete},
      keyframes: ${JSON.stringify(this.#keyframes)},
      keyFrameNumber: ${this.#actualKeyFrameNumber},
      timeline: ${JSON.stringify(this.#timeline)}
    }`;
    console.log(output);
  }

  get id (){return this.#id;}
  
  get relatedTo(){return this.#relatedTo;}
  set relatedTo(x){this.#relatedTo = x;}
  
  get ease() {return this.#ease;}
  set ease(x) {
    if(typeof x == "function"){
      this.#ease = x;
    }else if(typeof x == "string"){
      if(x in ease){
        this.#ease = ease[x];
      }else{
        throw new Error("The ease function: "+x+" Dont exists");
      }
    }
  }
  
  get done () {return this.#done;}
  set done (x) {this.#done = x;}

  get loops () {return this.#loops;}
  set loops (x) {
    if(!isNaN(x)){
      x = x>=0? x:0;
    }else{
      throw new Error ("Un-understandable value for 'loops' property: "+x);
    }
  }

  get infinite (){return this.#infinite;}
  set infinite (x) {this.#infinite = x;}

  get duration () {return this.#duration;}
  set duration (x) {this.#duration = x;}

  get elapsed() {return this.#elapsed;}
  set elapsed(x) {this.#elapsed = x;}

  get enabled () {return this.#enabled;}
  set enabled (x) {
    //if the value are different and x=true, the startedAt, dStartedAt must be changed
    if(this.#enabled != x){
      this.#enabled = x;
    }
  }

  get to () {return this.#to;}
  set to (x) {this.#to = x;}

  get delay () {return this.#delay;}
  set delay (x) {this.#delay = x;}

  get framesCount (){return this.#timestamps.length;}


  updateState(engineTime:number,engine:RenderEngine){//engine time
    const gObject = this.#relatedTo != "engineCamera" ? 
      engine.getObject(this.#relatedTo):
      engine.camera;

    if(this.#enabled && !this.#done){
      if(this.#delay > 0){
        this.updateDelay(engineTime);
      }else{
        this.updateAnimation(gObject,engineTime,engine);
      }
      return false;
    }else{
      return true;
    }
  }

  private updateDelay (delay: number) {
    if(isNaN(this.#dStartedAt)){
      this.#dStartedAt = delay;
      return;
    }
    if(this.#pendingTimersFix){
      this.#dStartedAt = delay-this.#delay;
      this.#pendingTimersFix = false;
    }
    const dO = delay;
    delay -= this.#dStartedAt;
    this.#delay -=delay;
    this.#dStartedAt = dO;
  }

    private runOnCompleteAnimation(engine: RenderEngine){
    if(typeof this.#onComplete == "function"){//add onComplete per keyframe
      try {
        this.#onComplete(engine);
      } catch (error) {
        console.log("Error on onComplete:",error,this.#onComplete)
      }
    }
  }

  private runOnCompleteKeyframe(engine:RenderEngine){
    if(typeof this.#to.onComplete == "function"){//add onComplete per keyframe
      try {
        this.#to.onComplete(engine);
      } catch (error) {
        console.log("Error on onComplete:",error,this.#to.onComplete);
      }
    }
  }

  private setKeyFrame(frameNumber:number){
    const keyOfTheKeyFrame:number = this.#timestamps[frameNumber];
    this.#to = this.#keyframes[keyOfTheKeyFrame];
    //TODO: set the keys of the keyframe attributes here instead of request it in the basicAttributesSetter
    this.#actualKeyFrameNumber = frameNumber;
    this.#duration = keyOfTheKeyFrame - (frameNumber == 0 ? 0 : this.#timestamps[frameNumber-1]);
  }

  //forced = false; no keyframes
  private setAnimationVars(gObject: GraphObject|Dictionary, elapsed: number, forced = false){
    if(isNaN(this.#startedAt) || forced){
      //Esta instanciacion se debe de realizar justo antes de iniciar la animacion
      let gOD: Dictionary;

      //Si se trata de la camara
      if(gObject.id == "engineCamera"){
        gOD = ExtendedObjects.buildObjectsWithRoutes(gObject);
        this.#to = ExtendedObjects.buildObjectsWithRoutes(this.#to);
      }else{
        gOD = (gObject as GraphObject).dump();
      }

      this.#toKeys = Object.keys(this.#to);

      this.#from =  gOD;//estado inicial del objeto
      
      //ajustar el tiempo de inicio de la animacion,solo cuando no se trate de una animacion con varios keyframes
      if(!forced)
        this.#startedAt = elapsed;
    }
  }

  private basicAttributesSetter(gObject:GraphObject|Dictionary, proportion: number){
    // console.log(this.#id, this.#to, this.#from, proportion);
    this.#toKeys.forEach(toKey =>{
      if(toKey != "onComplete"){
        const newValue = this.#from[toKey] + (this.#to[toKey] - this.#from[toKey])*proportion;
        // console.log(newValue);
        if(gObject.id == "engineCamera"){
          ExtendedObjects.setValueWithRoute(toKey,gObject,newValue);
        }else{
          gObject[toKey] = newValue;
        }
      }
    });
  }

  private instantaneousAttributeSetter(gObject:GraphObject|Dictionary,elapsed:number,engine:RenderEngine){
    console.warn("animacion de tipo instantanea");
    this.basicAttributesSetter(gObject,1);
    if(this.#timestamps.length != 0 && this.#actualKeyFrameNumber <(this.#timestamps.length-1)){
      //?onComplete
      this.runOnCompleteKeyframe(engine);
      this.setKeyFrame(this.#actualKeyFrameNumber+1);
      this.setAnimationVars(gObject ,elapsed, true);
    }else{
      this.#done = true;
    }

    this.#pendingTimersFix = true;

    this.runOnCompleteKeyframe(engine);
  }

  private updateAnimation (gObject:GraphObject|Dictionary,elapsed:number,engine:RenderEngine) {
    // console.log(this.#actualKeyFrameNumber, this.#duration == 0);
    const engineTime = elapsed;

    //TODO: this stupid shit isnt checking if the second parameter of the creation are a timestamps dictionary or a changes dictionary,
    //TODO: it's just specting that a "to" parameter is suministered via the Animation parameters if there is no a timestamp (and that case is imposible)

    if(this.#timestamps.length > 0){
      if(this.#actualKeyFrameNumber == -1){ //Default value
        this.setKeyFrame(0);
        // if(this.#timestamps.length == 1){ //? Check this shit
          this.setAnimationVars(gObject ,elapsed);
        // }
      }
    }
    
    //*NO KEYFRAMES=============================================================
    if(this.#timestamps.length == 0){
      this.setAnimationVars(gObject ,elapsed);
    }
    if(this.#pendingTimersFix){
      this.#startedAt = elapsed-(this.#tElapsed%this.#duration);
      this.#pendingTimersFix = false;
    }
    elapsed-=this.#startedAt;

    //? Aqui adelante hay un problema de logica con las animaciones instantaneas
    //? Con respecto a la ejecucion de las funciones onComplete a nivel de animación (no de keyframe)
    if(!this.#done && this.#duration == 0){//Si es una animacion instantanea
      this.instantaneousAttributeSetter(gObject,elapsed,engine);
      //?Que pasaría en el caso de que el ultimo keyframe sea una animación instantanea?
      //*No se esta ejecutando el onComplete a nivel de Animacion en ese caso
      return;

    }else if(!this.#done){//Si no se ha terminado de animar / llegar al proximo keyframe

      this.#tElapsed += elapsed-this.#elapsed;
      this.#elapsed += elapsed-this.#elapsed;

      const progress = this.#reversing ? 1-(this.#elapsed/this.#duration):(this.#elapsed/this.#duration);

      if(progress < 1 || (this.#reversing && (progress>0))){
        const easingConstant = this.#ease(progress);//easing constant
        this.basicAttributesSetter(gObject,easingConstant);
      }else if(progress >= 1 || (this.#reversing && (progress <= 0))){
        this.basicAttributesSetter(gObject, this.#reversing ? 0 : 1);
        //si no se han hecho todos los loops o está en loop infinito
        if(this.#looped < this.#loops || this.#infinite){
          this.runOnCompleteKeyframe(engine);
          if(this.#timestamps.length != 0 && this.#actualKeyFrameNumber < (this.#timestamps.length-1)){
            //?onComplete
            this.setKeyFrame(this.#actualKeyFrameNumber+1);
            this.setAnimationVars(gObject ,elapsed, true);

          }else{
            // console.warn("restarting");
            if(this.#timestamps.length > 0){
              this.setKeyFrame(0);
              this.setAnimationVars(gObject ,elapsed, true);
            }
            this.#looped++;
            if(this.#loopback)//Loopback wasn't tested with loopback
              this.#reversing = !this.#reversing;
          }

          //reset timers
          this.#startedAt = engineTime;
          this.#tElapsed = 0;
          this.#elapsed = 0;

        }else{
          if(this.#timestamps.length != 0 && this.#actualKeyFrameNumber < (this.#timestamps.length-1)){
            this.#startedAt = engineTime;
            this.#elapsed = 0;
            //?onComplete
            this.runOnCompleteKeyframe(engine);
            this.setKeyFrame(this.#actualKeyFrameNumber+1);
            this.setAnimationVars(gObject ,elapsed, true);
          }else{
            this.#done = true;
            this.#startedAt = NaN;
            this.#tElapsed = 0;
            this.#looped = 1;
            this.#reversing = Math.round(this.#reverse) == 1;
            this.runOnCompleteKeyframe(engine);
            this.runOnCompleteAnimation(engine)
            return;
          }
        }
      }
    }
  }

}

export {Animation}