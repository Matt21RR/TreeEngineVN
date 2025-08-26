import { lambdaConverter } from "../logic/Misc.ts"

const dataType = {
    id: "string",
    enabled : "boolean",

    text : ["function","string","null"],
    fitContent: "boolean",
    center : "boolean",
    verticalCenter: "boolean",
    color : "string",
    font : "string",
    fontSize : "number",
    boxColor : "string",
    horizontalMargin : "number",
    verticalMargin : "number",

    texture: ["string","null"],

    brightness : "number",
    contrast : "number",
    grayscale : "number",
    hueRotate : "number",
    invert : "number",
    saturate : "number",
    sepia : "number",

    blur : "number",
    aberration : "number",
    aberrationType : "string",

    opacity : "number",

    parent : "string",

    ignoreParallax : "boolean",
    useEngineUnits : "boolean",
    x : "number",
    y : "number",
    z : "number",
    scale : "number",
    widthScale : "number",
    heightScale : "number",
    rotate : "number",
  }

class GraphObject{
  _enabled:boolean //TODO: use I'T

  _text:Function|string|null
  _fitContent:boolean
  _center:boolean
  _verticalCenter:boolean
  _color:string
  _font:string
  _fontSize:number
  _boxColor:string
  _horizontalMargin:number
  _verticalMargin:number

  _textureName:string|null

  _id:string
  _brightness:number
  _contrast:number
  _grayscale:number
  _hueRotate:number

  _blur:number
  _aberration:number
  _aberrationType:string

  _invert:number
  _saturate:number
  _sepia:number

  _opacity:number

  _x:number
  _y:number
  _z:number

  _scale:number
  _widthScale:number
  _heightScale:number
  _rotate:number

  _ignoreParallax:boolean

  _pendingRenderingRecalculation:boolean = true;

  _useEngineUnits:boolean

  _parent:""
  
  _accomulatedZ:number //Engine related var, dont changeit through a gamescript

