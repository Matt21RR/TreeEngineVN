import { GPU } from "gpu.js";

import * as StackBlur from "stackblur-canvas";
class Shader {
  #id
  #texture;

  #gpu

  #resolution

  #reducedTexture

  #textureData

  #radialBlurTest
  #blurShader
  #blurCanvas
  #chromaticShader

  #blurAplied
  #aberrationAplied

  #renderedTree

  setTextureData(){
    const canvas = this.#blurCanvas;
    this.#textureData = canvas.getContext('2d').getImageData(0,0,this.#resolution.width, this.#resolution.height);
  }
  
  // copyCanvas returns a canvas containing the same image as the given canvas.
  /**
   * 
   * @param {*} original 
   * @param {*} createMode 
   * @returns HTMLCanvasElement
   */
  copyCanvas(original,createMode = false) {
    var copy = document.createElement('canvas');
    copy.width = original.width;
    copy.height = original.height;
    if(!createMode){
      copy.getContext('2d').drawImage(original, 0, 0);  // Copy the image.
    }
    return copy;
  }

  constructor(texture,id,widthArg = null, heightArg = null){
    this.#texture = texture;
    this.#id = id;
    this.#renderedTree = {
      blur:{}
    }

    const width = widthArg == null ?  texture.naturalWidth : widthArg;
    const height = heightArg == null ? texture.naturalHeight : heightArg;

    var canvas = document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const gl = canvas.getContext('webgl2', { 
      premultipliedAlpha: true, 
      antialias:false, 
      preserveDrawingBuffer: false, 
      depth: false, 
      stencil: false,
      powerPreference : "high-performance"});
    
