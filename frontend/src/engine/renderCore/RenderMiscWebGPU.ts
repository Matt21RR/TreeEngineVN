import { ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import { colorToRGBA, TextLine } from "../logic/Misc.ts";
import RenderMiscInterface, { RenderMiscForDebugInterface } from "./RenderMiscInterface.ts";
import EngTexture from "./EngTexture.ts";
import WebGPUCanvas, { RepeatMode } from "./WebGPUCanvas.ts";
import type { PackedGlbModel } from "./GlbPacker.ts";
import type { TexImageBC7 } from "./GlbTex.ts";
import { RgbSplitParams } from "./RgbSplit.ts";
import type { GridState, GridView } from "./GridHelper.ts";
import type { PointLightData } from "./RenderEngine.d.tsx";

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
  //*MSAA: la preferencia se persiste (init la lee al arrancar) y, si el
  //renderer ya existe, se aplica en caliente.
  static readonly MSAA_STORAGE_KEY = "treeengine.msaa";
  static get preferredMsaa(): 1 | 4 {
    try { return localStorage.getItem(RenderMiscWebGPU.MSAA_STORAGE_KEY) === "1" ? 1 : 4; }
    catch { return 4; }
  }
  static setPreferredMsaa(samples: 1 | 4){
    try { localStorage.setItem(RenderMiscWebGPU.MSAA_STORAGE_KEY, String(samples)); } catch {}
    RenderMiscWebGPU.instance?.WebGPURendererInstance.setMsaa(samples);
  }
  get msaa(){
    return this.WebGPURendererInstance.msaa;
  }
  init(ctx: GPUCanvasContext){
    return new Promise((resolve)=>{
      RenderMiscWebGPU.instance.WebGPURendererInstance.init(ctx, { msaa: RenderMiscWebGPU.preferredMsaa }).then(()=>{
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
  preloadModel(id: string, model: PackedGlbModel, bitmaps: Map<number, ImageBitmap>, compressed?: Map<number, TexImageBC7>): Promise<void>{
    return this.WebGPURendererInstance.preloadModel(id, model, bitmaps, compressed);
  }
  /** El dispositivo admite BC7 (false hasta que el renderer arranca). */
  get supportsBC(): boolean{
    return this.WebGPURendererInstance.supportsBC;
  }
  unloadModel(id: string){
    this.WebGPURendererInstance.unloadModel(id);
  }
  setLodMaxErrorPx(px: number){
    this.WebGPURendererInstance.setLodMaxErrorPx(px);
  }
  getModelGpuBytes(id: string): number{
    return this.WebGPURendererInstance.getModelGpuBytes(id);
  }
  getModelLastDrawn(id: string): number{
    return this.WebGPURendererInstance.getModelLastDrawn(id);
  }
  /** Diagnostico de mallas (harness/herramientas), ver WebGPUCanvas.setMeshDebug. */
  setMeshDebug(debug: { forceOpaque?: boolean; showAlpha?: boolean }){
    this.WebGPURendererInstance.setMeshDebug(debug);
  }
  clearCanvas(ctx: GPUCanvasContext){
    //WebGPU clear is handled in the render loop, so we don't need to do anything here
  }
  setOpacity(ctx: GPUCanvasContext, opacity:number){
    
  }
  setFilter(ctx: GPUCanvasContext, filter:string){

  }
  setGlobalBlur(ctx: GPUCanvasContext, radiusPx:number){
    this.WebGPURendererInstance.setBlurRadius(radiusPx);
  }
  setGlobalRgbSplit(ctx: GPUCanvasContext, params:RgbSplitParams|null){
    this.WebGPURendererInstance.setRgbSplit(params);
  }
  setGlobalAnisotropy(ctx: GPUCanvasContext, level:number){
    this.WebGPURendererInstance.setAnisotropyLevel(level);
  }
  setGlobalLighting(ctx: GPUCanvasContext, mode:number){
    this.WebGPURendererInstance.setLightingMode(mode);
  }
  setGlobalToneMapping(ctx: GPUCanvasContext, mode:string){
    this.WebGPURendererInstance.setToneMapping(mode);
  }
  setGlobalExposure(ctx: GPUCanvasContext, exposure:number){
    this.WebGPURendererInstance.setExposure(exposure);
  }
  setGlobalBloom(ctx: GPUCanvasContext, bloom:{ enabled?: boolean; threshold?: number; intensity?: number; radius?: number } | null){
    this.WebGPURendererInstance.setBloom(bloom);
  }
  setGlobalAO(ctx: GPUCanvasContext, ao:{ enabled?: boolean; radius?: number; intensity?: number; bias?: number; power?: number; debug?: boolean } | null){
    this.WebGPURendererInstance.setAmbientOcclusion(ao);
  }
  setGlobalLightingParams(ctx: GPUCanvasContext, params:{azim?:number;elev?:number;ambient?:number;shininess?:number;specStrength?:number;intensity?:number}){
    this.WebGPURendererInstance.setLightingParams(params);
  }
  setGlobalLightingEye(ctx: GPUCanvasContext, x:number, y:number, z:number){
    this.WebGPURendererInstance.setLightingEye(x, y, z);
  }
  setPointLights(ctx: GPUCanvasContext, lights: PointLightData[] | null | undefined){
    this.WebGPURendererInstance.setPointLights(lights ?? []);
  }
  setGridState(ctx: GPUCanvasContext, state:GridState|null, view:GridView|null){
    this.WebGPURendererInstance.setGridState(state, view);
  }
  setAnisotropyLevel(level: number){
    this.WebGPURendererInstance.setAnisotropyLevel(level);
  }
  get anisotropyLevel(){
    return this.WebGPURendererInstance.anisotropyLevel;
  }
  drawImage(texture: EngTexture, object:ObjectRenderingData, ctx:GPUCanvasContext){
    this.WebGPURendererInstance.queueImage({
      id:texture.id,
      x:object.corner.x,
      y:object.corner.y,
      width:object.width,
      height:object.height,
      rotation: object.rotation,
      pitch: object.pitch,
      yaw: object.yaw,
      roll: object.roll,
      depthZ: object.perspDepth.z,
      depthP: object.perspDepth.p,
      ignoreWorldRotation: object.ignoreWorldRotation ?? 0});
  }
  drawMesh(modelId: string, ppu: number, object:ObjectRenderingData, ctx:GPUCanvasContext){
    this.WebGPURendererInstance.queueMesh({
      id: modelId,
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      rotation: object.rotation,
      pitch: object.pitch,
      yaw: object.yaw,
      roll: object.roll,
      ppu,
      wx: object.base?.x ?? 0,
      wy: object.base?.y ?? 0,
      wz: object.base?.z ?? 0,
      mvx: object.meshView?.x ?? 0,
      mvy: object.meshView?.y ?? 0,
      mvz: object.meshView?.z ?? 0,
      mk: object.meshView?.k ?? 0,
      ms: object.meshView?.s ?? 0,
      //LOD: px por unidad modelo en la esquina mas cercana (0 = original)
      lodPx: object.meshLodPx ?? 0,
      depthZ: object.perspDepth.z,
      depthP: object.perspDepth.p,
      ignoreWorldRotation: object.ignoreWorldRotation ?? 0});
  }
  //*************************** DOES NOTHING *****************************************/
  createRepeatPattern(texture: ImageBitmap, repeatOption: string, ctx: GPUCanvasContext) {
    return true;
  }
  //*************************** ALSO DOES NOTHING *****************************************/
  applyPatternTransformation(object: ObjectRenderingData): void {
    
  }

  drawPattern(texture: EngTexture, object: ObjectRenderingData, displayWidth: number, displayHeight: number, repeatOption: string, ctx: GPUCanvasContext){
    this.WebGPURendererInstance.queueRepeatPattern({
      id: texture.id,
      x: object.corner.x,
      y: object.corner.y,
      width: displayWidth,
      height: displayHeight,
      rotation: object.rotation,
      pitch: object.pitch,
      yaw: object.yaw,
      roll: object.roll,
      ignoreWorldRotation: object.ignoreWorldRotation ?? 0,
      depthZ: object.perspDepth.z,
      depthP: object.perspDepth.p,
      tileWidth: object.width,
      tileHeight: object.height
    }, repeatOption as RepeatMode);
  }

  drawRectangle(object:ObjectRenderingData, boxColor:string, ctx:GPUCanvasContext){
    this.WebGPURendererInstance.queueRect({
      x:object.corner.x,
      y:object.corner.y,
      width:object.width,
      height:object.height,
      rotation: object.rotation,
      pitch: object.pitch,
      yaw: object.yaw,
      roll: object.roll,
      ignoreWorldRotation: object.ignoreWorldRotation ?? 0,
      depthZ: object.perspDepth.z,
      depthP: object.perspDepth.p,
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
  setWorldRotation(pitch: number, yaw: number, roll: number){
    this.WebGPURendererInstance.setWorldRotation(pitch, yaw, roll);
  }
  setWorldCameraPos(x: number, y: number){
    this.WebGPURendererInstance.setWorldCameraPos(x, y);
  }
  setDepthRange(near: number, maxZ: number){
    this.WebGPURendererInstance.setDepthRange(near, maxZ);
  }
}