import { ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import { colorToRGBA, TextLine } from "../logic/Misc.ts";
import RenderMiscInterface, { RenderMiscForDebugInterface } from "./RenderMiscInterface.ts";
import EngTexture from "./EngTextures.ts";
import WebGPUCanvas, { RepeatMode } from "./WebGPUCanvas.ts";

class RenderMiscForDebug extends RenderMiscForDebugInterface<GPUCanvasContext>{
  drawObjectLimits(ctx:GPUCanvasContext, object: ObjectRenderingData, canvasResolution: {width:number, height:number}, cameraZ:number){}
  /**
   * Draw the matrix used to split the objects in the scene in regions to simplify collision calcs
   * @param ctx 
   * @param resolution 
   */
  drawCollisionsMatrix(ctx:GPUCanvasContext, resolution:{width:number, height:number}){}

  /**
   * Draw the collision box of an object
   * @param ctx 
   * @param object 
   */
  drawCollisionBox(ctx:GPUCanvasContext, object: ObjectRenderingData){}
  /**
   * Draws a rectangle where a trigger is supposed to be
   * @param ctx 
   * @param object 
   */
  drawTrigger(ctx:GPUCanvasContext, object: ObjectRenderingData){}

  canvasWriter(text:Array<string>, origin:{x:number,y:number}, lineHeight:number, ctx:GPUCanvasContext){}
}

export default class RenderMiscWebGPU extends RenderMiscForDebug implements RenderMiscInterface<GPUCanvasContext>{
  readonly requiresPrecreateRepeatPattern = false;
  
  private WebGPURendererInstance = new WebGPUCanvas();
  private static instance: RenderMiscWebGPU;
  static getInstance(){
    if(!RenderMiscWebGPU.instance){
      throw new Error("RenderMiscWebGPU instance not created yet");
    }
    return RenderMiscWebGPU.instance;
  }
  constructor(){
    console.log("RenderMiscWebGPU instance created");
    super();
    RenderMiscWebGPU.instance = this;
  }
  init(ctx: GPUCanvasContext){
    return new Promise((resolve)=>{
      RenderMiscWebGPU.instance.WebGPURendererInstance.init(ctx).then(()=>{
        RenderMiscWebGPU.instance.WebGPURendererInstance.setResolution(ctx.canvas.width, ctx.canvas.height);
        resolve(0);
      });
    });
  }
  preloadImage(imagebitmap: ImageBitmap, imageId: string): Promise<void>{
    return new Promise((resolve)=>{
      this.WebGPURendererInstance.preloadImage(imagebitmap, imageId).then(resolve);
    });
    //No need to preload images in canvas, they can be used directly when they are loaded
  }
  clearCanvas(ctx: GPUCanvasContext){
    //WebGPU clear is handled in the render loop, so we don't need to do anything here
  }
  setOpacity(ctx: GPUCanvasContext, opacity:number){
    
  }
  setFilter(ctx: GPUCanvasContext, filter:string){
    
  }
  drawImage(texture: EngTexture, object:ObjectRenderingData, ctx:GPUCanvasContext){
    this.WebGPURendererInstance.queueImage({
      id:texture.id,
      x:object.corner.x,
      y:object.corner.y,
      width:object.width,
      height:object.height,
      rotation: object.rotation});
  }

  createRepeatPattern(texture: ImageBitmap, repeatOption: string, ctx: GPUCanvasContext) {
    return true;
  }
  applyPatternTransformation(object: ObjectRenderingData): void {
    
  }

  drawPattern(texture: EngTexture, object: ObjectRenderingData, displayWidth: number, displayHeight: number, repeatOption: string, ctx: GPUCanvasContext){
    this.WebGPURendererInstance.queueRepeatPattern({
      id: texture.id,
      x: object.corner.x,
      y: object.corner.y,
      width: displayWidth,   // área total que cubre el patrón (lo gestiona queueRepeatPattern según el modo)
      height: displayHeight, // área total que cubre el patrón (lo gestiona queueRepeatPattern según el modo)
      rotation: object.rotation,
      tileWidth: object.width,   // tamaño de un tile en pantalla (equivale a la escala de applyPatternTransformation en Canvas2D)
      tileHeight: object.height  // tamaño de un tile en pantalla
    }, repeatOption as RepeatMode);
  }

  drawRectangle(object:ObjectRenderingData, boxColor:string, ctx:GPUCanvasContext){
    this.WebGPURendererInstance.queueRect({
      x:object.corner.x,
      y:object.corner.y,
      width:object.width,
      height:object.height,
      rotation: object.rotation,
      borderColor: colorToRGBA(boxColor),
      fillColor: colorToRGBA(boxColor),
    });
  }
  setFont(fontSize:number, fontFamily:string, ctx:GPUCanvasContext){
    
  }
  drawText(object:ObjectRenderingData, textLines:Array<TextLine>, fontColor:string, boxColor:string, ctx:GPUCanvasContext){
    
  }

  wrapText(
    baseText:string,
    object:ObjectRenderingData,
    horizontalCenter:boolean,
    verticalCenter:boolean,
    ctx:GPUCanvasContext){

  return []
  }

  render(){
    this.WebGPURendererInstance.render();
  }
}