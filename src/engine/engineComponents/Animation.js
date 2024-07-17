import { ExtendedObjects } from "../logic/ExtendedObjects";

var ease = require("ease-component"); 

class Animation{
  #id
  #relatedTo
  #ease
  #done
  #loops
  #reverse
  #reversing
  #looped
  #infinite
  #loopback
  #duration
  #elapsed
  #tElapsed
  #enabled
  #pendingTimersFix
  #startedAt
  #dStartedAt
  #delay
  #to
  #from
  #onComplete

  #keyframes
  #keyFrameNumber
  #timeline

  constructor(aInfo = new Object()){
    this.#id = "id" in aInfo ? aInfo.id : "undefined";
    this.#relatedTo = "relatedTo" in aInfo ? aInfo.relatedTo:null; //the gO related to the animation
    this.#ease = "ease" in aInfo ? aInfo.ease : "linear";
    this.#done = "done" in aInfo ? aInfo.done : false;
    this.#loops = "loops" in aInfo ? aInfo.loops*(aInfo.loopback?2:1) : 1;//by default 1 loop
    this.#reverse = "reverse" in aInfo ? 1 : 0;//if the animation are played in reverse
    this.#reversing = "reverse" in aInfo ? 1 : 0;//control Var
    this.#looped = 1;
    this.#infinite = "infinite" in aInfo ? aInfo.infinite : false;//infinite looping
    this.#loopback = "loopback" in aInfo ? 1 : 0;//repeat the animation in reverse after end
    this.#duration = "duration" in aInfo ? aInfo.duration : 0;
    this.#elapsed = 0;
    this.#tElapsed = 0;//total time elapsed
    this.#enabled = "enabled" in aInfo ? aInfo.enabled : false;
    this.#pendingTimersFix = false;
    this.#startedAt = NaN;
    this.#dStartedAt = NaN;
    this.#delay = "delay" in aInfo ? aInfo.delay : NaN;
    this.#to = "to" in aInfo ? aInfo.to : {};
    this.#onComplete = "onComplete" in aInfo ? aInfo.onComplete : null;
    
    this.#keyframes = "keyframes" in aInfo ? aInfo.keyframes : {};
    this.#keyFrameNumber =  -1;
    this.#timeline = [];//controla los tiempos de cada frame de forma independiente
  }
  get id (){return this.#id;}
  
  get relatedTo(){return this.#relatedTo;}
  set relatedTo(x){this.#relatedTo = x;}
  
    get ease() {return ease[this.#ease];}
    set ease(x) {
      if(typeof x == "function"){
        this.#ease = x;
      }else if(typeof x == "string"){
        if(Object.keys(ease).indexOf(x) != -1){
          this.#ease = ease[x];
        }else{
          throw new Error("The ease function: "+x+" Dont exists");
        }
      }
    }
  
  
    get done () {return this.#done;}
    set done (x) {this.#done = x;}

    get loops () {return this.#loops;}
    set loops (xa) {
      const x = parseInt(xa);
      if(!isNaN(x)){
        x = x>=0? x:0;
      }else{
        throw new Error ("Un-understandable value for 'loops' property: "+xa);
      }
    }

    get infinite (){return this.#infinite;}
    set infinite (x) {this.#infinite = x;}

    get duration () {return this.#duration;}
    set duration (x) {x = parseFloat(x);}
  
    get elapsed() {return this.#elapsed;}
    set elapsed(x) {this.#elapsed = parseFloat(x);}
  
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

    updateState(engineTime,gObjectFun,engine){//engine time
      if(this.#enabled && !this.#done){
        if(this.#delay > 0){
          this.updateDelay(engineTime);
        }else{
          var gObject = gObjectFun(this.#relatedTo);
          this.updateAnimation(gObject,engineTime,engine);
        }
        return false;
      }else{
        return true;
      }
    }
    updateDelay (delay) {
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
    updateAnimation (gObject,elapsed,engine) {
      const engineTime = elapsed;
      
      const executeOnCompleteKeyframe = () => {
        if(typeof this.#to.onComplete == "function"){//add onComplete per keyframe
          try {
            this.#to.onComplete(engine);
          } catch (error) {
            console.log("Error on onComplete:",error,this.#to.onComplete)
          }
        }
      }
      const setAnimationVars = (forced = false)=>{
        if(isNaN(this.#startedAt) || forced){
          //Esta instanciacion se debe de realizar justo antes de iniciar la animacion
          var gOD;

          //Si se trata de la camara
          if(gObject.id == "engineCamera"){
            gOD = ExtendedObjects.buildObjectsWithRoutes(gObject);
            this.#to = ExtendedObjects.buildObjectsWithRoutes(this.#to);
          }else{
            gOD = gObject.dump();
          }

          var f = new Object();
          Object.keys(this.#to).forEach(toKey=>{
            if(toKey != "onComplete")
              f[toKey] = gOD[toKey];
          });
          this.#from =  f;//estado inicial del objeto
          
          //console.log(this.#from,this.#to,this.#elapsed,this.#duration,this.#keyFrameNumber,this.#startedAt,this.#tElapsed);
          //ajustar el tiempo de inicio de la animacion,solo cuando no se trate de una animacion con varios keyframes
          if(!forced)
            this.#startedAt = elapsed;
          return;
        }
      }
      const setKeyFrame = (frameNumber)=>{
        const keyOfTheKeyFrame = Object.keys(this.#keyframes)[frameNumber];
        const frame = this.#keyframes[keyOfTheKeyFrame];
        this.#keyFrameNumber = frameNumber;
        this.#to = frame;
        this.#duration = frameNumber == 0 ? keyOfTheKeyFrame*1: (keyOfTheKeyFrame)*1 - (Object.keys(this.#keyframes)[frameNumber-1])*1;
      }

      if(Object.keys(this.#keyframes).length > 0){
        if(this.#keyFrameNumber == -1){
          setKeyFrame(0);
          if(Object.keys(this.#keyframes).length == 1){
            setAnimationVars();
          }
        }
      }
      
      //*NO KEYFRAMES=============================================================
      if(Object.keys(this.#keyframes).length == 0)
         setAnimationVars();
      if(this.#pendingTimersFix){
        this.#startedAt = elapsed-(this.#tElapsed%this.#duration);
        this.#pendingTimersFix = false;
      }
      elapsed-=this.#startedAt;

      if(!this.#done && this.#duration == 0){//Si es una animacion instantanea
        console.warn("animacion de tipo instantanea")
        const k = Object.keys(this.#to);
        k.forEach(toKey =>{
          if(toKey != "onComplete"){
            const newValue = this.#to[toKey];
            if(gObject.id == "engineCamera"){
              ExtendedObjects.setValueWithRoute(toKey,gObject,newValue);
            }else{
              gObject[toKey] = newValue;
            }
          }
        });
        if(Object.keys(this.#keyframes).length != 0 && this.#keyFrameNumber<(Object.keys(this.#keyframes).length-1)){
          //?onComplete
          executeOnCompleteKeyframe();
          setKeyFrame(this.#keyFrameNumber+1);
          setAnimationVars(true);
        }else{
          this.#done = true;
        }

        this.#pendingTimersFix = true;

        if(typeof this.#onComplete == "function" && Object.keys(this.#keyframes).length == 0){
          console.log(this.#keyframes);
          console.log(this.#onComplete);
          this.#onComplete(engine);
        }
          
        return;

      }else if(!this.#done){

        this.#tElapsed += elapsed-this.#elapsed;
        this.#elapsed += elapsed-this.#elapsed;

        const progress = this.#reversing ? this.#reversing-(this.#elapsed/this.#duration):(this.#elapsed/this.#duration);
        

        const eConstant = ease[this.#ease](progress);//easing constant

        const k = Object.keys(this.#to);//Para cada elemento a cambiar en el .to
        k.forEach(toKey =>{
          if(toKey != "onComplete"){
            const newValue = this.#from[toKey] + (this.#to[toKey] - this.#from[toKey])*eConstant;
            if(gObject.id == "engineCamera"){
              ExtendedObjects.setValueWithRoute(toKey,gObject,newValue);
            }else{
              gObject[toKey] = newValue;
            }
          }
        
        });

        if(progress >= 1 || (this.#reversing && (progress <= 0))){
          k.forEach(toKey =>{
            if(toKey != "onComplete"){
              const newValue = this.#from[toKey] + (this.#to[toKey] - this.#from[toKey])*(this.#reversing ? 0 : 1);
              if(gObject.id == "engineCamera"){
                ExtendedObjects.setValueWithRoute(toKey,gObject,newValue);
              }else{
                gObject[toKey] = newValue;
              }
            }
          });
          //si no se han hecho todos los loops o está en loop infinito
          if(this.#looped < this.#loops || this.#infinite){

            executeOnCompleteKeyframe();
            if(Object.keys(this.#keyframes).length != 0 && this.#keyFrameNumber < (Object.keys(this.#keyframes).length-1)){
              //?onComplete
              setKeyFrame(this.#keyFrameNumber+1);
              setAnimationVars(true);

            }else{
              // console.warn("restarting");
              if(Object.keys(this.#keyframes).length > 0){
                setKeyFrame(0);
                setAnimationVars(true);
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
            if(Object.keys(this.#keyframes).length != 0 && this.#keyFrameNumber<(Object.keys(this.#keyframes).length-1)){
              this.#startedAt = engineTime;
              this.#elapsed = 0;
              //?onComplete
              //console.warn("here");
              executeOnCompleteKeyframe();
              setKeyFrame(this.#keyFrameNumber+1);
              setAnimationVars(true);
            }else{
              this.#done = true;
              this.#startedAt = NaN;
              this.#tElapsed = 0;
              this.#looped = 1;
              this.#reversing = this.#reverse;
              executeOnCompleteKeyframe();
              if(typeof this.#onComplete == "function"){//add onComplete per keyframe
                try {
                  this.#onComplete(engine);
                } catch (error) {
                  console.log("Error on onComplete:",error,this.#onComplete)
                }
              }
              return;
            }
          }
        }
      }
    }

}

export {Animation}