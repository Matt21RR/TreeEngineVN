import { engineRenderingDataCloner, ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import { GraphObject } from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";
import { getStr, wrapText } from "../logic/Misc.ts";
import { CanvasData } from "./Canvas.ts";
import { CalculationOrder, CameraData } from "./RenderEngine.d.tsx";
import { RenderEngine } from "./RenderEngine.tsx";
import { arrayiseTree } from "./RenderingOrder.ts";
import { Shader } from "./Shaders.ts";


/**
 * Genera las dimensions y ubicacion de los objetos a renderizar
 * Se recalcula un objeto cuando su información o la información de la camara cambia
 * @returns 
 */
function generateObjectsDisplayDimentions(
  canvas: CanvasData, 
  graphArray: RenList<GraphObject>, 
  // dimentionsPack: Record<string,ObjectRenderingData>, 
  prevNDico:Array<string>,
  calculationOrder: CalculationOrder,
  camera: CameraData){
    const engine = RenderEngine.getInstance();

    let nDico = [];
    let nDicoSet = new Set();

    const arrayisedTree = arrayiseTree(calculationOrder);

    const camCenter = {
      x: -camera.position.x + 0.5,
      y: -camera.position.y + 0.5,
      z: -camera.position.z + 0.56
    };
    
    const tangencialConstant = camera.position.angle;

    const developmentRatio = canvas.resolution.height/engine.developmentDeviceHeight;

    const perspectiveDiffHelper = (1/camera.maxZ) - 1

    const toAddSizeHelper = (tangencialConstant*canvas.resolution.height*camera.maxZ) / canvas.resolution.height;

    let analyzed = 0;

    let origin = {x:0, y:0};

    let gObject: GraphObject;
    let texRef: Shader;
    let addition = {x:0,y:0};
    let objectScale = 0;
    let objectLeft = 0;
    let objectTop = 0;
    let objectZ = 0;
    let perspectiveLayer = 0;
    let objectWidth = 0;
    let objectHeight = 0;
    let testD = 0;

    let perspectiveDiff = 0;
    let perspectiveScale = 0;

    let cornerX = 0;
    let cornerY = 0;

    const finalCameraHorizontalPixelOrigin = (camera.origin.x-0.5)*canvas.resolution.width;


    for (let index = 0; index < graphArray.length; index++) {
      gObject = graphArray.fasterGet(arrayisedTree[index]);
      if(!gObject.pendingRenderingRecalculation){
        nDico.push(gObject.id);
        nDicoSet.add(gObject.id);
        //TODO: if text value is not null, jump to text attribs recalculation
        continue;
      }

      objectZ = gObject.accomulatedZ;
      if(objectZ + camCenter.z < 0){
        continue;
      }
      analyzed++;
      const dimentionsPack = gObject.dimentionsPack;

      texRef = gObject.textureName ? engine.getTexture(gObject.textureName) : null;
      

      if(!!gObject.parent && nDicoSet.has(gObject.parent)){
        const parent = graphArray.fasterGet(gObject.parent);
        origin.x = parent.dimentionsPack.base.x;
        origin.y = parent.dimentionsPack.base.y;
      }

      if (!camera.usePerspective && gObject.ignoreParallax){
        addition.x = camCenter.x;
        addition.y = camCenter.y;
      }

      objectScale = gObject.scale;

      testD = 0.99;

      if(!camera.usePerspective || gObject.ignoreParallax){
        objectLeft = ((gObject.x + origin.x + addition.x)*canvas.resolution.height) + finalCameraHorizontalPixelOrigin; //*(camera.origin.x-0.5)*canvas.resolution.width
        objectTop = (gObject.y + origin.y + addition.y + (camera.origin.y-0.5))*canvas.resolution.height; //* (camera.origin.y-0.5))*canvas.resolution.height
      }else{
        objectLeft = gObject.x + origin.x + camCenter.x;
        objectTop = gObject.y + origin.y + camCenter.y;
        objectZ += camCenter.z;

        perspectiveDiff = 1 - ((1/objectZ)-1)/perspectiveDiffHelper;

        perspectiveScale = perspectiveDiff * toAddSizeHelper;

        //*with testD > 0.003 we ensure the very far of|behind the camera elements won't be further calculated
        if(perspectiveScale<=0.003){
          continue;
        }
        objectScale *= perspectiveScale;
        testD = perspectiveScale;

        //*recalculate gObject coords
        perspectiveLayer = canvas.resolution.height*perspectiveScale;

        //it will calc were the image must to be, inside the perspectiveLayer
        objectLeft *= perspectiveLayer;
        objectTop *= perspectiveLayer;
        //now add the origin of the perspectiveLayer
        objectLeft += -(perspectiveLayer-canvas.resolution.height)*(0.88889); // 177/2 :display horizontal center
        objectTop += -(perspectiveLayer-canvas.resolution.height)*camera.origin.y;
      }

      //By default values for the textboxes
      objectWidth = canvas.resolution.width*objectScale*gObject.widthScale;
      objectHeight = canvas.resolution.height*objectScale*gObject.heightScale;

      if(texRef){
        dimentionsPack.solvedTextureName = texRef.id;
        if(gObject.useEngineUnits){
          objectWidth = texRef.resolution.width*objectScale*gObject.widthScale*developmentRatio;
          objectHeight = texRef.resolution.height*objectScale*gObject.heightScale*developmentRatio;
        }else{
          objectHeight = (texRef.resolution.heightWidthRelation)*canvas.resolution.width*objectScale*gObject.heightScale;
        }
      }else{
        //dimentionsPack.solvedTextureName = ""; Unused in RenderEngine
        if(gObject.useEngineUnits){
          objectWidth = canvas.resolution.height*objectScale*gObject.widthScale;
        }
      }

      cornerX = objectLeft - objectWidth*0.5;
      cornerY = objectTop - objectHeight*0.5;

      if(cornerX > canvas.resolution.width || cornerY > canvas.resolution.height || (cornerX + objectWidth) < 0 || (cornerY + objectHeight)<0){
        continue;
      }

      dimentionsPack.x  = Math.trunc(objectLeft);
      dimentionsPack.y  = Math.trunc(objectTop);
      dimentionsPack.z  = objectZ;
      dimentionsPack.corner.x = Math.trunc(cornerX);
      dimentionsPack.corner.y = Math.trunc(cornerY);

      dimentionsPack.base.x = origin.x + gObject.x;
      dimentionsPack.base.y = origin.y + gObject.y;
      dimentionsPack.base.z = gObject.accomulatedZ;

      dimentionsPack.sizeInDisplay  = testD;
      dimentionsPack.width  = Math.trunc(objectWidth);
      dimentionsPack.height  = Math.trunc(objectHeight);
      dimentionsPack.rotation = Math.trunc(gObject.rotate);

      //TODO: texts requires continous recomputing
      const strRef = gObject.text == null ? null : getStr(gObject.text);
      if(strRef != null){
        const fontSizeRenderingValue = gObject.fontSizeNumeric*canvas.resolution.scale*(developmentRatio)*testD;
        const objectWidthMargin = (fontSizeRenderingValue/gObject.fontSize)*gObject.horizontalMargin;
        const objectHeightMargin = (fontSizeRenderingValue/gObject.fontSize)*gObject.verticalMargin;

        dimentionsPack.text = {
          fontSize:fontSizeRenderingValue,
          margin:{
            horizontal:objectWidthMargin, 
            vertical:objectHeightMargin}
        };

        if(gObject.fitContent){
          canvas.context.font = `${fontSizeRenderingValue}px ${gObject.font}`;
          var texts = wrapText(//TODO: Wrap it until all the text get wraped
            canvas.context,
            strRef,
            objectWidthMargin + dimentionsPack.corner.x,
            fontSizeRenderingValue/2,
            dimentionsPack.width - objectWidthMargin*2,
            0,
            fontSizeRenderingValue,
            gObject.center, 
            false
          );

          const lastText = texts.at(-1);
          if (lastText) {
            objectHeight = lastText.y + fontSizeRenderingValue/2 + objectHeightMargin*2;
          }

          for (let index = 0; index < texts.length; index++) {
            texts[index].y += objectHeightMargin + (objectTop - objectHeight/2);  
          }

          dimentionsPack.corner.y = (objectTop - objectHeight/2);
          dimentionsPack.height = objectHeight;

          dimentionsPack.text!.value = texts;
        }
      }else{
        dimentionsPack.text = null;
      }
      nDico.push(gObject.id);
      nDicoSet.add(gObject.id);

      gObject.pendingRenderingRecalculation = false;

    }
    return nDico;
  }

export {generateObjectsDisplayDimentions}