import React from "react";
import $ from "jquery";
import {Howl} from 'howler';

import { Canvas } from "./Canvas";

import { Animation } from "../engineComponents/Animation"
import { GraphObject } from "../engineComponents/GraphObject";
import { RenList } from "../engineComponents/RenList";
import { KeyboardTrigger, Trigger } from "../engineComponents/Trigger";

import { lambdaConverter, mobileCheck, wrapText } from "../logic/Misc";
import { Shader } from "./Shaders";
import gsap from "gsap";
import { TextureAnim } from "../engineComponents/TextureAnim";
import { CodedRoutine } from "../engineComponents/CodedRoutine";
import { Chaos } from "./ChaosInterpreter";
import { generateCalculationOrder } from "./RenderingOrder";

import noImageTexture from "./no-image.png"

/**
 * aaaaa
 * 
 * @class RenderEngine
 * @param {boolean} [props.repeat=false] clientSideResources (as flag) = The engine won't look for a server to get the game resources
 * @param {string} props.aspectRatio - Set aspect ratio (default 16:9)
 * 
 */
class RenderEngine extends React.Component{
  constructor(props){
    super(props);
    this.id = "rengine" + String(window.performance.now()).replaceAll(".","");
    this.projectRoot = "";
    if(props){
      this.isReady = props.clientSideResources || false;
      this.aspectRatio = props.aspectRatio || "16:9";
      this.showFps = props.showFps || false;
      this.cyclesPerSecond = props.cyclesPerSecond || 24;
      this.developmentDeviceHeight = props.developmentDeviceHeight || window.screen.height*window.devicePixelRatio;
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
      graphObject : GraphObject,
      animation : Animation,
      textureAnim : TextureAnim,
      trigger: Trigger,
      keyboardTrigger : KeyboardTrigger,
      codedRoutine : CodedRoutine,
    }
    this.graphObject = GraphObject;
    this.animation = Animation;

    this.codedRoutine = CodedRoutine;

    this.graphArray = new RenList();//array de objetos, un objeto para cada imagen en pantalla
    this.anims = new RenList();
    this.triggers = new RenList();
    this.gameVars = {};//Y guardar esto tambien
    this.texturesList = new RenList();
    this.textureAnims = new RenList();//gifs-like
    this.soundsList = new RenList();

    this.keyboardTriggers = new RenList();
    this.pressedKeys = [];

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

    //Rendering-related stuff
    this.camera = {
      id:"engineCamera",
      maxZ:10000,
      origin:{x:.5,y:.5},
      position:{x:.5,y:.5,z:0,angle:0},
      usePerspective:false
    }
    this.prevCamera = structuredClone(this.camera);

    this.calculationOrder = []; //for di

    this.dimentionsPack = {};
    this.renderingOrderById = [];

    //MOUSE
    this.mouseListener = 0;
    this.mouse = {x:0,y:0,origin:null};

    //Debug values
    this.noRenderedItemsCount = 0;

    this.drawObjectLimits = true;
    this.showBounds = false;
    this.drawTriggers = false;

    this.objectsToDebug = [];//id of the object
    this.setMouseOrigin = false;
    window.setUsePerspective = (x) =>{this.camera.usePerspective = x;}
    window.setCameraPerspectiveCoords = (x,y) =>{this.camera.position = {y:y,x:x};}

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
    this.loadScript(window.backendRoute + "/renderEngineBackend/game/main.txt");
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
  aspectRatioCalc(aspectRatio = this.aspectRatio) {
    const w = document.getElementById("display"+this.id);

    if (aspectRatio != "undefined") {
      let newWidth = Math.floor((w.offsetHeight / (aspectRatio.split(":")[1] * 1)) * (aspectRatio.split(":")[0] * 1));
      let newHeight = Math.floor((w.offsetWidth / (aspectRatio.split(":")[0] * 1)) * (aspectRatio.split(":")[1] * 1));
      if (newWidth <= w.offsetWidth) {
        newHeight = w.offsetHeight;
      } else {
        newWidth = w.offsetWidth;
      }
      gsap.to(document.getElementById("engineDisplay"+this.id), 0, 
        { 
          width : newWidth + "px", 
          height : newHeight + "px"
        } 
      );
      this.engineDisplayRes = {width:newWidth,height:newHeight};
    } else {
      this.engineDisplayRes = {width:w.offsetWidth,height:w.offsetHeight};
      document.getElementById("engineDisplay"+this.id).style.width = w.offsetWidth+"px";
      document.getElementById("engineDisplay"+this.id).style.height = w.offsetHeight+"px";
    }
    this.forceUpdate();  
  }
  /**
   * 
   * @param {String} id 
   * @returns {GraphObject}
   */
  getObject(id){
    var graphObject = new GraphObject();
    graphObject = this.graphArray.get(id);
    //todo: Adapt to autoparse the data
    return graphObject;
  }
  /**
   * 
   * @param {*} gObject 
   * @returns {Shader}
   */
  getTexture(gObject){
    var id = gObject.textureName;
    if(this.textureAnims.exist(id)){
      id = this.textureAnims.get(id).getTexture(this.engineTime);
    }
    try {
      const res = this.texturesList.get(id);
      return res;
    } catch (error) {
      // console.error(id +" Texture or TextureAnim wasn't found")
      // console.table(this.texturesList.objects); 
      // console.table(this.textureAnims.objects);
      return this.noImageTexture;
    }
  }

  /**
   * 
   * @param {*} text 
   * @returns {string}
   */
  getStr(text){
    try {
      if(typeof text == "function"){
        text = text(this);
      }
      if(typeof text != "string"){
        text = text.toString();
      }
      return text; 
    } catch (error) {
      console.warn("UNREADABLE STUFF DETECTED!!!!");
      console.log(text);
      console.error(error);
      return "UNREADABLE STUFF";
    }
  }

  componentDidCatch(error,info){
    console.error("RenderEngine several crash!!");
    console.warn(error);
    console.log(info);
  }
  loadSound(indexPath){
    const self = this;
    return new Promise(function (resolve, reject) {
      if(indexPath.indexOf(".")==0){
        indexPath = indexPath.substring(1);
      }
      fetch(indexPath)
        .then(res =>{return res.json()})
        .then(soundsList=>{
          if(Object.keys(soundsList).length > 0){
            Promise.all(Object.keys(soundsList).map(sndName=>
              new Promise(resolveFile=>{
                fetch(self.projectRoot + "snd/" + soundsList[sndName].replace("./","")).then(res=>res.blob()).then( blob =>{
                  var reader = new FileReader() ;
                  reader.onload = function(){ 
                    resolveFile({Base64:this.result,ext:soundsList[sndName].split('.').at(-1),id:sndName}) 
                  };
                  reader.readAsDataURL(blob) ;
                });
              })
            )).then(sounds => {
              sounds.forEach(snd => {
                var sound = new Howl({
                  src: [snd.Base64],
                  format: snd.ext
                });
                self.soundsList.push({sound:sound,id:snd.id})
              });
              resolve();
            }).catch(reason =>{
              console.error("===============================");
              console.error("Error during sounds load phase:");
              console.error(reason);
              console.error("===============================");
            });
          }else{
            console.warn("No sounds in this file: "+indexPath);
            if(typeof fun == "function")
                resolve();
          }
        })
    })
  }
  loadTexture(indexPath, textureId=""){
    const self = this;
    if("clientSideResources" in this.props){
      return new Promise(function (resolve, reject) {
        const image = new Image();
        image.crossOrigin = "Anonymous";
        image.src = indexPath;
        image.addEventListener('load',()=>{
          // const res = new Object({[textureId]:image});
          self.texturesList.push(new Shader(image,textureId))
          resolve();
        });
      });
    }

    return new Promise(function (resolve, reject) {
      if(indexPath.indexOf(".")==0){
        indexPath = indexPath.substring(1);
      }
      fetch(indexPath)
        .then(res =>{return res.json()})
        .then(texturesData=>{
          Promise.all(Object.keys(texturesData).map(textureName=>{
            if(self.texturesList.exist(textureName)){
              new Promise(resolveFile=>{console.warn(textureName + " already in engine.textureList");resolveFile({});});
            }else{
              new Promise(resolveFile=>{
                const image = new Image();
                image.crossOrigin = "Anonymous";
                image.src = self.projectRoot + "img/" + texturesData[textureName].replace("./","");
                image.addEventListener('load',()=>{
                  const res = new Object({[textureName]:image});
                  self.texturesList.push(new Shader(image,textureName))
                  resolveFile(res);
                });
              })
            }
          })).then(() => {
            resolve();
          }).catch(reason =>{
            console.error("===============================");
            console.error("Error during textures load phase:");
            console.error(reason);
            console.error("===============================");
          });
        })
      })
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

  play(songId){
    this.soundsList.get(songId).sound.play();
  }


  arrayiseTree(){
    const calculationOrder = this.calculationOrder;
    var base ={};
    var arr = [];
    calculationOrder.map(element=>{
      if(!([element.weight] in base)){
        Object.assign(base,{[element.weight]:[]});
      }
      base[element.weight].push(element.id);
    });
    Object.keys(base).forEach(weight=>{
      arr = arr.concat(base[weight]);
    });
    return arr;
  }
  generateObjectsDisplayDimentions(){
    let res;
    const canvas = this.canvasRef;
    const camera = this.camera;

    const arrayiseTree = this.arrayiseTree();
    for (let index = 0; index < this.graphArray.length; index++) {
      const gObject = this.getObject(arrayiseTree[index]);
      if(!gObject.pendingRenderingRecalculation){
        continue;
      }

      const texRef = gObject.textureName == null ? null : this.getTexture(gObject);
      const resolution = {
        height:canvas.resolutionHeight,
        width:canvas.resolutionWidth
      };

      const origin = {
        x: gObject.parent == "" ? 0 : this.dimentionsPack[gObject.parent].base.x,
        y: gObject.parent == "" ? 0 : this.dimentionsPack[gObject.parent].base.y
      };

      // const addition = !this.camera.usePerspective && !gObject.ignoreParallax && gObject.parent == "" ? 
      let addition = {x:0,y:0};
      if (!camera.usePerspective && gObject.ignoreParallax){
        addition = {x:-camera.position.x+.5, y:-camera.position.y+.5};
      }

      var objectScale = gObject.scale;
      var objectLeft = (gObject.x + origin.x + addition.x)*resolution.height + (camera.origin.x-0.5)*resolution.width;
      var objectTop = (gObject.y + origin.y + addition.y + (camera.origin.y-0.5))*resolution.height;
      var objectZ = gObject.accomulatedZ + camera.position.z;
      
      var testD = 0.99;

      // if(camera.usePerspective && !gObject.ignoreParallax){
      if(camera.usePerspective && !gObject.ignoreParallax){
        const tangencialConstant = canvas.resolutionHeight/(this.camera.maxZ*canvas.resolutionWidth);

        objectLeft = gObject.x + origin.x - this.camera.position.x+0.5;
        objectTop = gObject.y + origin.y - this.camera.position.y+0.5;
        objectZ = gObject.accomulatedZ - this.camera.position.z+0.56;

        const perspectiveDiff = 1-((1/(objectZ))-(1))/((1/camera.maxZ)-(1));
        const toAddSize = perspectiveDiff * tangencialConstant*(resolution.height)*camera.maxZ;
        const computedPercentageSize = (100 / resolution.height) * (toAddSize);
        const perspectiveScale = computedPercentageSize/100;
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
          objectWidth = texRef.texture.naturalWidth*objectScale*gObject.widthScale*(resolution.height/this.developmentDeviceHeight);
          objectHeight = texRef.texture.naturalHeight*objectScale*gObject.heightScale*(resolution.height/this.developmentDeviceHeight);
        }else{
          objectHeight = (texRef.texture.naturalHeight/texRef.texture.naturalWidth)*resolution.width*objectScale*gObject.heightScale;
        }
      }
      res = {
        id: gObject.id,
        x : objectLeft,
        y : objectTop,
        z : objectZ,
        base:{
          x:origin.x + gObject.x,
          y:origin.y + gObject.y,
          //z:gObject.z//*accomulated z
        },
        sizeInDisplay : testD,
        width : objectWidth,
        height : objectHeight
      }
      Object.assign(this.dimentionsPack,{[gObject.id]:res});
    }
    //*Build rendering order
    var zRefs = {};
    var zetas = [];
    var renderingOrderById = [];
    Object.keys(this.dimentionsPack).forEach(id=>{
      const z = this.dimentionsPack[id].z.toString(); 
        if(Object.keys(zRefs).indexOf(z) == -1){
          Object.assign(zRefs,{[z]:[id]});
          zetas.push(z*1)
        }else{
          zRefs[z].push(id);
        }
    });
    zetas.sort((a, b) => a - b).reverse().forEach(zIndex => {
      zRefs[zIndex.toString()].forEach(id => {
        renderingOrderById.push(id);
      });
    });
    this.renderingOrderById = renderingOrderById;
    //*Update camera data
    this.prevCamera = structuredClone(this.camera);
  }
  renderScene(){
    if(this.isReady){
      return(
        <Canvas 
        CELGF={(er)=>{console.error(er)}} 
        displayResolution={this.engineDisplayRes} 
        id={"renderCanvas" +Math.floor(window.performance.now()*10000000).toString()} 
        fps={this.cyclesPerSecond} 
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
          this.calculationOrder = generateCalculationOrder(this.graphArray);
          this.generateObjectsDisplayDimentions();

          this.canvasRef = canvas;
          canvas.context.clearRect(0, 0, canvas.resolutionWidth, canvas.resolutionHeight);//cleanning window

          this.noRenderedItemsCount = 0;

          const availableIdsToRender = this.renderingOrderById.filter(id =>{return this.graphArray.ids().indexOf(id) != -1}); 
          for (let index = 0; index < this.graphArray.length; index++) {
            const gObject = this.getObject(availableIdsToRender[index]);
            const texRef = gObject.textureName == null ? null : this.getTexture(gObject);
            const strRef = gObject.text == null ? null : this.getStr(gObject.text);

            var objectLeft = this.dimentionsPack[gObject.id].x;
            var objectTop = this.dimentionsPack[gObject.id].y;
            var objectZ = this.dimentionsPack[gObject.id].z;
            
            var testD = this.dimentionsPack[gObject.id].sizeInDisplay;

            var objectWidth = this.dimentionsPack[gObject.id].width;
            var objectHeight = this.dimentionsPack[gObject.id].height;

            if(!(gObject.opacity == 0)){
               //*part one: global alpha
              canvas.context.globalAlpha = gObject.opacity;//if the element to render have opacity != of the previous rendered element}

              //*part two: filtering
              var filterString = gObject.filterString;
              if(((((objectZ-this.camera.position.z)>50))) && !this.camera.usePerspective && gObject.ignoreParallax){//ignore filters
                filterString = "none";
              }

              //*part three
              //with testD > 0.003 we ensure the very far of|behind the camera elements won't be rendered
              if(testD>0.003){
                let texts;
                if(strRef != null){
                  canvas.context.font = (gObject.fontSizeNumeric*canvas.scale*(canvas.resolutionHeight/700)*testD)+"px "+gObject.font;
                  // console.warn(canvas.context.font);
                  texts = wrapText(//TODO: Wrap it until all the text get wraped
                    canvas.context,
                    strRef,
                    (gObject.margin*objectWidth) + objectLeft - (objectWidth/2),
                    (gObject.margin*objectHeight) + objectTop + (gObject.fontSizeNumeric*canvas.scale*(canvas.resolutionHeight/700)*testD) - (objectHeight/2),
                    objectWidth - (gObject.margin*objectWidth)*2,
                    (gObject.fontSize*canvas.scale*(canvas.resolutionHeight/700)*testD*window.devicePixelRatio*.6),
                    gObject.center
                  );
                }
                canvas.context.filter = filterString;//if the element to render have filtering values != of the previous element
                if(gObject.rotate != 0){
                  canvas.context.save();
                  canvas.context.setTransform(//transform using center as origin
                    1,
                    0,
                    0,
                    1,
                    objectLeft, 
                    objectTop); // sets scale and origin
                  canvas.context.rotate(gObject.rotateRad);

                  if(strRef != null){
                    if(gObject.boxColor != "transparent"){
                      canvas.context.fillStyle = gObject.boxColor;
                      canvas.context.fillRect(
                        -(objectWidth)/2,
                        -(objectHeight)/2,
                        objectWidth,
                        objectHeight
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
                      -(objectWidth)/2,
                      -(objectHeight)/2,
                      objectWidth,
                      objectHeight
                    );
                  }

                  canvas.context.restore();
                }else{
                //*part three: draw image
                  if(strRef != null){
                    if(gObject.boxColor != "transparent"){
                      canvas.context.fillStyle = gObject.boxColor;
                      canvas.context.fillRect(
                        objectLeft-(objectWidth/2),
                        objectTop-(objectHeight/2),
                        objectWidth,
                        objectHeight
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
                      objectLeft-(objectWidth/2),
                      objectTop-(objectHeight/2),
                      objectWidth,
                      objectHeight
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

            //*DEBUG INFO
            if(this.objectsToDebug.indexOf(gObject.id) != -1){
              //*part five: draw object info
              if(this.drawObjectLimits){
                //draw image center
                canvas.context.lineWidth = 5;
                canvas.context.strokeStyle = gObject.z - this.camera.position.z > 0 ? "green":"red";
                canvas.context.beginPath();
                canvas.context.arc(
                  objectLeft, 
                  objectTop, 
                  5, 
                  0, 
                  2 * Math.PI);
                canvas.context.lineTo(
                  canvas.resolutionWidth/2,
                  canvas.resolutionHeight/2
                );
                canvas.context.stroke();
                //image dimensions
                canvas.context.globalCompositeOperation = "exclusion";
                canvas.context.strokeStyle = "orange";
                
                canvas.context.strokeRect(
                  objectLeft-(objectWidth/2),
                  objectTop-(objectHeight/2),
                  objectWidth,
                  objectHeight);
                canvas.context.globalCompositeOperation = "source-over";
              }
            }
            //* DRAW TRIGGERS
            if(this.drawTriggers){
              if(this.triggers.objects.filter(e=>{return e.enabled}).map(e=>e.relatedTo).indexOf(gObject.id) != -1){
                canvas.context.strokeStyle = "blue";
                canvas.context.fillStyle = "blue";
                canvas.context.globalAlpha = .3;
                canvas.context.lineWidth = 3;
                canvas.context.setLineDash([4, 4]);
                  
                canvas.context.fillRect(
                  objectLeft-(objectWidth/2),
                  objectTop-(objectHeight/2),
                  objectWidth*canvas.scale,
                  objectHeight*canvas.scale);
                canvas.context.globalAlpha = 1;
                canvas.context.strokeRect(
                  objectLeft-(objectWidth/2),
                  objectTop-(objectHeight/2),
                  objectWidth*canvas.scale,
                  objectHeight*canvas.scale);
                
                canvas.context.setLineDash([]);
                canvas.context.fillStyle = "";
              }
            }
          }
          // console.warn("Objects excluded: ",this.noRenderedItemsCount);
          //*part seven: draw canvas grid
          if(this.showBounds){
            var grid = {
              x: -this.camera.position.x+0.5,
              y: -this.camera.position.y+0.5,
              z: (this.camera.usePerspective ? -this.camera.position.z : 0)+0.56
            }
            const tangencialConstant = canvas.resolutionHeight/(this.camera.maxZ*canvas.resolutionWidth);
            const perspectiveDiff = 1-((1/(grid.z))-(1))/((1/this.camera.maxZ)-(1));
            const toAddSize = perspectiveDiff * tangencialConstant*(canvas.resolutionHeight)*this.camera.maxZ;
            const computedPercentageSize = (100 / canvas.resolutionHeight) * (toAddSize);
            const perspectiveScale = computedPercentageSize/100;

            //*recalculate gobject coords
            var perspectiveLayer = {
              width:canvas.resolutionHeight*perspectiveScale,
              height:canvas.resolutionHeight*perspectiveScale
            }
              //it will calc were the image must to be, inside the perspectiveLayer
            grid.x *= perspectiveLayer.width;
            grid.y *= perspectiveLayer.height;
            //now add the origin of the perspectiveLayer
            grid.x += -(perspectiveLayer.width-canvas.resolutionHeight)*this.camera.origin.x;
            grid.y += -(perspectiveLayer.height-canvas.resolutionHeight)*this.camera.origin.y;

            const height = perspectiveLayer.height;
            const width = height*(canvas.resolutionWidth/canvas.resolutionHeight);

            canvas.context.beginPath();
            canvas.context.lineWidth = 5*perspectiveScale;
            canvas.context.strokeStyle = "green";

            canvas.context.moveTo(
              grid.x,
              grid.y
            );
            canvas.context.lineTo(
              width + grid.x,
              grid.y
            );
            canvas.context.lineTo(
              width + grid.x,
              height + grid.y
            );
            canvas.context.lineTo(
              grid.x,
              height + grid.y
            );
            canvas.context.lineTo(
              grid.x,
              grid.y
            );
            canvas.context.closePath();
            canvas.context.stroke();

            canvas.context.beginPath();
            canvas.context.strokeStyle = "blue";
            canvas.context.lineWidth = 1*perspectiveScale;
            canvas.context.moveTo(
              height+grid.x,
              grid.y
            );
            canvas.context.lineTo(
              height+grid.x,
              height+grid.y
            );

            canvas.context.closePath();
            canvas.context.stroke();
            
          }
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
        events={(fps)=>{
          const mix = this.pressedKeys.join(" ");
          if(this.keyboardTriggers.exist(mix) && (this.pressedKeys.length>1)){
            this.keyboardTriggers.get(mix).check(this,"onHold");
          }
          this.pressedKeys.forEach(key => {
            if(this.keyboardTriggers.exist(key)){
              this.keyboardTriggers.get(key).check(this,"onHold");
            }
          });
          
          this.engineTime += (fps.elapsed * (this.stopEngine ? 0 : this.engineSpeed));
          for (let index = 0; index < this.anims.objects.length; index++) {
            const anim = this.anims.objects[index];
            if(anim.relatedTo != null){
              anim.updateState(
                this.engineTime,
                (relatedTo)=>{
                  return relatedTo != "engineCamera" ?
                    this.getObject(relatedTo):
                    this.camera},
                    this);
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

    //*Check the assigned triggers
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
              if(this.setMouseOrigin){
                this.mouse.origin = targetGraphObjectId;
              }
              break;
            }
          }
        }
      }
    }
    //*check the unassigned triggers
    for (const triggerId of this.triggers.relatedToNullList()){
      this.triggers.get(triggerId).check(mouse,action);
    }
    if(action == "onMouseMove"){
      //onLeave part, activar el onLeave en todos aquellos triggers que no se activaron previamente
      let unexecutedTriggers;

      if (targetGraphObjectId in objectsWithTriggersList){
        unexecutedTriggers = triggersIdList.filter((triggerId) => {return objectsWithTriggersList[targetGraphObjectId].indexOf(triggerId) == -1});
      }else{
        unexecutedTriggers = triggersIdList;
      }
      
      unexecutedTriggers.forEach(triggerId => {
        const trigger = this.triggers.get(triggerId);
        if(trigger.relatedTo != null){
          trigger.check(this,"onLeave");
        }
      });
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
export {RenderEngine}