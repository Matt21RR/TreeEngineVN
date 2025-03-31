import { ObjectRenderingData } from "../engineComponents/CollisionLayer";
import { GraphObject } from "../engineComponents/GraphObject";

class RenderMisc{
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
  static drawCollisionsMatrix(ctx:CanvasRenderingContext2D, resolution:{width:number, height:number}){
    ctx.strokeStyle = "blue";
    ctx.globalAlpha = .3;
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    
    //draw collision layer
    for(let i = 0; i < 10; i++){
      for(let j = 0; j < 10; j++){
        ctx.strokeRect(
          (i * resolution.width)/10,
          (j * resolution.height)/10,
          resolution.width/10,
          resolution.height/10);
      }
    }
    ctx.setLineDash([]);
    ctx.fillStyle = "";
  }
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

export {RenderMisc}