import React from "react";
import $ from "jquery";
import {Howl} from 'howler';

import { Canvas } from "./Canvas";

import { Animation } from "../engineComponents/Animation";
import { GraphObject } from "../engineComponents/GraphObject";
import { RenList } from "../engineComponents/RenList";
import { Trigger } from "../engineComponents/Trigger";

import { ScriptInterpreter } from "./ScriptInterpreter";
import { mobileCheck } from "../logic/Misc";
import { Shader } from "./ShadersUnstable";
import gsap from "gsap";
import { TextureAnim } from "../engineComponents/TextureAnim";

class RenderEngine extends React.Component{
  constructor(props){
    super(props);
    this.id = "rengine" + String(window.performance.now()).replaceAll(".","");
    this.isReady = false;
    this.state = {
      consol: [],//only used by script interpreter errors
    }
    this.aspectRatio = "16:9";
    this.engineDisplayRes = {width:0,height:0};
    this.resizeTimeout = 0;
    this.consolMessagesArray = []
    this.isMobile = mobileCheck();
    this.mounted = false; //internal check
    this.canvasRef = {}; //Reference to the canvas used to render the scene
    this.engineTime = 0;

    this.actualSceneId = "";//Guardar esto
    this.masterScript = {};

    this.graphObject = GraphObject;
    this.animation = Animation;
    this.scriptInterpreter = ScriptInterpreter;

    this.graphArray = new RenList();//array de objetos, un objeto para cada imagen en pantalla
    this.anims = new RenList();
    this.triggers = new RenList();
    this.gameVars = {};//Y guardar esto tambien
    this.texturesList = new RenList();
    this.textureAnims = new RenList();//gifs-like
    this.soundsList = new RenList();

    this.keyboardTriggers = new RenList();
    this.pressedKeys = {};

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
      rotationMatrix:{
        "Axx": 1,
        "Axy": 0,
        "Axz": 0,
        "Ayx": 0,
        "Ayy": 1,
        "Ayz": 0,
        "Azx": 0,
        "Azy": 0,
        "Azz": 1
      },
      usePerspective:false
    }
    this.useUniformUnits = false;
    this.coordsPack = {};
    this.renderingOrderById = [];

    //MOUSE
    this.mouseListener = 0;
    this.mouse = {x:0, y:0};

    this.noRenderedItemsCount = 0;

    //Debug values
    this.showListedData = false;
    this.showObjectsInfo = false;
    this.drawObjectLimits = true;
    this.showCanvasGrid = false;
    this.drawTriggers = true;

    this.objectsToDebug = [];//id of the object
    window.setUsePerspective = (x) =>{this.camera.usePerspective = x;}
    window.setCameraPerspectiveAngle =  (x) =>{this.camera.position.angle = x;}
    window.setDisplayDigitalRepresentationZ = (x) =>{this.camera.maxZ = x;}
    window.setCameraPerspectiveCoords = (x,y) =>{this.camera.position = {y:y,x:x};}

