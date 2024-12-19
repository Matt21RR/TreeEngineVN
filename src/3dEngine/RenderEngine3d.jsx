import React from "react";
import $ from "jquery";
import {Howl} from 'howler';

import { Canvas } from "./Canvas";

import { Animation } from "../engineComponents/Animation";
import { GraphObject } from "../engineComponents/GraphObject";
import { RenList } from "../engineComponents/RenList";
import { KeyboardTrigger, Trigger } from "../engineComponents/Trigger";

import { mobileCheck} from "../logic/Misc";
import gsap from "gsap";
import { TextureAnim } from "../engineComponents/TextureAnim";
import { CodedRoutine } from "../engineComponents/CodedRoutine";
import { Chaos } from "./ChaosInterpreter";

/**
 * RenderEngine - By Matt1RR\n
 * clientSideResources (as flag) = The engine won't look for a server to get the game resources
 */
class RenderEngine3d extends React.Component{
  constructor(props){
    super(props);
    this.id = "rengine" + String(window.performance.now()).replaceAll(".","");
    this.projectRoot = "";
    if(this.props){
      this.isReady = "clientSideResources" in this.props ? true : false;
      this.aspectRatio = "aspectRatio" in this.props ? this.props.aspectRatio : "16:9";
    }
    this.engineDisplayRes = {width:0,height:0};
    this.resizeTimeout = 0;
    this.isMobile = mobileCheck();
    this.mounted = false; //internal check
    this.canvasRef = {}; //Reference to the canvas used to render the scene

    this.engineTime = 0;
    this.engineSpeed = 1;
    this.stopEngine = false; //Stop engine time

    this.actualSceneId = "";//Guardar esto

    this.constructors = {
      animation : Animation,
      trigger: Trigger,
      keyboardTrigger : KeyboardTrigger,
      codedRoutine : CodedRoutine,
    }
    this.graphObject = GraphObject;
    this.animation = Animation;

    this.codedRoutine = CodedRoutine;

    this.anims = new RenList();

    this.keyboardTriggers = new RenList();
    this.pressedKeys = [];

    this.codedRoutines = new RenList();
    this.routines = new Array();
    this.flags = new Object();
    this.routineNumber = -1;
    this.continue = true;

    //Rendering-related stuff
    this.camera = {
      id:"engineCamera",
      origin:{x:.5,y:.5},
      position:{x:.5,y:.5,z:0},
    }

    window.engine3dRef = this;
  }  
  componentDidMount(){
    if (!this.mounted) {
      this.mounted = true;
      //* ASPECT RATIO
      window.setTimeout(() => {
        this.aspectRatioCalc();
      }, 200);

      new ResizeObserver(() => {
        if(!("avoidResizeBlackout") in this.props)
          gsap.to(document.getElementById("engineDisplay"+this.id), 0, { opacity: 0 });
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(
          () => {
            this.aspectRatioCalc();
            if(!("avoidResizeBlackout") in this.props)
            gsap.to(document.getElementById("engineDisplay"+this.id), 0, { opacity: 1 });
          }, 800);
      })
      .observe(document.getElementById("display"+this.id));

      //*LOAD GAME
      if(!("clientSideResources" in this.props)){
        this.entryPoint();
      }else{
        if("setEngine" in  this.props ){
          this.props.setEngine(this);
        }
      }
      
      //*TECLADO
      const self = this;
      document.body.addEventListener("keydown",function(e){
        const keyCode = e.code;
        if(self.pressedKeys.indexOf(keyCode) == -1){
          self.pressedKeys.push(keyCode);
          const mix = self.pressedKeys.join(" ");
          if(self.keyboardTriggers.exist(mix)){
            self.keyboardTriggers.get(mix).check(self,"onPress");
          }
          if(self.pressedKeys.length > 1){//Si hay mas de una tecla oprimiendose, comprobar la ultima tecla
            if(self.keyboardTriggers.exist(keyCode)){
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
          self.keyboardTriggers.get(mix).check(self,"onRelease");
        }
        if(self.pressedKeys.length > 0){//Si habia mas de una tecla oprimiendose, comprobar la tecla que se soltó
          if(self.keyboardTriggers.exist(keyCode)){
            self.keyboardTriggers.get(keyCode).check(self,"onRelease");
          }
        }
      });
    }
  }
  entryPoint(){
    this.loadScript("http://localhost/renderEngineBackend/game/main.txt");
  }
  loadScript(scriptRoute){
    this.dataCleaner();
    const h = new Chaos();
    var self = this;
    $.get(scriptRoute).then(scriptFile=>{
      this.projectRoot = h.projectRoot;
      h.kreator(scriptFile).then(scriptData=>{
        var commands = scriptData["gameEntrypoint"];
        commands = commands.join("");
        const commandsF = new Function ("engine",commands);
        commandsF(self);
        self.isReady = true;
        self.forceUpdate();
        if("setEngine" in  self.props ){
          self.props.setEngine(self);
        }
      })
    })
  }
  componentDidCatch(error,info){
    console.error("RenderEngine3d several crash!!");
    console.warn(error);
    console.log(info);
  }
  dataCleaner(){
     //reset values
     this.engineTime = 0;
     this.graphArray = new RenList();//array de objetos, un objeto para cada imagen en pantalla
     this.anims = new RenList();
     this.triggers = new RenList();
     this.keyboardTriggers = new RenList();
     this.textureAnims = new RenList();
 
     this.camera = {
       maxZ:1000,
       origin:{x:.5,y:.5},//position of the virtual engineDisplay
       position:{x:.5,y:.5,z:0,angle:0},//position od the camera in the space.... angle? who knows (0_-)
       usePerspective:false, //or use3D
     }
     this.dimentionsPack = {};
 
     this.codedRoutines = new RenList();
     this.routines = new Array();
     this.flags = new Object();
     this.routineNumber = -1;
     this.continue = true;
     //Dialogs
     this.voiceFrom = "";
     this.paragraphNumber = 0;
     this.paragraph = "";
     this.dialogNumber = 0;
     this.dialog = [];
     this.narration = "";
  }
  renderScene(){
    if(this.isReady){
      console.log(this.showFps)
      return(
        <Canvas 
        CELGF={(er)=>{console.error(er)}} 
        displayResolution={this.engineDisplayRes} 
        id={"renderCanvas"} 
        fps={24} 
        scale={1} 
        showFps={this.showFps}
        // debugMessage={[
        //   ()=>{return "x: "+this.camera.position.x},
        //   ()=>{return "y: "+this.camera.position.y},
        //   ()=>{return "z: "+this.camera.position.z},
        //   ()=>{return "usePerspective: "+this.camera.usePerspective},
        // ]}
        engine={this}
        renderGraphics={(canvas)=>{
          
        }} 
        onLoad={(canvas)=>{
          //calc the perspective angle
          this.camera.position.angle = canvas.resolutionHeight/(this.camera.maxZ*canvas.resolutionWidth);
          //disable image smoothing
          canvas.context.imageSmoothingEnabled = false;
          canvas.context.imageSmoothingQuality = "low";
          canvas.context.textRendering = "optimizeSpeed";
        }}
        onResize={(canvas)=>{
          //calc the perspective angle
          this.camera.position.angle = canvas.resolutionHeight/(this.camera.maxZ*canvas.resolutionWidth);
          //disable image smoothing
          canvas.context.imageSmoothingEnabled = false;
          canvas.context.imageSmoothingQuality = "low";
          canvas.context.textRendering = "optimizeSpeed"; 

          this.graphArray.objects.forEach(e=>{e.pendingRenderingRecalculation = true;})
        }}
        events={(canvas)=>{
          
          const mix = this.pressedKeys.join(" ");
          if(this.keyboardTriggers.exist(mix) && (this.pressedKeys.length>1)){
            this.keyboardTriggers.get(mix).check(this,"onHold");
          }
          this.pressedKeys.forEach(key => {
            if(this.keyboardTriggers.exist(key)){
              this.keyboardTriggers.get(key).check(this,"onHold");
            }
          });
          
          this.engineTime += (canvas.fps.elapsed * (this.stopEngine ? 0 : this.engineSpeed));
          for (let index = 0; index < this.anims.objects.length; index++) {
            const anim = this.anims.objects[index];
            if(anim.relatedTo != null){
              anim.updateState(this.engineTime,(relatedTo)=>{return relatedTo!="engineCamera"?this.getObject(relatedTo):this.camera},this);
            }
          }  
        }}
        animateGraphics={(canvas)=>{
          if(this.continue){
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
  checkTriggers(mouse,action){//check using mouse stats
    var offset = $("#"+"triggersTarget"+this.id).offset();
    let mX,mY;
    var clientX;
    var clientY;
    if(this.isMobile){
      if(action == "onHold"){
        clientX = mouse.touches[0].clientX;
        clientY = mouse.touches[0].clientY;
      }else{
        clientX = mouse.changedTouches[0].clientX;
        clientY = mouse.changedTouches[0].clientY;
      }
    }else{
      clientX = mouse.clientX;
      clientY = mouse.clientY;
    }
    clientX-=offset.left;
    clientY-=offset.top;

    mX = clientX/mouse.target.clientWidth;
    mY = clientY/mouse.target.clientHeight;
    //move mouse "digital coords" with camera origin
    mX += (0.5-this.camera.origin.x);
    mY += (0.5-this.camera.origin.y);

    this.mouse.x = mX * (this.canvasRef.resolutionWidth/this.canvasRef.resolutionHeight);
    this.mouse.y = mY;

    mX *= this.canvasRef.resolutionWidth;
    mY *= this.canvasRef.resolutionHeight;

    var targetGraphObjectId = "";
    var reversedRenderOrderList = [].concat(this.renderingOrderById).reverse();
    const availableIdsToRender = reversedRenderOrderList.filter(id =>{return this.graphArray.ids().indexOf(id) != -1}); 
    const objectsWithTriggersList = this.triggers.relatedToReversedList();
    const triggersIdList = this.triggers.objects.filter(e=>{return e.enabled}).map(e=>{return e.id});

    for (let index = 0; index < availableIdsToRender.length; index++) {
      const gO = this.dimentionsPack[availableIdsToRender[index]];

      var objectWidth = gO.width;
      var objectHeight = gO.height;

      const gOy = gO.y - objectHeight/2;
      const gOx = gO.x - objectWidth/2;
      if(mY>=gOy && (this.getObject(gO.id).opacity != 0)){
        if(mX>=gOx){
          if(mY<=(gOy+(objectHeight))){
            if(mX<=(gOx+(objectWidth))){
              targetGraphObjectId = gO.id;
              if(targetGraphObjectId in objectsWithTriggersList){
                objectsWithTriggersList[targetGraphObjectId].forEach(triggerId => {
                  try {
                    this.triggers.get(triggerId).check(this,action);
                  } catch (error) {
                    console.log("Error on trigger execution:",error,this.triggers.get(triggerId))
                  }
                });
              }
              break;
            }
          }
        }
      }
    }
    if(action == "mouseMove"){
      //onLeave part, activar el onLeave en todos aquellos triggers que no se activaron previamente
      let unexecutedTriggers;

      if (targetGraphObjectId in objectsWithTriggersList){
        unexecutedTriggers = triggersIdList.filter((triggerId) => {return objectsWithTriggersList[targetGraphObjectId].indexOf(triggerId) == -1});
      }else{
        unexecutedTriggers = triggersIdList;
      }
      
      unexecutedTriggers.forEach(triggerId => {
        const trigger = this.triggers.get(triggerId);
        trigger.check(this,"onLeave");
      });
    }
  }
  triggersTarget(){
    if(this.isMobile){
      return (
        <div className="absolute w-full h-full"
          onTouchStart={(e)=>this.checkTriggers(e,"onHold")}
          onTouchEnd={(e)=>this.checkTriggers(e,"onRelease")}
        />
      );
    }else{
      return (
        <div className="absolute w-full h-full"
          id={"triggersTarget"+this.id}
          onMouseDown={(e)=>this.checkTriggers(e,"onHold")}
          onMouseUp={(e)=>{e.preventDefault();this.checkTriggers(e,"onRelease")}}
          onMouseMove={(e)=>{if(this.mouseListener+(1000/40) < performance.now()){this.mouseListener = performance.now();this.checkTriggers(e,"mouseMove")}}}
        />
      );
    }
    
  }
  engineDisplay(){
    if(Object.keys(this.engineDisplayRes).length >0){
      return(
        <>
          {this.renderScene()}
        </>
      );
    }
  }
  render(){
    return(
      <div className="relative w-full h-full mx-auto my-auto" id={'display'+this.id}>
        <div className="bg-black absolute w-full h-full flex">
          <div className="relative w-full h-full mx-auto my-auto" id={'engineDisplay'+this.id}>
            <div className="absolute w-full h-full">
              {this.engineDisplay()}
              {this.triggersTarget()}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
export {RenderEngine3d}