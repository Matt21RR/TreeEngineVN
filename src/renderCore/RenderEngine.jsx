import React from "react";

import urbanImg from '../res/engineRes/urban.png';
import aImg from '../res/engineRes/a.png';
import rectangle from './rectangle.svg';
import { Canvas } from "./Canvas";
import { graphObj, graphArr } from "./graphObj";

class RenderEngine extends React.Component{
  constructor(props){
    super(props);
    this.isChromiumBased = !!window.chrome;
    this.mounted = false;
    this.graphArray = graphArr.create();//array de objetos, un objeto para cada imagen en pantalla
    this.graphObj = graphObj;
    
    window.compareArray = new Array();
    this.direction = 1;
    this.direction2 =1;
    this.texturesArray = new Object();

    this.state = {
      isReady:false,
    }
    this.blurCanvas = document.createElement("canvas");
    this.blurContext = this.blurCanvas.getContext("2d");
    this.blurContext.imageSmoothingEnabled = false;

    this.rectangleData = null;
    this.rectangleBuffer = null;
    const pi1800 = (Math.PI/1800);
    this.angles =[...new Array(3600).fill(0)].map((_,i) => ({
      cos: Math.floor(Math.cos(i * pi1800)*100000)/100000,
      sin: Math.floor(Math.sin(i * pi1800)*100000)/100000
    }));
    console.log(this.angles);
    this.sin = (angle)=>{var a = Math.floor(angle*10)%3600; a = a<0?3600+a:a; return this.angles[a].sin}
    this.cos = (angle)=>{var a = Math.floor(angle*10)%3600; a = a<0?3600+a:a; return this.angles[a].cos}

    this.camera = {
      maxZ:10000,
      origin:{x:.5,y:.5},
      position:{top:.5,left:.5,z:0,angle:1},
      sphericalRotation:{x:0,y:-90,center:100},
      usePerspective:true,
      aspectRatio:"16:9"
    }
    this.drawPerspectiveLayersLimits = false;

    this.drawObjectLimits = false;
    this.showObjectsInfo = false;
    this.showCanvasGrid = false;

    this.objectToDebug = null;
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
  loadTextures(texturesPath,fun = null){
    Promise.all(texturesPath.map(textureSrc=>
      new Promise(resolve=>{
        const image = new Image();
        image.src = textureSrc;
        image.addEventListener('load',()=>{
          const res = new Object({[textureSrc]:image});
          resolve(res);
        });
      })
    )).then(textures => {
      textures.forEach(texture => {
        Object.assign(this.texturesArray,texture);
      });
      if(fun != null)
        fun();
    }).catch(reason =>{
      console.error("===============================");
      console.error("Error during textures load phase:");
      console.error(reason);
      console.error("===============================");
    });
  }
  componentDidMount(){
    if (!this.mounted) {
      this.loadTextures([urbanImg,aImg,rectangle],()=>{
        //establish perspective values
        const self = this;
        for (let index = 500; index > 0; index--) {
          for (let index2 = 0; index2 <= 5; index2++) {
              const element = graphObj.create({imgFile:self.texturesArray[aImg],//char
              zPos:index * 20,
              top:0.25+(Math.random()*30)-15,
              left:((index2-2.5)*5),
              brightness:1+Math.random(),
              contrast:Math.random(),
              scale:.65});
              this.graphArray.push(element);
          }
        }
        const a = graphObj.create({
          text:"Lorem ipsum dolor sit amet consectetur adipisicing elit. Nam eum laboriosam veniam voluptatum? Ullam natus, blanditiis dolorum non eaque id, provident corrupti doloremque omnis minus eos. Corporis quo quidem vel.",
          fontSize:22,
          color: "white",
          boxColor: "rgba(217, 57, 65)",
          left:0.1,
          top:0.8,
          scale:0.8,
          heightScale:0.2,
          zPos:1,
          ignoreParallax:true,
        });
        // this.graphArray.push(a);
        // var c = a.clone("topTextBox");
        // c.top = 0.1;

        // this.graphArray.push(c);
        
        self.setState({isReady:true});
      });
      this.mounted = true;     
    }
  }
  checkObjectBoundaries(oTLCorner,oRes,cRes){
    //check for very big images
    const tlCorner = {left:oTLCorner.left/cRes.width,top:oTLCorner.top/cRes.height};
    if(tlCorner.left >= 0 && tlCorner.left <= 1 && tlCorner.top >= 0 && tlCorner.top <= 1){
      return true
    }else{
      const sDims = {width:oRes.width/cRes.width,height:oRes.height/cRes.height};
      const brCorner = {left:tlCorner.left+sDims.width,y:tlCorner.top+sDims.height};
      return (brCorner.left >= 0 && brCorner.left <=1 && brCorner.top > 0 && brCorner.top<=1)
    }
  }
  renderScene(){
    if(this.state.isReady){
      const self = this;
      return(
        <Canvas aspectRatio={this.camera.aspectRatio} ghostMode={false} fps={24} static={false} scale={1} showFps={true} recursiveAnimation={true}
        renderGraphics={(canvas)=>{
          canvas.context.clearRect(0, 0, canvas.resolutionWidth, canvas.resolutionHeight);//cleanning window

          const clientHeight = canvas.resolutionHeight;//resolucion vertical del canvas
          const clientUnitaryHeightPercentageConstant = 100 / clientHeight;
          const tangencialConstant = Math.tan(this.camera.position.angle);//Uses camera angle
          var excludedObjects = 0;

          for (let index = 0; index < this.graphArray.graphObjects.length; index++) {
            const gObject = this.graphArray.graphObjects[index];
            //*part zero: perspective multiplier
            var objectScale = gObject.scale;
            var objectLeft = canvas.resolutionWidth*gObject.left;
            var objectTop = canvas.resolutionHeight*gObject.top;
            var objectBlur = gObject.blurNumeric;
            var objectZ = gObject.zPos;
            //camera spherical Rotation
            //y rotation
            objectZ =this.camera.sphericalRotation.center + this.camera.position.z - (this.camera.sphericalRotation.center+this.camera.position.z - gObject.zPos)*Math.cos(this.camera.sphericalRotation.y) - (gObject.top*Math.sin(this.camera.sphericalRotation.y));
            // objectZ =this.camera.sphericalRotation.center + this.camera.position.z - (this.camera.sphericalRotation.center+this.camera.position.z - gObject.zPos)*Math.cos(this.camera.sphericalRotation.y) - (gObject.top*Math.sin(this.camera.sphericalRotation.y));
            const zTemp = objectZ;
            // //x rotation
            // objectZ = this.camera.sphericalRotation.center + this.camera.position.z - (this.camera.sphericalRotation.center+this.camera.position.z - objectZ)*Math.cos(this.camera.sphericalRotation.x);

            var perspectiveScale = 1;
            var testD = 0.95;
            if(this.camera.usePerspective && !gObject.ignoreParallax){
              const perspectiveDiff = 1-((1/(objectZ-(!gObject.ignoreParallax?this.camera.position.z:0)))-(1/1))/((1/this.camera.maxZ)-(1/1));
              testD = perspectiveDiff;
              const toAddSize = perspectiveDiff * tangencialConstant*(canvas.resolutionWidth)*this.camera.maxZ;
              const computedPercentageSize = clientUnitaryHeightPercentageConstant * (toAddSize*2);
              objectScale *= computedPercentageSize/100;
              perspectiveScale = computedPercentageSize/100;
              //*recalculate gobject coords
              var perspectiveLayer = {
                width:canvas.resolutionWidth*perspectiveScale,
                height:canvas.resolutionHeight*perspectiveScale
              }
              Object.assign(perspectiveLayer,{
                left: -(canvas.resolutionWidth*this.camera.origin.x) -(perspectiveLayer.width-canvas.resolutionWidth)*this.camera.position.left,
                top: -(canvas.resolutionHeight*this.camera.origin.y) -(perspectiveLayer.height-canvas.resolutionHeight)*this.camera.position.top
              });

              //it will calc were the image must to be, inside the perspectiveLayer
              objectLeft = Math.cos(this.camera.sphericalRotation.x)*perspectiveLayer.width * (gObject.left + (canvas.resolutionWidth*(this.camera.origin.x-0.5)));
              objectTop = Math.cos(this.camera.sphericalRotation.y)*perspectiveLayer.height * (gObject.top + (canvas.resolutionHeight*(this.camera.origin.y-0.5)));
              //now add the origin of the perspectiveLayer
              objectLeft += -(perspectiveLayer.width-canvas.resolutionWidth)*this.camera.position.left;
              objectTop += -(perspectiveLayer.height-canvas.resolutionHeight)*this.camera.position.top;
              //camera spherical rotation
              objectTop -= (this.camera.sphericalRotation.center+this.camera.position.z-gObject.zPos)*Math.sin(this.camera.sphericalRotation.y)*perspectiveLayer.height;
              objectLeft -= (this.camera.sphericalRotation.center+this.camera.position.z-zTemp)*Math.sin(this.camera.sphericalRotation.x)*perspectiveLayer.width;
            }

            var objectWidth = canvas.resolutionWidth*objectScale*gObject.widthScale;
            var objectHeight;
            if(gObject.imgFile!=null){
              objectHeight = (gObject.imgFile.naturalHeight/gObject.imgFile.naturalWidth)*canvas.resolutionWidth*objectScale*gObject.heightScale;
            }else{
              objectHeight = canvas.resolutionHeight*objectScale*gObject.heightScale;
            }
            
            if(this.checkObjectBoundaries({left:objectLeft,top:objectTop},{width:objectWidth,height:objectHeight},{width:canvas.resolutionWidth,height:canvas.resolutionHeight})){
               //*part one: global alpha
              canvas.context.globalAlpha = gObject.opacity;//if the element to render have opacity != of the previous rendered element}

              //*part two: filtering
              var filterString = gObject.filterString;
              if((testD<0.015&& this.isChromiumBased) || (testD<0.02 && !this.isChromiumBased)){//ignore filters
                filterString = "none";
              }
              

              //*preparatives for part three: if the image need to be rotated
              //with testD > 0.005 we ensure the very far of|behind the camera elements won't be rendered
              if(testD>0.003 && gObject.rotate != 0){
                canvas.context.save();
                canvas.context.setTransform(
                  canvas.scale, 
                  0, 
                  0, 
                  canvas.scale,
                  (objectLeft)+(objectWidth / 2), 
                    (objectTop)+(objectHeight / 2)); // sets scale and origin
                canvas.context.rotate(gObject.rotate);
                if(this.isChromiumBased && objectBlur!=0){//*if chromium
                  let canvasResLimit = 1;
                  var bCScaleDivider = objectBlur >= 4 ? objectBlur :(objectBlur >= 2?2:1.7);
                  bCScaleDivider = objectBlur != 0 ? bCScaleDivider : 1;
                  const increase = (objectBlur+(objectBlur/2))/bCScaleDivider;
                  if(testD<0.5){
                    bCScaleDivider=1*(1-testD);
                    this.blurCanvas.width = ((objectWidth)*(canvas.scale/bCScaleDivider));
                    this.blurCanvas.height = ((objectHeight)*(canvas.scale/bCScaleDivider));
                  }else{
                    //TODO: limit the canvas size to the canvas resolution
                    this.blurCanvas.width = ((objectWidth)*(canvas.scale/bCScaleDivider))+(increase*2);
                    this.blurCanvas.height = ((objectHeight)*(canvas.scale/bCScaleDivider))+(increase*2);
                  }

                  if(this.blurCanvas.width > canvas.resolutionWidth){
                    canvasResLimit = canvas.resolutionWidth / this.blurCanvas.width;
                    this.blurCanvas.width *= canvasResLimit;
                    this.blurCanvas.height *= canvasResLimit;
                  }
                  this.blurContext.filter = filterString;
                  if(gObject.imgFile!=null)
                  this.blurContext.drawImage(
                    gObject.imgFile,
                    increase * canvasResLimit,
                    increase * canvasResLimit,
                    (objectWidth)*(canvas.scale/bCScaleDivider) * canvasResLimit,
                    (objectHeight)*(canvas.scale/bCScaleDivider) * canvasResLimit
                  );
                  canvas.context.drawImage(
                    this.blurCanvas,
                    (objectLeft)-(increase*bCScaleDivider),
                    (objectTop)-(increase*bCScaleDivider),
                    (objectWidth*canvas.scale)+increase*2*bCScaleDivider,
                    (objectHeight*canvas.scale)+increase*2*bCScaleDivider
                  );


                }else{//*If gecko
                  canvas.context.filter = filterString;//if the element to render have filtering values != of the previous element
                  if(gObject.text != null){
                    if(gObject.boxColor != "transparent"){
                      canvas.context.fillStyle = gObject.boxColor;
                      canvas.context.fillRect(
                        -(objectWidth)*canvas.scale/2,
                        -(objectHeight)*canvas.scale/2,
                        (objectWidth)*canvas.scale,
                        (objectHeight)*canvas.scale
                        );
                    }
                    canvas.context.fillStyle = gObject.color;
                    canvas.context.font = gObject.text;
                    canvas.context.fillText(
                      gObject.text,
                      -(objectWidth)*canvas.scale/2,
                      (-(objectHeight- (gObject.fontSize*objectScale))*canvas.scale/2));
                  }
                  if(gObject.imgFile!=null)
                  canvas.context.drawImage(
                    gObject.imgFile,
                    -(objectWidth)*canvas.scale/2,
                    -(objectHeight)*canvas.scale/2,
                    (objectWidth)*canvas.scale,
                    (objectHeight)*canvas.scale
                  );
                }
                canvas.context.restore();
              }else if(testD>0.003){
              //*part three: draw image
                if(this.isChromiumBased && objectBlur!=0 && testD>=0.065 && gObject.text == null){//*if chromium and if are far the camera and if the object arent really smaller
                  if(objectBlur!=0){
                    let canvasResLimit = 1;
                    var bCScaleDivider = objectBlur >= 4 ? objectBlur :(objectBlur >= 2?2:1.7);
                    bCScaleDivider = objectBlur != 0 ? bCScaleDivider : 1;
                    const increase = (objectBlur+(objectBlur/2))/bCScaleDivider;
                    if(testD<0.5){
                      bCScaleDivider=1*(1-testD);
                      this.blurCanvas.width = ((objectWidth)*(canvas.scale/bCScaleDivider));
                      this.blurCanvas.height = ((objectHeight)*(canvas.scale/bCScaleDivider));
                    }else{
                      //TODO: limit the canvas size to the canvas resolution
                      this.blurCanvas.width = ((objectWidth)*(canvas.scale/bCScaleDivider))+(increase*2);
                      this.blurCanvas.height = ((objectHeight)*(canvas.scale/bCScaleDivider))+(increase*2);
                    }
    
                    if(this.blurCanvas.width > canvas.resolutionWidth){
                      canvasResLimit = canvas.resolutionWidth / this.blurCanvas.width;
                      this.blurCanvas.width *= canvasResLimit;
                      this.blurCanvas.height *= canvasResLimit;
                    }
                    this.blurContext.filter = filterString;
                    if(gObject.imgFile!=null)
                    this.blurContext.drawImage(
                      gObject.imgFile,
                      increase * canvasResLimit,
                      increase * canvasResLimit,
                      (objectWidth)*(canvas.scale/bCScaleDivider) * canvasResLimit,
                      (objectHeight)*(canvas.scale/bCScaleDivider) * canvasResLimit
                    );
                    canvas.context.drawImage(
                      this.blurCanvas,
                      (objectLeft)-(increase*bCScaleDivider),
                      (objectTop)-(increase*bCScaleDivider),
                      (objectWidth*canvas.scale)+increase*2*bCScaleDivider,
                      (objectHeight*canvas.scale)+increase*2*bCScaleDivider
                    );
                  }else{//render individually in a separed canvas
                    // this.blurContext.clearRect(0, 0, this.blurCanvas.width, this.blurCanvas.height)
                    // this.blurCanvas.width = objectWidth;
                    // this.blurCanvas.height = objectHeight;
                    // this.blurContext.filter = filterString;
                    //if(gObject.imgFile!=null)
                    // this.blurContext.drawImage(
                    //   gObject.imgFile,
                    //   0,0,
                    //   objectWidth,
                    //   objectHeight);
                    // canvas.context.drawImage(
                    //     this.blurCanvas,
                    //     objectLeft,
                    //     objectTop);
                  }
                }else{//*If gecko
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
                    canvas.context.font = (gObject.fontSize*objectScale*canvas.scale)+"px "+gObject.fontFamily;
                    const texts = gObject.text.split("/n");
                    texts.forEach((text,index) => {
                      canvas.context.fillText(
                        // gObject.text,
                        text,
                        objectLeft,
                        objectTop + (gObject.fontSize*objectScale*canvas.scale*(1+index))
                      );
                    });

                  }
                  if(gObject.imgFile!=null)
                  canvas.context.drawImage(
                    gObject.imgFile,
                    objectLeft,
                    objectTop,
                    objectWidth,
                    objectHeight);
                }
              }

              //*part four: anullate globalalpha and filters
              if(filterString != "none")
                canvas.context.filter = "none";
              if(canvas.context.globalAlpha != 1)
                canvas.context.globalAlpha = 1;
            }else{
              excludedObjects++;
            }

              
            //*DEBUG INFO
            if((this.objectToDebug == null || this.objectToDebug == gObject.id)){
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

                //extended limit for blur
                if(gObject.blurNumeric != 0){
                  if(this.isChromiumBased){
                    canvas.context.fillText(
                      "Quality are being reduced",
                      objectLeft + (objectWidth*canvas.scale)-190,
                      objectTop + (objectHeight*canvas.scale)-10);
                  }
                  canvas.context.strokeStyle = "green";
                  const increase = (gObject.blurNumeric+(gObject.blurNumeric/2));
                  canvas.context.strokeRect(
                    (objectLeft) -(increase),
                    (objectTop) -(increase),
                    (objectWidth*canvas.scale) + (increase*2),
                    (objectHeight*canvas.scale)+ (increase*2));
                  //for the virtual canvas use the half of the resolution(half scale)
                }
              }
              
              if(this.showObjectsInfo){
                Object.keys(gObject).forEach((element,index) => {
                  if(element=="_zPos")
                  canvas.context.fillText(
                    element +" : "+gObject[element],
                    objectLeft,
                    (objectTop) +index*15 +15);
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
              //*part eight: draw perspective diagram
              if(this.showPerspectiveDiagram){
                canvas.context.beginPath();
                canvas.context.strokeStyle = "green";

                canvas.context.stroke();
              }
            }
          }
          // console.warn("Objects excluded: ",excludedObjects);
          
        }} 
        onLoad={(canvas)=>{
          window.deltarg = 0;
          window.poser = 0;
          //calc the perspective angle in degress
          this.camera.position.angle = Math.atan(canvas.resolutionHeight/(this.camera.maxZ*canvas.resolutionWidth));
          //disable image smoothing
          canvas.context.imageSmoothingEnabled = false;
          canvas.context.textRendering = "optimizeSpeed";
          
        }}
        onResize={(canvas)=>{
          //calc the perspective angle
          this.camera.position.angle = Math.atan(canvas.resolutionHeight/(this.camera.maxZ*canvas.resolutionWidth));
        }}
        events={(canvas)=>{
          window.deltarg += canvas.fps.elapsed;
          if(Math.floor(window.deltarg/1000) > window.poser){
            window.poser = Math.floor(window.deltarg/1000);
            console.log(window.poser);
            if(window.poser == 3){
              window.renderEngineTerminal((self)=>{self.graphArray.push(
                self.graphObj.create(
                  {
                    id:"textBox",
                    boxColor:"rgba(180,60,60,0.6)",
                    color:"white",
                    text:"Dentro de la piel del león\nSe esconde un corazón que sobre todo es humano/nAunque te parezca vulgar/nA veces suele llorar cuando el amor le hace daño/nAmada mía, tu luna fría/nMe está matando/nAmada mía, mientras me veo/nEstoy llorando/nTú te das la vuelta y te vas/nYo voy quedándome atrás con tu recuerdo colgado/nEso no me vuelve a pasar/nVoy a tragarme el dolor a pecho abierto/nNo voy a volver a llorar/nAunque me toque perder más de mil noches contigo/nPongo el corazón por testigo/nNi una sola lágrima más, te digo/nNo voy a volver a llorar/nAunque me ahogue en el mar de tus amores furtivos/nPongo el corazón por testigo/nNi una sola lágrima más, mejor morir que suplicar/nNo voy a volver a llorar",
                    opacity:0,
                    scale:0,
                    top:1,
                    left:0.5,
                    ignoreParallax:true,
                    zPos:1,
                    fontFamily:"Arial",
                    animation:{
                      ease:"outBounce",
                      duration:2000,
                      to:{scale:0.8,top:0.1,left:0.1,opacity:1}
                    }}
                )
              )});
            }
          }
          if(window.deltarg > 3000)
          window.renderEngineTerminal(
            (self)=>{
              var a = self.graphArray.get("textBox");
              a._animation.updateState(a,window.deltarg-3000)
            }
          );
          
        }}
        animateGraphics={(canvas)=>{
            if(this.direction2 == 1){
                this.camera.sphericalRotation.y -= 0.005;
            }
            if(this.direction == 1){
              this.camera.position.z+=.6 + (this.camera.position.z*2/1000);
              if(this.camera.position.z>=7000){
                this.direction = -1;
              }
            }else{
              this.camera.position.z-=.6   + (this.camera.position.z*2/1000);
              if(this.camera.position.z<=0){
                this.direction = 1;
              }
            }
        }}
        />
      );
    }else{
      return;
    }
  }
  render(){
    return(
      this.renderScene()
    );
  }
}
export {RenderEngine}