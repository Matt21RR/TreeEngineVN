import GraphObject from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";
import { getStr, wrapText } from "../logic/Misc.ts";
import { CameraData } from "./RenderEngine.d.tsx";
import { RenderEngine } from "./RenderEngine.tsx";
import EngTexture from "./EngTexture.ts";
import { CalculationOrder } from "./RenderingOrder.ts";

import RenderMiscCanvas2D from "./RenderMiscCanvas2D.ts";
const RenderDebug = RenderMiscCanvas2D;

function rotate3DJS(
  point: [number, number, number],
  roll: number, pitch: number, yaw: number
): [number, number, number] {
  const cr = Math.cos(roll),  sr = Math.sin(roll);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw),   sy = Math.sin(yaw);

  const x1 = point[0] * cy + point[2] * sy;
  const z1 = -point[0] * sy + point[2] * cy;
  const y1 = point[1];

  const y2 = y1 * cp - z1 * sp;
  const z2 = y1 * sp + z1 * cp;

  const x3 = x1 * cr - y2 * sr;
  const y3 = x1 * sr + y2 * cr;
  return [x3, y3, z2];
}

export class SharedDisplayCalcs{
  private static instance: SharedDisplayCalcs;

  public lookupTable: Map<number,number>;
  public nDicoSet: Set<string> = new Set();
  public recalculateAll: boolean = false;
  public visibleRefs: Array<GraphObject> = [];

  static getInstance(){
    return SharedDisplayCalcs.instance;
  }
  constructor(){
    this.lookupTable = new Map();
    SharedDisplayCalcs.instance = this;
  }
}


/**
 * Genera dimensions y ubicacion de los objetos a renderizar
 * Se recalcula un objeto cuando su información o la información de la camara cambia
 * @returns 
 */
