import { RenderEngine } from "../renderCore/RenderEngine"

class GraphObject{
  #enabled //TODO: use I'T
  #info //Convenient var to storage info related to this graphObject: ex. info:{name:Chara Newman, age:22}

  #text
  #center
  #color
  #font
  #fontSize
  #boxColor
  #margin

  #texture //unused
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

  #x
  #y
  #z

  #scale
  #widthScale
  #heightScale
  #rotate



  #ignoreParallax

  #states = new States(this);
  #pendingRenderingRecalculation = true;

  #useEngineUnits

  #type

  #parent
  
  #accomulatedZ //Engine related var, dont changeit through a gamescript

  #engineReference = new RenderEngine();

  #getAtribs(){// ? Could be a global function ?
    const propertyDescriptors = (Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this)));
    const propertyNames = Object.keys(propertyDescriptors);
    const atributesNames = propertyNames.filter(key =>{return "get" in propertyDescriptors[key]});
    return atributesNames;
  }

  constructor(graphInfo = new Object()){
    this.#enabled = "enabled" in graphInfo ? graphInfo.enabled : false;//exclude from calculation and renderin
    this.#info = "info" in graphInfo ? graphInfo.info : {};

    this.#type = "type" in graphInfo ? graphInfo.type : "default";

    this.#text = "text" in graphInfo ? graphInfo.text:null;
    this.#center = "center" in graphInfo ? graphInfo.center : false;
    this.#color = "color" in graphInfo ? graphInfo.color:"gray";
    this.#font = "font" in graphInfo ? graphInfo.font:"Arial";
    this.#fontSize = "fontSize" in graphInfo ? parseFloat(graphInfo.fontSize):18;
    this.#boxColor = "boxColor" in graphInfo ? graphInfo.boxColor : "transparent";
    this.#margin = "margin" in graphInfo ? graphInfo.margin : 0;

    this.#texture = "texture" in graphInfo ? graphInfo.texture:null;
    this.#textureName = "texture" in graphInfo ? graphInfo.texture:null;
    //Properties of the graph
    this.#id = "id" in graphInfo ? graphInfo.id: "error";
    this.#brightness = "brightness" in graphInfo ? graphInfo.brightness: 1;
    this.#contrast = "contrast" in graphInfo ? graphInfo.contrast: 1;
    this.#grayscale = "grayscale" in graphInfo ? graphInfo.grayscale: 0;
    this.#hueRotate = "hueRotate" in graphInfo ? parseFloat(graphInfo.hueRotate): 0;//deg
    //***SHADERS
    this.#blur = "blur" in graphInfo ? parseFloat(graphInfo.blur): 0;//px
    this.#aberration = "aberration" in graphInfo ? parseFloat(graphInfo.aberration): 0;
    this.#aberrationType = "aberrationType" in graphInfo ? graphInfo.aberrationType: "static";
    //static or shaky
    // _dither:graphInfo.dither != undefined ? graphInfo.dither : 1,
    //***END SHADERS
    this.#invert = "invert" in graphInfo ? graphInfo.invert : 0;
    this.#saturate = "saturate" in graphInfo ? graphInfo.saturate : 1;
    this.#sepia = "sepia" in graphInfo ? graphInfo.sepia : 0;
    this.#filterString = "";

    this.#opacity = "opacity" in graphInfo ? graphInfo.opacity: 1;

    this.#y = "y" in graphInfo ? graphInfo.y: 0;
    this.#x = "x" in graphInfo ? graphInfo.x: 0;
    //multipliers of canvasResolution
    //Resets the width and height scales
    this.#scale = "scale" in graphInfo ? graphInfo.scale: 1;
    //imageRotation
    this.#rotate = "rotate" in graphInfo ? parseFloat(graphInfo.rotate)*Math.PI/180 : 0;
    //z
    this.#z = "z" in graphInfo ? parseFloat(graphInfo.z) : 0;
    //ignoreParallax forces the object to ignore the camera parallax movement
    this.#ignoreParallax = "z" in graphInfo ? ("ignoreParallax" in graphInfo? graphInfo.ignoreParallax:false) : true;
    //if one of these are defined(!=1), ignore the imageScale for the defined individual scale
    //Todo: force the engine to use this when it's a text object.
    this.#widthScale = "widthScale" in graphInfo ? graphInfo.widthScale: 1;
    this.#heightScale = "heightScale" in graphInfo ? graphInfo.heightScale: 1;

    this.#states = "states" in graphInfo ? new States(this,graphInfo.states) : {};

    this.#useEngineUnits = "useEngineUnits" in graphInfo ? graphInfo.useEngineUnits:("parent" in graphInfo ? false :true); //for scale

    this.#parent = "parent" in graphInfo ? graphInfo.parent : "";
  }
  get enabled() {return this.#enabled}
  set enabled(x) {
    this.#enabled = x;
    this.#pendingRenderingRecalculation = true;
  }

  get info() {return this.#info}
  set info(x) {this.#info = x}
  getInfo(key){if(key in this.#info){return this.#info[key];} throw new Error(key+" not exist in info from "+this.#id)}
  setInfo(key, value){
    if(key in this.#info){
      this.#info[key] = value;
      return;
    }else{
      Object.assign(this.#info,{[key]:value});
      console.warn(key+" not exist in info from "+this.#id+", adding...");
    }
  }

  get type(){return this.#type}
  set type(x) {this.#type = x}

  get text() {return this.#text;}
  set text(x) {this.#text = x}

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
    this.#pendingRenderingRecalculation = true;
  }
    
  get textureName() {return this.#textureName;}
  set textureName(x) {
    this.#textureName = x;
    this.#pendingRenderingRecalculation = true;
  }
    
    
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
  get blurPX() {return this.#blur + "px";}
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
      blurPX:"blur",
      saturate:"saturate",
      sepia:"sepia",
    }
    var filters = [];
    var filterstr = "";
    
    if(this.#brightness != 1){filters.push("brightness");}
    if(this.#contrast != 1){filters.push("contrast");}
    if((this.#grayscale % 360) != 0){filters.push("grayscale");}
    if(this.#invert != 0){filters.push("invert");}
    if(this.#blur != 0){filters.push("blurPX")}
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

  get y() {return this.#y;}
  set y(x) {
    this.#y = typeof x == "string" ? parseFloat(x) : (!isNaN(x)? x : 0);
    this.#pendingRenderingRecalculation = true;
  }

  get x() {return this.#x;}
  set x(x) {
    this.#x = typeof x == "string" ? parseFloat(x) : (!isNaN(x)? x : 0);
    this.#pendingRenderingRecalculation = true;
  }

  get scale() {return this.#scale;}
  set scale(x) {
    this.#scale = !isNaN(x)? (x >= 0 ? x : 1 ) : 1
    this.#pendingRenderingRecalculation = true;
  }

  get rotate() {return (this.#rotate*180)/Math.PI;}
  get rotateRad() {return this.#rotate;}
  set rotate(x) {this.#rotate = parseFloat(x)*Math.PI/180;}

  get z() {return this.#z;}
  set z(x) {
    this.#z = parseFloat(x);
    this.#pendingRenderingRecalculation = true;
  }

  get ignoreParallax() {return this.#ignoreParallax;}
  set ignoreParallax(x) {
    this.#ignoreParallax = x;
    this.#pendingRenderingRecalculation = true;
  }

  get widthScale() {return this.#widthScale;}
  set widthScale(x) {
    this.#widthScale = parseFloat(x);
    this.#pendingRenderingRecalculation = true;
  }

  get heightScale() {return this.#heightScale;}
  set heightScale(x) {
    this.#heightScale = parseFloat(x);
    this.#pendingRenderingRecalculation = true;
  }

  get states(){return this.#states.states}

  get is() {return this.#states.state}
  set is(x) {this.#states.state = x;}

  get useEngineUnits() {return this.#useEngineUnits}
  set useEngineUnits(x) {this.#useEngineUnits = x}

  get pendingRenderingRecalculation() {return this.#pendingRenderingRecalculation;}
  set pendingRenderingRecalculation(x) {this.#pendingRenderingRecalculation = x;}

  get parent() {return this.#parent;}
  set parent(x) {this.#parent = x;}

  get accomulatedZ() {return this.#accomulatedZ;}
  set accomulatedZ(x) {this.#accomulatedZ = x;}


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
class States{
  #states
  /**
   * State structure = is a object
   * {
   *  beforeChange: funtion
   *  data: stateData = Object
   *  afterChange: function
   * }
   */
  #actualState
  #referenceToObject
  constructor(ref,states = new Object()){
    this.#actualState = "";
    this.#states = states != undefined ? states : {};
    Object.keys(states).forEach(stateName => {
      this.addState(stateName,states[stateName]);
    });
    this.#referenceToObject = ref != undefined ? ref : {};
  }
  addState(id,stateInfo){
    Object.assign(this.#states,{[id]:new State(stateInfo)});
  }
  removeState(id){
    delete this.#states[id];
  }
  get states(){return this.#states}

  set state(stateName){
    console.log(2);
    if(stateName != this.#actualState){
      console.log(3);
      if(stateName in this.#states){
        console.log(4);
        this.#actualState = stateName;
        const targetState = this.#states[stateName];
        targetState.setThisState(this.#referenceToObject);
      }
    }
  }
  get actualState() {return this.#actualState}
}
class State{
  #beforeChange = null
  #data
  #afterChange = null

  constructor(stateInfo = new Object()){
    if(!("data" in stateInfo))
      throw new Error("stateInfo without data key");
    this.#data = stateInfo.data;
    if("beforeChange" in stateInfo)
      this.#beforeChange = stateInfo.beforeChange;
    if("afterChange" in stateInfo)
      this.#afterChange = stateInfo.afterChange
  }

  get beforeChange(){return this.#beforeChange}
  get data(){return this.#data}
  get afterChange(){return this.#afterChange}

  setThisState(referenceToObject){
    if(this.#beforeChange != null){
      this.#beforeChange(window.engineRef);
    }
    Object.keys(this.#data).forEach(key =>{
      referenceToObject[key] = this.#data[key];
    });
    if(this.#afterChange != null){
      this.#afterChange(window.engineRef);
    }
  }

}
export {GraphObject}