    this.#gpu = new GPU({
      canvas,
      context: gl
    });

    //*******reduction shader
    const image = texture;
    this.#resolution = {width:width,height:height}
    this.#reducedTexture = image;

    if(width >1500 || height >1500){ 
      const reduceFactor = Math.round((this.#resolution[["width","height"][width/height >1?0:1]]) /1500);
      //crear el shader de reduccion
      //*Las comillas son para evitar que se minifique el codigo de la funcion kernely
      const reduceShader = this.#gpu.createKernel(`function (){
        const pixel = this.constants.image[Math.floor((this.thread.y*this.constants.reduceFactor* this.constants.width) + (this.thread.x*this.constants.reduceFactor))];
        if(pixel[3] != 0){
          this.color(pixel[0],pixel[1],pixel[2],pixel[3])
        }else{
          this.color(0,0,0,0)
        }
      }`)
        .setGraphical(true)
        .setOutput([Math.floor(width/reduceFactor),height/reduceFactor])
        .setConstants({reduceFactor:reduceFactor,image:image,width:width});

      reduceShader();
      this.#reducedTexture = reduceShader.canvas;
      
      this.#resolution.width = Math.floor(this.#resolution.width / reduceFactor);
      this.#resolution.height = Math.floor(this.#resolution.height / reduceFactor);
    }

    this.#blurCanvas = this.copyCanvas(this.#reducedTexture);
    this.setTextureData();


    //*********************************Radial blur*************************************
    this.#radialBlurTest = this.#gpu.createKernel(function (areas, rArray, rBase) {
      let sum0 = 0;
      let sum1 = 0;
      let sum2 = 0;
      let sum3 = 0;
      let nRad = 0;
      const rx = Math.pow(this.thread.x-(this.constants.width/2),2);
      const ry = Math.pow(this.thread.y -(this.constants.height/2),2);
      let rxy = Math.sqrt(rx + ry);

      while((rxy > rArray[nRad]) && (nRad < rBase)){
        nRad++;
      }
      var area = areas[nRad];

      if(nRad == 0){
        const pixel = this.constants.image[(this.thread.y) * this.constants.width + (this.thread.x)];
        this.color(pixel[0],pixel[1],pixel[2],pixel[3]);
      }
      if (nRad != 0){
        for (let i = -nRad; i <= nRad; i++) {
          for (let j = -nRad; j <= nRad; j++) {
            const x = this.thread.x + i;
            const y = this.thread.y + j;
            const pixel = this.constants.image[(y) * this.constants.width + (x)];
            if(pixel[3] != 0 && x>=0 && y>=0 && x<=this.constants.width && y<=this.constants.height){
              sum0 += pixel[0];
              sum1 += pixel[1];
              sum2 += pixel[2];
              sum3 += pixel[3];
            }else if(pixel[3] != 0){
              area--;
            }
          }
        }
        sum0 /= area;
        sum1 /= area;
        sum2 /= area;
        sum3 /= area;
        if(sum3 != 0){
          this.color(sum0,sum1,sum2,sum3);
        }
      }
      
    })
    .setOutput([this.#resolution.width,this.#resolution.height])
    .setGraphical(true)
    .setTactic("speed")
    .setDynamicArguments(true)
    .setDynamicOutput(true)
    .setConstants({image:this.#reducedTexture,width:this.#resolution.width,height:this.#resolution.height});

    // //**bLUR shader
    this.#blurShader = this.#gpu.createKernel(`function (radius, area) {
      let sum0 = 0;
      let sum1 = 0;
      let sum2 = 0;
      let sum3 = 0;
      for (let i = -radius; i <= radius; i++) {
        for (let j = -radius; j <= radius; j++) {
          const pixel = this.constants.image[(this.thread.y + j) * this.constants.width + (this.thread.x + i)];
          if(pixel[3] != 0){
            sum0 += pixel[0];
            sum1 += pixel[1];
            sum2 += pixel[2];
            sum3 += pixel[3];
          }
        }
      }
      sum0 /= area;
      sum1 /= area;
      sum2 /= area;
      sum3 /= area;
      if(sum3 != 0){
        this.color(sum0,sum1,sum2,sum3);
      }else{
        this.color(0,0,0,0);
      }
    }`)
    .setOutput([this.#resolution.width,this.#resolution.height])
    .setGraphical(true)
    .setTactic("speed")
    .setConstants({image:this.#reducedTexture,width:this.#resolution.width,height:this.#resolution.height});
    

    //*CHROMATIC ABERRATION
    this.#chromaticShader = this.#gpu.createKernel(`function (redShift, greenShift, blueShift) {
      const x = this.thread.x;
      const y = this.thread.y; 
      
      // Calcula las coordenadas desplazadas para los canales de color
      const xOffsetRed = x + redShift;
      const yOffsetRed = y - redShift;
      const xOffsetGreen = x - greenShift;
      const yOffsetGreen = y - greenShift;
      const xOffsetBlue = x ;
      const yOffsetBlue = y + blueShift;
    
      // Obtiene los valores de color para cada canal desplazado
      const rShifted = this.constants.image[yOffsetRed * this.constants.width + xOffsetRed];
      const gShifted = this.constants.image[yOffsetGreen * this.constants.width + xOffsetGreen];
      const bShifted = this.constants.image[yOffsetBlue * this.constants.width + xOffsetBlue];
    
      // Combina los canales de color desplazados para obtener el resultado final
      const outputR = rShifted[0];
      const outputG = gShifted[1];
      const outputB = bShifted[2];
      const alpha = (rShifted[3]+gShifted[3]+bShifted[3])/3;
    
      // Devuelve el color resultante
      this.color(outputR, outputG, outputB,alpha);}`)
      .setOutput([this.#resolution.width,this.#resolution.height])
      .setGraphical(true)
      .setTactic("speed")
      .setConstants({image:this.#reducedTexture,width:this.#resolution.width,height:this.#resolution.height});

    //*********SHADERS UTILITIES
    this.#blurAplied = 0;
    this.#aberrationAplied = 0;
  }
  get id(){return this.#id;}
  /**
   * 
   */
  get texture(){return this.#texture;}
  // //**bLUR shader
  rArrayCalc(blur){
    var rArray = [];
    for (let index = 1; index <= blur; index++) {
      rArray.push(Math.round((this.#resolution.height/2)*(index/blur)));
    }
    return rArray;
  }
  areasCalc(radius){
    var areas = [];
    for (let index = 0; index <= radius; index++) {
      areas.push((2 * index +1) * (2 * index +1));
    }
    return areas;
  }
  getTexture (graphObject){
    if(graphObject.aberration != 0){
        const intensity = graphObject.aberration;
        if(graphObject.aberrationType == "static" && this.#aberrationAplied != intensity){
          this.#aberrationAplied = intensity;
          this.#chromaticShader(intensity,intensity,intensity);
        }else if(graphObject.aberrationType != "static"){
          const goofier = ()=>(Math.floor(Math.random()*intensity)-Math.round(intensity/2))
          this.#chromaticShader(goofier(),goofier(),goofier());
        }
        return this.#chromaticShader.canvas;
    }
    else if (Math.round(graphObject.blur)!=0 && 1 ==2){
      if(this.#blurAplied != Math.round(graphObject.blur) && !(Math.round(graphObject.blur) in this.#renderedTree.blur)){
        this.#blurAplied = Math.round(graphObject.blur);
        const radius = this.#blurAplied;
        const area = (2 * radius +1) * (2 * radius +1);
        // this.#radialBlurTest(this.areasCalc(radius),this.rArrayCalc(radius), radius);

        // const targetCanvas = this.copyCanvas(this.#reducedTexture);
        // StackBlur.canvasRGBA(targetCanvas,0,0,this.#resolution.width,this.#resolution.height,radius);
        // this.#renderedTree.blur[this.#blurAplied] = targetCanvas;

        const blurredData = StackBlur.imageDataRGBA(structuredClone(this.#textureData),0,0,this.#resolution.width,this.#resolution.height,radius);
        this.#blurCanvas.getContext('2d').putImageData(blurredData, 0, 0);
        this.#renderedTree.blur[this.#blurAplied] = this.#blurCanvas;

        // this.#blurShader(radius,area);
        // this.#renderedTree.blur[this.#blurAplied] = this.copyCanvas(this.#blurShader.canvas);

      }else if(this.#blurAplied != Math.round(graphObject.blur)){
        this.#blurAplied = Math.round(graphObject.blur);
      }
      //console.log(Math.round(graphObject.blur));
      return this.#renderedTree.blur[this.#blurAplied];
    }
    else{
      return this.#texture;
    }
  }
  destroy(){
    this.#gpu.destroy();
  }
}

export {Shader}