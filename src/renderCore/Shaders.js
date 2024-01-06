import { GPU } from "gpu.js";
import { ObjectArray } from "./graphObj";

class Shader {
  static create(texture,id){
    var s = new Object({
      texture: texture,
      id:id
    })
    //*******reduction shader
    const width = texture.naturalWidth,height = texture.naturalHeight;
    var canvas = document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, antialias:false });
    const gpu = new GPU({
      canvas,
      context: gl
    });
    const image = texture;
    var resolution = {width:width,height:height}
    s._reducedTexture = image
    if(width >1000 || height >1000){ 
      const reduceFactor = Math.round((resolution[["width","height"][width/height >1?0:1]]) /1000);
      //crear el shader de reduccion
      //*Las comillas son para evitar que se minifique el codigo de la funcion kernely
      const reduceShader = gpu.createKernel(`function (){
        const pixel = this.constants.image[Math.floor(this.thread.y*this.constants.reduceFactor) * this.constants.width + Math.floor(this.thread.x*this.constants.reduceFactor)];
        if(pixel[3] != 0){
          this.color(pixel[0],pixel[1],pixel[2],pixel[3])
        }else{
          this.color(0,0,0,0)
        }
      }`)
        .setGraphical(true)
        .setOutput([width/reduceFactor,height/reduceFactor])
        .setConstants({reduceFactor:reduceFactor,image:image,width:width});

      reduceShader();
      s._reducedTexture = reduceShader.canvas;
      
      resolution.width /= reduceFactor;
      resolution.height /= reduceFactor;
    }
    const red = s._reducedTexture;
    // //**bLUR shader
    s._blurShader = gpu.createKernel(`function (radius) {
      let sum = [0, 0, 0, 0];
      for (let i = -1*radius; i <= 1*radius; i++) {
        for (let j = -1*radius; j <= 1*radius; j++) {
          const pixel = this.constants.image[(this.thread.y + j) * this.constants.width + (this.thread.x + i)];
          if(pixel[3] != 0){
            sum[0] += pixel[0];
            sum[1] += pixel[1];
            sum[2] += pixel[2];
            sum[3] += pixel[3];
          }
        }
      }
      const numPixels = (2 * radius +1) * (2 * radius + 1);
      sum[0] /= numPixels;
      sum[1] /= numPixels;
      sum[2] /= numPixels;
      sum[3] /= numPixels;
      if(sum[3] != 0){
        this.color(
          sum[0],
          sum[1],
          sum[2],
          sum[3]
        );
      }
      else{
        this.color(0,0,0,0);
      }
    }`)
      .setOutput([resolution.width,resolution.height])
      .setGraphical(true)
      .setConstants({image:red,width:resolution.width,height:resolution.height});
    //*CHROMATIC ABERRATION
    s._chromaticShader = gpu.createKernel(`function (redShift, greenShift, blueShift) {
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
      .setOutput([resolution.width,resolution.height])
      .setGraphical(true)
      .setTactic("speed")
      .setConstants({image:red,width:resolution.width,height:resolution.height});
    
    //*** DITHERING SHADER
    s._ditheringShader = gpu.createKernel(function (intensity,half,intensityHalf) {
      
      const x = this.thread.x;
      const y = this.thread.y; 
      const pixel = this.constants.image[(y) * this.constants.width + (x)];
      if(x%intensity==0 && y%intensity == 0){
        this.color(pixel[0],pixel[1],pixel[2],pixel[3])
      }else if(half){
        if((x+(intensityHalf))%intensity==0 && (y+(intensityHalf))%intensity == 0){
          this.color(pixel[0],pixel[1],pixel[2],pixel[3],)
        }
      }
    })
    .setOutput([resolution.width,resolution.height]).setGraphical(true).setConstants({image:red,width:resolution.width,height:resolution.height});

    //*BLACK N WHITE SHADER
    s._colorscale = gpu.createKernel(function () {
      
      const x = this.thread.x;
      const y = this.thread.y; 
      const pixel = this.constants.image[(y) * this.constants.width + (x)];
      const bleh = (pixel[0]+pixel[1]+pixel[2])/3;
      if(pixel[3] != 0){
        if(bleh>0.3)
        this.color(pixel[0],pixel[1],pixel[2],Math.round(bleh));
      }
      
    })
    .setOutput([resolution.width,resolution.height]).setGraphical(true).setConstants({image:red,width:resolution.width,height:resolution.height});

    //*********SHADERS UTILITIES
    s._blurAplied = 0;
    s._aberrationAplied = 0;
    s.getTexture = (graphObject)=>{
      if(graphObject._aberration != 0){
          const intensity = graphObject._aberration;
          if(graphObject._aberrationType == "static" && s._aberrationAplied != intensity){
            s._aberrationAplied = intensity;
            s._chromaticShader(intensity,intensity,intensity);
          }else if(graphObject._aberrationType != "static"){
            const goofier = ()=>(Math.floor(Math.random()*intensity)-Math.round(intensity/2))
            s._chromaticShader(goofier(),goofier(),goofier());
          }
          return s._chromaticShader.canvas;
      }else if (graphObject._blur!=0){
        if(s._blurAplied != graphObject._blur){
          s._blurAplied = graphObject._blur;
          s._blurShader(graphObject._blur);
        }
        return s._blurShader.canvas;
      }else{
        return s.texture;
      }
    }
    return s;
  }
}
export {Shader}