export function generateObjectsDisplayDimentions(
  graphArray: RenList<GraphObject>, 
  calculationOrder: CalculationOrder,
  canvasResolution: {width:number, height:number,scale:number},
  camera: CameraData): Set<string> {
    const canvasResolutionWidth = canvasResolution.width;
    const canvasResolutionHeight = canvasResolution.height;
    const canvasResolutionScale = canvasResolution.scale;

    const engine = RenderEngine.getInstance();
    const sharedInstance = SharedDisplayCalcs.getInstance();
    const textureManager = engine.textureManager;
    const lookupTable = sharedInstance.lookupTable;
    const cameraUsePerspective = camera.usePerspective;
    const cameraOriginY = camera.origin.y;

    sharedInstance.nDicoSet.clear();
    sharedInstance.visibleRefs = [];
    const visibleRefsOut = sharedInstance.visibleRefs;
    const nDicoSet = sharedInstance.nDicoSet;

    const camCenterX = -camera.position.x + 0.5;
    const camCenterY = -camera.position.y + 0.5;
    const camCenterZ = -camera.position.z + 0.56;

    const developmentRatio = canvasResolutionHeight/engine.developmentDeviceHeight;
    const perspectiveDiffHelper = (1/camera.maxZ) - 1;
    const toAddSizeHelper = (camera.position.angle*canvasResolutionHeight*camera.maxZ) / canvasResolutionHeight;
    const cameraOriginYDelta = (cameraOriginY-0.5)*canvasResolutionHeight;
    const finalCameraHorizontalPixelOrigin = (camera.origin.x-0.5)*canvasResolutionWidth;

    const worldPitch = camera.position.pitch ?? 0;
    const worldYaw   = camera.position.yaw   ?? 0;
    const worldRoll  = camera.position.roll  ?? 0;
    const hasWorldRotation = worldPitch !== 0 || worldYaw !== 0 || worldRoll !== 0;

    let strRef: any;
    const recalculateAll = sharedInstance.recalculateAll;

    //*Historical bound: the original engine truncated the calculation order to
    //enabledIds.length (RenList.length), never processing its tail entries.
    for (let index = 0; index < graphArray.length; index++) {
      const anyObj: any = calculationOrder[index];
      const gObject: GraphObject = anyObj._rawSelf ?? anyObj;
      const accumZ = gObject._accomulatedZ;
      if(!gObject._pendingRenderingRecalculation && !recalculateAll){
        nDicoSet.add(gObject._id);
        visibleRefsOut.push(gObject);
        //TODO: if text value is not null, jump to text attribs recalculation
      }else{
        const dimentionsPack = gObject.dimentionsPack;

       //*Sanitization: neutral defaults each iteration so results never depend on unrelated objects
        let originX = 0;
        let originY = 0;
        let additionX = 0;
        let additionY = 0;

        const solvedTexture = dimentionsPack.solvedTexture;
        const textureName = gObject._textureName;
        const texRef: EngTexture|null = solvedTexture ?? (textureName ? textureManager.getTexture(textureName) : null);

        const parentRef = gObject._parentRef;
        if(parentRef){
          const parentRaw: GraphObject = parentRef._rawSelf ?? parentRef;
          if(nDicoSet.has(parentRaw._id)){
            const parentPack = parentRaw.dimentionsPack;
            originX = parentPack.base.x;
            originY = parentPack.base.y;
          }
        }

        let worldX = gObject._x + originX;
        let worldY = gObject._y + originY;
        let worldZ = accumZ;

        if (hasWorldRotation) {
          const camPosX = camera.position.x;
          const camPosY = camera.position.y;
          const camPosZ = camera.position.z;
          const rotated = rotate3DJS(
            [worldX - camPosX, worldY - camPosY, worldZ - camPosZ],
            worldRoll, worldPitch, worldYaw
          );
          worldX = rotated[0] + camPosX;
          worldY = rotated[1] + camPosY;
          worldZ = rotated[2] + camPosZ;
        }

        const isBehindCamera = worldZ + camCenterZ < 0;
        //*Equivalence-safe fast path: repeating the behind-camera check with the
        //same accumulated z and an unchanged camera yields the same discard.
        if(isBehindCamera && !recalculateAll && gObject._behindStamp === accumZ){
          continue;
        }
        const childsRefs = gObject._childsRefs;
        if(childsRefs.size > 0){
          for (const childRef of childsRefs.values()){
            const rawChild: any = childRef._rawSelf ?? childRef;
            rawChild._pendingRenderingRecalculation = true;
          }
        }
        if(isBehindCamera){
          gObject._behindStamp = accumZ;
          continue;
        }

        if (!cameraUsePerspective && gObject._ignoreParallax){
          additionX = camCenterX;
          additionY = camCenterY;
        }

        let objectScale = gObject._scale;

        let perspectiveScale = 0.99;

        if(!cameraUsePerspective || gObject._ignoreParallax){
          const objectLeft = ((worldX + additionX)*canvasResolutionHeight) + finalCameraHorizontalPixelOrigin;
          const objectTop = ((worldY + additionY) + cameraOriginYDelta)*canvasResolutionHeight;

          let objectWidth = canvasResolutionWidth*objectScale*gObject._widthScale;
          let objectHeight = canvasResolutionHeight*objectScale*gObject._heightScale;

          if(texRef){
            if(!solvedTexture && !textureManager.isATextureAnim(textureName!))
              dimentionsPack.solvedTexture = texRef;
            if(gObject._useEngineUnits){
              objectWidth = texRef.resolution.width*objectScale*gObject._widthScale*developmentRatio;
              objectHeight = texRef.resolution.height*objectScale*gObject._heightScale*developmentRatio;
            }else{
              objectHeight = (texRef.resolution.heightWidthRelation)*canvasResolutionWidth*objectScale*gObject._heightScale;
            }
          }else{
            if(gObject._useEngineUnits){
              objectWidth = canvasResolutionHeight*objectScale*gObject._widthScale;
            }
          }

          const cornerX = objectLeft - objectWidth*0.5;
          const cornerY = objectTop - objectHeight*0.5;

          if(!gObject._repeatPattern){
            dimentionsPack.repeatPattern = false;
            if(cornerX > canvasResolutionWidth || cornerY > canvasResolutionHeight || (cornerX + objectWidth) < 0 || (cornerY + objectHeight)<0){
              continue;
            }
          }

          dimentionsPack.x  = objectLeft;
          dimentionsPack.y  = objectTop;
          dimentionsPack.z  = worldZ;
          dimentionsPack.corner.x = cornerX;
          dimentionsPack.corner.y = cornerY;

          dimentionsPack.base.x = worldX;
          dimentionsPack.base.y = worldY;
          dimentionsPack.base.z = worldZ;

          dimentionsPack.sizeInDisplay  = perspectiveScale;
          dimentionsPack.width  = objectWidth;
          dimentionsPack.height  = objectHeight;

          dimentionsPack.rotation = gObject._rotate;
          dimentionsPack.pitch = gObject._pitch;
          dimentionsPack.yaw = gObject._yaw;
          dimentionsPack.roll = gObject._rotate;

        }else{
          let objectLeft = worldX + camCenterX;
          let objectTop = worldY + camCenterY;
          const objectZ = worldZ + camCenterZ;

          const lookupTableIndex = Math.trunc(objectZ*1000);
          let perspectiveDiff = lookupTable.get(lookupTableIndex);
          if(perspectiveDiff === undefined){
            perspectiveDiff = 1 - ((1/objectZ)-1)/perspectiveDiffHelper;
            lookupTable.set(lookupTableIndex, perspectiveDiff);
          }

          perspectiveScale = perspectiveDiff * toAddSizeHelper;

          //*with perspectiveScale > 0.003 we ensure the very far of|behind the camera elements won't be further calculated
          if(perspectiveScale<=0.003){
            continue;
          }
          objectScale *= perspectiveScale;

          //*recalculate gObject coords
          const perspectiveLayer = canvasResolutionHeight*perspectiveScale;

          //it will calc were the image must to be, inside the perspectiveLayer
          objectLeft *= perspectiveLayer;
          objectTop *= perspectiveLayer;
          //now add the originof the perspectiveLayer
          objectLeft += -(perspectiveLayer-canvasResolutionHeight)*(0.88889); // 1.77/2 :display horizontal center
          objectTop += -(perspectiveLayer-canvasResolutionHeight)*cameraOriginY;

          let objectWidth = canvasResolutionWidth*objectScale*gObject._widthScale;
          let objectHeight = canvasResolutionHeight*objectScale*gObject._heightScale;

          if(texRef){
            if(!solvedTexture && !textureManager.isATextureAnim(textureName!))
              dimentionsPack.solvedTexture = texRef;
            if(gObject._useEngineUnits){
              objectWidth = texRef.resolution.width*objectScale*gObject._widthScale*developmentRatio;
              objectHeight = texRef.resolution.height*objectScale*gObject._heightScale*developmentRatio;
            }else{
              objectHeight = (texRef.resolution.heightWidthRelation)*canvasResolutionWidth*objectScale*gObject._heightScale;
            }
          }else{
            if(gObject._useEngineUnits){
              objectWidth = canvasResolutionHeight*objectScale*gObject._widthScale;
            }
          }

          const cornerX = objectLeft - objectWidth*0.5;
          const cornerY = objectTop - objectHeight*0.5;

          if(!gObject._repeatPattern){
            dimentionsPack.repeatPattern = false;
            if(cornerX > canvasResolutionWidth || cornerY > canvasResolutionHeight || (cornerX + objectWidth) < 0 || (cornerY + objectHeight)<0){
              continue;
            }
          }

          dimentionsPack.x  = objectLeft;
          dimentionsPack.y  = objectTop;
          dimentionsPack.z  = objectZ;
          dimentionsPack.corner.x = cornerX;
          dimentionsPack.corner.y = cornerY;

          dimentionsPack.base.x = worldX;
          dimentionsPack.base.y = worldY;
          dimentionsPack.base.z = worldZ;

          dimentionsPack.sizeInDisplay  = perspectiveScale;
          dimentionsPack.width  = objectWidth;
          dimentionsPack.height  = objectHeight;

          dimentionsPack.rotation = gObject._rotate;
          dimentionsPack.pitch = gObject._pitch;
          dimentionsPack.yaw = gObject._yaw;
          dimentionsPack.roll = gObject._rotate;
        }

        //TODO: texts requires continous recomputing
        if(gObject._text !== null && (strRef = getStr(gObject._text)) !== null){
          const fontSizeRenderingValue = gObject._fontSize*canvasResolutionScale*developmentRatio*perspectiveScale;
          const fontSizeHelper = fontSizeRenderingValue/gObject._fontSize;
          const objectWidthMargin = fontSizeHelper*gObject._horizontalMargin;
          const objectHeightMargin = fontSizeHelper*gObject._verticalMargin;

          dimentionsPack.text.fontSize = fontSizeRenderingValue;
          dimentionsPack.text.margin.horizontal = objectWidthMargin;
          dimentionsPack.text.margin.vertical = objectHeightMargin;

          if(gObject._fitContent){
            RenderDebug.getInstance().setFont(fontSizeRenderingValue, gObject._font, window.debugContext);

            //Why i do this here?
            //Because i need to know the fontSizeRenderingValue to calculate the margin, 
            // and i need the margin to calculate the wrapText, and i need the wrapText 
            // to calculate the height of the textbox, and i need the height of the
            // textbox to calculate the fontSizeRenderingValue... (because of fitContent)

            let texts = wrapText(//TODO: Wrap it until all the text get wraped
              window.debugContext,//equal as in RenderMiscCanvas2D
              strRef,//Eual
              objectWidthMargin + dimentionsPack.corner.x, //equal
              fontSizeRenderingValue*0.5,
              dimentionsPack.width - objectWidthMargin*2,
              0,
              fontSizeRenderingValue,
              gObject._center, 
              false
            );

            const lastText = texts.at(-1);
            if (lastText) {
              dimentionsPack.height = lastText.y + fontSizeRenderingValue*0.5 + objectHeightMargin*2;
            }

            for (let index = 0; index < texts.length; index++) {
              texts[index].y += objectHeightMargin + (dimentionsPack.y - dimentionsPack.height*0.5);  
            }

            dimentionsPack.corner.y = (dimentionsPack.y - dimentionsPack.height*0.5);

            dimentionsPack.text.value = texts;
          }
        }else{
          dimentionsPack.text.value = null;
        }
        nDicoSet.add(gObject._id);
        visibleRefsOut.push(gObject);

        gObject._pendingRenderingRecalculation = false;

      }
    }
    sharedInstance.recalculateAll = false;
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
    const aspectRatioParts = aspectRatio.split(":").map((part) => parseInt(part));

    let newWidth = Math.floor((w.offsetHeight / aspectRatioParts[1]) * aspectRatioParts[0]);
    let newHeight = Math.floor((w.offsetWidth / aspectRatioParts[0]) * aspectRatioParts[1]);
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
