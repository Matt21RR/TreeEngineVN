import { GPU } from "gpu.js";

class Shader {
  static create(texture,id,widthArg = null, heightArg = null){
    //console.warn(texture);
    var s = new Object({
      texture: texture,
      id:id
    })
    //*******reduction shader
    const width = widthArg == null ?  texture.naturalWidth : widthArg, height = heightArg == null ? texture.naturalHeight : heightArg;
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
    

    const gpu = new GPU({
      canvas,
      context: gl
    });
    const image = texture;
    var resolution = {width:width,height:height}
    s._reducedTexture = image;
    if(width >1500 || height >1500){ 
      const reduceFactor = Math.round((resolution[["width","height"][width/height >1?0:1]]) /1500);
      //crear el shader de reduccion
      //*Las comillas son para evitar que se minifique el codigo de la funcion kernely
      const reduceShader = gpu.createKernel(`function (){
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
      s._reducedTexture = reduceShader.canvas;
      
      resolution.width = Math.floor(resolution.width / reduceFactor);
      resolution.height = Math.floor(resolution.height / reduceFactor);
    }
    const red = s._reducedTexture;
//*********************************Radial blur
    s._radialBlurTest = gpu.createKernel(function (areas, rArray, rBase) {
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
          //this.color(sum0,sum1,sum2,sum3);
          this.color(sum0,sum1,sum2,sum3);
        }
      }
      
    })
    .setOutput([resolution.width,resolution.height])
    .setGraphical(true)
    .setTactic("speed")
    .setDynamicArguments(true)
    .setDynamicOutput(true)
    .setConstants({image:red,width:resolution.width,height:resolution.height});
    
    // //**bLUR shader
    s._blurShader = gpu.createKernel(`function (radius, area) {
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
      .setOutput([resolution.width,resolution.height])
      .setGraphical(true)
      .setTactic("speed")
      .setConstants({image:red,width:resolution.width,height:resolution.height});

      // //**bLUR shader
      const rArrayCalc = (blur)=>{
        var rArray = [];
        for (let index = 1; index <= blur; index++) {
          rArray.push(Math.round((resolution.height/2)*(index/blur)));
        }
        //console.log("topes",rArray);
        return rArray;
      }
      const areasCalc = (radius)=>{
        var areas = [];
        for (let index = 0; index <= radius; index++) {
          areas.push((2 * index +1) * (2 * index +1));
        }
        //console.log("areas",areas);
        return areas;
      }

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
    s._colorscale = gpu.createKernel(function (r) {
      
      const x = this.thread.x;
      const y = this.thread.y; 
      const pixel = this.constants.image[(y) * this.constants.width + (x)];
      if(pixel[3] != 0 && x%20<r){
        this.color(pixel[0],pixel[1],pixel[2],pixel[3]);
      }
      
    })
    .setOutput([resolution.width,resolution.height]).setGraphical(true).setConstants({image:red,width:resolution.width,height:resolution.height});
      
    //*SIGNAL MALFUNCTION ===================================
    s._malfunctionShader = gpu.createKernel(function (unstableArray,unstableArrayB,ratio,texture) {
      
      var y = this.thread.y; 
      const x = this.thread.x-(unstableArray[y]*ratio*this.constants.width);
      y = this.thread.y-(unstableArrayB[x]*ratio*this.constants.height);
      if(x<0 || x>this.constants.width){

      }else{
        const pixel = texture[(y) * this.constants.width + (x)];

        this.color(pixel[0],pixel[1],pixel[2],pixel[3])
      }


    })
    .setOutput([resolution.width,resolution.height]).setGraphical(true).setConstants({width:resolution.width,height:resolution.height});
    //*********SHADERS UTILITIES
    s._blurAplied = 0;
    s._aberrationAplied = 0;
    s.getTexture = (graphObject)=>{
      if(graphObject.aberration != 0){
          const intensity = graphObject.aberration;
          if(graphObject.aberrationType == "static" && s._aberrationAplied != intensity){
            s._aberrationAplied = intensity;
            s._chromaticShader(intensity,intensity,intensity);
          }else if(graphObject.aberrationType != "static"){
            const goofier = ()=>(Math.floor(Math.random()*intensity)-Math.round(intensity/2))
            s._chromaticShader(goofier(),goofier(),goofier());
          }
          return s._chromaticShader.canvas;
      }else if (Math.round(graphObject.blur)!=0){
        if(s._blurAplied != Math.round(graphObject.blur)){
          s._blurAplied = Math.round(graphObject.blur);
          const radius = s._blurAplied;
          //console.log(radius);
          const area = (2 * radius +1) * (2 * radius +1);
          // s._blurShader(radius,area);
          
          s._radialBlurTest(areasCalc(radius),rArrayCalc(radius), radius);
        }
        //console.log(graphObject._blur);
        return s._radialBlurTest.canvas;
      }else{
        // s._hznOp(Math.round((resolution.height/2)*1),1);
        // return s._hznOp.canvas;
        return s._reducedTexture;
      }
    }
    //TODO: Manage here the classic filter parameters aswell. We don't need to re apply the same efect over and over
    //*Destruction function: No se usa en ningun lado LOL
    s.destroy = function(){
      gpu.destroy()
    }
    return s;
  }
}
export {Shader}