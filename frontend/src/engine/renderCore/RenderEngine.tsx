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

import noImageTexture from "../resources/no-image.png";

import CollisionLayer from "../engineComponents/CollisionLayer.ts";
import { ExtendedObjects } from "../logic/ExtendedObjects.ts";
import { RenderMisc } from "./RenderMisc.ts";
import ResourceLoader from "./ResourceLoader.ts";
import PointerCalculation from "./PointerCalculation.tsx";

import gsap from "gsap";
import { generateObjectsDisplayDimentions, SharedDisplayCalcs } from "./RenderingDimentions.ts";
import UI from "./UI.tsx";
import Actor from "../engineComponents/Actor.ts";
import { CameraData } from "./RenderEngine.d.tsx";
import Swal from "sweetalert2";
import { Dictionary } from "../../global.ts";
import { RequestFile } from "../../../wailsjs/go/main/App.js";
import StageMark from "../engineComponents/StageMark.ts";

interface RenderEngineProps {
  aspectRatio?: string;
  showFps?: boolean;
  developmentDeviceHeight?: number;
  avoidResizeBlackout?: boolean;
  setEngine?: (engine: RenderEngine,ExtendedObjects?:ExtendedObjects) => void;
}

class RenderEngine extends React.Component<RenderEngineProps>{
  id: string;
  isReady: boolean;
  aspectRatio: string;
  showFps: boolean;
  resizeTimeout: number;
  mounted: boolean;
  canvasRef: CanvasData;
  engineTime: number;
  engineSpeed: number;
  stopEngine: boolean;
  actualSceneId: string;
  chaosInstance: Chaos;
  uiInstance: UI;
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
  
  actors:RenList<Actor>;
  stageMarks: RenList<StageMark>;
  
  //*Collisions stuff
  collisionLayer: CollisionLayer;
  //*Keyboard Triggers stuff
  inputManager: InputManager;
  //*Code-To-Run stuff
  codedRoutines: RenList<CodedRoutine>;
  routines: Array<Function>;
  routineNumber: number;
  resume: boolean;
  //*Dialog struff
  dialogManager: DialogManager;
  
  //*ScriptNode stuff
  nodes: Dictionary<string>;
  scenicPositions: RenList<any>;
  //*Rendering stuff
  developmentDeviceHeight: number;
  engineDisplayRes: { width: number; height: number };
  camera: CameraData;
  calculationOrder: Array<string>;
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

  textureManager: TextureManager;