  _getAtribs(){// ? Could be a global function ?
    const propertyDescriptors = (Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this)));
    const propertyNames = Object.keys(dataType);
    const atributesNames = propertyNames.filter(key =>{return "get" in propertyDescriptors[key]});
    return atributesNames;
  }

  constructor(graphInfo:{[key:string]:any} = {}){
    this._id =              graphInfo.id ?? "error";
    this._enabled =         graphInfo.enabled ?? false;//exclude from calculation and renderin

    this._text =            "text" in graphInfo ? graphInfo.text : null;
    this._fitContent =      graphInfo.fitContent ?? false;
    this._center =          graphInfo.center ?? false;
    this._verticalCenter =  graphInfo.verticalCenter ?? false;
    this._color =           graphInfo.color ?? "gray";
    this._font =            graphInfo.font ?? "Arial";
    this._fontSize =        "fontSize" in graphInfo ? parseFloat(graphInfo.fontSize):18;
    this._boxColor =        graphInfo.boxColor ?? "transparent";
    this._horizontalMargin =     graphInfo.horizontalMargin ?? 0;
    this._verticalMargin =     graphInfo.verticalMargin ?? 0;

    this._textureName =     graphInfo.texture ?? null;
    //Properties of the graph
    this._brightness =      graphInfo.brightness ?? 1;
    this._contrast =        graphInfo.contrast ?? 1;
    this._grayscale =       graphInfo.grayscale ?? 0;
    this._hueRotate =       "hueRotate" in graphInfo ? parseFloat(graphInfo.hueRotate): 0;//deg
    //***SHADERS
    this._blur =            "blur" in graphInfo ? parseFloat(graphInfo.blur): 0;//px
    this._aberration =      "aberration" in graphInfo ? parseFloat(graphInfo.aberration): 0;
    this._aberrationType =  graphInfo.aberrationType ?? "static";
    //static or shaky
    // _dither:graphInfo.dither != undefined ? graphInfo.dither : 1,
    //***END SHADERS
    this._invert =          graphInfo.invert ?? 0;
    this._saturate =        graphInfo.saturate ?? 1;
    this._sepia =           graphInfo.sepia ?? 0;

    this._opacity =         graphInfo.opacity ?? 1;

    this._parent =          graphInfo.parent ?? "";

    this._x =               graphInfo.x ?? 0;
    this._y =               graphInfo.y ?? 0;
    this._z =               graphInfo.z ?? 0;
    //multipliers of canvasResolution
    //Resets the width and height scales
    this._scale =           graphInfo.scale ?? 1;
    //imageRotation
    this._rotate =          "rotate" in graphInfo ? parseFloat(graphInfo.rotate)*Math.PI/180 : 0;

    //ignoreParallax forces the object to ignore the camera parallax movement
    this._ignoreParallax = "z" in graphInfo;
    this._ignoreParallax = "ignoreParallax" in graphInfo ? graphInfo.ignoreParallax : this._ignoreParallax
    //if one of these are defined(!=1), ignore the imageScale for the defined individual scale
    //Todo: force the engine to use this when it's a text object.
    this._widthScale =     graphInfo.widthScale ?? 1;
    this._heightScale =    graphInfo.heightScale ?? 1;

    this._useEngineUnits = "useEngineUnits" in graphInfo ? graphInfo.useEngineUnits : ("parent" in graphInfo ? false : true); //for scale
  
    // Initialize a proxy to intercept property sets
    return new Proxy(this, {
      set: (target, property, value) => {
        if (target[property] !== value) {
          // console.log(`${property} value changed in ${target.id} to ${value}`);
          target.pendingRenderingRecalculation = true;
        }
        target[property] = value; // Set the property
        return true; // Indicate success
      }
    });
  }

  get enabled() {return this._enabled}
  set enabled(x) {
    this._enabled = x;
  }

  get text() {return this._text;}
  set text(x) {
    this._text = lambdaConverter(x);
  }

  set fitContent(x:boolean){this._fitContent = x;}
  get fitContent(){return this._fitContent;}

  get center() {return this._center}
  set center(x:boolean) {this._center = x}

  get verticalCenter() {return this._verticalCenter}
  set verticalCenter(x:boolean) {this._verticalCenter = x}

  get color() {return this._color}
  set color(x) {this._color = typeof x == "string"? x : "gray"}

  get font() {return this._font}
  set font(x) {this._font = typeof x == "string" ? x: "Arial"}


  get fontSize():number {return this._fontSize;}
  set fontSize(x:string|number) {
    if(typeof x == "string"){
      x = parseFloat(x) || 0;
    }
    if(typeof x == "number"){
      if(x<0){
        this._fontSize = 0;
      }else{
        this._fontSize = x;
      }
    }
  }

  get fontSizeNumeric() {return this._fontSize;}
  set fontSizeNumeric(x:any) {this._fontSize = parseFloat(x) || 0;}

  get boxColor() {return this._boxColor}
  set boxColor(x) {this._boxColor = typeof x == "string"? x : "black"}
    
    
  get horizontalMargin() {return this._horizontalMargin;}
  set horizontalMargin(x:any) {this._horizontalMargin = parseFloat(x) || 0;}

  get verticalMargin() {return this._verticalMargin;}
  set verticalMargin(x:any) {this._verticalMargin = parseFloat(x) || 0;}
    
    
  get texture() { return this._textureName; }
  set texture(x) { 
    this._textureName = x != undefined ? x : null;
  }
    
  get textureName() {return this._textureName;}
  set textureName(x) {
    this._textureName = x != undefined ? x : null;
  }
    
    
  get id() {return this._id;}
  set id(x) {this._id = x;}
    
  get brightness() {return this._brightness;}
  set brightness(x) {
    if(!isNaN(x)){
      if(x < 0){
        this._brightness = 0;
      }else{
        this._brightness = x;
      }
    }
  }
  
  get contrast() {return this._contrast;}
  set contrast(x) {
    if(!isNaN(x)){
      if(x < 0){
        this._contrast = 0;
      }else{
        this._contrast = x;
      }
    }
  }

  get grayscale() {return this._grayscale;}
  set grayscale(x) {
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

  get hueRotate() {return this._hueRotate+"deg";}
  set hueRotate(x) {
    if(typeof x == "string"){
      this._hueRotate = parseFloat(x) || 0;
    }else if(typeof x == "number"){
      this._hueRotate = x;
    }
  }

  get hueRotateNumeric() {return this._hueRotate;}

  get blur() {return this._blur;}
  get blurPX() {return this._blur + "px";}
  set blur(x:any) {this._blur = parseFloat(x) || 0;}

  get aberration() {return this._aberration}
  set aberration(x) {
    if(!isNaN(x)){
      if(x<0){
        this._aberration = 0;
      }else{
        this._aberration = x;
      }
    }
  }

  get aberrationType() {return this._aberrationType;}
  set aberrationType(x) {this._aberrationType = x;}

  get invert() {return this._invert;}
  set invert(x) {
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

  get saturate() {return this._saturate;}
  set saturate(x) {
    if(!isNaN(x)){
      if(x<0){
        this._saturate = 0;
      }else{
        this._saturate = x;
      }  
    }
  }

  get sepia() {return this._sepia;}
  set sepia(x) {
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
    var filters:Array<string> = [];
    var filterstr = "";
    
    if(this._brightness != 1){filters.push("brightness");}
    if(this._contrast != 1){filters.push("contrast");}
    if((this._grayscale % 360) != 0){filters.push("grayscale");}
    if(this._hueRotate != 0){filters.push("hueRotate");}
    if(this._invert != 0){filters.push("invert");}
    if(this._blur != 0){filters.push("blurPX")}
    if(this._saturate != 1){filters.push("saturate");}
    if(this._sepia != 0){filters.push("sepia");}

    filters.forEach(element => {
      filterstr += " "+filtersName[element]+"("+this[element]+")";
    });
    
    if(filterstr == ""){
      filterstr = "none";
    }else{
      filterstr = filterstr.replace(' ','');
    }

    return filterstr;
  }

  get opacity() {return this._opacity;}
  set opacity(x) {
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

  get y() {return this._y;}
  set y(x:any) {
    this._y = parseFloat(x) || 0;
  }

  get x() {return this._x;}
  set x(x:any) {
    this._x = parseFloat(x) || 0;
  }

  get scale() {return this._scale;}
  set scale(x:any) {
    this._scale = parseFloat(x) || 0;
  }

  get rotate() {return (this._rotate*180)/Math.PI;}
  set rotateRad(x) {this._rotate = x}
  get rotateRad() {return this._rotate;}
  set rotate(x:any) {this._rotate =( parseFloat(x) || 0)*Math.PI/180;}

  get z() {return this._z;}
  set z(x:any) {
    this._z = parseFloat(x) || 0;
  }

  get ignoreParallax() {return this._ignoreParallax;}
  set ignoreParallax(x) {
    this._ignoreParallax = x;
  }

  get widthScale() {return this._widthScale;}
  set widthScale(x:any) {
    this._widthScale = parseFloat(x) || 0;
  }

  get heightScale() {return this._heightScale;}
  set heightScale(x:any) {
    this._heightScale = parseFloat(x) || 0;
  }

  get useEngineUnits() {return this._useEngineUnits}
  set useEngineUnits(x) {this._useEngineUnits = x}

  get pendingRenderingRecalculation() {return this._pendingRenderingRecalculation;}
  set pendingRenderingRecalculation(x) {this._pendingRenderingRecalculation = x;}

  get parent() {return this._parent;}
  set parent(x) {this._parent = x;}

  get accomulatedZ() {return this._accomulatedZ;}
  set accomulatedZ(x) {this._accomulatedZ = x;}


  /**
   * Create a deepclone of a graphObject
   * @param {object} graphObject The graphObject that you want to be cloned
   * @param {string} cloneId The id for the clone of the original object
   */
  clone(cloneId:string){
    if(cloneId == null)
      throw new Error("the id for the clonning operation that uses the object with id '"+this._id+"' is not defined");

    const atributesNames = this._getAtribs();

    var graphData = new Object();
    atributesNames.forEach(element => {
        Object.assign(graphData,{[element] : this[element]});
    });
    Object.assign(graphData,{id:cloneId});
    return new GraphObject(graphData);
  }
  /**
   * Show in console the graphObject params
   * @param {*} graphObject 
   */
  dump(){
    var d = new Object();
    this._getAtribs().forEach(key => {

      d[key] = this[key];
    });
    return d
  }
}
export {GraphObject}