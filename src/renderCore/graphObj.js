import { ExtendedObjects } from "../logic/ExtendedObjects";

var ease = require("ease-component"); 
class RenList{
  constructor(){
    this.objects = new Array();
    this.enabled = new Object();
  }
  push(GraphObject = new Object()){
    this.objects.push(GraphObject);
  }
  remove( objectId = new String()){
    const graphIds = this.objects.map(e=>e.id);

    if(graphIds.indexOf(objectId) != -1)
    this.objects.splice(graphIds.indexOf(objectId),1);
  }
  get(objectId = new String()){
    const graphIds = this.objects.map(e=>e.id);
    if(graphIds.indexOf(objectId) != -1)
      if(Object.keys(this.objects[graphIds.indexOf(objectId)]).indexOf("get") != -1){
        return this.objects[graphIds.indexOf(objectId)].get();
      }else{
        return this.objects[graphIds.indexOf(objectId)];
      }
  }
  /**
   * Verify if exists a object with the provided id
   * @param {*} objectId 
   * @returns 
   */
  exist(objectId =  new String()){
    const graphIds = this.objects.map(e=>e.id);
    return graphIds.indexOf(objectId) != -1;
  }
  ids(){
    return this.objects.map(e => {return e.id;});
  }
  relatedToList(){
    return this.objects.map(e => {return {[e.id]:e.relatedTo};});
  }
  relatedToReversedList(){
    var list = {};
    this.objects.forEach(element => {
      if(element.relatedTo in list){
        list[element.relatedTo].push(element.id);
      }else{
        Object.assign(list,{[element.relatedTo]:[element.id]});
      }
    });
    return list;
  }
  enable(objectId = new String(),bool = new Boolean()){
    if(objectId in this.enabled){
      this.enabled[objectId] = bool;
    }else{
      Object.assign(this.enabled,{[objectId]:bool});
    }
  }
  enabledList(){
    var res = Object.assign({},this.enabled);
    this.ids().forEach(id => {
      if(!(id in res)){
        Object.assign(res,{[id]:false})
      }
    });
    return res;
  }
}
class Trigger{
  static create(tInfo = new Object(),graphObject = GraphObject){
    if(!("id" in tInfo))
      throw new Error("Trying to create a Trigger without id");
    var trigger = new Object({
      id: tInfo.id,
      relatedTo: tInfo.relatedTo != undefined ? tInfo.relatedTo : "Keyboard", 
      enabled: tInfo.enabled != undefined ? tInfo.enabled : true,
      //if superposition is true the engine will ignore the graphObjects that are over the graphobject related to the trigger
      //superposition: tInfo.superposition != undefined ? tInfo.superposition : false,
      onPress: tInfo.onPress != undefined ? tInfo.onPress : null,//Special for keyboard
      onHold: tInfo.onHold != undefined ? tInfo.onHold : null,
      onRelease: tInfo.onRelease != undefined ? tInfo.onRelease : null,
      onEnter: tInfo.onEnter != undefined ? tInfo.onEnter : null,
      onLeave: tInfo.onLeave != undefined ? tInfo.onLeave : null,
      mouseAreInside: false,//Value to check the execution of onEnter/onLeave
      check: function(engineRef,action,graphObjectRef = null){//Si no existe en el trigger tal accion retorna falso, si no verdadero
        if(action == "mouseMove")//check onEnter
          action = "onEnter";
        if(this[action] == null || !this.enabled)
          return;
        
        const numberOfArguments = this[action].length;
        if(numberOfArguments == 0){
          this[action]();
        }else if(numberOfArguments == 1){
          this[action](engineRef);
        }else if (numberOfArguments == 2){
          this[action](engineRef,graphObjectRef);
        }else{
          throw new Error("Too much arguments (",numberOfArguments,") for the funtion defined to the action ",action,", for the trigger",this.id)
        }
      }
    });
    return trigger;
  }
}
class Animation{
  static create(aInfo = new Object(),graphObject = GraphObject){
    var animation = new Object({
      _id:aInfo.id?aInfo.id:"undefined",
      _relatedTo:aInfo.relatedTo?aInfo.relatedTo:null, //the gO related to the animation
      _ease:aInfo.ease?aInfo.ease:"linear",
      _done:aInfo.done?aInfo.done:false,
      _loops:aInfo.loops?aInfo.loops*(aInfo.loopback?2:1):1,//by default 1 loop
      _reverse:aInfo.reverse?1:0,//if the animation are played in reverse
      _reversing:aInfo.reverse?1:0,//control Var
      _looped:1,
      _infinite:aInfo.infinite?aInfo.infinite:false,//infinite looping
      _loopback:aInfo.loopback?1:0,//repeat the animation in reverse after end
      _duration:aInfo.duration?aInfo.duration:0,
      _elapsed:0,
      _tElapsed:0,//total time elapsed
      _enabled:aInfo.enabled?aInfo.enabled:false,
      _pendingTimersFix:false,
      _startedAt:NaN,
      _dStartedAt:NaN,
      _delay:aInfo.delay?aInfo.delay:NaN,
      _to:aInfo.to?aInfo.to:{},
      _onComplete:aInfo.onComplete?aInfo.onComplete:null,

      _keyframes:aInfo.keyframes?aInfo.keyframes:{},
      _keyFrameNumber: -1,
      _timeline:[],//controla los tiempos de cada frame de forma independiente

      updateState : function (engineTime,gObjectFun,engine){//engine time
        if(this._enabled && !this._done){
          if(this._delay > 0){
            this.updateDelay(engineTime);
          }else{
            var gObject = gObjectFun(this._relatedTo);
            this.updateAnimation(gObject,engineTime,engine);
          }
          return false;
        }else{
          return true;
        }
      },
      updateDelay : function (delay) {
        if(isNaN(this._dStartedAt)){
          this._dStartedAt = delay;
          return;
        }
        if(this._pendingTimersFix){
          this._dStartedAt = delay-this._delay;
          this._pendingTimersFix = false;
        }
        const dO = delay;
        delay -= this._dStartedAt;
        this._delay -=delay;
        this._dStartedAt = dO;
      },
      updateAnimation : function (gObject,elapsed,engine) {
        const engineTime = elapsed;
        
        const executeOnCompleteKeyframe = () => {
          if(typeof this._to.onComplete == "function"){//add onComplete per keyframe
            try {
              this._to.onComplete(engine);
            } catch (error) {
              console.log("Error on onComplete:",error,this._to.onComplete)
            }
          }
        }
        const setAnimationVars = (forced = false)=>{
          if(isNaN(this._startedAt) || forced){
            //Esta instanciacion se debe de realizar justo antes de iniciar la animacion
            var gOD;
  
            //Si se trata de la camara
            if(gObject.id == "engineCamera"){
              gOD = ExtendedObjects.buildObjectsWithRoutes(gObject);
              this._to = ExtendedObjects.buildObjectsWithRoutes(this._to);
            }else{
              gOD = gObject.dump();
            }
  
            var f = new Object();
            Object.keys(this._to).forEach(toKey=>{
              if(toKey != "onComplete")
                f[toKey] = gOD[toKey];
            });
            this._from =  f;//estado inicial del objeto
            
            //console.log(this._from,this._to,this._elapsed,this._duration,this._keyFrameNumber,this._startedAt,this._tElapsed);
            //ajustar el tiempo de inicio de la animacion,solo cuando no se trate de una animacion con varios keyframes
            if(!forced)
              this._startedAt = elapsed;
            return;
          }
        }
        const setKeyFrame = (frameNumber)=>{
          const keyOfTheKeyFrame = Object.keys(this._keyframes)[frameNumber];
          const frame = this._keyframes[keyOfTheKeyFrame];
          this._keyFrameNumber = frameNumber;
          this._to = frame;
          this._duration = frameNumber == 0 ? keyOfTheKeyFrame*1: (keyOfTheKeyFrame)*1 - (Object.keys(this._keyframes)[frameNumber-1])*1;
        }

        if(Object.keys(this._keyframes).length != 0){
          if(this._keyFrameNumber == -1){
            console.log("calling here");
            setKeyFrame(0);
          }
        }
        
        //*NO KEYFRAMES=============================================================
        if(Object.keys(this._keyframes).length == 0)
           setAnimationVars();
        if(this._pendingTimersFix){
          this._startedAt = elapsed-(this._tElapsed%this._duration);
          this._pendingTimersFix = false;
        }
        elapsed-=this._startedAt;

        if(!this._done && this._duration == 0){//Si es una animacion instantanea

          const k = Object.keys(this._to);
          k.forEach(toKey =>{
            if(toKey != "onComplete"){
              const newValue = this._to[toKey];
              if(gObject.id == "engineCamera"){
                ExtendedObjects.setValueWithRoute(toKey,gObject,newValue);
              }else{
                gObject[toKey] = newValue;
              }
            }
          });
          if(Object.keys(this._keyframes).length != 0 && this._keyFrameNumber<(Object.keys(this._keyframes).length-1)){
            //?onComplete
            executeOnCompleteKeyframe();
            setKeyFrame(this._keyFrameNumber+1);
            setAnimationVars(true);
          }else{
            this._done = true;
          }

          this._pendingTimersFix = true;

          if(typeof this._onComplete == "function")
            this._onComplete(engine);
          return;

        }else if(!this._done){

          this._tElapsed += elapsed-this._elapsed;
          this._elapsed += elapsed-this._elapsed;

          const progress = this._reversing ? this._reversing-(this._elapsed/this._duration):(this._elapsed/this._duration);
          

          const eConstant = ease[this._ease](progress);//easing constant

          const k = Object.keys(this._to);//Para cada elemento a cambiar en el .to
          k.forEach(toKey =>{
            if(toKey != "onComplete"){
              const newValue = this._from[toKey] + (this._to[toKey] - this._from[toKey])*eConstant;
              if(gObject.id == "engineCamera"){
                ExtendedObjects.setValueWithRoute(toKey,gObject,newValue);
              }else{
                gObject[toKey] = newValue;
              }
            }
          
          });

          if(progress >= 1 || (this._reversing && (progress <= 0))){
            k.forEach(toKey =>{
              if(toKey != "onComplete"){
                const newValue = this._from[toKey] + (this._to[toKey] - this._from[toKey])*(this._reversing ? 0 : 1);
                if(gObject.id == "engineCamera"){
                  ExtendedObjects.setValueWithRoute(toKey,gObject,newValue);
                }else{
                  gObject[toKey] = newValue;
                }
              }
            });
            //si no se han hecho todos los loops o está en loop infinito
            if(this._looped < this._loops || this._infinite){

              executeOnCompleteKeyframe();
              if(Object.keys(this._keyframes).length != 0 && this._keyFrameNumber<(Object.keys(this._keyframes).length-1)){
                //?onComplete
                setKeyFrame(this._keyFrameNumber+1);

              }else{
                //console.warn("restarting");
                setKeyFrame(0);
                this._looped++;
                if(this._loopback)//Loopback wasn't tested with loopback
                  this._reversing = !this._reversing;
              }
              setAnimationVars(true);

              //reset timers
              this._startedAt = engineTime;
              this._tElapsed = 0;
              this._elapsed = 0;

            }else{
              if(Object.keys(this._keyframes).length != 0 && this._keyFrameNumber<(Object.keys(this._keyframes).length-1)){
                this._startedAt = engineTime;
                this._elapsed = 0;
                //?onComplete
                //console.warn("here");
                executeOnCompleteKeyframe();
                setKeyFrame(this._keyFrameNumber+1);
                setAnimationVars(true);
              }else{
                this._done = true;
                this._startedAt = NaN;
                this._tElapsed = 0;
                this._looped = 1;
                this._reversing = this._reverse;
                executeOnCompleteKeyframe();
                if(typeof this._onComplete == "function"){//add onComplete per keyframe
                  try {
                    this._onComplete(engine);
                  } catch (error) {
                    console.log("Error on onComplete:",error,this._onComplete)
                  }
                }
                return;
              }
            }
          }
        }
      }
    });

    Object.defineProperties(animation,{
      id:{
        get: function(){return this._id;}
      },
      relatedTo:{
        get: function(){return this._relatedTo;},
        set: function(x){this._relatedTo = x;}
      },
      ease:{
        get: function () {return ease[this._ease];},
        set: function (x) {
          if(typeof x == "function"){
            this._ease = x;
          }else if(typeof x == "string"){
            if(Object.keys(ease).indexOf(x) != -1){
              this._ease = ease[x];
            }else{
              throw new Error("The ease function: "+x+" Dont exists");
            }
          }
        }
      },
      done:{
        get: function () {return this._done;},
        set: function (x) {this._done = x;}
      },
      loops:{
        get: function () {return this._loops;},
        set: function (xa) {
          const x = parseInt(xa);
          if(!isNaN(x)){
            x = x>=0? x:0;
          }else{
            throw new Error ("Un-understandable value for 'loops' property: "+xa);
          }
        }
      },
      infinite:{
        get: function (){return this._infinite;},
        set: function (x) {this._infinite = x;}
      },
      duration:{
        get: function () {return this._duration;},
        set: function (x) {x = parseFloat(x);}
      },
      elapsed:{
        get: function () {return this._elapsed;},
        set: function (x) {this._elapsed = parseFloat(x);}
      },
      enabled:{
        get: function () {return this._enabled;},
        set: function (x) {
          //if the value are different and x=true, the startedAt, dStartedAt must be changed
          if(this._enabled != x){
            this._enabled = x;
          }
        }
      },
      to:{
        get: function () {return this._to;},
        set: function (x) {this._to = x;}
      },
      delay:{
        get: function () {return this._delay;},
        set: function (x) {this._delay = x;}
      }
    });

    return animation;
  }
}
class GraphObject{
  #enabled
  #text
  #center
  #color
  #font
  #fontSize
  #boxColor
  #margin