    window.setDrawObjectLimits = (x) => {this.drawObjectLimits = x;}
    window.setShowObjectsInfo = (x) => {this.showObjectsInfo = x;}
    window.setShowCanvasGrid = (x) => {this.showCanvasGrid = x;}
    window.renderEngineTerminal = (code) =>{ code(this);}
    window.engineRef = this;
  }  
  componentDidMount(){
    if (!this.mounted) {
      this.mounted = true;
      console.clear();
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
      const k = new ScriptInterpreter();
      k.build((masterScript)=>{this.loadGame(masterScript); if("setEngine" in  this.props ){this.props.setEngine(this);}},(error)=>{this.consol(error)});
      
      //*TECLADO
      const self = this;
      document.body.addEventListener("keydown",function(e){
        if(!(e.code in self.pressedKeys)){
          Object.assign(self.pressedKeys,{[e.code]:true});
          if(self.keyboardTriggers.exist(e.code)){
            self.keyboardTriggers.get(e.code).check(self,"onPress");
          }
        }
      });  
      document.body.addEventListener("keyup", function(e){
        delete self.pressedKeys[e.code];
        if(self.keyboardTriggers.exist(e.code)){
          self.keyboardTriggers.get(e.code).check(self,"onRelease");
        }
      });
    }
  }

  getTexture(gObject){
    var id = gObject.textureName;
    console.log(id);
    if(this.textureAnims.exist(id)){
      id = this.textureAnims.get(id).getTexture(this.engineTime);
    }
    console.log(id);
    //.getTexture(gObject)
    const res = this.texturesList.get(id);
    if(res == undefined){
      console.log(this.textureAnims);
      debugger;
    }

    return res;
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
      console.log(newWidth,newHeight);
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
    })
  }
  componentDidCatch(error,info){
    console.error("RenderEngine several crash!!");
    console.warn(error);
    console.log(info);
  }
  loadGame(masterScript){
    this.masterScript = masterScript;
    if(this.actualSceneId == ""){
      this.actualSceneId = Object.keys(this.masterScript)[0];
    }
    this.loadScene(this.actualSceneId);
  }
  loadSounds(sndsData,fun = null){
    if(sndsData != null){
      Promise.all(Object.keys(sndsData).map(sndName=>
        new Promise(resolve=>{
          fetch(sndsData[sndName]).then(res=>res.blob()).then( blob =>{
            var reader = new FileReader() ;
            reader.onload = function(){ resolve({Base64:this.result,ext:sndsData[sndName].split('.').at(-1),id:sndName}) } ; // <--- `this.result` contains a base64 data URI
            reader.readAsDataURL(blob) ;
          });
        })
      )).then(sounds => {
        sounds.forEach(snd => {
          var sound = new Howl({
            src: [snd.Base64],
            format: snd.ext
          });
          this.soundsList.push({sound:sound,id:snd.id})
        });

        if(typeof fun == "function")
          fun();
      }).catch(reason =>{
        console.error("===============================");
        console.error("Error during sounds load phase:");
        console.error(reason);
        console.error("===============================");
      });
    }else{
      console.warn("No sounds in this scene");
      if(typeof fun == "function")
          fun();
    }
    
  }
  loadTextures(texturesData,fun = null){
    if(texturesData != null){
      Promise.all(Object.keys(texturesData).map(textureName=>
        new Promise(resolve=>{
          const image = new Image();
          image.src = texturesData[textureName];
          image.addEventListener('load',()=>{
            const res = new Object({[textureName]:image});
            this.texturesList.push(new Shader(image,textureName))
            resolve(res);
          });
        })
      )).then(textures => {
        if(typeof fun == "function")
          fun();
      }).catch(reason =>{
        console.error("===============================");
        console.error("Error during textures load phase:");
        console.error(reason);
        console.error("===============================");
      });
    }else{
      console.warn("No sounds in this scene");
      if(typeof fun == "function")
          fun();
    }
    
  }
  loadScene(sceneId){
    //TODO: Check the textures object and destroy all gpu instances
    while(this.texturesList.objects.length > 0){
      this.texturesList.objects[0].destroy();
      this.texturesList.remove(this.texturesList.objects[0].id)
    }

    this.actualSceneId = sceneId;
    let scene = this.masterScript[sceneId];
    this.isReady = false;
    this.forceUpdate();
    //reset values
    this.engineTime = 0;
    this.graphArray = new RenList();//array de objetos, un objeto para cada imagen en pantalla
    this.graphObject = GraphObject;
    this.animation = Animation;
    this.anims = new RenList();
    this.triggers = new RenList();
    this.keyboardTriggers = new RenList();
    this.textureAnims = new RenList();
    this.codedRoutines = new RenList();
    this.routines = new Array();
    this.flags = new Object();
    this.routineNumber = -1;

    this.camera = {
      maxZ:1000,
      origin:{x:.5,y:.5},//position of the virtual engineDisplay
      position:{x:.5,y:.5,z:0,angle:0},//position od the camera in the space.... angle? who knows (0_-)
      rotationMatrix:{
        "Axx": 1,
        "Axy": 0,
        "Axz": 0,
        "Ayx": 0,
        "Ayy": 1,
        "Ayz": 0,
        "Azx": 0,
        "Azy": 0,
        "Azz": 1
      },
      usePerspective:false, //or use3D
      useTHREE3d:false
    }
    this.loadSounds(scene.sounds,()=>{
      this.loadTextures(scene.textures,()=>{
        //change texture reference with the actual file
        Object.assign(this.gameVars,scene.gameVars);

        scene.graphObjects.map(object =>{object.textureName=object.texture; return object});

        scene.graphObjects.forEach(object => this.graphArray.push(new GraphObject(object)));
        scene.triggers.forEach(trigger => this.triggers.push(new Trigger(trigger)));
        scene.keyboardTriggers.forEach(trigger => this.keyboardTriggers.push(new Trigger(trigger)));
        scene.textureAnims.forEach(textureAnim => this.textureAnims.push(new TextureAnim(textureAnim)));
        scene.animations.forEach(animation => this.anims.push(new Animation(animation)));
        scene.codedRoutines.forEach(codedAnim => this.codedRoutines.push(codedAnim));
        this.routines = scene.routines;
        this.flags = scene.flags;
        
        this.isReady = true;
        this.forceUpdate();
      });
    });
  }

  checkObjectBoundaries(oTopLeftCorner,objectRes,canvasRes){
    //check for very big images
    const sDims = {width:objectRes.width/canvasRes.width,height:objectRes.height/canvasRes.height};
    const x = oTopLeftCorner.x/canvasRes.width;
    const y  = oTopLeftCorner.y/canvasRes.height;
    const right = x+sDims.width;
    const bottom = y+sDims.height;
    
    //if top
    if(y>=0 && y<1){
      //one of the top corners are inside the field of view
      if(x>=0 && x<1){
        return true;
      }else if(right>0 && right<=1){
        return true;
      }
      //Or both are outside the field Of view
      else if(x<0 && right>1){
        return true;
      }
    }else if(bottom>0 && bottom<=1){//or bottom
      //one of the top corners are inside the field of view
      if(x>=0 && x<1){
        return true;
      }else if(right>0 && right<=1){
        return true;
      }
      //Or both are outside the field Of view
      else if(x<0 && right>1){
        return true;
      }
    }else if(y <= 0 && bottom>=1){//check top <= 0 && bottom=>1
      if(x<1 && right>0){
        return true;
      }
    }
    return false;
  }
  replaceReferencesToGameVars(script,insideCodedExpr=false){
    //TODO: construir multiples reemplazos para cuando hay datos a izquierda, a derecha, a derecha e izquierda
    if(insideCodedExpr){
      return script.replaceAll(/\¬+(\w)+/g,(a,_)=>{return "engine.gameVars." + a.substring(1)+ ""})
    }else{
      return script.replaceAll(/\$+(\w)+/g,(a,_)=>{return "'engine.gameVars." + a.substring(1)+ "'"})
    }
  }
  replaceCodedExpresions(script){
    //TODO: construir multiples reemplazos para cuando hay datos a izquierda, a derecha, a derecha e izquierda
    return script.replaceAll(/\$\(?(.\n*)+\)\$/g,(a,_)=>{
      const h = new Function ("engine","return "+ this.replaceReferencesToGameVars(a.substring(1,a.length-1),true).replaceAll(/\n/g,"/n"))
      return h(this);
    })
  }
  // @description: wrapText wraps HTML canvas text onto a canvas of fixed width
  // @param context del canvas principal
  // @param text - el texto a probar
  // @param x - coordenada horizontal de origen.
  // @param y - coordenada vertical de origen.
  // @param maxWidth - la medida del ancho maximo del lugar donde se quiere agregar el texto.
  // @param lineHeight - altura entre linea y linea.
  // @returns an array of [ lineText, x, y ] for all lines
  wrapText(ctx, text, x, y, maxWidth, lineHeight,center = false) {
    // First, start by splitting all of our text into words, but splitting it into an array split by spaces
    let words = text.replaceAll('\n',()=>{return ' \n \n '}).split(' ');
    let line = ''; // This will store the text of the current line
    let testLine = ''; // This will store the text when we add a word, to test if it's too long
    let lineArray = []; // This is an array of lines, which the function will return

    const centering = () => {
      if(center){
        let metricsF = ctx.measureText(line);
        let testWidthF = metricsF.width;
        return (maxWidth-testWidthF)/2;
      }else{
        return 0;
      }
        
    }
    // Lets iterate over each word
    for(var n = 0; n < words.length; n++) {
      // Create a test line, and measure it..
      testLine += `${words[n]} `;
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      // If the width of this test line is more than the max width
      //console.log(line)
      if ((testWidth > maxWidth && n > 0) || line.indexOf('\n') != -1) {
          // Then the line is finished, push the current line into "lineArray"
          lineArray.push([line, x+centering(), y]);
          // Increase the line height, so a new line is started
          y += lineHeight;
          // Update line and test line to use this word as the first word on the next line
          line = `${words[n]} `;
          testLine = `${words[n]} `;
      }
      else {
          // If the test line is still less than the max width, then add the word to the current line
          line += `${words[n]} `;
      }
      // If we never reach the full max width, then there is only one line.. so push it into the lineArray so we return something
      if(n === words.length - 1) {
          lineArray.push([line, x+centering(), y]);
          //TODO: Medir el ancho disponible y
      }
    }
    // Return the line array
    
    return lineArray;
  }
  generateRenderingOrder(){
    var zRefs = {}
    var zetas = [];
    var coordsPack = {};
    var renderingOrderById = [];
    const rM = this.camera.rotationMatrix;
    
    this.graphArray.ids().forEach(id=>{

      const gObject = this.graphArray.get(id);
      Object.assign(coordsPack,{[id]:{
        x:(gObject.x + (this.camera.origin.x-0.5))*this.canvasRef.resolutionHeight,
        y:(gObject.y + (this.camera.origin.y-0.5))*this.canvasRef.resolutionHeight,
        z:gObject.z + this.camera.position.z}})
      //TODO: recalculate this only when the camera angles or position have changed
      if(this.camera.usePerspective && !gObject.ignoreParallax){
        const px = gObject.x - this.camera.position.x;
        const py = gObject.y - this.camera.position.y;
        const pz = gObject.z - this.camera.position.z;

        coordsPack[id].x = (rM.Axx*px + rM.Axy*py + rM.Axz*pz);
        coordsPack[id].y = (rM.Ayx*px + rM.Ayy*py + rM.Ayz*pz);
        coordsPack[id].z = rM.Azx*(px) + rM.Azy*(py) + rM.Azz*pz;
      }
      const z = coordsPack[id].z.toString(); 
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
      this.coordsPack = coordsPack;
      this.renderingOrderById = renderingOrderById;
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
        showFps={"showFps" in this.props ? this.props.showFps : true}
        renderGraphics={(canvas)=>{
          this.canvasRef = canvas;
          canvas.context.clearRect(0, 0, canvas.resolutionWidth, canvas.resolutionHeight);//cleanning window

          const clientUnitaryHeightPercentageConstant = 100 / canvas.resolutionHeight;
          const tangencialConstant = this.camera.position.angle;//Uses camera angle
          this.noRenderedItemsCount = 0;

          this.generateRenderingOrder();

          for (let index = 0; index < this.graphArray.objects.length; index++) {
            const gObject = this.graphArray.get(this.renderingOrderById[index]);
            var objectScale = gObject.scale;
            var objectLeft = this.coordsPack[gObject.id].x;
            var objectTop = this.coordsPack[gObject.id].y;
            var objectZ = this.coordsPack[gObject.id].z;
            
            var testD = 0.95;
            //TODO: recalculate this only when the camera angles or position have changed or its position 
            if(this.camera.usePerspective && !gObject.ignoreParallax){
              const perspectiveDiff = 1-((1/(objectZ-(this.camera.position.z)))-(1))/((1/this.camera.maxZ)-(1));
              testD = perspectiveDiff;
              const toAddSize = perspectiveDiff * tangencialConstant*(canvas.resolutionHeight)*this.camera.maxZ;
              const computedPercentageSize = clientUnitaryHeightPercentageConstant * (toAddSize);
              const perspectiveScale = computedPercentageSize/100;
              objectScale *= computedPercentageSize/100;

              //*recalculate gobject coords
              var perspectiveLayer = {
                width:canvas.resolutionHeight*perspectiveScale,
                height:canvas.resolutionHeight*perspectiveScale
              }
               //it will calc were the image must to be, inside the perspectiveLayer
              objectLeft *= perspectiveLayer.width;
              objectTop *= perspectiveLayer.height;
              //now add the origin of the perspectiveLayer
              objectLeft += -(perspectiveLayer.width-canvas.resolutionHeight)*this.camera.origin.x;
              objectTop += -(perspectiveLayer.height-canvas.resolutionHeight)*this.camera.origin.y;
            }

            var objectWidth = canvas.resolutionWidth*objectScale*gObject.widthScale;
            var objectHeight;
            if(gObject.textureName!=null){
              if(gObject.useEngineUnits){
                objectWidth = canvas.resolutionHeight*objectScale*gObject.widthScale;
                objectHeight = canvas.resolutionHeight*objectScale*gObject.heightScale;
              }else{
                objectHeight = (this.getTexture(gObject).texture.naturalHeight/this.getTexture(gObject).texture.naturalWidth)*canvas.resolutionWidth*objectScale*gObject.heightScale;
              }
            }else{
              objectHeight = canvas.resolutionHeight*objectScale*gObject.heightScale;
            }

            if(!(gObject.opacity == 0) && this.checkObjectBoundaries({x:objectLeft,y:objectTop},{width:objectWidth,height:objectHeight},{width:canvas.resolutionWidth,height:canvas.resolutionHeight})){
               //*part one: global alpha
              canvas.context.globalAlpha = gObject.opacity;//if the element to render have opacity != of the previous rendered element}

              //*part two: filtering
              var filterString = gObject.filterString;
              if(((((objectZ-this.camera.position.z)>50))) && !this.camera.usePerspective && gObject.ignoreParallax){//ignore filters
                filterString = "none";
              }

              //*preparatives for part three: if the image need to be rotated
              //with testD > 0.003 we ensure the very far of|behind the camera elements won't be rendered
              if(testD>0.003 && gObject.rotate != 0){
                canvas.context.save();
                canvas.context.setTransform(//transform using center as origin
                  1, 
                  0, 
                  0, 
                  1,
                  objectLeft, 
                  objectTop); // sets scale and origin
                canvas.context.rotate(gObject.rotateRad);

                canvas.context.filter = filterString;//if the element to render have filtering values != of the previous element
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
                  canvas.context.font = (gObject.fontSize*canvas.scale*(canvas.resolutionHeight/700))+"px "+gObject.font;
                  const texts = this.replaceCodedExpresions(gObject.text).split("/n");
                  texts.forEach((text,index) => {
                    canvas.context.fillText(
                      text,
                      -(objectWidth)/2,
                      -(objectHeight)/2 + (gObject.fontSize*canvas.scale*(1+index)*(canvas.resolutionHeight/700))
                    );
                  });
                }
                if(gObject.textureName!=null){
                  canvas.context.drawImage(
                    this.getTexture(gObject).getTexture(gObject),
                    -(objectWidth)/2,
                    -(objectHeight)/2,
                    objectWidth,
                    objectHeight
                  );
                }

                canvas.context.restore();
              }else if(testD>0.003){
              //*part three: draw image
                canvas.context.filter = filterString;//if the element to render have filtering values != of the previous element
                if(gObject.text != null){
                  if(gObject.boxColor != "transparent"){
                    canvas.context.fillStyle = gObject.boxColor;
                    canvas.context.fillRect(
                      objectLeft,
                      objectTop,
                      objectWidth,
                      objectHeight
                      );
                  }
                  canvas.context.fillStyle = gObject.color;
                  canvas.context.font = (gObject.fontSize*canvas.scale*(canvas.resolutionHeight/700))+"px "+gObject.font;

                  const texts = this.wrapText(//TODO: Wrap it until all the text get wraped
                    canvas.context,
                    this.replaceCodedExpresions(gObject.text),
                    (gObject.margin*objectWidth) + objectLeft,
                    (gObject.margin*objectHeight) + objectTop + (gObject.fontSize*canvas.scale*(canvas.resolutionHeight/700)),
                    objectWidth - (gObject.margin*objectWidth)*2,
                    (gObject.fontSize*canvas.scale*(canvas.resolutionHeight/700)*.6),
                    gObject.center
                  );
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
                    this.getTexture(gObject).getTexture(gObject),
                    objectLeft-(objectWidth/2),
                    objectTop-(objectHeight/2),
                    objectWidth,
                    objectHeight);
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
                canvas.context.strokeStyle = "orange";
                
                canvas.context.strokeRect(
                  objectLeft-(objectWidth/2),
                  objectTop-(objectHeight/2),
                  objectWidth,
                  objectHeight);
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
            if(this.drawTriggers && this.triggers.objects.map(e=>e.relatedTo).indexOf(gObject.id) != -1){
              canvas.context.strokeStyle = "blue";
              canvas.context.fillStyle = "blue";
              canvas.context.globalAlpha = .3;
              canvas.context.lineWidth = 3;
              canvas.context.setLineDash([4, 4]);
                
              canvas.context.fillRect(
                gObject.text != null?objectLeft:objectLeft-(objectWidth/2),
                gObject.text != null?objectTop:objectTop-(objectHeight/2),
                objectWidth*canvas.scale,
                objectHeight*canvas.scale);
              canvas.context.globalAlpha = 1;
              canvas.context.strokeRect(
                gObject.text != null?objectLeft:objectLeft-(objectWidth/2),
                gObject.text != null?objectTop:objectTop-(objectHeight/2),
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
              const rM = this.camera.rotationMatrix;
              const base = {
                x: -this.camera.position.x+.5,
                y: -this.camera.position.y,
                z: -this.camera.position.z+0.65
              }
              const grid = {
                x: rM.Axx*(base.x) + rM.Axy*(base.y) + rM.Axz*(base.z),
                y: rM.Ayx*(base.x) + rM.Ayy*(base.y) + rM.Ayz*(base.z),
                z: rM.Azx*((base.x)) + rM.Azy*((base.y)) + rM.Azz*(base.z)
              }

              const perspectiveDiff = 1-((1/(grid.z-(this.camera.position.z)))-(1))/((1/this.camera.maxZ)-(1));
              testD = perspectiveDiff;
              const toAddSize = perspectiveDiff * tangencialConstant*(canvas.resolutionHeight)*this.camera.maxZ;
              const computedPercentageSize = clientUnitaryHeightPercentageConstant * (toAddSize);
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

              grid.x = grid.x;
              grid.y = grid.y;

              const height = canvas.resolutionHeight * perspectiveScale;

              canvas.context.beginPath();
              canvas.context.lineWidth = 1;
              canvas.context.strokeStyle = "green";
              //create grid
              const length = 2
              for (let line = -1; line < length; line +=.1) {
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
              //show 0<->1 coords
              canvas.context.fillStyle = "white";
              canvas.context.font = "900 "+(11*canvas.scale)+"px Calibri";
              for (let horizontal = 0; horizontal < length; horizontal+=.1) {
                for (let vertical = 0; vertical < length; vertical+=.1) {
                  canvas.context.fillText(
                    Math.round(horizontal*10)/10+", "+Math.round(vertical*10)/10,
                    (height*horizontal)-38 + (grid.x),
                    (height*vertical)-4 + (grid.y));
                }
              }
            }
          }
        }} 
        onLoad={(canvas)=>{
          //calc the perspective angle in degress
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
        }}
        events={(canvas)=>{
          Object.keys(this.pressedKeys).forEach(key => {
            if(this.keyboardTriggers.exist(key)){
              this.keyboardTriggers.get(key).check(this,"onHold");
            }
          });
          
          this.engineTime += canvas.fps.elapsed;
          for (let index = 0; index < this.anims.objects.length; index++) {
            const anim = this.anims.objects[index];
            if(anim.relatedTo != null){
              anim.updateState(this.engineTime,(relatedTo)=>{return relatedTo!="engineCamera"?this.graphArray.get(relatedTo):this.camera},this);
            }
          }  
        }}
        animateGraphics={(canvas)=>{
          //console.log(this.routines,this.routineNumber);
          if(this.continue){
            if((this.routineNumber+1)<this.routines.length){
              this.routineNumber++;
              this.routines[this.routineNumber](this);
            }
          }

          this.codedRoutines.objects.forEach(element => {
            const numberOfArguments = element.code.length;
            
            if(numberOfArguments == 0){
              element.code();
            }else if(numberOfArguments == 1){
              element.code(this);
            }else if (numberOfArguments == 2){
              element.code(this,this.engineTime);
            }
          });
        }}
        afterEffects = {(canvas)=>{

        }}
        />
      );
    }else{
      return(<span className="text-white absolute">ISN'T READY YET, OR UNABLE TO RUN YOUR SCRIPT</span>);
    }
  }
  checkTriggers(mouse,action){//check using mouse stats
    var offset = $("#"+"triggersTarget"+this.id).offset();
    // console.log(offset.y,offset.x);
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
    mX *= (this.canvasRef.resolutionWidth/this.canvasRef.resolutionHeight);
    mY += (0.5-this.camera.origin.y);

    var targetGraphObjectId = "";
    var reversedRenderOrderList = [].concat(this.renderingOrderById).reverse();
    const objectsWithTriggersList = this.triggers.relatedToReversedList();
    const triggersIdList = this.triggers.ids();

    for (let index = 0; index < reversedRenderOrderList.length; index++) {
      const gO = this.graphArray.get(reversedRenderOrderList[index]);

      var objectWidth = gO.scale*gO.widthScale*(this.canvasRef.resolutionWidth/this.canvasRef.resolutionHeight);
      var objectHeight;
      if(gO.textureName!=null){
        objectHeight = (this.getTexture(gO).texture.naturalHeight/this.getTexture(gO).texture.naturalWidth)*gO.scale*gO.heightScale*(this.canvasRef.resolutionWidth/this.canvasRef.resolutionHeight);
      }else{
        objectHeight = gO.scale*gO.heightScale;
        objectWidth = gO.scale*gO.widthScale*(this.canvasRef.resolutionWidth/this.canvasRef.resolutionHeight);
      }
      const gOy = gO.textureName==null ? gO.y : gO.y - (objectHeight/2);
      const gOx = gO.textureName==null ? gO.x : gO.x - (objectWidth/2);
      if(mY>=gOy && gO.id != "spring"){
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
    console.log("?")
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
          onMouseUp={(e)=>this.checkTriggers(e,"onRelease")}
          onWheel={(e)=>{this.camera.position.z -=(e.deltaY/1000)}}
          //This may be used only in the dev mode(elements aligment, etc)
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