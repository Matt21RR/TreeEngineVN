import React from "react";

import { Canvas, CanvasData } from "./Canvas.tsx";

import { Animation } from "../engineComponents/Animation.ts"
import GraphObject from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";
import { KeyboardTrigger, Trigger } from "../engineComponents/Trigger.ts";

import { getStr, lambdaConverter, TextLine } from "../logic/Misc.ts";
import Shader from "./Shaders.ts";
import { TextureAnim } from "../engineComponents/TextureAnim.ts";
import { CodedRoutine } from "../engineComponents/CodedRoutine.ts";
import { Chaos } from "../interpretators/ChaosInterpreter.ts";
import { generateCalculationOrder, generateRenderingOrder } from "./RenderingOrder.ts";

//@ts-ignore
import noImageTexture from "../resources/no-image.png";

import CollisionLayer from "../engineComponents/CollisionLayer.ts";
import { ExtendedObjects } from "../logic/ExtendedObjects.ts";
import { RenderMisc } from "./RenderMisc.ts";
import ResourceLoader from "./ResourceLoader.ts";
import PointerCalculation from "./PointerCalculation.tsx";
//@ts-ignore
import gsap from "gsap";
import { generateObjectsDisplayDimentions, SharedDisplayCalcs} from "./RenderingDimentions.ts";
import UI from "./UI.tsx";
import Actor from "../engineComponents/Actor.ts";
import { CalculationOrder, CameraData } from "./RenderEngine.d.tsx";
import Swal from "sweetalert2";
import { Dictionary } from "../../global.ts";
import { RequestFile } from "../../../wailsjs/go/main/App.js";
import StageMark from "../engineComponents/StageMark.ts";

interface RenderEngineProps {
  clientSideResources?: boolean;
  aspectRatio?: string;
  showFps?: boolean;
  cyclesPerSecond?: number;
  developmentDeviceHeight?: number;
  avoidResizeBlackout?: boolean;
  setEngine?: (engine: RenderEngine,ExtendedObjects?:ExtendedObjects) => void;
}

