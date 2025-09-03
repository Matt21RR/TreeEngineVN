import { ObjectRenderingData } from "../engineComponents/CollisionLayer";
import { TextLine, wrapText } from "../logic/Misc";

class RenderMiscForDebug{
  static drawObjectLimits(ctx:CanvasRenderingContext2D, object: ObjectRenderingData, canvasResolution: {width:number, height:number}, cameraZ:number){
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
  static drawCollisionsMatrix(ctx:CanvasRenderingContext2D, resolution:{width:number, height:number}){
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
  static drawCollisionBox(ctx:CanvasRenderingContext2D, object: ObjectRenderingData){
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
  static drawTrigger(ctx:CanvasRenderingContext2D, object: ObjectRenderingData){
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
}

class RenderMisc extends RenderMiscForDebug{
  static drawImage(texture: HTMLImageElement, object:ObjectRenderingData, ctx:CanvasRenderingContext2D){
    if(object.rotation % 360 == 0){
      ctx.drawImage(
        texture,
        object.corner.x,
        object.corner.y,
        object.width,
        object.height
      );
    }else{
      ctx.drawImage(
        texture,
        object.corner.x - object.x,
        object.corner.y - object.y,
        object.width,
        object.height
      );
    }
  }

  static drawRectangle(object:ObjectRenderingData, boxColor:string, ctx:CanvasRenderingContext2D){
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
  static drawText(object:ObjectRenderingData, textLines:Array<TextLine>, fontColor:string, ctx:CanvasRenderingContext2D){
    ctx.fillStyle = fontColor;
    if(object.rotation % 360 == 0){
      textLines.forEach((text) => {
        ctx.fillText(
          text.value,
          text.x,
          text.y
        );
      });
    }else{
      textLines.forEach((text) => {
        ctx.fillText(
          text.value,
          text.x-object.x,
          text.y-object.y
        );
      });
    }
  }

  /**
   * Calculates the apropiate engine display resolution
   * @param aspectRatio 
   * @param w 
   * @returns 
   */
  static displayResolutionCalc(aspectRatio:string, w:HTMLElement){
    let engineDisplayRes:{width:number, height:number};

    if (aspectRatio != "undefined") {
      let newWidth = Math.floor((w.offsetHeight / parseInt(aspectRatio.split(":")[1])) * parseInt(aspectRatio.split(":")[0]));
      let newHeight = Math.floor((w.offsetWidth / parseInt(aspectRatio.split(":")[0])) * parseInt(aspectRatio.split(":")[1]));
      if (newWidth <= w.offsetWidth) {
        newHeight = w.offsetHeight;
      } else {
        newWidth = w.offsetWidth;
      }

      engineDisplayRes = {width:newWidth,height:newHeight};
    } else {
      engineDisplayRes = {width:w.offsetWidth,height:w.offsetHeight};
    }

    return engineDisplayRes;
  }

  static wrapText(
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
}

export {RenderMisc}