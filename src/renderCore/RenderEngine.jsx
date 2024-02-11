import React from "react";
import $ from "jquery";
import {Howl, Howler} from 'howler';

import { Canvas } from "./Canvas";
import { GraphObj, ObjectArray, Animation, Trigger } from "./graphObj";
import { ScriptInterpreter } from "./ScriptInterpreter";
import { mobileCheck } from "../logic/Misc";
import { Shader } from "./Shaders";


class RenderEngine extends React.Component{
  constructor(props){
    super(props);
    this.state = {
      isReady:false,
      consol: [],//only used by script interpreter errors
    }
    window.consol = []
    this.isMobile = mobileCheck();
    this.mounted = false;
    this.canvasRef = {};

    this.actualSceneId = "";//Guardar esto
    this.masterScript = {};

    this.graphObj = GraphObj;
    this.animation = Animation;

    this.graphArray = ObjectArray.create();//array de objetos, un objeto para cada imagen en pantalla
    this.anims = ObjectArray.create();
    this.triggers = ObjectArray.create();
    this.gameVars = {};//Y guardar esto tambien
    this.texturesList = ObjectArray.create();
    this.soundsList = ObjectArray.create();

    this.codedRoutines = ObjectArray.create();
    this.routines = new Array();
    this.flags = new Object();
    this.routineNumber = -1;
    this.continue = true;
    //Dialogs
    this.voiceFrom = "";
    this.paragraphNumber = -1;
    this.paragraph = "h";
    this.dialogNumber = -1;
    this.dialog = [];
    this.narration = "";

    //Rendering-related stuff
    this.camera = {
      id:"engineCamera",
      maxZ:10000,
      origin:{x:.5,y:.5},
      position:{top:.5,left:.5,z:0,angle:0},
      sphericalRotation:{x:0,y:0,z:0,center:0},
      actualAngles:{x:0,y:0,z:0},//Rotation matrix actual angles
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
      usePerspective:false,
      aspectRatio:"16:9"
    }
    this.coordsPack = {};
    this.renderingOrderById = [];
    this.preserveTexturesAspectRatio = this.props.preserveTexturesAspectRatio != undefined ? this.props.preserveTexturesAspectRatio : true;

    this.mouseListener = 0;

    this.noRenderedItemsCount = 0;

    //Debug values
    this.showListedData = false;
    this.drawObjectLimits = true;
    this.showObjectsInfo = false;
    this.showCanvasGrid = false;
    this.drawPerspectiveLayersLimits = false;

    this.objectToDebug = null;//id of the object
    window.setUsePerspective = (x) =>{this.camera.usePerspective = x;}
    window.setCameraPerspectiveAngle =  (x) =>{this.camera.position.angle = x;}
    window.setDisplayDigitalRepresentationZ = (x) =>{this.camera.maxZ = x;}
    window.setCameraPerspectiveCoords = (x,y) =>{this.camera.position = {top:y,left:x};}
    window.setDrawPerspectiveLayersLimits = (x) =>{this.drawPerspectiveLayersLimits = x;}
    window.setForcedAspectRatio = (x) => {this.camera.aspectRatio = x;}

    window.setDrawObjectLimits = (x) => {this.drawObjectLimits = x;}
    window.setShowObjectsInfo = (x) => {this.showObjectsInfo = x;}
    window.setShowCanvasGrid = (x) => {this.showCanvasGrid = x;}
    window.renderEngineTerminal = (code) =>{ code(this);}
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
            this.texturesList.push(Shader.create(image,textureName))
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
    while(this.texturesList._objects.length > 0){
      this.texturesList._objects[0].destroy();
      this.texturesList.remove(this.texturesList._objects[0].id)
    }

    this.actualSceneId = sceneId;
    let scene = this.masterScript[sceneId];
    this.setState({isReady:false},()=>{
      //reset values
      this.graphArray = ObjectArray.create();//array de objetos, un objeto para cada imagen en pantalla
      this.graphObj = GraphObj;
      this.animation = Animation;
      this.anims = ObjectArray.create();
      this.triggers = ObjectArray.create();

      this.codedRoutines = ObjectArray.create();
      this.routines = new Array();
      this.flags = new Object();
      this.routineNumber = -1;

      this.camera = {
        id:"engineCamera",
        maxZ:10000,
        origin:{x:.5,y:.5},
        position:{top:.5,left:.5,z:0,angle:0},
        sphericalRotation:{x:0,y:0,z:0,center:0},
        actualAngles:{x:0,y:0,z:0},//Rotation matrix actual angles
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
        usePerspective:false,
        aspectRatio:"16:9"
      }
      console.log(scene);
      this.loadSounds(scene.sounds,()=>{
        this.loadTextures(scene.textures,()=>{
          //change texture reference with the actual file
          Object.assign(this.gameVars,scene.gameVars);
  
          scene.graphObjects.map(object =>{object.textureName=object.texture; return object});
  
          scene.graphObjects.forEach(object => this.graphArray.push(GraphObj.create(object)));
          scene.triggers.forEach(trigger => this.triggers.push(Trigger.create(trigger)));
          scene.animations.forEach(animation => this.anims.push(Animation.create(animation)));
          scene.codedRoutines.forEach(codedAnim => this.codedRoutines.push(codedAnim));
          this.routines = scene.routines;
          this.flags = scene.flags;
          
          this.setState({isReady:true})
        });
      });
    });

  }
  componentDidMount(){
    if (!this.mounted) {
      this.mounted = true;  
      const k = new ScriptInterpreter;
      k.build((masterScript)=>{this.loadGame(masterScript)},(error)=>{this.consol(error)});
    }
  }
  consol(text,color="white") {
    window.consol.push({text:text,color:color});
    this.setState({
      consol: (window.consol),
    })
  }
  consolClean(){
    window.consol=[];
    this.setState({
      consol: [],
    })
  }
  checkObjectBoundaries(oTopLeftCorner,objectRes,canvasRes){
    //check for very big images
    const sDims = {width:objectRes.width/canvasRes.width,height:objectRes.height/canvasRes.height};
    const left = oTopLeftCorner.left/canvasRes.width;
    const top  = oTopLeftCorner.top/canvasRes.height;
    const right = left+sDims.width;
    const bottom = top+sDims.height;
    
    //if top
    if(top>=0 && top<1){
      //one of the top corners are inside the field of view
      if(left>=0 && left<1){
        return true;
      }else if(right>0 && right<=1){
        return true;
      }
      //Or both are outside the field Of view
      else if(left<0 && right>1){
        return true;
      }
    }else if(bottom>0 && bottom<=1){//or bottom
      //one of the top corners are inside the field of view
      if(left>=0 && left<1){
        return true;
      }else if(right>0 && right<=1){
        return true;
      }
      //Or both are outside the field Of view
      else if(left<0 && right>1){
        return true;
      }
    }else if(top <= 0 && bottom>=1){//check top <= 0 && bottom=>1
      if(left<1 && right>0){
        return true;
      }
    }
    return false;
  }
  buildRotationMatrix(pitch, roll, yaw){
    const cosa = Math.cos(yaw);
    const sina = Math.sin(yaw);

    const cosb = Math.cos(pitch);
    const sinb = Math.sin(pitch);

    const cosc = Math.cos(roll);
    const sinc = Math.sin(roll);

    return {
      Axx : cosa*cosb,
      Axy : cosa*sinb*sinc - sina*cosc,
      Axz : cosa*sinb*cosc + sina*sinc,

      Ayx : sina*cosb,
      Ayy : sina*sinb*sinc + cosa*cosc,
      Ayz : sina*sinb*cosc - cosa*sinc,

      Azx : -sinb,
      Azy : cosb*sinc,
      Azz : cosb*cosc
    }
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
        left:(gObject.left + (this.camera.origin.x-0.5))*this.canvasRef.resolutionWidth,
        top:(gObject.top + (this.camera.origin.y-0.5))*this.canvasRef.resolutionHeight,
        z:gObject.z +this.camera.sphericalRotation.center + this.camera.position.z}})
      var objectScale = gObject.scale;
      //TODO: recalculate this only when the camera angles or position have changed
      if(this.camera.usePerspective && !gObject.ignoreParallax){
        const px = gObject.left;
        const py = gObject.top;
        const pz = gObject.z -this.camera.sphericalRotation.center - this.camera.position.z;

        coordsPack[id].left = (rM.Axx*px + rM.Axy*py + rM.Axz*pz);
        coordsPack[id].top = (rM.Ayx*px + rM.Ayy*py + rM.Ayz*pz);
        coordsPack[id].z = rM.Azx*(px+(objectScale*gObject.widthScale*.5)) + rM.Azy*(py+(objectScale*gObject.heightScale*.5)) + rM.Azz*pz + this.camera.sphericalRotation.center  + this.camera.position.z;
      }
      const z = coordsPack[id].z.toString(); 
      if(Object.keys(zRefs).indexOf(z) == -1){
        Object.assign(zRefs,{[z]:[id]});
        zetas.push(z*1)
      }else{
        zRefs[z].push(id);
      }
    });
    zetas.sort().reverse();
    zetas.forEach(zIndex => {
      zRefs[zIndex.toString()].forEach(id => {
        renderingOrderById.push(id);
      });
    });
      this.coordsPack = coordsPack;
      this.renderingOrderById = renderingOrderById;
  }
  renderScene(){
    if(this.state.isReady){
      return(
        <Canvas CELGF={(error)=>this.consol(error)} id={"renderCanvas"} aspectRatio={this.camera.aspectRatio} fps={24} scale={1} showFps={true}
        renderGraphics={(canvas)=>{
          // console.time("RenderingNow");
          this.canvasRef = canvas;
          canvas.context.clearRect(0, 0, canvas.resolutionWidth, canvas.resolutionHeight);//cleanning window
          // console.log(
          //   canvas.resolutionWidth, 
          //   canvas.resolutionHeight,
          //   document.getElementById("display").style.width,
          //   document.getElementById("display").style.height);

          const clientUnitaryHeightPercentageConstant = 100 / canvas.resolutionHeight;
          const tangencialConstant = this.camera.position.angle;//Uses camera angle
          this.noRenderedItemsCount = 0;
          var rM;
          //*DONE: Recalculate the rotation matrix only when the camera angles are different of the previous recalculation
          if(this.camera.usePerspective){
            if( (this.camera.actualAngles.x != this.camera.sphericalRotation.x) ||
                (this.camera.actualAngles.y != this.camera.sphericalRotation.y) ||
                (this.camera.actualAngles.z != this.camera.sphericalRotation.z)){
                  this.camera.actualAngles.x = this.camera.sphericalRotation.x;
                  this.camera.actualAngles.y = this.camera.sphericalRotation.y;
                  this.camera.actualAngles.z = this.camera.sphericalRotation.z;
                  rM = this.buildRotationMatrix(this.camera.sphericalRotation.x,this.camera.sphericalRotation.y,0); 
                  this.camera.rotationMatrix = rM;
            }else{
              rM = this.camera.rotationMatrix;
            }
          } 


          this.generateRenderingOrder();

          for (let index = 0; index < this.graphArray.objects.length; index++) {
            //const gObject = this.graphArray.objects[index];
            const gObject = this.graphArray.get(this.renderingOrderById[index]);
            var objectScale = gObject.scale;
            var objectLeft = this.coordsPack[gObject.id].left;
            var objectTop = this.coordsPack[gObject.id].top;
            var objectZ = this.coordsPack[gObject.id].z;
            
            var testD = 0.95;
            //TODO: recalculate this only when the camera angles or position have changed or its position 
            if(this.camera.usePerspective && !gObject.ignoreParallax){
              const perspectiveDiff = 1-((1/(objectZ-(this.camera.position.z)))-(1))/((1/this.camera.maxZ)-(1));
              testD = perspectiveDiff;
              const toAddSize = perspectiveDiff * tangencialConstant*(canvas.resolutionWidth)*this.camera.maxZ;
              const computedPercentageSize = clientUnitaryHeightPercentageConstant * (toAddSize);
              objectScale *= computedPercentageSize/100;
              const perspectiveScale = computedPercentageSize/100;
              //*recalculate gobject coords
              var perspectiveLayer = {
                width:canvas.resolutionWidth*perspectiveScale,
                height:canvas.resolutionHeight*perspectiveScale
              }
              objectLeft = (objectLeft + (canvas.resolutionWidth*(this.camera.origin.x-0.5)));
              objectTop = (objectTop + (canvas.resolutionHeight*(this.camera.origin.y-0.5)));
               //it will calc were the image must to be, inside the perspectiveLayer
              objectLeft *= perspectiveLayer.width;
              objectTop *= perspectiveLayer.height;
              //now add the origin of the perspectiveLayer
              objectLeft += -(perspectiveLayer.width-canvas.resolutionWidth)*this.camera.position.left;
              objectTop += -(perspectiveLayer.height-canvas.resolutionHeight)*this.camera.position.top;

              Object.assign(perspectiveLayer,{
                left: -(canvas.resolutionWidth*this.camera.origin.x) -(perspectiveLayer.width-canvas.resolutionWidth)*this.camera.position.left,
                top: -(canvas.resolutionHeight*this.camera.origin.y) -(perspectiveLayer.height-canvas.resolutionHeight)*this.camera.position.top
              });
            }

            var objectWidth = canvas.resolutionWidth*objectScale*gObject.widthScale;
            var objectHeight;
            if(gObject.textureName!=null && this.preserveTexturesAspectRatio){
              objectHeight = (this.texturesList.get(gObject.textureName).texture.naturalHeight/this.texturesList.get(gObject.textureName).texture.naturalWidth)*canvas.resolutionWidth*objectScale*gObject.heightScale;
            }else{
              objectHeight = canvas.resolutionHeight*objectScale*gObject.heightScale;
            }

            if(!(gObject.opacity == 0) && this.checkObjectBoundaries({left:objectLeft,top:objectTop},{width:objectWidth,height:objectHeight},{width:canvas.resolutionWidth,height:canvas.resolutionHeight})){
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
                canvas.context.setTransform(
                  1, 
                  0, 
                  0, 
                  1,
                  (objectLeft)+(objectWidth / 2), 
                    (objectTop)+(objectHeight / 2)); // sets scale and origin
                canvas.context.rotate(gObject._rotate);


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
                  canvas.context.font = (gObject.fontSize*objectScale*canvas.scale*(canvas.resolutionHeight/700))+"px "+gObject.font;
                  const texts = this.replaceCodedExpresions(gObject.text).split("/n");
                  texts.forEach((text,index) => {
                    canvas.context.fillText(
                      text,
                      -(objectWidth)/2,
                      -(objectHeight)/2 + (gObject.fontSize*objectScale*canvas.scale*(1+index)*(canvas.resolutionHeight/700))
                    );
                  });
                }
                if(gObject.textureName!=null)
                canvas.context.drawImage(
                  this.texturesList.get(gObject.textureName).getTexture(gObject),
                  -(objectWidth)/2,
                  -(objectHeight)/2,
                  objectWidth,
                  objectHeight
                );
                canvas.context.restore();
              }else if(testD>0.003){
              //*part three: draw image
                canvas.context.filter = filterString;//if the element to render have filtering values != of the previous element
                if(gObject.text != null){
                  if(gObject.boxColor != "transparent"){
                    canvas.context.fillStyle = gObject.boxColor;
                    canvas.context.fillRect(
                      Math.floor(objectLeft),
                      Math.floor(objectTop),
                      Math.floor(objectWidth),
                      Math.floor(objectHeight)
                      );
                  }
                  canvas.context.fillStyle = gObject.color;
                  canvas.context.font = Math.floor(gObject.fontSize*objectScale*canvas.scale*(canvas.resolutionHeight/700))+"px "+gObject.font;
                  const texts = this.wrapText(//TODO: Wrap it until all the text get wraped
                    canvas.context,
                    this.replaceCodedExpresions(gObject.text),
                    (gObject.margin*objectWidth) + objectLeft,
                    (gObject.margin*objectHeight) + objectTop + (gObject.fontSize*objectScale*canvas.scale*(canvas.resolutionHeight/700)),
                    objectWidth - (gObject.margin*objectWidth)*2,
                    (gObject.fontSize*objectScale*canvas.scale*(canvas.resolutionHeight/700)),
                    gObject.center
                  );
                  texts.forEach((text) => {
                    canvas.context.fillText(
                      text[0],
                      Math.floor(text[1]),
                      Math.floor(text[2])
                    );
                  });
                }
                if(gObject.textureName!=null){
                  canvas.context.drawImage(
                    this.texturesList.get(gObject.textureName).getTexture(gObject),
                    Math.floor(objectLeft),
                    Math.floor(objectTop),
                    Math.floor(objectWidth),
                    Math.floor(objectHeight));
                }
              }else{
                this.noRenderedItemsCount++;
              }

              //*part four: anullate globalalpha and filters
              if(filterString != "none")
                canvas.context.filter = "none";
              if(canvas.context.globalAlpha != 1)
                canvas.context.globalAlpha = 1;
            }else{
              this.noRenderedItemsCount++;
            }

            //*DEBUG INFO
            if(this.objectToDebug == gObject.id){
              //*part five: draw object limits

              if(this.drawObjectLimits){
                //draw image center
                canvas.context.strokeStyle = "red";
                canvas.context.beginPath();
                canvas.context.arc(
                  objectLeft + (objectWidth*canvas.scale*0.5) , 
                  objectTop + (objectHeight*canvas.scale*0.5), 
                  5, 
                  0, 
                  2 * Math.PI);
                canvas.context.stroke();
                //image dimensions
                  canvas.context.strokeStyle = "orange";
                
                canvas.context.strokeRect(
                  objectLeft,
                  objectTop,
                  objectWidth*canvas.scale,
                  objectHeight*canvas.scale);
              }
              
              if(this.showObjectsInfo){
                Object.keys(gObject.dump()).filter(e=>{return gObject[e] != 0}).forEach((element,index) => {
                  if((element.indexOf("_")!= 0)){
                    canvas.context.fillText(
                      element +" : "+gObject[element],
                      objectLeft,
                      (objectTop) +index*15 +15);
                  }
                });
              }

              //*part six: draw perspective layers limits
              if(this.drawPerspectiveLayersLimits && this.camera.usePerspective){//draw objectPerspectiveLimits
                canvas.context.save();
                canvas.context.setTransform(
                  canvas.scale, 
                  0, 
                  0, 
                  canvas.scale,
                  (canvas.resolutionWidth*this.camera.origin.x), 
                  (canvas.resolutionHeight*this.camera.origin.y)); // sets scale and origin
                // throw new Error();
                canvas.context.fillText(
                  "Perspective layer of: "+gObject.id,
                  perspectiveLayer.width/2 -200, 
                  perspectiveLayer.height/2 -20);
                canvas.context.beginPath();
                canvas.context.strokeStyle = "red";
                canvas.context.rect(
                  perspectiveLayer.left,
                  perspectiveLayer.top,
                  perspectiveLayer.width, 
                  perspectiveLayer.height);
                canvas.context.stroke();
                canvas.context.beginPath();
                canvas.context.moveTo(
                  perspectiveLayer.left,
                  perspectiveLayer.top);
                canvas.context.lineTo(
                  perspectiveLayer.left+perspectiveLayer.width,
                  perspectiveLayer.top+perspectiveLayer.height);
                canvas.context.lineTo(
                  perspectiveLayer.left+perspectiveLayer.width,
                  perspectiveLayer.top);
                canvas.context.lineTo(
                  perspectiveLayer.left,
                  perspectiveLayer.top+perspectiveLayer.height);
                if(this.showCanvasGrid){
                  canvas.context.beginPath();
                  canvas.context.strokeStyle = "green";
                  //create grid
                  for (let line = 0; line < 1; line +=.1) {
                    //vertical
                    canvas.context.moveTo(
                      perspectiveLayer.left+perspectiveLayer.width*line,
                      perspectiveLayer.top+0
                    );
                    canvas.context.lineTo(
                      perspectiveLayer.left+perspectiveLayer.width*line,
                      perspectiveLayer.top+perspectiveLayer.height
                    );
                    //horizontal
                    canvas.context.moveTo(
                      perspectiveLayer.left+0,
                      perspectiveLayer.top+perspectiveLayer.height*line
                    );
                    canvas.context.lineTo(
                      perspectiveLayer.left+perspectiveLayer.width,
                      perspectiveLayer.top+perspectiveLayer.height*line
                    );
                  }
                  
                  //show 0<->1 coords
                  canvas.context.fillStyle = "green";
                  canvas.context.font = (12*canvas.scale)+"px Harry";
                  for (let horizontal = 0; horizontal < 1; horizontal+=.1) {
                    for (let vertical = 0; vertical < 1; vertical+=.1) {
                      canvas.context.fillText(
                        Math.round(horizontal*10)/10+", "+Math.round(vertical*10)/10,
                        perspectiveLayer.left+(perspectiveLayer.width*horizontal)-45,
                        perspectiveLayer.top+(perspectiveLayer.height*vertical)-8 );
                    }
                  }
                  canvas.context.stroke();
                }
                canvas.context.stroke();
                canvas.context.restore();
              }
            }
          }
          // console.warn("Objects excluded: ",this.noRenderedItemsCount);
          //*part seven: draw canvas grid
          if(this.showCanvasGrid){
            if(this.drawPerspectiveLayersLimits && this.camera.usePerspective){}else{
              canvas.context.beginPath();
              canvas.context.strokeStyle = "black";
              //create grid
              for (let line = 0; line < 1; line +=.1) {
                //vertical
                canvas.context.moveTo(
                  canvas.resolutionWidth*line,
                  0
                );
                canvas.context.lineTo(
                  canvas.resolutionWidth*line,
                  canvas.resolutionHeight
                );
                //horizontal
                canvas.context.moveTo(
                  0,
                  canvas.resolutionHeight*line
                );
                canvas.context.lineTo(
                  canvas.resolutionWidth,
                  canvas.resolutionHeight*line
                );
              }
              canvas.context.closePath();
              canvas.context.stroke();
              //show 0<->1 coords
              canvas.context.fillStyle = "black";
              canvas.context.font = "900 "+(15*canvas.scale)+"px Calibri";
              for (let horizontal = 0; horizontal < 1; horizontal+=.1) {
                for (let vertical = 0; vertical < 1; vertical+=.1) {
                  canvas.context.fillText(
                    Math.round(horizontal*10)/10+", "+Math.round(vertical*10)/10,
                    (canvas.resolutionWidth*horizontal)-45,
                    (canvas.resolutionHeight*vertical)-8 );
                }
              }
            }
          }
          // console.timeEnd("RenderingNow");
        }} 
        onLoad={(canvas)=>{
          window.deltarg = 0;
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
        }}
        events={(canvas)=>{
          window.deltarg += canvas.fps.elapsed;
          for (let index = 0; index < this.anims.objects.length; index++) {
            const anim = this.anims.objects[index];
            if(anim.relatedTo != null){
              anim.updateState(window.deltarg,(relatedTo)=>{return relatedTo!="engineCamera"?this.graphArray.get(relatedTo):this.camera},this);
            }
            //Add here the onComplete functionalities
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

          this.codedRoutines._objects.forEach(element => {
            element.code(this);//I really dunno if someone will need the canvas data
            //* Answer: DEFINITELY YES!!
          });
        }}
        />
      );
    }else{
      return;
    }
  }
  mouseCameraRotation(mX,mY){
    this.camera.sphericalRotation.x = (mX-0.5)*Math.PI*-4;
    this.camera.sphericalRotation.y = (mY-0.5)*Math.PI*4;
  }
  
  checkTriggers(mouse,action){//check using mouse stats
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
    if(window.innerWidth > mouse.target.clientWidth){
        mX = (clientX-((window.innerWidth-mouse.target.clientWidth)/2))/mouse.target.clientWidth;
        mY = clientY/mouse.target.clientHeight;
    }else if(window.innerHeight > mouse.target.clientHeight){
        mX = clientX/mouse.target.clientWidth;
        mY = (clientY-((window.innerHeight-mouse.target.clientHeight)/2))/mouse.target.clientHeight;
    }
    //move mouse "digital coords" with camera origin
    
    mX += (0.5-this.camera.origin.x);
    mY += (0.5-this.camera.origin.y);
    //rotating view with mouse test
    this.mouseCameraRotation(mX,mY)


    var targetGraphObjectId = "";
    const reversedRenderOrderList = [].concat(this.renderingOrderById).reverse();
    const objectsWithTriggersList = this.triggers.relatedToReversedList();
    const triggersIdList = this.triggers.ids();

    for (let index = 0; index < reversedRenderOrderList.length; index++) {
      const gO = this.graphArray.get(reversedRenderOrderList[index]);

      var objectHeight;
      if(gO.textureName!=null && this.preserveTexturesAspectRatio){
        objectHeight = (this.texturesList.get(gO.textureName).texture.naturalHeight/this.texturesList.get(gO.textureName).texture.naturalWidth)*gO.scale*gO.heightScale*(this.canvasRef.resolutionWidth/this.canvasRef.resolutionHeight);
      }else{
        objectHeight = gO.scale*gO.heightScale;
      }
      if(mY>=gO.top){
        if(mX>=gO.left){
          if(mY<=(gO.top+(objectHeight))){
            if(mX<=(gO.left+(gO.scale*gO.widthScale))){
              targetGraphObjectId = gO.id;
              if(targetGraphObjectId in objectsWithTriggersList){
                objectsWithTriggersList[targetGraphObjectId].forEach(triggerId => {
                  try {
                    this.triggers.get(triggerId).check(this,gO,action);
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
    //console.log(reversedRenderOrderList, objectsWithTriggersList,targetGraphObjectId);
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
        trigger.check(this,this.graphArray.get(trigger.relatedTo),"onLeave");
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
          onMouseDown={(e)=>this.checkTriggers(e,"onHold")}
          onMouseUp={(e)=>this.checkTriggers(e,"onRelease")}
          onWheel={(e)=>{this.camera.position.z -=(e.deltaY/1000)}}
          //This may be used only in the dev mode(elements aligment, etc)
          onMouseMove={(e)=>{if(this.mouseListener+(1000/45) < performance.now()){this.mouseListener = performance.now();this.checkTriggers(e,"mouseMove")}}}
        />
      );
    }
    
  }
  display(){
    return(
      this.renderScene()
    );
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
      <>
        {this.display()}
        {this.consolRend()}
        {this.triggersTarget()}
      </>
    );
  }
}
export {RenderEngine}