class RenderEngine extends React.Component<RenderEngineProps>{
  id: string;
  isReady: boolean;
  aspectRatio: string;
  showFps: boolean;
  cyclesPerSecond: number;
  resizeTimeout: number;
  mounted: boolean;
  canvasRef: CanvasData;
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
    actor: typeof Actor;
    stageMark: typeof StageMark;
  };
  //*Runtime information
  gameVars: Record<string, any>;
  graphArray: RenList<GraphObject>;
  anims: RenList<Animation>;
  triggers: RenList<Trigger>;
  texturesList: RenList<any>;
  textureAnims: RenList<any>;
  soundsList: RenList<any>;
  actors:RenList<Actor>;
  stageMarks: RenList<StageMark>;

  //*Collisions stuff
  collisionLayer: CollisionLayer;
  //*Keyboard Triggers stuff
  keyboardTriggers: RenList<KeyboardTrigger>;
  pressedKeys: string[];
  //*Code-To-Run stuff
  codedRoutines: RenList<CodedRoutine>;
  routines: Array<Function>;
  routineNumber: number;
  resume: boolean;
  //*Dialog struff
  actualSpeaker: Actor;
  paragraphNumber: number;
  paragraph: string;
  dialogNumber: number;
  charNumber: number;
  dialog: Array<any>;
  narration: Array<any>;

  //*ScriptNode stuff
  nodes: Dictionary<string>;
  scenicPositions: RenList<any>;
  callThisShitWhenDialogEnds:(engine:RenderEngine)=>void;
  callThisShitWhenDecisionEnds:(engine:RenderEngine,data:Dictionary)=>void;
  //*Rendering stuff
  developmentDeviceHeight: number;
  engineDisplayRes: { width: number; height: number };
  camera: CameraData;
  calculationOrder: CalculationOrder;
  // dimentionsPack: Record<string, ObjectRenderingData>;
  dimentionsPack: Set<string>;
  renderingOrderById: Array<string>;

  mouse: { x: number; y: number; origin: any };
  //*Debug stuff
  noRenderedItemsCount: number;
  drawObjectLimits: boolean;
  drawCollisionsMatrix: boolean;
  drawTriggers: boolean;
  objectsToDebug: Set<string>;

  lambdaConverter: Function;
  getStr: Function;
  noImageTexture: Shader;

  displayObserver: ResizeObserver;

  private static instance: RenderEngine;

  static getInstance(){
    return RenderEngine.instance;
  }

  constructor(props: RenderEngineProps){
    super(props);

    //@ts-ignore
    window.engineRef = this;

    RenderEngine.instance = this;

    new SharedDisplayCalcs();

    this.id = "rengine" + String(window.performance.now()).replaceAll(".","");
    if(props){
      this.isReady = props.clientSideResources ?? false;
      this.aspectRatio = props.aspectRatio ?? "16:9";
      this.showFps = props.showFps ?? false;
      this.cyclesPerSecond = props.cyclesPerSecond ?? 24;
      this.developmentDeviceHeight = props.developmentDeviceHeight ?? window.screen.height*window.devicePixelRatio;
    }
    this.engineDisplayRes = {width:0,height:0};
    this.resizeTimeout = 0;
    this.mounted = false; //internal check
    // this.canvasRef = null; //Reference to the canvas used to render the scene

    this.actualSceneId = "";//Guardar esto

    this.constructors = {
      graphObject : GraphObject,
      animation : Animation,
      textureAnim : TextureAnim,
      trigger: Trigger,
      keyboardTrigger : KeyboardTrigger,
      codedRoutine : CodedRoutine,
      actor : Actor,
      stageMark : StageMark
    }
    this.gameVars = {};//Y guardar esto tambien

    this.texturesList = new RenList();
    this.soundsList = new RenList();

    //MOUSE
    this.mouse = {x:0,y:0,origin:null};

    //Debug values
    this.noRenderedItemsCount = 0;

    this.drawObjectLimits = true;
    this.drawCollisionsMatrix = false;
    this.drawTriggers = false;

    this.lambdaConverter = lambdaConverter;
    this.getStr = getStr;

    //ScriptNode Stuff
    this.actors = new RenList();
    this.scenicPositions = new RenList();

    this.dataCleaner();
    //*Texture Fallback
    this.setFallbackTexture();
  } 
  private setFallbackTexture(){
    const fallbackImage = new Image();
    fallbackImage.crossOrigin = "Anonymous";
    fallbackImage.src = noImageTexture;
    fallbackImage.addEventListener('load',()=>{
      (new Shader())
        .instanceIt(fallbackImage,"engineNoImageTexture")
        .then((shader)=>{
          this.noImageTexture = shader;
        })
    });
  }
  
  componentDidMount(){
    RenderEngine.instance = this;
    if (!this.mounted) {
      this.mounted = true;
      // initDimensionCalculation(10000, this.developmentDeviceHeight);
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
          this.dataCleaner();
          this.isReady = true;
          this.forceUpdate();
        }
      }

      //*TECLADO
      const self = this as RenderEngine;

      const keydownFunc = (e:KeyboardEvent)=>{
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
      };

      const keyupFunc = (e:KeyboardEvent)=>{
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
      };

      document.body.removeEventListener("keydown",keydownFunc); 
      document.body.removeEventListener("keyup", keyupFunc); 
      document.body.addEventListener("keydown",keydownFunc);  
      document.body.addEventListener("keyup", keyupFunc);
    }
  }
  setEngineClientSideResources(fun:Function){
    this.dataCleaner();
    this.isReady = true;
    this.forceUpdate();

    const numberOfArguments = fun.length;
    if(numberOfArguments == 1){
      fun(this);
    }else if(numberOfArguments == 2){
      fun(this,ExtendedObjects);
    }
  }
  entryPoint(){
    this.loadScript(window.projectRoute + "main.txt");
  }
  loadScript(scriptRoute:string,destination = "gameEntrypoint"){
    this.dataCleaner();
    const h = new Chaos();         
    var self = this;
    
    RequestFile(scriptRoute)
      .then(res => atob(res))
      .then((scriptFile:string)=>{
        // console.log(scriptFile);
        h.kreator(scriptFile)
          .then(scriptData=>{
            try {
              console.warn(scriptData);
              if(Object.keys(scriptData).length == 0){
                console.error("Script is empty");
              }else{
                const commands = scriptData[destination].main;
                this.nodes = scriptData[destination].nodes;
                const commandsF = new Function ("engine","ExtendedObjects",commands);
                console.log(commandsF); 
                commandsF(self,ExtendedObjects);
              }
              self.isReady = true;
              self.forceUpdate();
            } catch (error) {
              let timerInterval: NodeJS.Timeout;
              Swal.fire({
                title: "Error al ejecutar el script",
                html: "compruebe la consola!",
                timer: 1500,
                timerProgressBar: true,
                didOpen: () => {
                  Swal.showLoading();
                  const timer = Swal.getPopup()!.querySelector("b");
                  timerInterval = setInterval(() => {
                    timer!.textContent = `${Swal.getTimerLeft()}`;
                  }, 100);
                },
                willClose: () => {
                  clearInterval(timerInterval);
                }
              });
              console.warn(scriptData);
              console.error(error.message);
              console.error(error.stack);
              throw error;
            }
        })
    })
    .catch(err=>{
      console.error(err);
      console.warn("Running engine without main script");
      self.isReady = true;
      self.forceUpdate();
    })
  }
  loadNode(nodeId: string){
    var commands = this.nodes[nodeId];
    const commandsF = new Function ("engine","ExtendedObjects",commands);
    commandsF(self,ExtendedObjects);
  }
  displayResolutionCalc(aspectRatio:string = this.aspectRatio) {
    const w = document.getElementById("display"+this.id) as HTMLElement;
    const engDisplay = document.getElementById("engineDisplay"+this.id) as HTMLElement;

    this.engineDisplayRes = RenderMisc.displayResolutionCalc(aspectRatio,w);

    gsap.to(engDisplay, 0, 
      { 
        width : this.engineDisplayRes.width + "px", 
        height : this.engineDisplayRes.height + "px"
      } 
    );

    this.forceUpdate();  
  }
  getObject(id:string){
    return this.graphArray.fastGet(id);
  }

  getTexture(id: string):Shader{
    if(this.textureAnims.exist(id)){
      id = this.textureAnims.get(id).getTexture(this.engineTime);
    }
    if(id){
      return this.texturesList.get(id) ?? this.noImageTexture;
    }else{
      return this.noImageTexture;
    }
  }

  getSolvedTexture(id: string):Shader{
    if(id){ //id != ""
      return this.texturesList.get(id);
    }else{
      return this.noImageTexture;
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
    if(areClientSideResources && this.texturesList.exist(textureId)){
      console.warn(`Textura de nombre ${textureId} ya existe. Saltando...`);
      return new Promise((resolve, reject)=>{resolve(null);});
    }
    return new Promise((resolve, reject)=>{
      ResourceLoader.loadTexture(indexPath,textureId,areClientSideResources,self.texturesList.ids())
        .then(shaderList => {
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
    this.engineSpeed = 1;
    this.stopEngine = false; //Stop engine time

    this.redraw = true;

    this.graphArray = new RenList();//array de objetos, un objeto para cada imagen en pantalla
    this.anims = new RenList();
    this.triggers = new RenList();
    this.stageMarks = new RenList();

    this.textureAnims = new RenList();

    this.collisionLayer = new CollisionLayer();

    this.keyboardTriggers = new RenList();
    this.pressedKeys = [];

    //Rendering-related stuff
    const self = this;
    const handler = {
      get(target, prop:string) {
        // return typeof  target[prop] === 'object' &&  target[prop] !== null ? new Proxy(target[prop],handler) :  target[prop];
        // return typeof  target[prop] === 'object' ? new Proxy(target[prop],handler) :  target[prop];
        return target[prop];
      },
      set(target, prop:string, value:any) {
        target[prop] = value;
        self.graphArray.objects.forEach(e=>{
          e.pendingRenderingRecalculation = true;
        });
        return true;
      }
    };

    const canvas = this.canvasRef;
    
    this.camera = new Proxy({
      id:"engineCamera",
      maxZ:10000,
      origin:new Proxy({x:.5,y:.5},handler),
      position:new Proxy({
        x:.5,
        y:.5,
        z:0,
        angle: canvas ? canvas.resolution.height/(this.camera.maxZ*canvas.resolution.width) : 0}, handler),
      usePerspective:false
    }, handler);
    
    this.calculationOrder = [];

    this.dimentionsPack = new Set();
    this.renderingOrderById = [];

    this.objectsToDebug = new Set();//id of the object
 
    this.codedRoutines = new RenList();
    this.routines = new Array();
    this.routineNumber = -1;
    this.resume = true;
    //Dialogs
    this.paragraphNumber = 0;
    this.paragraph = "";
    this.dialogNumber = 0;
    this.charNumber = 0;
    this.dialog = [];
    this.narration = [];
    //ScriptNode stuff
    this.nodes = {};
  }
  play(songId:string){
    this.soundsList.get(songId).sound.play();
  }
  renderScene(){
    if(!this.isReady){
      return(<span className="text-white absolute">ISN'T READY YET, OR UNABLE TO RUN YOUR SCRIPT</span>);
    }
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
        const orderingTime = performance.now()-startOrdA;

        const renderingOrdA = performance.now();
        const [dimentionsPack, requireRepaint] = generateObjectsDisplayDimentions(canvas, this.graphArray, this.calculationOrder, this.camera);

        this.dimentionsPack = dimentionsPack;

        let dimentionsObject = {};
        dimentionsPack.forEach(key => {
          dimentionsObject[key] = this.graphArray.fastGet(key).dimentionsPack;
        });

        this.renderingOrderById = generateRenderingOrder(dimentionsObject);
        const renderingOrdTime = performance.now()-renderingOrdA;

        this.canvasRef = canvas;
        const resolution = canvas.resolution;

        canvas.context.clearRect(0, 0, resolution.width, resolution.height);//cleanning window

        this.noRenderedItemsCount = 0;

        let infoAdjudicationTime = 0;
        let drawingTime = 0;
        let debugTime = 0;

        const availableIdsToRender = this.renderingOrderById; 

        const objectsToRender = availableIdsToRender.length;

        let excludedIds:Dictionary<boolean> = {};

        for (let index = 0; index < objectsToRender; index++) {
          let infoAdjudicationPre = performance.now();
          const gObject = this.getObject(availableIdsToRender[index]); //!Non-confirmed bottleneck
          
          const renderingData = gObject.dimentionsPack;

          const objectIsRotated = renderingData.rotation % 360 != 0;
          
          // const texRef = ( gObject.textureName ? this.getTexture(gObject.textureName) : null ); //Null works as false / not assigned
          const texRef = gObject.dimentionsPack.solvedTexture ?? ( gObject.textureName ? this.getTexture(gObject.textureName) : null ); //Null works as false / not assigned
          const strRef = gObject.text == null ? null : getStr(gObject.text);

          infoAdjudicationTime += performance.now()-infoAdjudicationPre;

          let drawingTimePre = performance.now();
          if(gObject.opacity == 0){
            this.noRenderedItemsCount++;
            excludedIds[gObject.id] = true;
          }else{
              //*part one: global alpha
              canvas.context.globalAlpha = gObject.opacity;//if the element to render have opacity != of the previous rendered element}

              let texts: Array<TextLine> = [];
              if(renderingData.text){
                const fontSize = renderingData.text.fontSize;
                canvas.context.font = `${fontSize}px ${gObject.font}`;

                if(renderingData.text?.value){
                  texts = renderingData.text.value;
                }else{
                  texts = RenderMisc.wrapText(
                    strRef as string,
                    renderingData,
                    gObject.center,
                    gObject.verticalCenter,
                    canvas.context);
                }
              }

              if(gObject.filterString != "none")
                canvas.context.filter = gObject.filterString;//if the element to render have filtering values != of the previous element
              if(objectIsRotated){
                canvas.context.save();
                canvas.context.setTransform(//transform using center as origin
                  1,
                  0,
                  0,
                  1,
                  renderingData.x, 
                  renderingData.y); // sets scale and origin
                canvas.context.rotate(gObject.rotateRad);
              }
              
              if(texRef){
                RenderMisc.drawImage(
                  texRef.getTexture(),
                  renderingData,
                  canvas.context);
              }

              if(renderingData.text){
                if(gObject.boxColor != "transparent"){
                  RenderMisc.drawRectangle(
                    renderingData,
                    gObject.boxColor,
                    canvas.context);
                }
                RenderMisc.drawText(
                  renderingData,
                  texts,
                  gObject.color,
                  canvas.context);
              }

              if(objectIsRotated){
                canvas.context.restore();
              }
              //*part four: anullate globalalpha and filters
              if(gObject.filterString != "none")
                canvas.context.filter = "none";
              canvas.context.globalAlpha = 1;
          }
          drawingTime += performance.now()-drawingTimePre;

          //*DEBUG INFO
          let debugTimePre = performance.now();
          if(this.objectsToDebug.has(gObject.id)){
            //*part five: draw object info
            if(this.drawObjectLimits){
              RenderMisc.drawObjectLimits(canvas.context,renderingData,resolution,this.camera.position.z);
            }
          }
          if(this.drawCollisionsMatrix){
            RenderMisc.drawCollisionBox(canvas.context,renderingData);
          }
          //* DRAW TRIGGERS
          if(this.drawTriggers){
            if(this.triggers.objects.filter(e=>{return e.enabled}).map(e=>e.relatedTo).indexOf(gObject.id) != -1){
              RenderMisc.drawTrigger(canvas.context,renderingData);
            }
          }
          debugTime += performance.now()-debugTimePre;
        }
        //* DRAW COLLISION LAYER
        if(this.drawCollisionsMatrix){
          RenderMisc.drawCollisionsMatrix(canvas.context,resolution);
        }

        var updatingColsTime = performance.now();
        this.collisionLayer.update(dimentionsObject,resolution.width,resolution.height,excludedIds);
        updatingColsTime = performance.now()-updatingColsTime;

        // this.redraw = false;
        return [orderingTime,renderingOrdTime,infoAdjudicationTime,drawingTime,debugTime,objectsToRender,updatingColsTime,this.noRenderedItemsCount,performance.now()-startOrdA];
      }} 
      onLoad={(canvas)=>{
        this.canvasRef = canvas;
        //calc the perspective angle
        this.camera.position.angle = canvas.resolution.height/(this.camera.maxZ*canvas.resolution.width);
        //disable image smoothing
        canvas.context.imageSmoothingEnabled = false;
        canvas.context.textRendering = "optimizeSpeed";
        canvas.context.textBaseline = 'middle';

        //*Cargar funcion externa
        if(this.props.setEngine){
          const numberOfArguments = this.props.setEngine.length;
          if(numberOfArguments == 1){
            this.props.setEngine(this);
          }else if(numberOfArguments == 2){
            this.props.setEngine(this,ExtendedObjects);
          }
        }
      }}
      onResize={(canvas)=>{
        this.canvasRef = canvas;
        //calc the perspective angle
        this.camera.position.angle = canvas.resolution.height/(this.camera.maxZ*canvas.resolution.width);
        //disable image smoothing
        canvas.context.imageSmoothingEnabled = false;
        canvas.context.textRendering = "optimizeSpeed"; 
        canvas.context.textBaseline = 'middle';

        //prevents reescaling glitches
        this.graphArray.objects.forEach(e=>{
          e.pendingRenderingRecalculation = true;
        });
      }}
      events={()=>{
        const mix = this.pressedKeys.join(" ");
        if(this.keyboardTriggers.exist(mix) && (this.pressedKeys.length>1)){
          this.keyboardTriggers.get(mix).check(this,"onHold");
        }
        this.pressedKeys.forEach(key => {
          if(this.keyboardTriggers.exist(key)){
            this.keyboardTriggers.get(key).check(this,"onHold");
          }
        });
      }}
      animateGraphics={(fps)=>{
        this.engineTime += (fps.elapsed * (this.stopEngine ? 0 : this.engineSpeed));
        for (let index = 0; index < this.anims.objects.length; index++) {
          const anim = this.anims.objects[index];
          if(anim.relatedTo != null){
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
          element.run(this);
        });
      }}
      />
    );
  }
  render(){
    return(
      <div className="relative w-full h-full mx-auto my-auto" id={'display'+this.id}>
        <div className="bg-black absolute w-full h-full flex">
          <div className="relative w-full h-full mx-auto my-auto" id={'engineDisplay'+this.id}>
            <div className="absolute w-full h-full bg-gradient-to-b from-gray-900 to-gray-700">
              {this.renderScene()}
              <PointerCalculation/>
              <UI/>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
export {RenderEngine}