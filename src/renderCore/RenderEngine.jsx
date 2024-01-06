import React from "react";

import { Canvas } from "./Canvas";
import { GraphObj, ObjectArray, Animation } from "./graphObj";
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

    this.graphArray = ObjectArray.create();//array de objetos, un objeto para cada imagen en pantalla
    this.graphObj = GraphObj;
    this.animation = Animation;
    this.texturesArray = new Object();
    this.anims = ObjectArray.create();
    this.codedRoutines = ObjectArray.create();
    this.triggers = ObjectArray.create();
    this.gameVars = {};//Y guardar esto tambien
    this.texturesList = ObjectArray.create();

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
    this.preserveTexturesAspectRatio = this.props.preserveTexturesAspectRatio != undefined ? this.props.preserveTexturesAspectRatio : true;
    this.drawPerspectiveLayersLimits = false;

    this.mouseListener = 0;

    this.noRenderedItemsCount = 0;

    this.showListedData = false;
    this.drawObjectLimits = true;
    this.showObjectsInfo = false;
    this.showCanvasGrid = true;

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
  loadTextures(texturesData,fun = null){
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
      textures.forEach(texture => {
        Object.assign(this.texturesArray,texture);
      });
      if(typeof fun == "function")
        fun();
    }).catch(reason =>{
      console.error("===============================");
      console.error("Error during textures load phase:");
      console.error(reason);
      console.error("===============================");
    });
  }
  loadScene(sceneId){
    this.actualSceneId = sceneId;
    let scene = this.masterScript[sceneId];
    console.log(scene.sounds);
    console.log(scene.textures);
    this.setState({isReady:false},()=>{
      //reset values
      this.graphArray = ObjectArray.create();//array de objetos, un objeto para cada imagen en pantalla
      this.graphObj = GraphObj;
      this.animation = Animation;
      this.texturesArray = new Object();
      this.anims = ObjectArray.create();
      this.codedRoutines = ObjectArray.create();
      this.triggers = ObjectArray.create();
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

      this.loadTextures(scene.textures,()=>{
        //change texture reference with the actual file
        Object.assign(this.gameVars,scene.gameVars);

        scene.graphObjects.map(object =>{object.textureFile = this.texturesArray[object.texture]; object.textureName=object.texture; return object});

        scene.graphObjects.forEach(object => this.graphArray.push(GraphObj.create(object)));
        scene.triggers.forEach(trigger => this.triggers.push(trigger));
        scene.animations.forEach(animation => this.anims.push(Animation.create(animation)));
        scene.codedRoutines.forEach(codedAnim => this.codedRoutines.push(codedAnim));

        this.setState({isReady:true})
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
  renderScene(){
    if(this.state.isReady){
      return(
        <Canvas CELGF={(error)=>this.consol(error)} id={"renderCanvas"} aspectRatio={this.camera.aspectRatio} fps={30} scale={1} showFps={true}
        renderGraphics={(canvas)=>{
          this.canvasRef = canvas;
          canvas.context.clearRect(0, 0, canvas.resolutionWidth, canvas.resolutionHeight);//cleanning window

          const clientUnitaryHeightPercentageConstant = 100 / canvas.resolutionHeight;
          const tangencialConstant = this.camera.position.angle;//Uses camera angle
          this.noRenderedItemsCount = 0;
          var rM;
          //TODO: Recalculate the rotation matrix only when the camera angles are different of the previous recalculation
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
            
          for (let index = 0; index < this.graphArray.objects.length; index++) {
            const gObject = this.graphArray.objects[index];
            var objectScale = gObject.scale;
            var objectLeft = (gObject.left + (this.camera.origin.x-0.5))*canvas.resolutionWidth;
            var objectTop = (gObject.top + (this.camera.origin.y-0.5))*canvas.resolutionHeight;
            var objectZ = gObject.z +this.camera.sphericalRotation.center + this.camera.position.z;
            //TODO: recalculate this only when the camera angles or position have changed
            if(this.camera.usePerspective && !gObject.ignoreParallax){
              const px = gObject.left;
              const py = gObject.top;
              const pz = gObject.z -this.camera.sphericalRotation.center - this.camera.position.z;

              objectLeft = (rM.Axx*px + rM.Axy*py + rM.Axz*pz);
              objectTop = (rM.Ayx*px + rM.Ayy*py + rM.Ayz*pz);
              objectZ = rM.Azx*px + rM.Azy*py + rM.Azz*pz+this.camera.sphericalRotation.center  + this.camera.position.z;
            }
            
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
            if(gObject.texture!=null && this.preserveTexturesAspectRatio){
              objectHeight = (gObject.texture.naturalHeight/gObject.texture.naturalWidth)*canvas.resolutionWidth*objectScale*gObject.heightScale;
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
              //with testD > 0.005 we ensure the very far of|behind the camera elements won't be rendered

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
                      (objectWidth),
                      (objectHeight)
                      );
                  }
                  canvas.context.fillStyle = gObject.color;
                  canvas.context.font = (gObject.fontSize*objectScale)+"px "+gObject.font;//Relate fontsize to canvs res
                  canvas.context.fillText(
                    gObject.text,
                    -(objectWidth)*1/2,
                    (-(objectHeight- (gObject.fontSize*objectScale))*1/2));
                }
                if(gObject.texture!=null)
                canvas.context.drawImage(
                  gObject.getTexture(),
                  -(objectWidth)/2,
                  -(objectHeight)/2,
                  (objectWidth),
                  (objectHeight)
                );
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
                    canvas.context.font = (gObject.fontSize*objectScale*canvas.scale*(canvas.resolutionHeight/700))+"px "+gObject.font;
                    const texts = this.replaceCodedExpresions(gObject.text).split("/n");
                    texts.forEach((text,index) => {
                      canvas.context.fillText(
                        text,
                        objectLeft,
                        objectTop + (gObject.fontSize*objectScale*canvas.scale*(1+index)*(canvas.resolutionHeight/700))
                      );
                    });
                  }
                  if(gObject.texture!=null){
                    canvas.context.drawImage(
                      this.texturesList.get(gObject.textureName).getTexture(gObject),
                      //gObject.getTexture(),
                      objectLeft,
                      objectTop,
                      objectWidth,
                      objectHeight);
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
                  canvas.context.font = (12*this.scale)+"px Harry";
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
              //*part seven: draw canvas grid
              if(this.showCanvasGrid){
                if(this.drawPerspectiveLayersLimits && this.camera.usePerspective){}else{
                  canvas.context.beginPath();
                  canvas.context.strokeStyle = "green";
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
                  
                  //show 0<->1 coords
                  canvas.context.fillStyle = "green";
                  canvas.context.font = (12*this.scale)+"px Harry";
                  for (let horizontal = 0; horizontal < 1; horizontal+=.1) {
                    for (let vertical = 0; vertical < 1; vertical+=.1) {
                      canvas.context.fillText(
                        Math.round(horizontal*10)/10+", "+Math.round(vertical*10)/10,
                        (canvas.resolutionWidth*horizontal)-45,
                        (canvas.resolutionHeight*vertical)-8 );
                    }
                  }
                  canvas.context.stroke();
                }
              }
            }
          }
          // console.warn("Objects excluded: ",this.noRenderedItemsCount);
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
          this.codedRoutines._objects.forEach(element => {
            element.code(this);//I really dunno if someone will need the canvas data
          });
        }}
        />
      );
    }else{
      return;
    }
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
    this.camera.sphericalRotation.x = (mX-0.5)*Math.PI*-1;
    this.camera.sphericalRotation.y = (mY-0.5)*Math.PI*1;
    //Moving camera with mouse movement xy
    //this.camera.position.left = -(.5*this.camera.position.z)+(mX*this.camera.position.z)+.5;
    //this.camera.position.top = -(.5*this.camera.position.z)+(mY*this.camera.position.z)+.5;

    for (let index = 0; index < this.triggers._objects.length; index++) {
      const trigger = this.triggers._objects[index];
      if(Object.keys(trigger).indexOf(action) != -1 || ((action == "onMove") && (Object.keys(trigger).indexOf("onMove") != -1 || Object.keys(trigger).indexOf("onMouseOut") != -1))){
        const gO = this.graphArray.get(trigger.relatedTo);
        // //This may be used only in the dev mode(elements aligment, etc)
        
        // // devmode end
        //recalculate using texture boundaries (if the graphobject have texture)
        var objectHeight;
        if(gO.texture!=null && this.preserveTexturesAspectRatio){
          objectHeight = (gO.texture.naturalHeight/gO.texture.naturalWidth)*gO.scale*gO.heightScale*(this.canvasRef.resolutionWidth/this.canvasRef.resolutionHeight);
        }else{
          objectHeight = gO.scale*gO.heightScale;
        }

        if(mY>gO.top){
          if(mX>gO.left){
            if(mY<(gO.top+(objectHeight))){
              if(mX<(gO.left+(gO.scale*gO.widthScale))){
                  if(action != "onMove"){
                    trigger[action](this); 
                    return;
                  }else if(Object.keys(trigger).indexOf("onMove") != -1){
                    trigger[action](this,gO)
                    return; //? Check this
                  }else{console.log("none")}

              }
            }
          }
        }
        //Si el mouse no esta dentro y la revision se hace por el movimiento del mouse
        if(Object.keys(trigger).indexOf("onMouseOut") != -1){
          console.log("onMouseOut",gO.id);
          trigger["onMouseOut"](this,gO);
        }
      }
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
          onMouseMove={(e)=>{if(this.mouseListener+(1000/60) < performance.now()){this.mouseListener = performance.now();this.checkTriggers(e,"onMove")}}}
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