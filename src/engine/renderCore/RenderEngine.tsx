import React from "react";
import * as $ from "jquery";
import {Howl} from 'howler';

import { Canvas } from "./Canvas.tsx";

import { Animation } from "../engineComponents/Animation.ts"
import { GraphObject } from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";
import { KeyboardTrigger, Trigger } from "../engineComponents/Trigger.ts";

import { lambdaConverter, getStr, mobileCheck, sortByReference, wrapText } from "../logic/Misc.ts";
import { Shader } from "./Shaders.ts";
import gsap from "gsap";
import { TextureAnim } from "../engineComponents/TextureAnim.ts";
import { CodedRoutine } from "../engineComponents/CodedRoutine.ts";
import { Chaos } from "../interpretators/ChaosInterpreter.ts";
import { generateCalculationOrder, arrayiseTree, generateRenderingOrder } from "./RenderingOrder.ts";

//@ts-ignore
import noImageTexture from "./no-image.png";

import CollisionLayer, { engineRenderingDataCloner, ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import { ExtendedObjects } from "../logic/ExtendedObjects.ts";
import { RenderMisc } from "./RenderMisc.ts";
import ResourceLoader from "./ResourceLoader.ts";
import PointerCalculation from "./PointerCalculation.ts";

type CalculationOrder = Array<{id:string,weight:number,z:number}>;

declare global {
  interface Window {
    engineRef:RenderEngine;
    backendRoute:string;
    setUsePerspective:Function;
  }
}

/**
 * aaaaa
 * 
 * @class RenderEngine
 * @param {boolean} [props.repeat=false] clientSideResources (as flag) = The engine won't look for a server to get the game resources
 * @param {string} props.aspectRatio - Set aspect ratio (default 16:9)
 * 
 */
interface RenderEngineProps {
  clientSideResources?: boolean;
  aspectRatio?: string;
  showFps?: boolean;
  cyclesPerSecond?: number;
  developmentDeviceHeight?: number;
  avoidResizeBlackout?: boolean;
  setEngine?: (engine: RenderEngine) => void;
}

class RenderEngine extends React.Component<RenderEngineProps>{
  id: string;
  projectRoot: string;
  isReady: boolean;
  aspectRatio: string;
  showFps: boolean;
  cyclesPerSecond: number;
  developmentDeviceHeight: number;
  engineDisplayRes: { width: number; height: number };
  resizeTimeout: number;
  isMobile: boolean;
  mounted: boolean;
  canvasRef: any;
  engineTime: number;
  engineSpeed: number;
  stopEngine: boolean;
  redraw:boolean;
  actualSceneId: string;
  constructors: {
    graphObject: typeof GraphObject;
    animation: typeof Animation;
    textureAnim: typeof TextureAnim;
    trigger: typeof Trigger;
    keyboardTrigger: typeof KeyboardTrigger;
    codedRoutine: typeof CodedRoutine;
  };
  gameVars: Record<string, any>;
  graphObject: typeof GraphObject;
  animation: typeof Animation;
  codedRoutine: typeof CodedRoutine;
  graphArray: RenList<GraphObject>;
  anims: RenList<Animation>;
  triggers: RenList<Trigger>;
  texturesList: RenList<any>;
  textureAnims: RenList<any>;
  soundsList: RenList<any>;
  collisionLayer: CollisionLayer;
  enteredTriggers: Array<string>;
  keyboardTriggers: RenList<KeyboardTrigger>;
  pressedKeys: string[];
  codedRoutines: RenList<CodedRoutine>;
  routines: Array<Function>;
  routineNumber: number;
  resume: boolean;
  voiceFrom: string;
  paragraphNumber: number;
  paragraph: string;
  dialogNumber: number;
  dialog: Array<any>;
  narration: string;
  camera: {
    id: string;
    maxZ: number;
    origin: { x: number; y: number };
    position: { x: number; y: number; z: number; angle: number };
    usePerspective: boolean;
  };
  calculationOrder: CalculationOrder;
  dimentionsPack: Record<string, ObjectRenderingData>;
  renderingOrderById: Array<string>;
  mouseListener: number;
  mouse: { x: number; y: number; origin: any };
  noRenderedItemsCount: number;
  drawObjectLimits: boolean;
  drawCollisionsMatrix: boolean;
  drawTriggers: boolean;
  objectsToDebug: Array<string>;

  lambdaConverter: Function;
  noImageTexture: Shader;

  displayObserver: ResizeObserver;

  getStr:Function;

  private static instance: RenderEngine;

  static getInstance(){
    return RenderEngine.instance;
  }

  constructor(props: RenderEngineProps){
    super(props);

    RenderEngine.instance = this;

    this.getStr = (text:Function|string)=>{return getStr(text,this);};


    this.id = "rengine" + String(window.performance.now()).replaceAll(".","");
    this.projectRoot = "";
    if(props){
      this.isReady = props.clientSideResources ?? false;
      this.aspectRatio = props.aspectRatio ?? "16:9";
      this.showFps = props.showFps ?? false;
      this.cyclesPerSecond = props.cyclesPerSecond ?? 24;
      this.developmentDeviceHeight = props.developmentDeviceHeight ?? window.screen.height*window.devicePixelRatio;
    }
    this.engineDisplayRes = {width:0,height:0};
    this.resizeTimeout = 0;
    this.isMobile = mobileCheck();
    this.mounted = false; //internal check
    this.canvasRef = {}; //Reference to the canvas used to render the scene

    this.engineTime = 0;
    this.engineSpeed = 1;
    this.stopEngine = false; //Stop engine time

    this.redraw = true;

    this.actualSceneId = "";//Guardar esto

    this.constructors = {
      graphObject : GraphObject,
      animation : Animation,
      textureAnim : TextureAnim,
      trigger: Trigger,
      keyboardTrigger : KeyboardTrigger,
      codedRoutine : CodedRoutine,
    }
    this.gameVars = {};//Y guardar esto tambien

    this.graphObject = GraphObject;
    this.animation = Animation;
    this.codedRoutine = CodedRoutine;
    this.graphArray = new RenList();//array de objetos, un objeto para cada imagen en pantalla
    this.anims = new RenList();
    this.triggers = new RenList();

    this.texturesList = new RenList();
    this.textureAnims = new RenList();//gifs-like
    this.soundsList = new RenList();

    this.collisionLayer = new CollisionLayer();
    this.enteredTriggers = [];

    this.keyboardTriggers = new RenList();
    this.pressedKeys = [];

    this.codedRoutines = new RenList();
    this.routines = new Array();
    this.routineNumber = -1;
    this.resume = true;
    //Dialogs
    this.voiceFrom = "";
    this.paragraphNumber = 0;
    this.paragraph = "";
    this.dialogNumber = 0;
    this.dialog = [];
    this.narration = "";

    //Rendering-related stuff
    const self = this;
    const handler = {
      get(target, prop) {
        return target[prop];
      },
      set(target, prop, value) {
        target[prop] = value;
        self.graphArray.objects.forEach(e=>{
          e.pendingRenderingRecalculation = true;
        });
        return true;
      }
    };
    
    this.camera = new Proxy({
      id:"engineCamera",
      maxZ:10000,
      origin:{x:.5,y:.5},
      position:{x:.5,y:.5,z:0,angle:0},
      usePerspective:false
    }, handler);

    this.calculationOrder = []; //for di

    this.dimentionsPack = {};
    this.renderingOrderById = [];

    //MOUSE
    this.mouseListener = 0;
    this.mouse = {x:0,y:0,origin:null};

    //Debug values
    this.noRenderedItemsCount = 0;

    this.drawObjectLimits = false;
    this.drawCollisionsMatrix = false;
    this.drawTriggers = false;

    this.objectsToDebug = [];//id of the object

    window.engineRef = this;

    this.lambdaConverter = lambdaConverter;
    //*Texture Fallback
    const fallbackImage = new Image();
    fallbackImage.crossOrigin = "Anonymous";
    fallbackImage.src = noImageTexture;
    fallbackImage.addEventListener('load',()=>{
      this.noImageTexture = new Shader(fallbackImage,"engineNoImageTexture");
    });

  }  
  componentDidMount(){
    if (!this.mounted) {
      this.mounted = true;
      //* ASPECT RATIO
      window.setTimeout(() => {
        this.displayResolutionCalc();
      }, 200);

      this.displayObserver = new ResizeObserver(() => {
        if(!("avoidResizeBlackout" in this.props)){
          gsap.to(document.getElementById("engineDisplay"+this.id), 0, { opacity: 0 });
        }
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = window.setTimeout(
          () => {
            try {
              this.displayResolutionCalc();
            } catch (error) {
              this.displayObserver.disconnect();
            }

            if(!("avoidResizeBlackout" in this.props)){
              gsap.to(document.getElementById("engineDisplay"+this.id), 0, { opacity: 1 });
            }

          }, 800);
      });

      this.displayObserver.observe(document.getElementById("display"+this.id) as Element,)

      //*LOAD GAME
      if(!("clientSideResources" in this.props)){
        this.entryPoint();
      }else{
        if("setEngine" in  this.props){
          if(typeof this.props.setEngine == "function"){
            this.props.setEngine(this);
          }
        }
      }
      
      //*TECLADO
      const self = this as RenderEngine;
      document.body.addEventListener("keydown",function(e){
        const keyCode = e.code;  
        if(self.pressedKeys.indexOf(keyCode) == -1){
          self.pressedKeys.push(keyCode);
          const mix = self.pressedKeys.join(" ");
          if(self.keyboardTriggers.exist(mix)){
            // @ts-ignore
            self.keyboardTriggers.get(mix).check(self,"onPress");
          }
          if(self.pressedKeys.length > 1){//Si hay mas de una tecla oprimiendose, comprobar la ultima tecla
            if(self.keyboardTriggers.exist(keyCode)){
              // @ts-ignore
              self.keyboardTriggers.get(keyCode).check(self,"onPress");
            }
          }
        }
      });  
      document.body.addEventListener("keyup", function(e){
        const keyCode = e.code;
        const mix = self.pressedKeys.join(" ");
        self.pressedKeys.splice(self.pressedKeys.indexOf(keyCode),1);
        if(self.keyboardTriggers.exist(mix)){
          // @ts-ignore
          self.keyboardTriggers.get(mix).check(self,"onRelease");
        }
        if(self.pressedKeys.length > 0){//Si habia mas de una tecla oprimiendose, comprobar la tecla que se soltó
          if(self.keyboardTriggers.exist(keyCode)){
            // @ts-ignore
            self.keyboardTriggers.get(keyCode).check(self,"onRelease");
          }
        }
      });
    }
  }
  entryPoint(){
    this.loadScript(window.projectRoute + "main.txt");
  }
  loadScript(scriptRoute:string,destination = "gameEntrypoint"){
    this.dataCleaner();
    const h = new Chaos();
    var self = this;
    $.get(scriptRoute).then(scriptFile=>{
      this.projectRoot = h.projectRoot;
      h.kreator(scriptFile).then(scriptData=>{
        var commands = (scriptData as {[key:string]:string})[destination];
        const commandsF = new Function ("engine","ExtendedObjects",commands);
        console.log(commandsF);
        commandsF(self,ExtendedObjects);
        self.isReady = true;
        self.forceUpdate();
        if("setEngine" in  self.props ){
          // @ts-ignore
          self.props.setEngine(self);
        }
      })
    })
  }
  displayResolutionCalc(aspectRatio:string = this.aspectRatio) {
    const w = document.getElementById("display"+this.id) as HTMLElement;
    const engDisplay = document.getElementById("engineDisplay"+this.id) as HTMLElement;

    this.engineDisplayRes = RenderMisc.displayResolutionCalc(aspectRatio,w,engDisplay);

    gsap.to(engDisplay, 0, 
      { 
        width : this.engineDisplayRes.width + "px", 
        height : this.engineDisplayRes.height + "px"
      } 
    );

    this.forceUpdate();  
  }
  getObject(id:string){
    //todo: Adapt to autoparse the data
    return this.graphArray.get(id);
  }

  getTexture(gObject: GraphObject):Shader{
    var id = gObject.textureName;
    if(id == null){
      console.warn(`no textureName in ${gObject.id}`);
      return this.noImageTexture;
    }
    else{
      if(this.textureAnims.exist(id)){
        id = this.textureAnims.get(id).getTexture(this.engineTime);
      }
      try {
        if(id != null){
          return this.texturesList.get(id);
        }else{
          return this.noImageTexture;
        }
        
      } catch (error) {
        // console.error(id +" Texture or TextureAnim wasn't found");
        return this.noImageTexture;
      }
    }

  }

  componentDidCatch(error,info){
    console.error("RenderEngine several crash!!");
    console.warn(error);
    console.log(info);
  }
  loadSound(indexPath:string){
    const self = this;
    return new Promise(function (resolve, reject) {
      ResourceLoader.loadSound(indexPath).then((soundList)=>{
        (soundList as Array<any>).forEach(soundExtructure => {
          self.soundsList.push(soundExtructure);
        });
        resolve(null);
      });
    })
  }
  loadTexture(indexPath:string, textureId=""){
    const self = this;
    const areClientSideResources = "clientSideResources" in this.props;
    return new Promise(function (resolve, reject) {
      ResourceLoader.loadTexture(indexPath,textureId,areClientSideResources,self.texturesList.ids()).then((shaderList)=>{
        (shaderList as Array<any>).forEach(shaderExtructure => {
          self.texturesList.push(shaderExtructure)
        });
        resolve(null);
      });
    });
  }
  dataCleaner(){
    //reset values
    this.engineTime = 0;
    this.graphArray = new RenList();//array de objetos, un objeto para cada imagen en pantalla
    this.anims = new RenList();
    this.triggers = new RenList();
    this.keyboardTriggers = new RenList();
    this.textureAnims = new RenList();

    const self = this;
    const handler = {
      get(target, prop:string) {
        return typeof  target[prop] === 'object' &&  target[prop] !== null ? new Proxy(target[prop],handler) :  target[prop];
      },
      set(target, prop:string, value:any) {
        self.graphArray.objects.forEach(e=>{
          e.pendingRenderingRecalculation = true;
        });
        target[prop] = value;
        return true;
      }
    };
    
    this.camera = new Proxy({
      id:"engineCamera",
      maxZ:10000,
      origin:{x:.5,y:.5},
      position:{x:.5,y:.5,z:0,angle:0},
      usePerspective:false
    }, handler);
    this.dimentionsPack = {};
 
    this.codedRoutines = new RenList();
    this.routines = new Array();
    this.routineNumber = -1;
    this.resume = true;
    //Dialogs
    this.voiceFrom = "";
    this.paragraphNumber = 0;
    this.paragraph = "";
    this.dialogNumber = 0;
    this.dialog = [];
    this.narration = "";
    this.enteredTriggers = [];
  }

  play(songId:string){
    this.soundsList.get(songId).sound.play();
  }

  generateObjectsDisplayDimentions(){
    const prevDimentionsPack = engineRenderingDataCloner(this.dimentionsPack);

    this.dimentionsPack = {};

    const canvas = this.canvasRef;
    const resolution = {
      height:canvas.resolutionHeight,
      width:canvas.resolutionWidth
    };

    const camera = this.camera;

    const arrayisedTree = arrayiseTree(this.calculationOrder);
    
    const tangencialConstant = canvas.resolutionHeight/(this.camera.maxZ*canvas.resolutionWidth);

    const perspectiveDiffHelper = ((1/camera.maxZ)-(1))
    const toAddSizeHelper = tangencialConstant*resolution.height*camera.maxZ;

    for (let index = 0; index < this.graphArray.length; index++) {
      
      const gObject = this.getObject(arrayisedTree[index]);
      
      if(!gObject.pendingRenderingRecalculation){
        this.dimentionsPack[gObject.id] = prevDimentionsPack[gObject.id]
        continue;
      }
      this.redraw = true;

      const texRef = gObject.textureName == null ? null : this.getTexture(gObject);

      let origin = {x:0,y:0};
      if(gObject.parent != "" && gObject.parent in this.dimentionsPack){
        origin = {
          x: this.dimentionsPack[gObject.parent].base.x,
          y: this.dimentionsPack[gObject.parent].base.y
        };
      }

      let addition = {x:0,y:0};
      if (!camera.usePerspective && gObject.ignoreParallax){
        addition = {x:-camera.position.x+.5, y:-camera.position.y+.5};
      }

      var objectScale = gObject.scale;
      var objectLeft = (gObject.x + origin.x + addition.x)*resolution.height + (camera.origin.x-0.5)*resolution.width;
      var objectTop = (gObject.y + origin.y + addition.y + (camera.origin.y-0.5))*resolution.height;
      var objectZ = gObject.accomulatedZ + camera.position.z;
      
      var testD = 0.99;
      
      if(camera.usePerspective && !gObject.ignoreParallax){
        objectLeft = gObject.x + origin.x - this.camera.position.x+0.5;
        objectTop = gObject.y + origin.y - this.camera.position.y+0.5;
        objectZ = gObject.accomulatedZ - this.camera.position.z+0.56;

        const perspectiveDiff = 1-((1/objectZ)-(1))/perspectiveDiffHelper;
        const toAddSize = perspectiveDiff * (toAddSizeHelper);
        const perspectiveScale = toAddSize/resolution.height;
        objectScale *= perspectiveScale;
        testD = perspectiveScale;

        //*recalculate gObject coords
        var perspectiveLayer = {
          width:resolution.height*perspectiveScale,
          height:resolution.height*perspectiveScale
        }
        //it will calc were the image must to be, inside the perspectiveLayer
        objectLeft *= perspectiveLayer.width;
        objectTop *= perspectiveLayer.height;
        //now add the origin of the perspectiveLayer
        objectLeft += -(perspectiveLayer.width-resolution.height)*camera.origin.x;
        objectTop += -(perspectiveLayer.height-resolution.height)*camera.origin.y;
      }

      //By default values for the textboxes
      var objectWidth = resolution.width*objectScale*gObject.widthScale;
      var objectHeight = resolution.height*objectScale*gObject.heightScale;

      if(texRef != null){
        if(gObject.useEngineUnits){
          objectWidth = texRef.resolution.width*objectScale*gObject.widthScale*(resolution.height/this.developmentDeviceHeight);
          objectHeight = texRef.resolution.height*objectScale*gObject.heightScale*(resolution.height/this.developmentDeviceHeight);
        }else{
          objectHeight = (texRef.resolution.height/texRef.resolution.width)*resolution.width*objectScale*gObject.heightScale;
        }
      }else{
        if(gObject.useEngineUnits){
          objectWidth = resolution.height*objectScale*gObject.widthScale;
        }
      }

      var res:ObjectRenderingData = {
        id: gObject.id,
        x : objectLeft,
        y : objectTop,
        z : objectZ,
        corner:{
          x:objectLeft - objectWidth/2,
          y:objectTop - objectHeight/2
        },
        base:{
          x:origin.x + gObject.x,
          y:origin.y + gObject.y,
          z:gObject.accomulatedZ
        },
        sizeInDisplay : testD,
        width : objectWidth,
        height : objectHeight
      };
      //Recompute Object size
      const strRef = gObject.text == null ? null : this.getStr(gObject.text);
      if(strRef != null && gObject.fitContent){
        const fontSizeRenderingValue = gObject.fontSizeNumeric*canvas.scale*(resolution.height/this.developmentDeviceHeight)*testD;
        const objectWidthMargin = (fontSizeRenderingValue/gObject.fontSize)*gObject.horizontalMargin;
        const objectHeightMargin = (fontSizeRenderingValue/gObject.fontSize)*gObject.verticalMargin;
        canvas.context.font = `${fontSizeRenderingValue}px ${gObject.font}`;
        var texts = wrapText(//TODO: Wrap it until all the text get wraped
          canvas.context,
          strRef,
          objectWidthMargin + res.corner.x,
          fontSizeRenderingValue/2,
          res.width - objectWidthMargin*2,
          0,
          fontSizeRenderingValue,
          gObject.center,
          false
        );

        const lastText = texts.at(-1);
        if (lastText) {
          objectHeight = lastText[2] + fontSizeRenderingValue/2 + objectHeightMargin*2;
        }

        for (let index = 0; index < texts.length; index++) {
          texts[index][2] += objectHeightMargin + (objectTop - objectHeight/2) ;  
        }

        res.corner.y = (objectTop - objectHeight/2);
        res.height = objectHeight;
        res.text = texts;
        res.margin = {horizontal:objectWidthMargin, vertical:objectHeightMargin};
      }
      this.dimentionsPack[gObject.id] = res;
      gObject.pendingRenderingRecalculation = false;

    }

    return this.dimentionsPack;
  }
  renderScene(){
    if(this.isReady){
      return(
        <Canvas 
        displayResolution={this.engineDisplayRes}
        fps={this.cyclesPerSecond}
        scale={1} 
        showFps={this.showFps}
        engine={this}
        renderGraphics={(canvas)=>{

          const startOrdA = performance.now();
          this.calculationOrder = generateCalculationOrder(this.graphArray);

          const dimentionsPack = this.generateObjectsDisplayDimentions();

          this.renderingOrderById = generateRenderingOrder(dimentionsPack);

          const endOrdB = performance.now()-startOrdA;

          const orderingTime = endOrdB;

          if(!this.redraw){
            return;
          }

          this.canvasRef = canvas;
          const resolution = {
            height:canvas.resolutionHeight,
            width:canvas.resolutionWidth
          };

          canvas.context.clearRect(0, 0, resolution.width, resolution.height);//cleanning window
          canvas.context.textBaseline = 'middle';

          this.noRenderedItemsCount = 0;

          let infoAdjudicationTime = 0;
          let drawingTime = 0;
          let debugTime = 0;

          const availableIdsToRender = this.renderingOrderById; 

          const objectsToRender = availableIdsToRender.length;

          for (let index = 0; index < objectsToRender; index++) {
            let infoAdjudicationPre = performance.now();
            const gObject = this.getObject(availableIdsToRender[index]);

            const objectRenderingData = dimentionsPack[gObject.id];
            var objectLeft = objectRenderingData.x;
            var objectTop = objectRenderingData.y;
            
            var testD = objectRenderingData.sizeInDisplay;

            var objectWidth = objectRenderingData.width;
            var objectHeight = objectRenderingData.height;

            const texRef = gObject.textureName == null ? null : this.getTexture(gObject);
            const strRef = gObject.text == null ? null : this.getStr(gObject.text);
            const fontSizeRenderingValue = gObject.fontSizeNumeric*canvas.scale*(resolution.height/this.developmentDeviceHeight)*testD;
            const objectWidthMargin = (fontSizeRenderingValue/gObject.fontSize)*gObject.horizontalMargin;
            const objectHeightMargin = (fontSizeRenderingValue/gObject.fontSize)*gObject.verticalMargin;

            infoAdjudicationTime += performance.now()-infoAdjudicationPre;

            let drawingTimePre = performance.now();
            if(!(gObject.opacity == 0)){

               //*part one: global alpha
              canvas.context.globalAlpha = gObject.opacity;//if the element to render have opacity != of the previous rendered element}

              //*part two: filtering
              var filterString = gObject.filterString;

              //*part three
              //with testD > 0.003 we ensure the very far of|behind the camera elements won't be rendered
              if(testD>0.003){
                let texts: Array<[string,number,number]> = [];
                if(strRef != null && !objectRenderingData.text){
                  canvas.context.font = `${fontSizeRenderingValue}px ${gObject.font}`;
                  texts = wrapText(//TODO: Wrap it until all the text get wraped
                    canvas.context,
                    strRef,
                    objectWidthMargin + objectRenderingData.corner.x,
                    objectHeightMargin + objectRenderingData.corner.y + fontSizeRenderingValue/2,
                    objectWidth - objectWidthMargin*2,
                    objectHeight - objectHeightMargin*2,

                    fontSizeRenderingValue,
                    
                    gObject.center,
                    gObject.verticalCenter
                  ); 

                }
                if(objectRenderingData.text){
                  canvas.context.font = `${fontSizeRenderingValue}px ${gObject.font}`;
                  texts = objectRenderingData.text;
                }
                canvas.context.filter = filterString;//if the element to render have filtering values != of the previous element
                if(gObject.rotate != 0){
                  canvas.context.save();
                  canvas.context.setTransform(//transform using center as origin
                    1,
                    0,
                    0,
                    1,
                    objectRenderingData.x, 
                    objectRenderingData.y); // sets scale and origin
                  canvas.context.rotate(gObject.rotateRad);

                  if(strRef != null){
                    if(gObject.boxColor != "transparent"){
                      canvas.context.fillStyle = gObject.boxColor;
                      canvas.context.fillRect(
                        objectRenderingData.corner.x - objectRenderingData.x,
                        objectRenderingData.corner.y - objectRenderingData.y,
                        objectRenderingData.width,
                        objectRenderingData.height
                        );
                    }
                    canvas.context.fillStyle = gObject.color;
                    texts.forEach((text) => {
                      canvas.context.fillText(
                        text[0],
                        text[1]-objectLeft,
                        text[2]-objectTop
                      );
                    });
                  }
                  if(texRef != null){
                    canvas.context.drawImage(
                      texRef.getTexture(gObject),
                      objectRenderingData.corner.x - objectRenderingData.x,
                      objectRenderingData.corner.y - objectRenderingData.y,
                      objectRenderingData.width,
                      objectRenderingData.height
                    );
                  }

                  canvas.context.restore();
                }else{
                //*part three: draw image
                  if(strRef != null){
                    if(gObject.boxColor != "transparent"){
                      canvas.context.fillStyle = gObject.boxColor;
                      canvas.context.fillRect(
                        objectRenderingData.corner.x,
                        objectRenderingData.corner.y,
                        objectRenderingData.width,
                        objectRenderingData.height
                      );
                    }
                    canvas.context.fillStyle = gObject.color;
                    texts.forEach((text) => {
                      canvas.context.fillText(
                        text[0],
                        text[1],
                        text[2]
                      );
                    });
                  }

                  if(texRef != null){
                    canvas.context.drawImage(
                      texRef.getTexture(gObject),
                      objectRenderingData.corner.x,
                      objectRenderingData.corner.y,
                      objectRenderingData.width,
                      objectRenderingData.height
                    );
                  }
                }
              }else{
                this.noRenderedItemsCount++;
              }

              //*part four: anullate globalalpha and filters
              if(filterString != "none")
                canvas.context.filter = "none";
              canvas.context.globalAlpha = 1;
            }else{
              this.noRenderedItemsCount++;
            }
            drawingTime += performance.now()-drawingTimePre;

            //*DEBUG INFO
            let debugTimePre = performance.now();
            if(this.objectsToDebug.indexOf(gObject.id) != -1){
              //*part five: draw object info
              if(this.drawObjectLimits){
                RenderMisc.drawObjectLimits(canvas.context,objectRenderingData,resolution,this.camera.position.z);
              }
            }
            if(this.drawCollisionsMatrix){
              RenderMisc.drawCollisionBox(canvas.context,objectRenderingData);
            }
            //* DRAW TRIGGERS
            if(this.drawTriggers){
              if(this.triggers.objects.filter(e=>{return e.enabled}).map(e=>e.relatedTo).indexOf(gObject.id) != -1){
                RenderMisc.drawTrigger(canvas.context,objectRenderingData);
              }
            }
            debugTime += performance.now()-debugTimePre;
          }
          //* DRAW COLLISION LAYER
          if(this.drawCollisionsMatrix){
            RenderMisc.drawCollisionsMatrix(canvas.context,resolution);
          }

          // console.warn("Objects excluded: ",this.noRenderedItemsCount);

          var updatingColsTime = performance.now();
          this.collisionLayer.update(dimentionsPack,resolution.width,resolution.height);
          updatingColsTime = performance.now()-updatingColsTime;


          // this.redraw = false;
          return [orderingTime,infoAdjudicationTime,drawingTime,debugTime,objectsToRender,updatingColsTime];
        }} 
        onLoad={(canvas)=>{
          this.canvasRef = canvas;
          //calc the perspective angle
          this.camera.position.angle = canvas.resolutionHeight/(this.camera.maxZ*canvas.resolutionWidth);
          //disable image smoothing
          canvas.context.imageSmoothingEnabled = false;
          canvas.context.textRendering = "optimizeSpeed";
        }}
        onResize={(canvas)=>{
          this.canvasRef = canvas;
          //calc the perspective angle
          this.camera.position.angle = canvas.resolutionHeight/(this.camera.maxZ*canvas.resolutionWidth);
          //disable image smoothing
          canvas.context.imageSmoothingEnabled = false;
          canvas.context.textRendering = "optimizeSpeed"; 

          //prevents reescaling glitches
          this.graphArray.objects.forEach(e=>{
            e.pendingRenderingRecalculation = true;
          });
        }}
        events={()=>{
          const mix = this.pressedKeys.join(" ");
          if(this.keyboardTriggers.exist(mix) && (this.pressedKeys.length>1)){
            // @ts-ignore
            this.keyboardTriggers.get(mix).check(this,"onHold");
          }
          this.pressedKeys.forEach(key => {
            if(this.keyboardTriggers.exist(key)){
              // @ts-ignore
              this.keyboardTriggers.get(key).check(this,"onHold");
            }
          });
        }}
        animateGraphics={(fps)=>{
          this.engineTime += (fps.elapsed * (this.stopEngine ? 0 : this.engineSpeed));
          for (let index = 0; index < this.anims.objects.length; index++) {
            const anim = this.anims.objects[index];
            if(anim.relatedTo != null){
              // @ts-ignore
              anim.updateState(this.engineTime,this);
            }
          }  

          if(this.resume){
            if((this.routineNumber+1)<this.routines.length){
              this.routineNumber++;
              this.routines[this.routineNumber](this);
            }
          }
          this.codedRoutines.objects.forEach(element => {
            //@ts-ignore
            element.run(this);
          });
        }}
        />
      );
    }else{
      return(<span className="text-white absolute">ISN'T READY YET, OR UNABLE TO RUN YOUR SCRIPT</span>);
    }
  }
  checkTriggers(mouse:React.MouseEvent|React.TouchEvent,action:string){//check using mouse stats
    const resolution = {
      height:this.canvasRef.resolutionHeight, 
      width:this.canvasRef.resolutionWidth
    };

    var offset = $("#"+"triggersTarget"+this.id).offset() as JQuery.Coordinates;

    const mouseVirtualPosition = PointerCalculation.calcMouseVirtualPosition(mouse,offset,action);

    const mX = mouseVirtualPosition.mX;
    const mY = mouseVirtualPosition.mY;

    this.mouse.x = mX * (this.canvasRef.resolutionWidth/this.canvasRef.resolutionHeight);
    this.mouse.y = mY;

    const reversedRenderOrderList = ([] as Array<string>).concat(this.renderingOrderById).reverse();
    const triggersIdList = this.triggers.objects.filter(e=>{return e.enabled}).map(e=>{return e.id});
    const objectsWithTriggersList = this.triggers.relatedToReversedList();
    const collisionedTriggers = this.collisionLayer.checkMouse(mX,mY,resolution).filter(e=>{return e in objectsWithTriggersList});
    
    PointerCalculation.triggersMouseCollisionManagement(collisionedTriggers,objectsWithTriggersList,reversedRenderOrderList,this.triggers,action);

    //*Check the triggers that wasn't assigned to a GraphObject
    for (const triggerId of this.triggers.relatedToNullList()){
      this.triggers.get(triggerId).check(mouse,action);
    }

    if(action == "onMouseMove"){
      //onLeave part, activar el onLeave en todos aquellos triggers que no se activaron previamente
      PointerCalculation.onLeaveTriggerCheck(collisionedTriggers,triggersIdList,this.triggers);
    }
  }
  triggersTarget(){
    if(this.isMobile){
      return (
        <div className="absolute w-full h-full"
          id={"triggersTarget"+this.id}
          onTouchStart={(e)=>this.checkTriggers(e,"onHold")}
          onTouchEnd={(e)=>this.checkTriggers(e,"onRelease")}
          onTouchMove={
            (e)=>{
              if(this.mouseListener+(1000/40) < performance.now()){
                this.mouseListener = performance.now();
                this.checkTriggers(e,"onMouseMove");
              }
            }
          }
        />
      );
    }else{
      return (
        <div className="absolute w-full h-full"
          id={"triggersTarget"+this.id}
          onContextMenu={(e)=>{
            e.preventDefault();
            this.checkTriggers(e,"onContextMenu");
          }}
          onWheel={(e)=>{this.checkTriggers(e,"onWheel")}}
          onMouseDown={(e)=>this.checkTriggers(e,"onHold")}
          onMouseUp={(e)=>{e.preventDefault();this.checkTriggers(e,"onRelease")}}
          onMouseMove={
            (e)=>{
              if(this.mouseListener+(1000/40) < performance.now()){
                this.mouseListener = performance.now();
                this.checkTriggers(e,"onMouseMove");
              }
            }
          }
        />
      );
    }
  }
  engineDisplay(){
    return(
      <>
        {this.renderScene()}
      </>
    );
  }
  render(){
    return(
      <div className="relative w-full h-full mx-auto my-auto" id={'display'+this.id}>
        <div className="bg-black absolute w-full h-full flex">
          <div className="relative w-full h-full mx-auto my-auto" id={'engineDisplay'+this.id}>
            <div className="absolute w-full h-full bg-gradient-to-b from-gray-900 to-gray-700">
              {this.engineDisplay()}
              {this.triggersTarget()}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
export {RenderEngine}