import React from "react";
import $ from "jquery";

import { Canvas, CanvasData } from "./Canvas.tsx";

import { Animation } from "../engineComponents/Animation.ts"
import { GraphObject } from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";
import { KeyboardTrigger, Trigger } from "../engineComponents/Trigger.ts";

import { getStr, lambdaConverter, Mixin, wrapText } from "../logic/Misc.ts";
import { Shader } from "./Shaders.ts";
import { TextureAnim } from "../engineComponents/TextureAnim.ts";
import { CodedRoutine } from "../engineComponents/CodedRoutine.ts";
import { Chaos } from "../interpretators/ChaosInterpreter.ts";
import { generateCalculationOrder, generateRenderingOrder } from "./RenderingOrder.ts";

//@ts-ignore
import noImageTexture from "../resources/no-image.png";

import CollisionLayer, { ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import { ExtendedObjects } from "../logic/ExtendedObjects.ts";
import { RenderMisc } from "./RenderMisc.ts";
import ResourceLoader from "./ResourceLoader.ts";
import PointerCalculation from "./PointerCalculation.tsx";
//@ts-ignore
import gsap from "gsap";
import { generateObjectsDisplayDimentions } from "./RenderingDimentions.ts";
import UI from "./UI.tsx";
import ScriptNode from "../engineComponents/ScriptNode.ts";
import Actor from "../engineComponents/Actor.ts";
import { CalculationOrder, CameraData } from "./RenderEngine.d.tsx";

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
  };
  //*Runtime information
  gameVars: Record<string, any>;
  graphArray: RenList<GraphObject>;
  anims: RenList<Animation>;
  triggers: RenList<Trigger>;
  texturesList: RenList<any>;
  textureAnims: RenList<any>;
  soundsList: RenList<any>;
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
  actors:RenList<Actor>
  nodes:{[key:string]:string};
  scenicPositions: RenList<any>;
  callThisShitWhenDialogEnds:(engine:RenderEngine)=>void;
  callThisShitWhenDecisionEnds:(engine:RenderEngine,data:{[key:string]:any})=>void;
  //*Rendering stuff
  developmentDeviceHeight: number;
  engineDisplayRes: { width: number; height: number };
  camera: CameraData;
  calculationOrder: CalculationOrder;
  dimentionsPack: Record<string, ObjectRenderingData>;
  renderingOrderById: Array<string>;

  mouse: { x: number; y: number; origin: any };
  //*Debug stuff
  noRenderedItemsCount: number;
  drawObjectLimits: boolean;
  drawCollisionsMatrix: boolean;
  drawTriggers: boolean;
  objectsToDebug: Array<string>;

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
      actor : Actor
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

    this.objectsToDebug = [];//id of the object

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
      this.noImageTexture = new Shader(fallbackImage,"engineNoImageTexture");
    });
  }
  
  componentDidMount(){
    RenderEngine.instance = this;
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
    
    $.get(scriptRoute).then(scriptFile=>{
      h.kreator(scriptFile).then(scriptData=>{
        var commands = (scriptData as {[key:string]:string})[destination].main;
        this.nodes = (scriptData as {[key:string]:string})[destination].nodes;
        const commandsF = new Function ("engine","ExtendedObjects",commands);
        console.log(commandsF); 
        commandsF(self,ExtendedObjects);
        self.isReady = true;
        self.forceUpdate();
      })
    })
  }
  loadNode(nodeId: string){
    var commands = this.nodes[nodeId];
    const commandsF = new Function ("engine","ExtendedObjects",commands);
    // console.log(commandsF); 
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
    if(areClientSideResources && this.texturesList.exist(textureId)){
      console.warn(`Textura de nombre ${textureId} ya existe. Saltando...`);
      return new Promise((resolve, reject)=>{resolve(null);});
    }
    return new Promise((resolve, reject)=>{
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
    this.engineSpeed = 1;
    this.stopEngine = false; //Stop engine time

    this.redraw = true;

    this.graphArray = new RenList();//array de objetos, un objeto para cada imagen en pantalla
    this.anims = new RenList();
    this.triggers = new RenList();

    this.textureAnims = new RenList();

    this.collisionLayer = new CollisionLayer();

    this.keyboardTriggers = new RenList();
    this.pressedKeys = [];

    //Rendering-related stuff
    const self = this;
    const handler = {
      get(target, prop:string) {
        return typeof  target[prop] === 'object' &&  target[prop] !== null ? new Proxy(target[prop],handler) :  target[prop];
      },
      set(target, prop:string, value:any) {
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
    
    this.calculationOrder = [];

    this.dimentionsPack = {};
    this.renderingOrderById = [];
 
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
          const dimentionsPack = generateObjectsDisplayDimentions(canvas, this.graphArray, this.dimentionsPack,this.calculationOrder,this.camera);
          this.dimentionsPack = dimentionsPack;
          this.renderingOrderById = generateRenderingOrder(dimentionsPack);

          const endOrdB = performance.now()-startOrdA;

          const orderingTime = endOrdB;

          if(!this.redraw){
            return [0];
          }

          this.canvasRef = canvas;
          const resolution = canvas.resolution;

          canvas.context.clearRect(0, 0, resolution.width, resolution.height);//cleanning window

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
            const strRef = gObject.text == null ? null : getStr(gObject.text);
            const fontSizeRenderingValue = gObject.fontSizeNumeric*resolution.scale*(resolution.height/this.developmentDeviceHeight)*testD;
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
    }else{
      return(<span className="text-white absolute">ISN'T READY YET, OR UNABLE TO RUN YOUR SCRIPT</span>);
    }
  }
  pracket(){
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
        this.calculationOrder = generateCalculationOrder(this.graphArray);
        const dimentionsPack = generateObjectsDisplayDimentions(canvas, this.graphArray, this.dimentionsPack,this.calculationOrder,this.camera);
        this.dimentionsPack = dimentionsPack;
        this.renderingOrderById = generateRenderingOrder(dimentionsPack);

        if(!this.redraw){
          return [0];
        }

        this.canvasRef = canvas;
        const resolution = canvas.resolution;

        canvas.context.clearRect(0, 0, resolution.width, resolution.height);//cleanning window

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

        }
        this.collisionLayer.update(dimentionsPack,resolution.width,resolution.height);

        // this.redraw = false;
        return [0,0,0,0,objectsToRender,0];
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