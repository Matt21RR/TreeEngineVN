var ease = require("ease-component"); 
console.log(Object.keys(ease));
class graphArr{
  static create(){
    var graphArray = new Object({
      _graphObjects : new Array(),
      push: function(newGraphObj) {graphArr.push(this,newGraphObj)},
      remove: function(objectId) {graphArr.remove(this,objectId)},
      get: function(objectId) {return graphArr.get(this,objectId)}
    });
    Object.defineProperties(graphArray,{
      graphObjects:{
        get: function () {return this._graphObjects;}
      }
    });
    return graphArray;
  }
  /**
   * 
   * @param previous The graphArray related to the previous frame rendered
   * @param actual The graphArray related to the next frame to render 
   * @returns true if the graphArrays are equal, else false
   */
  static compare(previous,actual = new Array()){
    for (let index = 0; index < actual.length; index++) {
      const actualElement = actual[index];
      Object.keys(actualElement).forEach(element => {
        
      });
    }

  }
  static push(graphArray = new Array(),graphObj = new Object()){
    graphArray._graphObjects.push(graphObj);
  }
  static remove(graphArray = new Array(), objectId = new String()){
    const graphIds = graphArray._graphObjects.map(e=>e.id);

    if(graphIds.indexOf(objectId) != -1)
    graphArray._graphObjects.splice(graphIds.indexOf(objectId),1);
  }
  static get(graphArray = new Array(), objectId = new String()){
    const graphIds = graphArray._graphObjects.map(e=>e.id);
    if(graphIds.indexOf(objectId) != -1)
    return graphArray._graphObjects[graphIds.indexOf(objectId)].get();
  }
}
class Animation{
  static create(aInfo = new Object(),graphObject = graphObj){
    var animation = new Object({
      _ease:aInfo.ease?aInfo.ease:"linear",
      _done:aInfo.done?aInfo.done:false,
      _loops:aInfo.loops?aInfo.loops:0,
      _infinite:aInfo.infinite?aInfo.infinite:false,//infinite looping
      _duration:aInfo.duration?aInfo.duration:0,
      _elapsed:aInfo.elapsed?aInfo.elapsed:0,
      _to:aInfo.to?aInfo.to:{},
      updateState : function (gObject,elapsed) {
        if(!this._done){
          console.warn(this);
          this._elapsed += elapsed-this._elapsed;
          const progress = this._elapsed/this._duration;
          const eConstant = ease[this._ease](progress);//easing constant
          console.warn("eConstant: "+ eConstant);
          const k = Object.keys(this._to);
          k.forEach(toKey =>{
            gObject["_"+toKey] = this._from[toKey] + (this._to[toKey] - this._from[toKey])*eConstant;
          });
          if(progress >= 1){
            console.log(gObject);
            console.log("animation done!!");
            this._done=true;
          }
        }
      }
    });
    
    const gOD = graphObject.dump();
    var f = new Object();
    Object.keys(aInfo.to).forEach(toKey=>{
      f[toKey] = gOD[toKey];
    });
    animation._from =  f;

    Object.defineProperties(animation,{
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
      to:{
        get: function () {return this._to;},
        set: function (x) {this._to = x;}
      },
      // from:{
      //   get: function () {return this._from;},
      //   set: function (x) {this._from = x;}
      // }
    });
    return animation;
  }
}
class graphObj{
  static create(graphInfo = new Object()){
    var graphObject = new Object({
      //is text
      _text:graphInfo.text != undefined ? graphInfo.text:null,
      _color:graphInfo.color != undefined ? graphInfo.color:"gray",
      _font:graphInfo.font != undefined ? graphInfo.font:"Arial",
      _fontSize:graphInfo.fontSize != undefined ? parseFloat(graphInfo.fontSize):18,
      _boxColor:graphInfo.boxColor != undefined ? graphInfo.boxColor : "black",
      _imgFile:graphInfo.imgFile != undefined ? graphInfo.imgFile:null,
      //Properties of the graph
      _id:graphInfo.id != undefined ? graphInfo.id: "error",
      _brightness: graphInfo.brightness != undefined ? graphInfo.brightness: 1,
      _contrast: graphInfo.contrast != undefined ? graphInfo.contrast: 1,
      _grayscale: graphInfo.grayscale != undefined ? graphInfo.grayscale: 0,
      _hueRotate: graphInfo.hueRotate != undefined ? parseFloat(graphInfo.hueRotate): 0,//deg
      _blur: graphInfo.blur != undefined ? parseFloat(graphInfo.blur): 0,//px
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
      //zPos
      _zPos : graphInfo.zPos != undefined ? parseFloat(graphInfo.zPos) : 0,
      //ignoreParallax forces the object to ignore the camera parallax movement
      _ignoreParallax : graphInfo.zPos != undefined ? graphInfo.ignoreParallax : false,
      //if one of these are defined(!=1), ignore the imageScale for the defined individual scale
      //Todo: force the engine to use this when it's a text object.
      _widthScale: graphInfo.widthScale != undefined ? graphInfo.widthScale: 1,
      _heightScale: graphInfo.heightScale != undefined ? graphInfo.heightScale: 1,
      //render type properties
      _static : graphInfo.animation != undefined? (graphInfo.static != undefined ? graphInfo.static : true):true,//the element will render only 1 time(with the initial params)
      _recursiveAnimation : graphInfo.recursiveAnimation != undefined ? graphInfo.recursiveAnimation : false,//the animation will play only 1 time(ideal for the fadeIn,fadeOut animation)
      _animation: null,//animation are a object with three parts:duration,ease,graphPropertiesFinalValue

      //duration are the time elapsed to change the variables values, from initial to the final values determined in the animation
      //ease determine the "rythm" of change of the values across the time
      //graphPropertiesFinalValue = literaly the name describes itself
      //*Object methods
      dump : function() {return graphObj.dump(this);},
      clone: function(cloneId = null) {
        if(cloneId == null)
        throw new Error("the id for the clonning operation that uses the object with id '"+this._id+"' is not defined");
        return graphObj.clone(this,cloneId);
      },
      get : function() {return graphObj.get(this);}
    });
    //Todo: add a throw error to ensure every graphObject created have it's own id
    if(graphObject._widthScale != 1 || graphObject._heightScale != 1){//reset the scale value and alert of the scale re-instantiation
      console.warn("Object scale reinstantiation /n","scale, widthScale and height values are being defined at same time");
    }
    Object.defineProperties(graphObject,{
      text:{
        get: function() {return this._text;},
        set: function(x) {this._text = typeof x == "string"? x : null}
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
      imgFile: {
        get: function() { return this._imgFile; },
        set: function(x) { 
          this._imgFile = x != undefined ? x : null;
        }
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
        get: function() {return (!!window.chrome)?(this._blur>=4 ? this._blur : (this._blur>=2)?this._blur/2 :this._blur/1.7)+"px" : this._blur+"px"},//1/4 blur
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
            blur:"blur",
            dropShadow:"dropShadow",
            invert:"invert",
            saturate:"saturate",
            sepia:"sepia",
          }
          var filters = [];
          var filterstr = "";
          
          if(this._brightness != 1){filters.push("brightness");}
          if(this._contrast != 1){filters.push("contrast");}
          if((this._grayscale % 360) != 0){filters.push("grayscale");}
          if(this._invert != 0){filters.push("invert");}
          if(this._saturate != 1){filters.push("saturate");}
          if(this._sepia != 0){filters.push("sepia");}

          if(this._blur != 0){filters.push("blur");}
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
        get: function () {return this._rotate;},
        set: function(x) {this._rotate = parseFloat(x)*Math.PI/180;}
      },
      zPos:{
        get: function () {return this._zPos;},
        set: function(x) {this._zPos = parseFloat(x);}
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
    //*Add animation
    graphObject._animation = graphInfo.animation != undefined ? Animation.create(graphInfo.animation,graphObject) : null;
    return graphObject;
  }
  static get(graphObject = new Object()){
    // var graphData = new Object();
    // Object.keys(graphObject).forEach(element => {
    //   if(element.indexOf("_") != -1)
    //     Object.assign(graphData,{[element.replace("_","")] : graphObject[element]});
    // });
    // return graphData;
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
export {graphObj,graphArr}