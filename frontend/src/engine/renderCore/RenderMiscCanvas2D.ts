import { ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import { TextLine, wrapText } from "../logic/Misc.ts";
import RenderMiscInterface, { RenderMiscForDebugInterface } from "./RenderMiscInterface.ts";

class RenderMiscForDebug extends RenderMiscForDebugInterface<CanvasRenderingContext2D>{
  drawObjectLimits(ctx:CanvasRenderingContext2D, object: ObjectRenderingData, canvasResolution: {width:number, height:number}, cameraZ:number){
      //draw image center
      ctx.lineWidth = 5;
      ctx.strokeStyle = object.z - cameraZ > 0 ? "green":"red";
      ctx.beginPath();
      ctx.arc(
        object.x, 
        object.y, 
        5, 
        0, 
        2 * Math.PI);
      ctx.lineTo(
        canvasResolution.width/2,
        canvasResolution.height/2
      );
      ctx.stroke();
      //image dimensions
      ctx.globalCompositeOperation = "exclusion";
      ctx.strokeStyle = "orange";
      
      ctx.strokeRect(
        object.corner.x,
        object.corner.y,
        object.width,
        object.height);
      ctx.globalCompositeOperation = "source-over";
  }
  /**
   * Draw the matrix used to split the objects in the scene in regions to simplify collision calcs
   * @param ctx 
   * @param resolution 
   */
  drawCollisionsMatrix(ctx:CanvasRenderingContext2D, resolution:{width:number, height:number}){
    ctx.beginPath();

    ctx.strokeStyle = "blue";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    
    //draw collision layer
    for(let i = 0; i < 10; i++){
      for(let j = 0; j < 10; j++){
        ctx.rect(
          (i * resolution.width)/10,
          (j * resolution.height)/10,
          resolution.width/10,
          resolution.height/10);
      }
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "";
  }

  /**
   * Draw the collision box of an object
   * @param ctx 
   * @param object 
   */
  drawCollisionBox(ctx:CanvasRenderingContext2D, object: ObjectRenderingData){
    ctx.strokeStyle = "red";
    ctx.fillStyle = "red";
    ctx.globalAlpha = .3;
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.fillRect(
      object.corner.x,
      object.corner.y,
      object.width,
      object.height);
    ctx.globalAlpha = 1;
    ctx.strokeRect(
      object.corner.x,
      object.corner.y,
      object.width,
      object.height);
    ctx.setLineDash([]);
    ctx.fillStyle = "";
  }
  /**
   * Draws a rectangle where a trigger is supposed to be
   * @param ctx 
   * @param object 
   */
  drawTrigger(ctx:CanvasRenderingContext2D, object: ObjectRenderingData){
    ctx.strokeStyle = "blue";
    ctx.fillStyle = "blue";
    ctx.globalAlpha = .3;
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
      
    ctx.fillRect(
      object.corner.x,
      object.corner.y,
      object.width,
      object.height);
    ctx.globalAlpha = 1;
    ctx.strokeRect(
      object.corner.x,
      object.corner.y,
      object.width,
      object.height);
    
    ctx.setLineDash([]);
    ctx.fillStyle = "";
  }

  /**
   * Basic writer (ideal to write performance info)
   */
  canvasWriter(text:Array<string>, origin:{x:number,y:number}, lineHeight:number, ctx:CanvasRenderingContext2D){
    // ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);//cleanning window

    ctx.font = "12px Consolas";
    ctx.fillStyle = "orange";
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.beginPath();

    text.forEach((line,index) => {
        ctx.fillText(
        line,
        origin.x,
        (origin.y+(index*lineHeight))
      );
    });
    ctx.closePath();
    ctx.fill();
  }
}

export default class RenderMiscCanvas2D extends RenderMiscForDebug implements RenderMiscInterface<CanvasRenderingContext2D>{
  readonly requiresPrecreateRepeatPattern = true;
  private static instance: RenderMiscCanvas2D;
  static getInstance(){
    if(!RenderMiscCanvas2D.instance){
      throw new Error("RenderMiscCanvas2D instance not created yet");
    }
    return RenderMiscCanvas2D.instance;
  }

  constructor(){
    super();
    RenderMiscCanvas2D.instance = this;
  }

  init(ctx: CanvasRenderingContext2D): Promise<void>{
    return new Promise((resolve)=>{
      resolve();
    });
    //No initialization needed for canvas, but we need to implement this method to satisfy the interface
  }
  preloadImage(imagebitmap: ImageBitmap, imageId: string){
    return Promise.resolve();
    //No need to preload images in canvas, they can be used directly when they are loaded
  }

  clearCanvas(ctx: CanvasRenderingContext2D){
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  setOpacity(ctx: CanvasRenderingContext2D, opacity:number){
    ctx.globalAlpha = opacity;
  }
  setFilter(ctx: CanvasRenderingContext2D, filter:string){
    ctx.filter = filter;
  }

  private rotateTransform(ctx:CanvasRenderingContext2D, originX:number, originY:number, rotation:number){
    //ROTATION
      ctx.save();
      ctx.setTransform(//transform using center as origin
        1,
        0,
        0,
        1,
        originX, 
        originY); // sets scale and origin
      ctx.rotate(rotation); //? Rotation == gObject.rotateRad ?
  }
  private unrotateTransform(ctx:CanvasRenderingContext2D){
    ctx.restore();
  }

  drawImage(texture: ImageBitmap, object:ObjectRenderingData, ctx:CanvasRenderingContext2D){
    if(object.rotation % 360 == 0){
      ctx.drawImage(
        texture,
        object.corner.x,
        object.corner.y,
        object.width,
        object.height
      );
    }else{
      //ROTATION
      this.rotateTransform(ctx, object.x, object.y, object.rotation);
      //DRAW
      ctx.drawImage(
        texture,
        object.corner.x - object.x,
        object.corner.y - object.y,
        object.width,
        object.height
      );
      //REVERSE ROTATION
      this.unrotateTransform(ctx);
    }
  }

  createRepeatPattern(texture: ImageBitmap, repeatOption: string, ctx: CanvasRenderingContext2D) {
    return ctx.createPattern(texture , "repeat");
  }
  applyPatternTransformation( object:ObjectRenderingData ): void {
    //ScallingX , 0,0, ScallingY, displacementX, displacementY
    const matrix = new DOMMatrix([
      object.width/object.solvedTexture.resolution.width, 
      0, 
      0, 
      object.height/object.solvedTexture.resolution.height, 
      object.corner.x, 
      object.corner.y]);

    object.repeatPattern.setTransform(matrix);
  }
  drawPattern(texture: ImageBitmap, object:ObjectRenderingData, displayWidth:number, displayHeight:number, repeatOption: string, ctx:CanvasRenderingContext2D) {
    ctx.fillStyle = object.repeatPattern;

    if(repeatOption == "repeat"){
      ctx.fillRect(0, 0, displayWidth, displayHeight)
    }else if(repeatOption == "repeat-x"){
      ctx.fillRect(0, object.corner.y, displayWidth, object.height)
    }else if(repeatOption == "repeat-y"){
      ctx.fillRect(object.corner.x, 0, object.width, displayHeight)
    }
  }

  drawRectangle(object:ObjectRenderingData, boxColor:string, ctx:CanvasRenderingContext2D){
    ctx.fillStyle = boxColor;
    if(object.rotation % 360 == 0){
      ctx.fillRect(
        object.corner.x,
        object.corner.y,
        object.width,
        object.height
      );
    }else{
      ctx.fillRect(
        object.corner.x - object.x,
        object.corner.y - object.y,
        object.width,
        object.height
      );
    }
  }
  setFont(fontSize:number, fontFamily:string, ctx:CanvasRenderingContext2D){
    ctx.font = `${fontSize}px ${fontFamily}`;
  }
  drawText(object:ObjectRenderingData, textLines:Array<TextLine>, fontColor:string, boxColor:string, ctx:CanvasRenderingContext2D){
    
    if(object.rotation % 360 == 0){
      // if(boxColor != "transparent")
        // this.drawRectangle(object,boxColor,ctx);
      
      ctx.fillStyle = fontColor;
      textLines.forEach((text) => {
        ctx.fillText(
          text.value,
          text.x,
          text.y
        );
      });
    }else{
      //ROTATION
      this.rotateTransform(ctx, object.x, object.y, object.rotation);
      //DRAW
      // if(boxColor != "transparent")
        // this.drawRectangle(object,boxColor,ctx);
      
      ctx.fillStyle = fontColor;
      textLines.forEach((text) => {
        ctx.fillText(
          text.value,
          text.x-object.x,
          text.y-object.y
        );
      });
      //REVERSE ROTATION
      this.unrotateTransform(ctx);
    }
  }

  wrapText(
    baseText:string,
    object:ObjectRenderingData,
    horizontalCenter:boolean,
    verticalCenter:boolean,
    ctx:CanvasRenderingContext2D){

    const text = object.text!;
    const margin = text.margin;
    const fontSize = text.fontSize;
    const texts = wrapText(//TODO: Wrap it until all the text get wraped
      ctx,
      baseText,
      margin.horizontal + object.corner.x,
      margin.vertical + object.corner.y + fontSize/2,
      object.width - margin.horizontal*2,
      object.height - margin.vertical*2,

      fontSize,
      
      horizontalCenter,
      verticalCenter
    ); 
    return texts;
  }

  render(){
    //No need to implement render in canvas, since the drawing methods draw directly on the canvas. But we need to implement this method to satisfy the interface
  }
}