  audioManager: AudioManager;
  
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
      this.isReady = false;
      this.aspectRatio = props.aspectRatio ?? "16:9";
      this.showFps = props.showFps ?? false;
      this.developmentDeviceHeight = props.developmentDeviceHeight ?? window.screen.height*window.devicePixelRatio;
    }
    this.engineDisplayRes = {width:0,height:0};
    this.resizeTimeout = 0;
    this.mounted = false; //internal check

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

    //*Texture Fallback
    this.textureManager = new TextureManager();
    this.audioManager = new AudioManager();

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

    this.inputManager = new InputManager();

    this.dialogManager = new DialogManager();
    console.warn("Cleaning");
    this.dataCleaner();
  }
  
  componentDidMount(){
    RenderEngine.instance = this;
    if (!this.mounted) {
      this.uiInstance = UI.getInstance();
      this.mounted = true;
      //* ASPECT RATIO
      window.setTimeout(() => {
        this.displayResolutionCalc();
      }, 200);

      this.displayObserver = new ResizeObserver(() => {
        if(!("avoidResizeBlackout" in this.props)){
          gsap.to(document.getElementById("engineDisplay"+this.id), { opacity: 0, duration: 0 });
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
              gsap.to(document.getElementById("engineDisplay"+this.id), { opacity: 1, duration: 0 });
            }
          }, 800);
      });

      this.displayObserver.observe(document.getElementById("display"+this.id) as Element)
      

      //*LOAD GAME
      this.entryPoint();


    }
  }
  entryPoint(){
    this.loadScript(window.projectRoute + "main.txt");
  }
  loadScript(scriptRoute:string,sceneId = "gameEntrypoint"){
    this.dataCleaner();
    this.chaosInstance = new Chaos(); 
    window.h = this.chaosInstance;
    
    RequestFile(scriptRoute)
      .then(res => atob(res))
      .then((scriptFile:string)=>{
        // console.log(scriptFile);
        this.chaosInstance.kreator(scriptFile)
          .then(processedScenesAndModules=>processedScenesAndModules.scenes)
          .then(scriptData=>{
            console.log(scriptData)
            this.runScript(sceneId);
        })
    })
    .catch(err=>{
      console.error(err);
      console.warn("Running engine without main script");
      this.isReady = true;
      this.forceUpdate();
    })
  }
  runScript(sceneId:string,nodeId:string = ""){
    this.dataCleaner();
    try {
      if(Object.keys(this.chaosInstance.scenes).length == 0){
        console.error("Script is empty");
      }else{
        const commands = this.chaosInstance.scenes[sceneId].main;
        this.nodes = this.chaosInstance.scenes[sceneId].nodes;
        if(nodeId != ""){
          this.runNode(nodeId);
          return;
        }
        const commandsF = new Function ("engine","ExtendedObjects",commands);
        commandsF(this,ExtendedObjects);
      }
      this.isReady = true;
      this.forceUpdate();
    } catch (error) {
      let timerInterval: number;
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
      console.warn(this.chaosInstance.scenes);
      console.error(error.message);
      console.error(error.stack);
      throw error;
    }
  }
  runNode(nodeId: string){
    const routineNumber = this.routineNumber;
    const prevRoutines = this.routines.slice(0,routineNumber+1);
    const nextRoutines = this.routines.slice(routineNumber+1);

    this.routines = prevRoutines;
    const commandsF = new Function ("engine", "ExtendedObjects", this.nodes[nodeId]);
    commandsF(this,ExtendedObjects);
    this.routines = this.routines.concat(nextRoutines);
  }
  private displayResolutionCalc(aspectRatio:string = this.aspectRatio) {
    const w = document.getElementById("display"+this.id) as HTMLElement;
    const engDisplay = document.getElementById("engineDisplay"+this.id) as HTMLElement;

    this.engineDisplayRes = RenderMisc.displayResolutionCalc(aspectRatio,w);

    gsap.to(engDisplay, 
      { 
        duration: 0,
        width : this.engineDisplayRes.width + "px", 
        height : this.engineDisplayRes.height + "px"
      } 
    );

    this.forceUpdate();  
  }

  getObject(id: string): GraphObject{
    return this.graphArray.fastGet(id);
  }

  componentDidCatch(error,info){
    console.error("RenderEngine several crash!!");
    console.warn(error);
    console.log(info);
  }
  private dataCleaner(){
    //reset values
    this.engineTime = 0;
    this.engineSpeed = 1;
    this.stopEngine = false; //Stop engine time

    this.graphArray = new RenList();//array de objetos, un objeto para cada imagen en pantalla
    this.anims = new RenList();
    this.triggers = new RenList();
    this.stageMarks = new RenList();

    this.collisionLayer = new CollisionLayer();

    this.inputManager.cleaner();

    //Rendering-related stuff
    const self = this;
    const handler = {
      get(target, prop:string) {
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
    this.dialogManager.cleaner();
    //ScriptNode stuff
    this.nodes = {};
  }
  renderScene(){
    if(!this.isReady){
      return(<span className="text-white absolute">ISN'T READY YET, OR UNABLE TO RUN YOUR SCRIPT</span>);
    }
    return(
      <Canvas 
      displayResolution={this.engineDisplayRes}
      scale={1} 
      showFps={this.showFps}
      engine={this}
      renderGraphics={(canvas)=>{
        const startOrdA = performance.now();
        //TODO: Only recalculate order if some object have changed its parent
        this.calculationOrder = generateCalculationOrder(this.graphArray);
        
        const orderingTime = performance.now()-startOrdA;

        const renderingOrdA = performance.now();
        const dimentionsPack = generateObjectsDisplayDimentions(canvas, this.graphArray, this.calculationOrder, this.camera);

        this.dimentionsPack = dimentionsPack;

        let dimentionsObject = {};
        dimentionsPack.forEach(key => {
          dimentionsObject[key] = this.graphArray.fastGet(key).dimentionsPack;
        });

        this.renderingOrderById = generateRenderingOrder(dimentionsObject);


        const renderingOrdTime = performance.now()-renderingOrdA;

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
          const gObject = this.graphArray.fastGet(availableIdsToRender[index]); //!Non-confirmed bottleneck
          
          const renderingData = gObject.dimentionsPack;

          const objectIsRotated = renderingData.rotation % 360 != 0;
          
          // const texRef = ( gObject.textureName ? this.getTexture(gObject.textureName) : null ); //Null works as false / not assigned
          const texRef = gObject.dimentionsPack.solvedTexture ?? ( gObject.textureName ? this.textureManager.getTexture(gObject.textureName) : null ); //Null works as false / not assigned
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
                if(gObject.repeatPattern){
                  const matrix = new DOMMatrix([renderingData.width/texRef.resolution.width, 0, 0, renderingData.height/texRef.resolution.height, renderingData.corner.x, renderingData.corner.y]);

                  gObject.repeatPattern.setTransform(matrix);
                  canvas.context.fillStyle = gObject.repeatPattern;
                  if(gObject.repeat == "repeat"){
                    canvas.context.fillRect(0, 0, resolution.width, resolution.height)
                  }else if(gObject.repeat == "repeat-x"){
                    canvas.context.fillRect(0, renderingData.corner.y, resolution.width, renderingData.height)
                  }else if(gObject.repeat == "repeat-y"){
                    canvas.context.fillRect(renderingData.corner.x, 0, renderingData.width, resolution.height)
                  }
                }else{
                  RenderMisc.drawImage(
                    texRef.getTexture(),
                    renderingData,
                    canvas.context);
                }
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

        let updatingColsTime = performance.now();
        this.collisionLayer.update(dimentionsObject,resolution.width,resolution.height,excludedIds);
        updatingColsTime = performance.now()-updatingColsTime;

        return [orderingTime,renderingOrdTime,infoAdjudicationTime,drawingTime,debugTime,objectsToRender,updatingColsTime,this.noRenderedItemsCount,performance.now()-startOrdA];
      }} 
      onLoad={(canvas)=>{
        this.canvasRef = canvas;
        //calc the perspective angle
        this.camera.position.angle = canvas.resolution.height/(this.camera.maxZ*canvas.resolution.width);
        //disable image smoothing
        canvas.context.textRendering = "optimizeSpeed";
        canvas.context.textBaseline = 'middle';

        //*Cargar funcion externa
        this.setEngine();
      }}
      onResize={(canvas)=>{
        this.canvasRef = canvas;
        //calc the perspective angle
        this.camera.position.angle = canvas.resolution.height/(this.camera.maxZ*canvas.resolution.width);
        //disable image smoothing
        canvas.context.textRendering = "optimizeSpeed"; 
        canvas.context.textBaseline = 'middle';

        //prevents reescaling glitches
        this.graphArray.objects.forEach(e=>{
          e.pendingRenderingRecalculation = true;
        });
      }}
      events={()=>{this.inputManager.update(this)}}
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
  setEngine(){
    if(this.props.setEngine){
      const numberOfArguments = this.props.setEngine.length;
      if(numberOfArguments == 1){
        this.props.setEngine(this);
      }else if(numberOfArguments == 2){
        this.props.setEngine(this,ExtendedObjects);
      }
    }
  }
  render(){
    return(
      <div className="relative w-full h-full mx-auto my-auto" id={'display'+this.id}>
        <div className="bg-black absolute w-full h-full flex">
          <div className="relative w-full h-full mx-auto my-auto" id={'engineDisplay'+this.id}>
            <div className="absolute w-full h-full bg-linear-to-b from-gray-900 to-gray-700">
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

class TextureManager{
  texturesList: RenList<any>
  textureAnims: RenList<TextureAnim>

  noImageTexture: Shader;

  constructor(){
    this.texturesList = new RenList();
    this.textureAnims = new RenList();
    this.setFallbackTexture()
  }

  cleaner(){
    this.texturesList = new RenList();
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

  loadTexture(indexPath:string, textureId=""){
    return new Promise((resolve, reject)=>{
      ResourceLoader.loadTexture(indexPath,textureId,this.texturesList.ids())
        .then(shaderList => {
          (shaderList as Array<any>).forEach(shaderExtructure => {
            this.texturesList.push(shaderExtructure)
          });
          resolve(null);
        })
        .catch(reject);
    });
  }

  getTexture(id: string, engineTime?: number):Shader{
    if(this.textureAnims.exist(id)){
      id = this.textureAnims.get(id).getTexture(engineTime || 0);
    }
    if(id){
      return this.texturesList.get(id) ?? this.noImageTexture;
    }else{
      return this.noImageTexture;
    }
  }

  getSolvedTexture(id: string):Shader{
    if(id) return this.texturesList.get(id);
    return this.noImageTexture;
  }
}

class AudioManager {
  soundsList: RenList<any>;
 
  constructor() {
    this.soundsList = new RenList();
  }
 
  play(songId: string): void {
    this.soundsList.get(songId)?.sound?.play();
  }
 
  loadSound(indexPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ResourceLoader.loadSound(indexPath)
        .then((soundList) => {
          (soundList as Array<any>).forEach((soundEntry) => {
            this.soundsList.push(soundEntry);
          });
          resolve();
        })
        .catch(reject);
    });
  }
}

class InputManager{
  //*Keyboard Triggers stuff
  keyboardTriggers: RenList<KeyboardTrigger>;
  pressedKeys: string[];

  private boundKeydown: (e: KeyboardEvent) => void;
  private boundKeyup: (e: KeyboardEvent) => void;

  constructor(){
    this.destroy();
    this.boundKeydown = this.onKeydown.bind(this);
    this.boundKeyup = this.onKeyup.bind(this);

    this.bind();
  }

  cleaner(){
    this.keyboardTriggers = new RenList();
    this.pressedKeys = [];
  }

  onKeydown (e:KeyboardEvent){
    const keyCode = e.code;  
    if(this.pressedKeys.indexOf(keyCode) == -1){
      this.pressedKeys.push(keyCode);
      const mix = this.pressedKeys.join(" ");
      if(this.keyboardTriggers.exist(mix)){
        // @ts-ignore
        this.keyboardTriggers.get(mix).check(this,"onPress");
      }
      if(this.pressedKeys.length > 1){//Si hay mas de una tecla oprimiendose, comprobar la ultima tecla
        if(this.keyboardTriggers.exist(keyCode)){
          // @ts-ignore
          this.keyboardTriggers.get(keyCode).check(this,"onPress");
        }
      }
    }
  }

  onKeyup(e:KeyboardEvent){
    const keyCode = e.code;
    const mix = this.pressedKeys.join(" ");
    this.pressedKeys.splice(this.pressedKeys.indexOf(keyCode),1);
    if(this.keyboardTriggers.exist(mix)){
      // @ts-ignore
      this.keyboardTriggers.get(mix).check(this,"onRelease");
    }
    if(this.pressedKeys.length > 0){//Si habia mas de una tecla oprimiendose, comprobar la tecla que se soltó
      if(this.keyboardTriggers.exist(keyCode)){
        // @ts-ignore
        this.keyboardTriggers.get(keyCode).check(this,"onRelease");
      }
    } 
  }

  bind(){
    console.log("binding");
    document.body.addEventListener("keydown", this.boundKeydown as EventListener);
    document.body.addEventListener("keyup", this.boundKeyup as EventListener);
  }

  destroy(){
    console.log("destroy");
    document.body.removeEventListener("keydown", this.boundKeydown as EventListener);
    document.body.removeEventListener("keyup", this.boundKeyup as EventListener);
  }

  update(engineRef: RenderEngine){
    const mix = this.pressedKeys.join(" ");
    if(this.keyboardTriggers.exist(mix) && (this.pressedKeys.length>1)){
      this.keyboardTriggers.get(mix).check(engineRef,"onHold");
    }
    this.pressedKeys.forEach(key => {
      if(this.keyboardTriggers.exist(key)){
        this.keyboardTriggers.get(key).check(engineRef,"onHold");
      }
    });
  }
}

class DialogManager {
  actualSpeaker: Actor | null = null;
  //NarrationText
  narration: any[] = [];
  paragraphNumber = 0;
  paragraph = "";
  //ActorText
  dialogs: any[] = [];
  dialogNumber = 0;
  charNumber = 0;
 
  cleaner(): void {
    this.actualSpeaker = null;
    this.narration = [];
    this.paragraphNumber = 0;
    this.paragraph = "";
    this.dialogNumber = 0;
    this.charNumber = 0;
    this.dialogs = [];
  }

  isPendingParagraphsToLoad(){
    return this.paragraphNumber < this.narration.length;
  }
  getActualParagraph(){
    return this.narration[this.paragraphNumber];
  }
  concatActualParagraphToNarrationText(){
    this.paragraph += '\n\n' + getStr(lambdaConverter( this.getActualParagraph() ));
  }
  cleanNarration(){
    this.narration = [];
    this.paragraphNumber = 0;
    this.paragraph = "";
  }



  isPendingDialogsToLoad():boolean{
    return this.dialogNumber+1 < this.dialogs.length;
  }
  loadNextDialog():void{
    this.dialogNumber++;
    this.charNumber = 0;
  }
  isPendingCharsInActualDialog():boolean{
    //number of chars joined to the showing text < Number of chars in actual dialog
    return this.charNumber < this.dialogs[this.dialogNumber].length;
  }
  getActualDialogChar(){
    return this.dialogs[this.dialogNumber][this.charNumber];
  }

  cleanActorDialogs():void{
    this.dialogNumber = 0;
    this.charNumber = 0;
    this.dialogs = [];
  }
}

export {RenderEngine}