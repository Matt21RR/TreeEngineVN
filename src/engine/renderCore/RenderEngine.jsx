import React from "react";
import $ from "jquery";
import {Howl} from 'howler';

import { Canvas } from "./Canvas";

import { Animation } from "../engineComponents/Animation";
import { GraphObject } from "../engineComponents/GraphObject";
import { RenList } from "../engineComponents/RenList";
import { KeyboardTrigger, Trigger } from "../engineComponents/Trigger";

import { mobileCheck, wrapText } from "../logic/Misc";
import { Shader } from "./ShadersUnstable";
import gsap from "gsap";
import { TextureAnim } from "../engineComponents/TextureAnim";
import { CodedRoutine } from "../engineComponents/CodedRoutine";
import { Chaos } from "./ChaosInterpreter";

class RenderEngine extends React.Component{
  constructor(props){
    super(props);
    this.id = "rengine" + String(window.performance.now()).replaceAll(".","");
    this.isReady = false;
    this.state = {
      consol: [],//only used by script interpreter errors
    }
    this.projectRoot = "";
    this.aspectRatio = "16:9";
    this.engineDisplayRes = {width:0,height:0};
    this.resizeTimeout = 0;
    this.consolMessagesArray = []
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

    this.showObjectsInfo = false;
    this.drawObjectLimits = true;
    this.showCanvasGrid = false;
    this.drawTriggers = false;
    this.showFps = true;

    this.objectsToDebug = [];//id of the object
    this.setMouseOrigin = false;
    window.setUsePerspective = (x) =>{this.camera.usePerspective = x;}
    window.setCameraPerspectiveCoords = (x,y) =>{this.camera.position = {y:y,x:x};}

    window.engineRef = this;
  }  
  componentDidMount(){
    if (!this.mounted) {
      this.mounted = true;
      //* ASPECT RATIO
      window.setTimeout(() => {
        this.aspectRatioCalc();
      }, 200);

      new ResizeObserver(() => {
        gsap.to(document.getElementById("engineDisplay"+this.id), 0, { opacity: 0 });
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(
          () => {
            this.aspectRatioCalc();
            gsap.to(document.getElementById("engineDisplay"+this.id), 0, { opacity: 1 });
          }, 800);
      }).observe(document.getElementById("display"+this.id))

      //*LOAD GAME

      this.entryPoint();
      
      //*TECLADO
      const self = this;
      document.body.addEventListener("keydown",function(e){
        if(self.pressedKeys.indexOf(e.code) == -1){
          self.pressedKeys.push(e.code);
          const mix = self.pressedKeys.join(" ");
          if(self.keyboardTriggers.exist(mix)){
            self.keyboardTriggers.get(mix).check(self,"onPress");
          }
        }
      });  
      document.body.addEventListener("keyup", function(e){
        const mix = self.pressedKeys.join(" ");
        self.pressedKeys.splice(self.pressedKeys.indexOf(e.code),1);
        if(self.keyboardTriggers.exist(mix)){
          self.keyboardTriggers.get(mix).check(self,"onRelease");
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
        console.log(commandsF);
        commandsF(self);
        self.isReady = true;
        self.forceUpdate();
        if("setEngine" in  self.props ){
          self.props.setEngine(self);
        }
      })
    })
  }
  aspectRatioCalc(op = this.aspectRatio) {
    const w = document.getElementById("display"+this.id);

    if (op != "unset") {
      let newWidth = Math.floor((w.offsetHeight / (op.split(":")[1] * 1)) * (op.split(":")[0] * 1));
      let newHeight = Math.floor((w.offsetWidth / (op.split(":")[0] * 1)) * (op.split(":")[1] * 1));
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
      this.forceUpdate();  
    } else {
      document.getElementById("engineDisplay"+this.id).style.width = "";
      document.getElementById("engineDisplay"+this.is).style.height = "";
    }
  }
  /**
   * Used to show info over the render engineDisplay (canvas)
   * @param {string} text 
   * @param {string} color, default white
   */
  consol(text,color="white") {
    this.consolMessagesArray.push({text:text,color:color});
    this.setState({
      consol: (this.consolMessagesArray),
    })
  }
  cleanConsol(){
    this.setState({
      consol: [],
    });
    this.consolMessagesArray = [];
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
    const res = this.texturesList.get(id);
    if(res == undefined){
      console.log(this.textureAnims);
      debugger;
    }
    return res;
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
  loadTexture(indexPath){
    const self = this;
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
       useTHREE3d:false
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

  generateCalculationOrder(){
    var ordered = 0;
    var order = [];
    var dictionary = [];
    while (ordered < this.graphArray.length) {
      this.graphArray.ids().forEach(id=>{
        if(dictionary.indexOf(id) == -1){
          const gObject = this.getObject(id);
          const parent = gObject.parent;
          if(parent == ""){
            order.push({id:id,weight:0,z:gObject.z});
            gObject.accomulatedZ = gObject.z;
            dictionary.push(id);
            ordered++;
          }
          if(dictionary.indexOf(parent) != -1){
            if(this.getObject(parent).pendingRenderingRecalculation){
              this.graphArray.get(id).pendingRenderingRecalculation = true;
            }
            order.push({id:id,weight:order[dictionary.indexOf(parent)].weight +1});
            gObject.accomulatedZ = gObject.z + this.getObject(parent).accomulatedZ;
            dictionary.push(id);
            ordered++;
          }

        }
      });
    }
    this.calculationOrder = order;
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

  play(songId){
    this.soundsList.get(songId).sound.play();
  }
  generateObjectsDisplayDimentions(){
    let res;
    const canvas = this.canvasRef;
    const camera = this.camera;

    const recalculate = (gObject = new GraphObject())=>{
      if(JSON.stringify(this.prevCamera) != JSON.stringify(this.camera)){
        return true;
      }
      if (!(gObject.id in this.dimentionsPack)){
        return true;
      }else{
        //console.log("recalculation: "+ gObject.id+ " "+ gObject.pendingRenderingRecalculation);
        const rack = gObject.pendingRenderingRecalculation;
        gObject.pendingRenderingRecalculation = false;
        return rack;
      }
    }
    const arrayiseTree = this.arrayiseTree();
    for (let index = 0; index < this.graphArray.length; index++) {
      const gObject = this.getObject(arrayiseTree[index]);

      if(recalculate(gObject)){ //TODO: add check for camera or window modifications
        const texRef = gObject.textureName == null ? null : this.getTexture(gObject);
        const resolution = {
          height:canvas.resolutionHeight,
          width:canvas.resolutionWidth
        };

        const origin = {
          x: gObject.parent == "" ? 0 : this.dimentionsPack[gObject.parent].x, //-this.dimentionsPack[gObject.parent].width/2,
          y: gObject.parent == "" ? 0 : this.dimentionsPack[gObject.parent].y, //-this.dimentionsPack[gObject.parent].height/2,
          z: gObject.parent == "" ?  - this.camera.position.z : 0
        };

        const addition = !this.camera.usePerspective && !gObject.ignoreParallax && gObject.parent == "" ? 
          {x:-this.camera.position.x+.5, y:-this.camera.position.y+.5} : {x:0,y:0};

        var objectScale = gObject.scale;
        var objectLeft = (gObject.x + addition.x + (this.camera.origin.x-0.5))*resolution.height + origin.x;
        var objectTop = (gObject.y + addition.y + (this.camera.origin.y-0.5))*resolution.height + origin.y;
        var objectZ = gObject.accomulatedZ + this.camera.position.z;
        
        var testD = 0.95;

        if(camera.usePerspective && !gObject.ignoreParallax){
          const tangencialConstant = canvas.resolutionHeight/(this.camera.maxZ*canvas.resolutionWidth);

          objectLeft = gObject.x - this.camera.position.x;
          objectTop = gObject.y - this.camera.position.y;
          objectZ = gObject.accomulatedZ - this.camera.position.z;
          const perspectiveDiff = 1-((1/(objectZ))-(1))/((1/camera.maxZ)-(1));
          testD = perspectiveDiff;
          const toAddSize = perspectiveDiff * tangencialConstant*(resolution.height)*camera.maxZ;
          const computedPercentageSize = (100 / resolution.height) * (toAddSize);
          const perspectiveScale = computedPercentageSize/100;
          objectScale *= computedPercentageSize/100;
  
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
          //If is a child object add the parent origin
          // objectLeft += origin.x;
          // objectTop += origin.y;
        }
  
        //By default values for the textboxes
        var objectWidth = resolution.width*objectScale*gObject.widthScale;
        var objectHeight = resolution.height*objectScale*gObject.heightScale;
  
        if(gObject.textureName!=null){
          if(gObject.useEngineUnits){
            objectWidth = texRef.texture.naturalWidth*objectScale*gObject.widthScale*(resolution.height/768);
            objectHeight = texRef.texture.naturalHeight*objectScale*gObject.heightScale*(resolution.height/768);
          }else{
            objectHeight = (texRef.texture.naturalHeight/texRef.texture.naturalWidth)*resolution.width*objectScale*gObject.heightScale;
          }
        }
        res = {
          id: gObject.id,
          x : objectLeft,
          y : objectTop,
          z : objectZ,
          sizeInDisplay : testD,
          width : objectWidth,
          height : objectHeight
        }
        Object.assign(this.dimentionsPack,{[gObject.id]:res});
      }
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
    zetas.sort((a, b) => a - b).reverse();
    zetas.forEach(zIndex => {
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
        CELGF={(error)=>this.consol(error)} 
        displayResolution={this.engineDisplayRes} 
        id={"renderCanvas"} 
        fps={24} 
        scale={1} 
        showFps={this.showFps}
        engine={this}
        renderGraphics={(canvas)=>{
          this.canvasRef = canvas;
          canvas.context.clearRect(0, 0, canvas.resolutionWidth, canvas.resolutionHeight);//cleanning window

          const clientUnitaryHeightPercentageConstant = 100 / canvas.resolutionHeight;
          const tangencialConstant = this.camera.position.angle;//Uses camera angle

          this.noRenderedItemsCount = 0;

          const availableIdsToRender = this.renderingOrderById.filter(id =>{return this.graphArray.ids().indexOf(id) != -1}); 
          for (let index = 0; index < this.graphArray.length; index++) {
            const gObject = this.getObject(availableIdsToRender[index]);
            const texRef = gObject.textureName == null ? null : this.getTexture(gObject);

            const multiply = (!this.camera.usePerspective && !gObject.ignoreParallax) ? this.camera.position.z+1 : 1;

            var objectLeft = this.dimentionsPack[gObject.id].x *multiply;
            var objectTop = this.dimentionsPack[gObject.id].y *multiply;
            var objectZ = this.dimentionsPack[gObject.id].z *multiply;
            
            var testD = this.dimentionsPack[gObject.id].sizeInDisplay;

            var objectWidth = this.dimentionsPack[gObject.id].width *multiply;
            var objectHeight = this.dimentionsPack[gObject.id].height *multiply;

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
                if(gObject.text != null){
                  canvas.context.font = (gObject.fontSizeNumeric*canvas.scale*(canvas.resolutionHeight/700))+"px "+gObject.font;
                  // console.warn(canvas.context.font);

                  var textO = gObject.text;
                  if(typeof textO == "function"){
                    textO = textO(this);
                  }
                  texts = wrapText(//TODO: Wrap it until all the text get wraped
                    canvas.context,
                    textO,
                    (gObject.margin*objectWidth) + objectLeft - (objectWidth/2),
                    (gObject.margin*objectHeight) + objectTop + (gObject.fontSizeNumeric*canvas.scale*(canvas.resolutionHeight/700)) - (objectHeight/2),
                    objectWidth - (gObject.margin*objectWidth)*2,
                    (gObject.fontSize*canvas.scale*(canvas.resolutionHeight/700)*.6),
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

                  if(gObject.text != null){
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
                  if(gObject.textureName!=null){
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
                  if(gObject.text != null){
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
                  if(gObject.textureName!=null){
                    canvas.context.drawImage(
                      texRef.getTexture(gObject),
                      objectLeft-(objectWidth/2),
                      objectTop-(objectHeight/2),
                      objectWidth,
                      objectHeight);
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
              if(this.showObjectsInfo){
                Object.keys(gObject.dump()).forEach((element,index) => {
                  canvas.context.fillText(
                    element +" : "+gObject[element],
                    objectLeft,
                    (objectTop) +index*15 +15);
                });
              }
            }
            //* DRAW TRIGGERS
            if(this.drawTriggers && this.triggers.objects.filter(e=>{return e.enabled}).map(e=>e.relatedTo).indexOf(gObject.id) != -1){
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
          // console.warn("Objects excluded: ",this.noRenderedItemsCount);
          //*part seven: draw canvas grid
          if(this.showCanvasGrid){
            if(this.drawPerspectiveLayersLimits && this.camera.usePerspective){}else{
              const base = {
                x: -this.camera.position.x,
                y: -this.camera.position.y,
                z: -this.camera.position.z
              }
              const grid = {
                x: base.x,
                y: base.y,
                z: base.z
              }

              const perspectiveDiff = 1-((1/(grid.z-(this.camera.position.z)))-(1))/((1/this.camera.maxZ)-(1));
              testD = perspectiveDiff;
              const toAddSize = perspectiveDiff * tangencialConstant*(canvas.resolutionHeight)*this.camera.maxZ;
              const computedPercentageSize = clientUnitaryHeightPercentageConstant * (toAddSize);
              const perspectiveScale = computedPercentageSize/100;

              //*recalculate gobject coords
              var perspectiveLayer = {
                width:canvas.resolutionHeight,
                height:canvas.resolutionHeight
              }
                //it will calc were the image must to be, inside the perspectiveLayer
              grid.x *= perspectiveLayer.width;
              grid.y *= perspectiveLayer.height;
              //now add the origin of the perspectiveLayer
              grid.x += -(perspectiveLayer.width-canvas.resolutionHeight)*this.camera.origin.x;
              grid.y += -(perspectiveLayer.height-canvas.resolutionHeight)*this.camera.origin.y;

              const height = canvas.resolutionHeight;

              canvas.context.beginPath();
              canvas.context.lineWidth = 1;
              canvas.context.strokeStyle = "green";
              //create grid
              const length = 2
              for (let line = 0; line < length; line +=.1) {
                //vertical
                canvas.context.moveTo(
                  (height*line) + grid.x,
                  0 + grid.y
                );
                canvas.context.lineTo(
                  (height*line) + grid.x,
                  (height*length) + grid.y
                );
                //horizontal
                canvas.context.moveTo(
                  0 + grid.x,
                  (height*line) + grid.y
                );
                canvas.context.lineTo(
                  (height*length) + grid.x,
                  (height*line) + grid.y
                );
              }
              canvas.context.closePath();
              canvas.context.stroke();
            }
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
          this.generateCalculationOrder();
          this.generateObjectsDisplayDimentions();
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
              if(this.setMouseOrigin){
                this.mouse.origin = targetGraphObjectId;
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
          onWheel={(e)=>{this.camera.position.z -=(e.deltaY/1000)}}
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
  consolMap() {
    if (!this.state.consol.length == 0) {
      return (
        this.state.consol.map((text) => (
            <div className={"text-["+text.color+"]"}>{text.text}</div>
        ))
      )
    } else {
      return (null);
    }
  }
  consolRend(){
    if (!this.state.consol.length == 0) {
      return(
        <div className="absolute h-full w-full">
          <div id="consol" className="bottom-0 absolute text-white w-full font-['Lucida_Console'] text-xs">
            {this.consolMap()}
          </div>
        </div>
      )}
  }
  render(){
    return(
      <div className="relative w-full h-full mx-auto my-auto" id={'display'+this.id}>
        <div className="bg-black absolute w-full h-full flex">
          <div className="relative w-full h-full mx-auto my-auto" id={'engineDisplay'+this.id}>
            <div className="absolute w-full h-full">
              {this.engineDisplay()}
              {this.consolRend()}
              {this.triggersTarget()}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
export {RenderEngine}