  #texture
  #textureName

  #id
  #brightness
  #contrast
  #grayscale
  #hueRotate

  #blur
  #aberration
  #aberrationType

  #invert
  #saturate
  #sepia
  #filterString

  #opacity

  #top
  #left

  #scale

  #rotate

  #z

  #ignoreParallax

  #widthScale
  #heightScale
  
  #getAtribs(){// ? Could be a global function ?
    const propertyDescriptors = (Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this)));
    const propertyNames = Object.keys(propertyDescriptors);
    const atributesNames = propertyNames.filter(key =>{return "get" in propertyDescriptors[key]});
    return atributesNames;
  }

  constructor(graphInfo = new Object()){
    this.#enabled = graphInfo.enabled != undefined ? graphInfo.enabled : true;//exclude from calculation and renderin
    this.#text = graphInfo.text != undefined ? graphInfo.text:null;
    this.#center = graphInfo.center != undefined ? graphInfo.center : false;
    this.#color = graphInfo.color != undefined ? graphInfo.color:"gray";
    this.#font = graphInfo.font != undefined ? graphInfo.font:"Arial";
    this.#fontSize = graphInfo.fontSize != undefined ? parseFloat(graphInfo.fontSize):18;
    this.#boxColor = graphInfo.boxColor != undefined ? graphInfo.boxColor : "transparent";
    this.#margin = graphInfo.margin != undefined ? graphInfo.margin : 0;

    this.#texture = graphInfo.textureFile != undefined ? graphInfo.textureFile:null;
    this.#textureName = graphInfo.textureName != undefined ? graphInfo.textureName:null;
    //Properties of the graph
    this.#id = graphInfo.id != undefined ? graphInfo.id: "error";
    this.#brightness = graphInfo.brightness != undefined ? graphInfo.brightness: 1;
    this.#contrast = graphInfo.contrast != undefined ? graphInfo.contrast: 1;
    this.#grayscale = graphInfo.grayscale != undefined ? graphInfo.grayscale: 0;
    this.#hueRotate = graphInfo.hueRotate != undefined ? parseFloat(graphInfo.hueRotate): 0;//deg
    //***SHADERS
    this.#blur =  graphInfo.blur != undefined ? parseFloat(graphInfo.blur): 0;//px
    this.#aberration =  graphInfo.aberration != undefined ? parseFloat(graphInfo.aberration): 0;
    this.#aberrationType =  graphInfo.aberrationType != undefined ? graphInfo.aberrationType: "static";
    //static or shaky
    // _dither:graphInfo.dither != undefined ? graphInfo.dither : 1,
    //***END SHADERS
    this.#invert = graphInfo.invert != undefined ? graphInfo.invert : 0;
    this.#saturate = graphInfo.saturate != undefined ? graphInfo.saturate : 1;
    this.#sepia = graphInfo.sepia != undefined ? graphInfo.sepia : 0;
    this.#filterString = "";

    this.#opacity = graphInfo.opacity != undefined ? graphInfo.opacity: 1;

    this.#top = graphInfo.top != undefined ? graphInfo.top: 0;
    this.#left = graphInfo.left != undefined ? graphInfo.left: 0;
    //multipliers of canvasResolution
    //Resets the width and height scales
    this.#scale = graphInfo.scale != undefined ? graphInfo.scale: 1;
    //imageRotation
    this.#rotate = graphInfo.rotate != undefined ? parseFloat(graphInfo.rotate)*Math.PI/180 : 0;
    //z
    this.#z = graphInfo.z != undefined ? parseFloat(graphInfo.z) : 0;
    //ignoreParallax forces the object to ignore the camera parallax movement
    this.#ignoreParallax = graphInfo.z != undefined ? (graphInfo.ignoreParallax!=undefined?graphInfo.ignoreParallax:false) : true;
    //if one of these are defined(!=1), ignore the imageScale for the defined individual scale
    //Todo: force the engine to use this when it's a text object.
    this.#widthScale = graphInfo.widthScale != undefined ? graphInfo.widthScale: 1;
    this.#heightScale = graphInfo.heightScale != undefined ? graphInfo.heightScale: 1;
  }
  get enabled() {return this.#enabled}
  set enabled(x) {this.#enabled = typeof x == "boolean"? x : false}

  get text() {return this.#text;}
  set text(x) {this.#text = typeof x == "string"? x : null}

  get center() {return this.#center}
  set center(x) {this.#center = typeof x == "boolean"? x : false}

  get color() {return this.#color}
  set color(x) {this.#color = typeof x == "string"? x : "gray"}

  get font() {return this.#font}
  set font(x) {this.#font = typeof x == "string" ? x: "Arial"}


  get fontSize() {return this.#fontSize;}
  set fontSize(x) {
    if(typeof x == "string"){
      if(x.indexOf("px") != -1){
        x = parseFloat(x);
      }
    }
    if(!isNaN(x)){
      if(x<0){
        this.#fontSize = 0;
      }else{
        this.#fontSize = x;
      }
    }
  }

  get fontSizeNumeric() {return this.#fontSize;}
  set fontSizeNumeric(x) {this.#fontSize = parseFloat(x);}

  get boxColor() {return this.#boxColor}
  set boxColor(x) {this.#boxColor = typeof x == "string"? x : "black"}
    
    
  get margin() {return this.#margin;}
  set margin(x) {this.#margin = parseFloat(x);}
    
    
  get texture() { return this.#texture; }
  set texture(x) { 
    this.#texture = x != undefined ? x : null;
  }
    
  get textureName() {return this.#textureName;}
  set textureName(x) {this.#textureName = x;}
    
    
  get id() {return this.#id;}
  set id(x) {this.#id = x;}
    
  get brightness() {return this.#brightness;}
  set brightness(x) {
    if(!isNaN(x)){
      if(x < 0){
        this.#brightness = 0;
      }else{
        this.#brightness = x;
      }
    }
  }
  
  get contrast() {return this.#contrast;}
  set contrast(x) {
    if(!isNaN(x)){
      if(x < 0){
        this.#contrast = 0;
      }else{
        this.#contrast = x;
      }
    }
  }

  get grayscale() {return this.#grayscale;}
  set grayscale(x) {
    if(!isNaN(x)){
      if(x<0){
        this.#grayscale = 0;
      }else if(x>1){
        this.#grayscale = 1;
      }else{
        this.#grayscale = x;
      }  
    }
  }

  get hueRotate() {return this.#hueRotate+"deg";}
  set hueRotate(x) {
    if(typeof x == "string"){
      this.#hueRotate = parseFloat(x);
    }else if(!isNaN(x)){
      this.#hueRotate = x;
    }
  }

  get hueRotateNumeric() {return this.#hueRotate;}

  get blur() {return this.#blur;}
  set blur(x) {this.#blur = parseFloat(x);}

  get aberration() {return this.#aberration}
  set aberration(x) {
    if(!isNaN(x)){
      if(x<0){
        this.#aberration = 0;
      }else{
        this.#aberration = x;
      }
    }
  }

  get aberrationType() {return this.#aberrationType;}
  set aberrationType(x) {this.#aberrationType = x;}

  get invert() {return this.#invert;}
  set invert(x) {
    if(!isNaN(x)){
      if(x<0){
        this.#invert = 0;
      }else if(x>1){
        this.#invert = 1;
      }else{
        this.#invert = x;
      }  
    }
  }

  get saturate() {return this.#saturate;}
  set saturate(x) {
    if(!isNaN(x)){
      if(x<0){
        this.#saturate = 0;
      }else{
        this.#saturate = x;
      }  
    }
  }

  get sepia() {return this.#sepia;}
  set sepia(x) {
    if(!isNaN(x)){
      if(x<0){
        this.#sepia = 0;
      }else if(x>1){
        this.#sepia = 1;
      }else{
        this.#sepia = x;
      }  
    }
  }
    
  get filterString() {
    const filtersName = {
      brightness:"brightness",
      contrast:"contrast",
      grayscale:"grayscale",
      hueRotate:"hue-rotate",
      dropShadow:"dropShadow",
      invert:"invert",
      //blur:"blur",
      saturate:"saturate",
      sepia:"sepia",
    }
    var filters = [];
    var filterstr = "";
    
    if(this.#brightness != 1){filters.push("brightness");}
    if(this.#contrast != 1){filters.push("contrast");}
    if((this.#grayscale % 360) != 0){filters.push("grayscale");}
    if(this.#invert != 0){filters.push("invert");}
    //if(this.#blur != 0){filters.push("blur")}
    if(this.#saturate != 1){filters.push("saturate");}
    if(this.#sepia != 0){filters.push("sepia");}

    if(this.#hueRotate != 0){filters.push("hueRotate");}

    filters.forEach(element => {
      filterstr += " "+filtersName[element]+"("+this[element]+")";
    });
    
    if(filterstr == ""){
      filterstr = "none";
    }
    this.#filterString = filterstr.replace(' ','');
    return this.#filterString;
  }

  get opacity() {return this.#opacity;}
  set opacity(x) {
    if(!isNaN(x)){
      if(x<0){
        this.#opacity = 0;
      }else if(x>1){
        this.#opacity = 1;
      }else{
        this.#opacity = x;
      }  
    }
  }

  get top() {return this.#top;}
  set top(x) {this.#top = typeof x == "string" ? parseFloat(x) : (!isNaN(x)? x : 0);}

  get left() {return this.#left;}
  set left(x) {this.#left = typeof x == "string" ? parseFloat(x) : (!isNaN(x)? x : 0);}

  get scale() {return this.#scale;}
  set scale(x) {this.#scale = !isNaN(x)? (x >= 0 ? x : 1 ) : 1}

  get rotate() {return (this.#rotate*180)/Math.PI;}
  set rotate(x) {this.#rotate = parseFloat(x)*Math.PI/180;}

  get z() {return this.#z;}
  set z(x) {this.#z = parseFloat(x);}

  get ignoreParallax() {return this.#ignoreParallax;}
  set ignoreParallax(x) {this.#ignoreParallax = x;}

  get widthScale() {return this.#widthScale;}
  set widthScale(x) {this.#widthScale = parseFloat(x);}

  get heightScale() {return this.#heightScale;}
  set heightScale(x) {this.#heightScale = parseFloat(x);}

  get(){// TF THIS ARE bEING USED?
    return this;
  }
  /**
   * Create a deepclone of a graphObject
   * @param {object} graphObject The graphObject that you want to be cloned
   * @param {string} cloneId The id for the clone of the original object
   */
  clone(cloneId){
    if(cloneId == null)
      throw new Error("the id for the clonning operation that uses the object with id '"+this.#id+"' is not defined");

    const atributesNames = this.#getAtribs();

    var graphData = new Object();
    atributesNames.forEach(element => {
        Object.assign(graphData,{[element] : this[element]});
    });
    Object.assign(graphData,{"id":cloneId});
    return new GraphObject(graphData);
  }
  /**
   * Show in console the graphObject params
   * @param {*} graphObject 
   */
  dump(){
    var d = new Object();
    this.#getAtribs().forEach(key => {

      d[key] = this[key];
    });
    return d
  }
}
export {GraphObject,RenList,Animation,Trigger}