import { engineRenderingDataCloner, ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import { GraphObject } from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";
import { getStr, wrapText } from "../logic/Misc.ts";
import { CanvasData } from "./Canvas";
import { RenderEngine } from "./RenderEngine.tsx";
import { arrayiseTree } from "./RenderingOrder.ts";
import { RenderMisc } from "./RenderMisc.ts";

type CalculationOrder = Array<{id:string,weight:number,z:number}>;
type CameraData = {
    id: string;
    maxZ: number;
    origin: { x: number; y: number };
    position: { x: number; y: number; z: number; angle: number };
    usePerspective: boolean;
  };


/**
 * Genera las dimensions y ubicacion de los objetos a renderizar
 * Se recalcula un objeto cuando su información o la información de la camara cambia
 * @returns 
 */
function generateObjectsDisplayDimentions(canvas: CanvasData, graphArray: RenList<GraphObject>, dimentionsPack: Record<string,ObjectRenderingData>, calculationOrder: CalculationOrder, camera: CameraData){
  const engine = RenderEngine.getInstance();
  
    const prevDimentionsPack = engineRenderingDataCloner(dimentionsPack);

    dimentionsPack = {}; //wipe

    const arrayisedTree = arrayiseTree(calculationOrder);
    
    const tangencialConstant = camera.position.angle;

    const developmentRatio = canvas.resolution.height/engine.developmentDeviceHeight;

    const perspectiveDiffHelper = ((1/camera.maxZ)-(1))
    const toAddSizeHelper = tangencialConstant*canvas.resolution.height*camera.maxZ;

    for (let index = 0; index < graphArray.length; index++) {
      
      const gObject = graphArray.get(arrayisedTree[index]);
      
      if(!gObject.pendingRenderingRecalculation){
        dimentionsPack[gObject.id] = prevDimentionsPack[gObject.id]
        continue;
      }
      engine.redraw = true;

      const texRef = gObject.textureName == null ? null : engine.getTexture(gObject);

      let origin = {x:0,y:0};
      if(gObject.parent != "" && gObject.parent in dimentionsPack){
        origin = {
          x: dimentionsPack[gObject.parent].base.x,
          y: dimentionsPack[gObject.parent].base.y
        };
      }

      let addition = {x:0,y:0};
      if (!camera.usePerspective && gObject.ignoreParallax){
        addition = {x:-camera.position.x+.5, y:-camera.position.y+.5};
      }

      var objectScale = gObject.scale;
      var objectLeft = (gObject.x + origin.x + addition.x)*canvas.resolution.height + (camera.origin.x-0.5)*canvas.resolution.width;
      var objectTop = (gObject.y + origin.y + addition.y + (camera.origin.y-0.5))*canvas.resolution.height;
      var objectZ = gObject.accomulatedZ + camera.position.z;
      
      var testD = 0.99;
      
      if(camera.usePerspective && !gObject.ignoreParallax){
        objectLeft = gObject.x + origin.x - camera.position.x+0.5;
        objectTop = gObject.y + origin.y - camera.position.y+0.5;
        objectZ = gObject.accomulatedZ - camera.position.z+0.56;

        const perspectiveDiff = 1-((1/objectZ)-(1))/perspectiveDiffHelper;
        const toAddSize = perspectiveDiff * (toAddSizeHelper);
        const perspectiveScale = toAddSize/canvas.resolution.height;
        objectScale *= perspectiveScale;
        testD = perspectiveScale;

        //*recalculate gObject coords
        var perspectiveLayer = {
          width:canvas.resolution.height*perspectiveScale,
          height:canvas.resolution.height*perspectiveScale
        }
        //it will calc were the image must to be, inside the perspectiveLayer
        objectLeft *= perspectiveLayer.width;
        objectTop *= perspectiveLayer.height;
        //now add the origin of the perspectiveLayer
        objectLeft += -(perspectiveLayer.width-canvas.resolution.height)*camera.origin.x;
        objectTop += -(perspectiveLayer.height-canvas.resolution.height)*camera.origin.y;
      }

      //By default values for the textboxes
      var objectWidth = canvas.resolution.width*objectScale*gObject.widthScale;
      var objectHeight = canvas.resolution.height*objectScale*gObject.heightScale;

      if(texRef != null){
        if(gObject.useEngineUnits){
          objectWidth = texRef.resolution.width*objectScale*gObject.widthScale*(developmentRatio);
          objectHeight = texRef.resolution.height*objectScale*gObject.heightScale*(developmentRatio);
        }else{
          objectHeight = (texRef.resolution.height/texRef.resolution.width)*canvas.resolution.width*objectScale*gObject.heightScale;
        }
      }else{
        if(gObject.useEngineUnits){
          objectWidth = canvas.resolution.height*objectScale*gObject.widthScale;
        }
      }

      var res:ObjectRenderingData = {
        id: gObject.id,
        x : objectLeft,
        y : objectTop,
        z : objectZ,
        corner:{
          x:objectLeft - objectWidth/2,
          y:objectTop - objectHeight/2
        },
        base:{
          x:origin.x + gObject.x,
          y:origin.y + gObject.y,
          z:gObject.accomulatedZ
        },
        sizeInDisplay : testD,
        width : objectWidth,
        height : objectHeight
      };
      //Recompute Object size
      const strRef = gObject.text == null ? null : getStr(gObject.text);
      if(strRef != null && gObject.fitContent){
        const fontSizeRenderingValue = gObject.fontSizeNumeric*canvas.resolution.scale*(developmentRatio)*testD;
        const objectWidthMargin = (fontSizeRenderingValue/gObject.fontSize)*gObject.horizontalMargin;
        const objectHeightMargin = (fontSizeRenderingValue/gObject.fontSize)*gObject.verticalMargin;
        canvas.context.font = `${fontSizeRenderingValue}px ${gObject.font}`;
        var texts = wrapText(//TODO: Wrap it until all the text get wraped
          canvas.context,
          strRef,
          objectWidthMargin + res.corner.x,
          fontSizeRenderingValue/2,
          res.width - objectWidthMargin*2,
          0,
          fontSizeRenderingValue,
          gObject.center, 
          false
        );

        const lastText = texts.at(-1);
        if (lastText) {
          objectHeight = lastText[2] + fontSizeRenderingValue/2 + objectHeightMargin*2;
        }

        for (let index = 0; index < texts.length; index++) {
          texts[index][2] += objectHeightMargin + (objectTop - objectHeight/2) ;  
        }

        res.corner.y = (objectTop - objectHeight/2);
        res.height = objectHeight;
        res.text = texts;
        res.margin = {horizontal:objectWidthMargin, vertical:objectHeightMargin};
      }
      dimentionsPack[gObject.id] = res;
      gObject.pendingRenderingRecalculation = false;

    }

    return dimentionsPack;
  }

export {generateObjectsDisplayDimentions}