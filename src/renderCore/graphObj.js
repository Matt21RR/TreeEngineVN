import { GPU } from "gpu.js"; //for create shaders spicific for each graphObject with texture
import { ExtendedObjects } from "../logic/ExtendedObjects";

var ease = require("ease-component"); 
//console.log("Easing options: ",Object.keys(ease));
class graphArr{
  static create(){
    var graphArray = new Object({
      _objects : new Array(),
      _enabled : new Object(),
      push: function(newGraphObj) {graphArr.push(this,newGraphObj)},
      remove: function(objectId) {graphArr.remove(this,objectId)},
      get: function(objectId) {return graphArr.get(this,objectId)},
      ids: function() {return graphArr.ids(this)},
      relatedToList: function() {return graphArr.relatedToList(this)},
      relatedToReversedList: function() {return graphArr.relatedToReversedList(this)},
      enable: function(objectId,bool) {return graphArr.enable(this,objectId,bool)},
      enabledList: function() {return graphArr.enabledList(this)}
    });
    Object.defineProperties(graphArray,{
      objects:{
        get: function () {return this._objects;}
      }
    });
    return graphArray;
  }
  static push(graphArray = new Array(),GraphObj = new Object()){
    graphArray._objects.push(GraphObj);
  }
  static remove(graphArray = new Array(), objectId = new String()){
    const graphIds = graphArray._objects.map(e=>e.id);

    if(graphIds.indexOf(objectId) != -1)
    graphArray._objects.splice(graphIds.indexOf(objectId),1);
  }
  static get(graphArray = new Array(), objectId = new String()){
    const graphIds = graphArray._objects.map(e=>e.id);
    if(graphIds.indexOf(objectId) != -1)
    if(Object.keys(graphArray._objects[graphIds.indexOf(objectId)]).indexOf("get") != -1){
      return graphArray._objects[graphIds.indexOf(objectId)].get();
    }else{
      return graphArray._objects[graphIds.indexOf(objectId)];
    }
    
  }
  static ids(graphArray = new Array()){
    return graphArray._objects.map(e => {return e.id;});
  }
  static relatedToList(graphArray = new Array()){
    return graphArray._objects.map(e => {return {[e.id]:e.relatedTo};});
  }
  static relatedToReversedList(graphArray = new Array()){
    var list = {};
    graphArray._objects.forEach(element => {
      if(element.relatedTo in list){
        list[element.relatedTo].push(element.id);
      }else{
        Object.assign(list,{[element.relatedTo]:[element.id]});
      }
    });
    return list;
  }
  static enable(graphArray = new Object(), objectId = new String(),bool = new Boolean()){
    if(objectId in graphArray._enabled){
      graphArray._enabled[objectId] = bool;
    }else{
      Object.assign(graphArray._enabled,{[objectId]:bool});
    }
  }
  static enabledList(graphArray = new Object()){
    var res = Object.assign({},graphArray._enabled);
    this.ids(graphArray).forEach(id => {
      if(!(id in res)){
        Object.assign(res,{[id]:false})
      }
    });
    return res;
  }
}
class Trigger{
  static create(tInfo = new Object(),graphObject = GraphObj){
    if(!("id" in tInfo))
      throw new Error("Trying to create a Trigger without id");
    var trigger = new Object({
      id: tInfo.id,
      relatedTo: tInfo.relatedTo, 
      enabled: tInfo.enabled != undefined ? tInfo.enabled : true,
      //if superposition is true the engine will ignore the graphObjects that are over the graphobject related to the trigger
      //superposition: tInfo.superposition != undefined ? tInfo.superposition : false,
      onHold: tInfo.onHold != undefined ? tInfo.onHold : null,
      onRelease: tInfo.onRelease != undefined ? tInfo.onRelease : null,
      onEnter: tInfo.onEnter != undefined ? tInfo.onEnter : null,
      onLeave: tInfo.onLeave != undefined ? tInfo.onLeave : null,
      mouseAreInside: false,//Value to check the execution of onEnter/onLeave
      check: function(engineRef,graphObjectRef,action){//Si no existe en el trigger tal accion retorna falso, si no verdadero
        if(action == "mouseMove")//check onEnter
          action = "onEnter";
        if(this[action] == null || !this.enabled)
          return;
        
        const numberOfArguments = this[action].length;
        if(numberOfArguments == 1){
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
  static create(aInfo = new Object(),graphObject = GraphObj){
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
                gObject["_"+toKey] = newValue;
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
                gObject["_"+toKey] = newValue;
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
                  gObject["_"+toKey] = newValue;
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
                console.warn("restarting");
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
                console.warn("here");
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
class GraphObj{
  static create(graphInfo = new Object()){
    console.log(graphInfo)
    var graphObject = new Object({
      //is text
      _enabled:graphInfo.enabled != undefined ? graphInfo.enabled : true,//exclude from calculation and rendering
      _text:graphInfo.text != undefined ? graphInfo.text:null,
      _center:graphInfo.center != undefined ? graphInfo.center : false,
      _color:graphInfo.color != undefined ? graphInfo.color:"gray",
      _font:graphInfo.font != undefined ? graphInfo.font:"Arial",
      _fontSize:graphInfo.fontSize != undefined ? parseFloat(graphInfo.fontSize):18,
      _boxColor:graphInfo.boxColor != undefined ? graphInfo.boxColor : "transparent",
      _margin:graphInfo.margin != undefined ? graphInfo.margin : 0,

      _texture:graphInfo.textureFile != undefined ? graphInfo.textureFile:null,
      _textureName:graphInfo.textureName != undefined ? graphInfo.textureName:null,
      //Properties of the graph
      _id:graphInfo.id != undefined ? graphInfo.id: "error",
      _brightness: graphInfo.brightness != undefined ? graphInfo.brightness: 1,
      _contrast: graphInfo.contrast != undefined ? graphInfo.contrast: 1,
      _grayscale: graphInfo.grayscale != undefined ? graphInfo.grayscale: 0,
      _hueRotate: graphInfo.hueRotate != undefined ? parseFloat(graphInfo.hueRotate): 0,//deg
      //***SHADERS
      _blur: graphInfo.blur != undefined ? parseFloat(graphInfo.blur): 0,//px
      _aberration: graphInfo.aberration != undefined ? parseFloat(graphInfo.aberration): 0,
      _aberrationType: graphInfo.aberrationType != undefined ? graphInfo.aberrationType: "static",
      //static or shaky
      // _dither:graphInfo.dither != undefined ? graphInfo.dither : 1,
      //***END SHADERS
      _dropShadow : graphInfo.dropShadow != undefined ? {offsetX:parseFloat(graphInfo.dropShadow.offsetX), offsetY:parseFloat(graphInfo.dropShadow.offsetY), blurRadius:parseFloat(graphInfo.dropShadow.blurRadius), color:graphInfo.dropShadow.color} : {offsetX: 0, offsetY:0,blurRadius:0,color:"transparent"},
      _invert : graphInfo.invert != undefined ? graphInfo.invert : 0,
      _saturate : graphInfo.saturate != undefined ? graphInfo.saturate : 1,
      _sepia : graphInfo.sepia != undefined ? graphInfo.sepia : 0,
      _filterString:"",

      _opacity: graphInfo.opacity != undefined ? graphInfo.opacity: 1,

      _top : graphInfo.top != undefined ? graphInfo.top: 0,
      _left : graphInfo.left != undefined ? graphInfo.left: 0,
      //multipliers of canvasResolution
      //Resets the width and height scales
      _scale : graphInfo.scale != undefined ? graphInfo.scale: 1,
      //imageRotation
      _rotate : graphInfo.rotate != undefined ? parseFloat(graphInfo.rotate)*Math.PI/180 : 0,
      //z
      _z : graphInfo.z != undefined ? parseFloat(graphInfo.z) : 0,
      _renderZ:0,
      //ignoreParallax forces the object to ignore the camera parallax movement
      _ignoreParallax : graphInfo.z != undefined ? (graphInfo.ignoreParallax!=undefined?graphInfo.ignoreParallax:false) : true,
      //if one of these are defined(!=1), ignore the imageScale for the defined individual scale
      //Todo: force the engine to use this when it's a text object.
      _widthScale: graphInfo.widthScale != undefined ? graphInfo.widthScale: 1,
      _heightScale: graphInfo.heightScale != undefined ? graphInfo.heightScale: 1,

      //*Object methods
      dump : function() {return GraphObj.dump(this);},
      clone: function(cloneId = null) {
        if(cloneId == null)
        throw new Error("the id for the clonning operation that uses the object with id '"+this._id+"' is not defined");
        return GraphObj.clone(this,cloneId);
      },
      get : function() {return GraphObj.get(this);}
    });
    //Todo: add a throw error to ensure every graphObject created have it's own id
    // if(graphObject._widthScale != 1 || graphObject._heightScale != 1){//reset the scale value and alert of the scale re-instantiation
    //   console.warn("Object scale reinstantiation /n","scale, widthScale and height values are being defined at same time");
    // }
    Object.defineProperties(graphObject,{
      enabled:{
        get: function() {return this._enabled},
        set: function(x) {this._enabled = typeof x == "boolean"? x : false}
      },
      text:{
        get: function() {return this._text;},
        set: function(x) {this._text = typeof x == "string"? x : null}
      },
      center:{
        get: function() {return this._center},
        set: function(x) {this._center = typeof x == "boolean"? x : false}
      },
      color:{
        get: function() {return this._color},
        set: function(x) {this._color = typeof x == "string"? x : "gray"}
      },
      font:{
        get: function() {return this._font},
        set: function(x) {this._font = typeof x == "string" ? x: "Arial"}
      },
      fontSize:{
        get: function() {return this._fontSize;},
        set: function(x) {
          if(typeof x == "string"){
            if(x.indexOf("px") != -1){
              x = parseFloat(x);
            }
          }
          if(!isNaN(x)){
            if(x<0){
              this._fontSize = 0;
            }else{
              this._fontSize = x;
            }
          }
        }
      },
      fontSizeNumeric:{
        get: function() {return this._fontSize;},
        set: function(x) {this._fontSize = parseFloat(x);}
      },
      boxColor:{
        get: function() {return this._boxColor},
        set: function(x) {this._boxColor = typeof x == "string"? x : "black"}
      },
      margin:{
        get: function() {return this._margin;},
        set: function(x) {this._margin = parseFloat(x);}
      },
      texture: {
        get: function() { return this._texture; },
        set: function(x) { 
          this._texture = x != undefined ? x : null;
        }
      },
      textureName: {
        get: function() {return this._textureName;},
        set: function(x) {this._textureName = x;}
      },
      id:{
        get: function() {return this._id;},
        set: function(x) {this._id = x;}
      },
      brightness:{
        get: function() {return this._brightness;},
        set: function(x) {
          if(!isNaN(x)){
            if(x < 0){
              this._brightness = 0;
            }else{
              this._brightness = x;
            }
          }
        }
      },
      contrast:{
        get: function() {return this._contrast;},
        set: function(x) {
          if(!isNaN(x)){
            if(x < 0){
              this._contrast = 0;
            }else{
              this._contrast = x;
            }
          }
        }
      },
      grayscale:{
        get: function() {return this._grayscale;},
        set: function(x) {
          if(!isNaN(x)){
            if(x<0){
              this._grayscale = 0;
            }else if(x>1){
              this._grayscale = 1;
            }else{
              this._grayscale = x;
            }  
          }
        }
      },
      hueRotate:{
        get: function() {return this._hueRotate+"deg";},
        set: function(x) {
          if(typeof x == "string"){
            this._hueRotate = parseFloat(x);
          }else if(!isNaN(x)){
            this._hueRotate = x;
          }
        }
      },
      hueRotateNumeric:{
        get: function() {return this._hueRotate;}
      },
      blur:{
        get: function() {return this._blur+"px"},//1/4 blur
        set: function(x) {
          if(typeof x == "string"){
            if(x.indexOf("px") != -1){
              x = parseFloat(x);
            }
          }
          if(!isNaN(x)){
            if(x<0){
              this._blur = 0;
            }else{
              this._blur = x;
            }
          }
        }
      },
      blurNumeric:{
        get: function() {return this._blur;},
        set: function(x) {this._blur = parseFloat(x);}
      },
      aberration:{
        get: function() {return this._aberration},//1/4 blur
        set: function(x) {
          if(!isNaN(x)){
            if(x<0){
              this._aberration = 0;
            }else{
              this._aberration = x;
            }
          }
        }
      },
      aberrationType:{
        get: function() {return this._aberrationType;},
        set: function(x) {this._aberrationType = x;}
      },
      dropShadow:{
        get: function() {const s = this._dropShadow; return s.offsetX+"px "+s.offsetY+"px "+s.blurRadius+"px "+s.color;},
        set: function(x) {
          if(typeof x == "object"){
            this._dropShadow = x;
          }else if(typeof x == "string"){
            const vars = x.split(" ");
            if((vars.length -1) == 3){
              this._dropShadow = {offsetX: parseFloat(vars[0]), 
                                  offsetY: parseFloat(vars[1]),
                                  blurRadius: parseFloat(vars[2]),
                                  color: vars[3]}
            }
          }
        }
      },
      dropSahdowObject:{
        get: function() {return this._dropShadow;}
      },
      invert:{
        get: function() {return this._invert;},
        set: function(x) {
          if(!isNaN(x)){
            if(x<0){
              this._invert = 0;
            }else if(x>1){
              this._invert = 1;
            }else{
              this._invert = x;
            }  
          }
        }
      },
      saturate:{
        get: function() {return this._saturate;},
        set: function(x) {
          if(!isNaN(x)){
            if(x<0){
              this._saturate = 0;
            }else{
              this._saturate = x;
            }  
          }
        }
      },
      sepia:{
        get: function() {return this._sepia;},
        set: function(x) {
          if(!isNaN(x)){
            if(x<0){
              this._sepia = 0;
            }else if(x>1){
              this._sepia = 1;
            }else{
              this._sepia = x;
            }  
          }
        }
      },
      filterString:{
        get: function(x) {
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
          
          if(this._brightness != 1){filters.push("brightness");}
          if(this._contrast != 1){filters.push("contrast");}
          if((this._grayscale % 360) != 0){filters.push("grayscale");}
          if(this._invert != 0){filters.push("invert");}
          //if(this._blur != 0){filters.push("blur")}
          if(this._saturate != 1){filters.push("saturate");}
          if(this._sepia != 0){filters.push("sepia");}

          if(this._hueRotate != 0){filters.push("hueRotate");}
          if(!(this._dropShadow.offsetX == 0 && this._dropShadow.offsetY == 0 && this._dropShadow.blurRadius == 0)){
            if(this._dropShadow.color != "transparent"){//if isnt transparent check in rgba code
              if(this._dropShadow.color.split(",")[3] != "0)"){//if the alpha channel isn't trasparent
                filters.push("dropShadow");
              }
            }
          }


          filters.forEach(element => {
            filterstr += " "+filtersName[element]+"("+this[element]+")";
          });
          
          if(filterstr == ""){
            filterstr = "none";
          }
          this._filterString = filterstr.replace(' ','');
          return this._filterString;
        }
      },
      opacity:{
        get: function() {return this._opacity;},
        set: function(x) {
          if(!isNaN(x)){
            if(x<0){
              this._opacity = 0;
            }else if(x>1){
              this._opacity = 1;
            }else{
              this._opacity = x;
            }  
          }
        }
      },
      top:{
        get: function() {return this._top;},
        set: function(x) {this._top = typeof x == "string" ? parseFloat(x) : (!isNaN(x)? x : 0);}
      },
      left:{
        get: function() {return this._left;},
        set: function(x) {this._left = typeof x == "string" ? parseFloat(x) : (!isNaN(x)? x : 0);}
      },
      scale:{
        get: function () {return this._scale;},
        set: function(x) {this._scale = !isNaN(x)? (x >= 0 ? x : 1 ) : 1}
      },
      rotate:{
        get: function () {return (this._rotate*180)/Math.PI;},
        set: function(x) {this._rotate = parseFloat(x)*Math.PI/180;}
      },
      z:{
        get: function () {return this._z;},
        set: function(x) {this._z = parseFloat(x);}
      },
      ignoreParallax:{
        get: function() {return this._ignoreParallax;},
        set: function(x) {this._ignoreParallax = x;}
      },
      widthScale:{
        get: function () {return this._widthScale;},
        set: function(x) {this._widthScale = parseFloat(x);}
      },
      heightScale:{
        get: function () {return this._heightScale;},
        set: function(x) {this._heightScale = parseFloat(x);}
      }

    });
    return graphObject;
  }
  static get(graphObject = new Object()){
    return graphObject;
  }
  /**
   * Create a deepclone of a graphObject
   * @param {object} graphObject The graphObject that you want to be cloned
   * @param {string} cloneId The id for the clone of the original object
   */
  static clone(graphObject = new Object(), cloneId){
    var graphData = new Object();
    Object.keys(graphObject).forEach(element => {
      if(element.indexOf("_") != -1 && (element != "_id")){
        Object.assign(graphData,{[element.replace("_","")] : graphObject[element]});
      }else if(element == "_id"){
        Object.assign(graphData,{"id":cloneId});
      }
    });
    return this.create(graphData);
  }
  /**
   * Show in console the graphObject params
   * @param {*} graphObject 
   */
  static dump(graphObject = new Object()){
    const k = Object.keys(graphObject).filter((e)=>e.indexOf("_")!=-1)
    var d = new Object();
    k.forEach(key => {

      d[key.replace("_","")] = graphObject[key];
    });
    return d
  }
}
export {GraphObj,graphArr as ObjectArray,Animation,Trigger}