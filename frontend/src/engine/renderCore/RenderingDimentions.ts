import GraphObject from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";
import { getStr, wrapText } from "../logic/Misc.ts";
import { CameraData } from "./RenderEngine.d.tsx";
import { RenderEngine } from "./RenderEngine.tsx";
import EngTexture from "./EngTexture.ts";

import RenderMiscCanvas2D from "./RenderMiscCanvas2D.ts";
const RenderDebug = RenderMiscCanvas2D;

export class SharedDisplayCalcs{
  private static instance: SharedDisplayCalcs;

  public lookupTable: Map<number,number>;
  nDicoSet: Set<string> = new Set();

  static getInstance(){
    return SharedDisplayCalcs.instance;
  }
  constructor(){
    this.lookupTable = new Map();
    SharedDisplayCalcs.instance = this;
  }
}


/**
 * Genera las dimensions y ubicacion de los objetos a renderizar
 * Se recalcula un objeto cuando su información o la información de la camara cambia
 * @returns 
 */
export function generateObjectsDisplayDimentions(
  graphArray: RenList<GraphObject>, 
  calculationOrder: Array<string>,
  canvasResolution: {width:number, height:number,scale:number},
  camera: CameraData): Set<string> {
    const engine = RenderEngine.getInstance();
    const sharedInstance = SharedDisplayCalcs.getInstance();

    sharedInstance.nDicoSet.clear();

    let finalArrayisedTree: Array<string> = [];

    const camCenter = {
      x: -camera.position.x + 0.5,
      y: -camera.position.y + 0.5,
      z: -camera.position.z + 0.56
    };


    const developmentRatio = canvasResolution.height/engine.developmentDeviceHeight;
    const perspectiveDiffHelper = (1/camera.maxZ) - 1;
    const toAddSizeHelper = (camera.position.angle*canvasResolution.height*camera.maxZ) / canvasResolution.height;

    let gObject: GraphObject;

    let parent: GraphObject;

    let texRef: EngTexture;

    let analyzed = 0;

    let origin = {x:0, y:0};

    let additionX = 0;
    let additionY = 0;
    let objectScale = 0;
    let objectLeft = 0;
    let objectTop = 0;
    let objectZ = 0;
    let perspectiveLayer = 0;
    let objectWidth = 0;
    let objectHeight = 0;
    let perspectiveScale = 0;

    let perspectiveDiff = 0;

    let cornerX = 0;
    let cornerY = 0;

    const finalCameraHorizontalPixelOrigin = (camera.origin.x-0.5)*canvasResolution.width;

    let dimentionsPack = null;

    for (let index = 0; index < graphArray.length; index++) {
      gObject = graphArray.fastGet(calculationOrder[index]);
      objectZ = gObject.accomulatedZ;
      if(!gObject.pendingRenderingRecalculation){
        sharedInstance.nDicoSet.add(gObject.id);
        finalArrayisedTree.push(gObject.id);
        //TODO: if text value is not null, jump to text attribs recalculation
      }else{
        if(gObject.childsRefs.size > 0){
          gObject.childsRefs.values().forEach(childRef => {
            childRef.pendingRenderingRecalculation = true;
          });
        }
        if(objectZ + camCenter.z < 0){
          continue;
        }

        analyzed++;
        dimentionsPack = gObject.dimentionsPack;

        texRef = gObject.textureName ? engine.textureManager.getTexture(gObject.textureName) : null;
        
        if(gObject.parentRef && sharedInstance.nDicoSet.has(gObject.parentRef.id)){
          parent = gObject.parentRef;
          origin.x = parent.dimentionsPack.base.x;
          origin.y = parent.dimentionsPack.base.y;
        }

        if (!camera.usePerspective && gObject.ignoreParallax){
          additionX = camCenter.x;
          additionY = camCenter.y;
        }

        objectScale = gObject.scale;

        perspectiveScale = 0.99;

        if(!camera.usePerspective || gObject.ignoreParallax){
          objectLeft = ((gObject.x + origin.x + additionX)*canvasResolution.height) + finalCameraHorizontalPixelOrigin; //*(camera.origin.x-0.5)*canvasResolution.width
          objectTop = (gObject.y + origin.y + additionY + (camera.origin.y-0.5))*canvasResolution.height; //* (camera.origin.y-0.5))*canvasResolution.height
        }else{
          objectLeft = gObject.x + origin.x + camCenter.x;
          objectTop = gObject.y + origin.y + camCenter.y;
          objectZ += camCenter.z;

          const lookupTableIndex = Math.trunc(objectZ*100)
          if(sharedInstance.lookupTable.has(lookupTableIndex)){
            perspectiveDiff = sharedInstance.lookupTable.get(lookupTableIndex);
          }else{
            perspectiveDiff = 1 - ((1/objectZ)-1)/perspectiveDiffHelper;
            sharedInstance.lookupTable.set(lookupTableIndex, perspectiveDiff);
          }

          perspectiveScale = perspectiveDiff * toAddSizeHelper;

          //*with perspectiveScale > 0.003 we ensure the very far of|behind the camera elements won't be further calculated
          if(perspectiveScale<=0.003){
            continue;
          }
          objectScale *= perspectiveScale;

          //*recalculate gObject coords
          perspectiveLayer = canvasResolution.height*perspectiveScale;

          //it will calc were the image must to be, inside the perspectiveLayer
          objectLeft *= perspectiveLayer;
          objectTop *= perspectiveLayer;
          //now add the origin of the perspectiveLayer
          objectLeft += -(perspectiveLayer-canvasResolution.height)*(0.88889); // 1.77/2 :display horizontal center
          objectTop += -(perspectiveLayer-canvasResolution.height)*camera.origin.y;
        }

        //By default values for the textboxes
        objectWidth = canvasResolution.width*objectScale*gObject.widthScale;
        objectHeight = canvasResolution.height*objectScale*gObject.heightScale;

        if(texRef){
          if(!dimentionsPack.solvedTexture && !engine.textureManager.isATextureAnim(gObject.textureName!))
            dimentionsPack.solvedTexture = texRef;
          if(gObject.useEngineUnits){
            objectWidth = texRef.resolution.width*objectScale*gObject.widthScale*developmentRatio;
            objectHeight = texRef.resolution.height*objectScale*gObject.heightScale*developmentRatio;
          }else{
            objectHeight = (texRef.resolution.heightWidthRelation)*canvasResolution.width*objectScale*gObject.heightScale;
          }
        }else{
          //dimentionsPack.solvedTextureName = ""; Unused in RenderEngine
          if(gObject.useEngineUnits){
            objectWidth = canvasResolution.height*objectScale*gObject.widthScale;
          }
        }

        cornerX = objectLeft - objectWidth*0.5;
        cornerY = objectTop - objectHeight*0.5;

        if(!gObject.repeatPattern){
          dimentionsPack.repeatPattern = null;
          if(cornerX > canvasResolution.width || cornerY > canvasResolution.height || (cornerX + objectWidth) < 0 || (cornerY + objectHeight)<0){
            continue;
          }
        }else{
          if(gObject.repeatPattern instanceof CanvasPattern){
            dimentionsPack.repeatPattern = gObject.repeatPattern;
            engine.renderMisc.applyPatternTransformation(gObject.dimentionsPack);
          }
        }

        dimentionsPack.x  = Math.trunc(objectLeft);
        dimentionsPack.y  = Math.trunc(objectTop);
        dimentionsPack.z  = objectZ;
        dimentionsPack.corner.x = Math.trunc(cornerX);
        dimentionsPack.corner.y = Math.trunc(cornerY);

        dimentionsPack.base.x = origin.x + gObject.x;
        dimentionsPack.base.y = origin.y + gObject.y;
        dimentionsPack.base.z = gObject.accomulatedZ;

        dimentionsPack.sizeInDisplay  = perspectiveScale;
        dimentionsPack.width  = objectWidth;
        dimentionsPack.height  = objectHeight;
        dimentionsPack.rotation = Math.trunc(gObject.rotate);

        //TODO: texts requires continous recomputing
        const strRef = gObject.text == null ? null : getStr(gObject.text);
        if(strRef != null){
          const fontSizeRenderingValue = gObject.fontSizeNumeric*(canvasResolution.scale*developmentRatio)*perspectiveScale;
          const objectWidthMargin = (fontSizeRenderingValue/gObject.fontSize)*gObject.horizontalMargin;
          const objectHeightMargin = (fontSizeRenderingValue/gObject.fontSize)*gObject.verticalMargin;

          dimentionsPack.text = {
            fontSize:fontSizeRenderingValue,
            margin:{
              horizontal:objectWidthMargin, 
              vertical:objectHeightMargin}
          };

          if(gObject.fitContent){
            RenderDebug.getInstance().setFont(fontSizeRenderingValue, gObject.font, window.debugContext);

            //Why i do this here?
            //Because i need to know the fontSizeRenderingValue to calculate the margin, 
            // and i need the margin to calculate the wrapText, and i need the wrapText 
            // to calculate the height of the textbox, and i need the height of the
            // textbox to calculate the fontSizeRenderingValue... (because of fitContent)

            let texts = wrapText(//TODO: Wrap it until all the text get wraped
              window.debugContext,//equal as in RenderMiscCanvas2D
              strRef,//Eual
              objectWidthMargin + dimentionsPack.corner.x, //equal
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
        sharedInstance.nDicoSet.add(gObject.id);
        finalArrayisedTree.push(gObject.id);

        gObject.pendingRenderingRecalculation = false;

      }
    }
    return sharedInstance.nDicoSet;
}

/**
 * Calculates the apropiate engine display resolution
 * @param aspectRatio 
 * @param w 
 * @returns 
 */
export function displayResolutionCalc(aspectRatio:string, w:HTMLElement){
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