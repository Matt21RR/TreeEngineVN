import { ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import { TextLine } from "../logic/Misc.ts";
import EngTexture from "./EngTexture.ts";

export abstract class RenderMiscForDebugInterface<T extends CanvasRenderingContext2D|GPUCanvasContext>{
  abstract drawObjectLimits(ctx:T, object: ObjectRenderingData, canvasResolution: {width:number, height:number}, cameraZ:number) : void;
  abstract drawCollisionsMatrix(ctx:T, resolution:{width:number, height:number}) : void;
  abstract drawCollisionBox(ctx:T, object: ObjectRenderingData) : void;
  abstract drawTrigger(ctx:T, object: ObjectRenderingData) : void;

  abstract canvasWriter(text:Array<string>, origin:{x:number,y:number}, lineHeight:number, ctx:T) : void;
}

export default abstract class RenderMiscInterface<T extends CanvasRenderingContext2D|GPUCanvasContext>{
  abstract readonly requiresPrecreateRepeatPattern: boolean;
  
  abstract init(ctx:T): Promise<unknown>;
  abstract preloadImage(imagebitmap: ImageBitmap, imageId: string): Promise<void>;

  abstract clearCanvas(ctx:T) : void;
  abstract setOpacity(ctx:T, opacity:number) : void;
  abstract setFilter(ctx:T, filter:string) : void;
  abstract drawImage(texture: EngTexture, object:ObjectRenderingData, ctx:T) : void;
  
  abstract createRepeatPattern(texture: ImageBitmap, repeatOption: string, ctx:T) : any; //TODO: RepeatPattern blocks AnimatedTextures and viceversa
  abstract applyPatternTransformation( object:ObjectRenderingData ): void;
  abstract drawPattern(texture: EngTexture, object:ObjectRenderingData, displayWidth:number, displayHeight:number, repeatOption: string, ctx:T) : void;

  abstract drawRectangle(object:ObjectRenderingData, boxColor:string, ctx:T) : void;
  abstract setFont(fontSize:number, fontFamily:string, ctx:T) : void;
  abstract drawText(object:ObjectRenderingData, textLines:Array<TextLine>, fontColor:string, boxColor:string, ctx:T) : void;

  abstract wrapText(
    baseText:string,
    object:ObjectRenderingData,
    horizontalCenter:boolean,
    verticalCenter:boolean,
    ctx:T): Array<TextLine>;

  abstract render() : void;
}
