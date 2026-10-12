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
    //L5: FOV vertical explicito. Sin fov se reproduce la focal historica exacta
    //(H^2/W): camera.position.angle queda como campo legacy sin uso en el calculo.
    const legacyFov = 2*Math.atan(canvasResolutionWidth/(2*canvasResolutionHeight));
    const fovRaw = camera.fov ?? legacyFov;
    const fov = Math.min(Math.max(fovRaw, 0.01), Math.PI - 0.01);
    const focalPx = (canvasResolutionHeight*0.5)/Math.tan(fov*0.5);
    const toAddSizeHelper = focalPx/canvasResolutionHeight;
    //Centro optico horizontal en unidades mundo. Antes hardcodeado a 0.88889
    //(= 1.777/2, solo correcto en 16:9); en cualquier otro aspect desplazaba
    //toda la escena lateralmente de forma dependiente de la profundidad.
    const halfAspectWidth = canvasResolutionWidth/canvasResolutionHeight/2;
    //Near plane en unidades mundo: con objectZ -> 0 la escala 1/Z diverge a
    //infinito y en negativo espejea; por debajo de esto se descarta el objeto
    //(la camara esta pegada/atravesando su plano).
    const NEAR_PLANE = 0.02;
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
        //L4: el hijo hereda posicion Y escala del padre (offsets en espacio del padre)
        let parentScaleAccum = 1;
        if(parentRef){
          const parentRaw: GraphObject = parentRef._rawSelf ?? parentRef;
          if(nDicoSet.has(parentRaw._id)){
            const parentPack = parentRaw.dimentionsPack;
            originX = parentPack.base.x;
            originY = parentPack.base.y;
            parentScaleAccum = parentRaw._accomulatedScale;
          }
        }

        let worldX = gObject._x * parentScaleAccum + originX;
        let worldY = gObject._y * parentScaleAccum + originY;
        let worldZ = accumZ;

        if (hasWorldRotation && !gObject._ignoreParallax) {
          const camPosX = camera.position.x;
          const camPosY = camera.position.y;
          const camPosZ = camera.position.z;
          //Pivote de rotacion: el ojo en perspectiva (girar la camara sin paralaje),
          //camera.position en orto (rama intacta). El ojo es el punto que la
          //proyeccion lleva al centro optico: eye = cam + (halfAspect-.5, originY-.5, -.56).
          //Rotar sobre camera.position lo dejaba 0.56 delante y 0.39 al lado,
          //y el giro parecia orbital "mas adelante" en vez de giro de camara.
          const pivotX = cameraUsePerspective ? -camCenterX + halfAspectWidth : camPosX;
          const pivotY = cameraUsePerspective ? -camCenterY + cameraOriginY : camPosY;
          const pivotZ = cameraUsePerspective ? -camCenterZ : camPosZ;
          const rotated = rotate3DJS(
            [worldX - pivotX, worldY - pivotY, worldZ - pivotZ],
            worldRoll, worldPitch, worldYaw
          );
          worldX = rotated[0] + pivotX;
          worldY = rotated[1] + pivotY;
          worldZ = rotated[2] + pivotZ;
        }

        const isBehindCamera = worldZ + camCenterZ < NEAR_PLANE;
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
          gObject._pendingRenderingRecalculation = true;
          continue;
        }

        if (!cameraUsePerspective && gObject._ignoreParallax){
          additionX = camCenterX;
          additionY = camCenterY;
        }

        let objectScale = gObject._accomulatedScale;

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
            //La GPU rota los vertices (roll/pitch/yaw propios + rotacion mundo):
            //la caja sin rotar subestima los pixeles reales y produce pop-in/out
            //al rotar. Se descarta con el cuadrado que contiene cualquier rotacion
            //x1.5 de margen por el estiramiento de perspectiva por vertice.
            let cullX = cornerX, cullY = cornerY, cullW = objectWidth, cullH = objectHeight;
            if(gObject._rotate !== 0 || gObject._pitch !== 0 || gObject._yaw !== 0 ||
               (hasWorldRotation && !gObject._ignoreParallax)){
              const halfDiag = 0.75*Math.sqrt(objectWidth*objectWidth + objectHeight*objectHeight) + 2;
              cullX = cornerX + objectWidth*0.5 - halfDiag;
              cullY = cornerY + objectHeight*0.5 - halfDiag;
              cullW = halfDiag*2;
              cullH = halfDiag*2;
            }
            if(cullX > canvasResolutionWidth || cullY > canvasResolutionHeight || (cullX + cullW) < 0 || (cullY + cullH)<0){
              gObject._pendingRenderingRecalculation = true;
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
          dimentionsPack.ignoreWorldRotation = gObject._ignoreParallax ? 1 : 0;
          //Orto: sin perspectiva por vertice (la GPU conserva su foreshorten local historico)
          dimentionsPack.perspDepth.z = 0;
          dimentionsPack.perspDepth.p = 0;

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
            gObject._pendingRenderingRecalculation = true;
            continue;
          }
          objectScale *= perspectiveScale;

          //*recalculate gObject coords
          const perspectiveLayer = canvasResolutionHeight*perspectiveScale;

          //it will calc were the image must to be, inside the perspectiveLayer
          objectLeft *= perspectiveLayer;
          objectTop *= perspectiveLayer;
          //now add the originof the perspectiveLayer
          objectLeft += -(perspectiveLayer-canvasResolutionHeight)*halfAspectWidth; // display horizontal center
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
            //La GPU rota los vertices (roll/pitch/yaw propios + rotacion mundo):
            //la caja sin rotar subestima los pixeles reales y produce pop-in/out
            //al rotar. Se descarta con el cuadrado que contiene cualquier rotacion
            //x1.5 de margen por el estiramiento de perspectiva por vertice.
            let cullX = cornerX, cullY = cornerY, cullW = objectWidth, cullH = objectHeight;
            if(gObject._rotate !== 0 || gObject._pitch !== 0 || gObject._yaw !== 0 ||
               (hasWorldRotation && !gObject._ignoreParallax)){
              const halfDiag = 0.75*Math.sqrt(objectWidth*objectWidth + objectHeight*objectHeight) + 2;
              cullX = cornerX + objectWidth*0.5 - halfDiag;
              cullY = cornerY + objectHeight*0.5 - halfDiag;
              cullW = halfDiag*2;
              cullH = halfDiag*2;
            }
            if(cullX > canvasResolutionWidth || cullY > canvasResolutionHeight || (cullX + cullW) < 0 || (cullY + cullH)<0){
              gObject._pendingRenderingRecalculation = true;
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
          dimentionsPack.ignoreWorldRotation = gObject._ignoreParallax ? 1 : 0;
          //Profundidad real del centro + px por unidad mundo: la GPU proyecta
          //cada vertice con Zc/Zv en vez del heuristico cameraDist.
          dimentionsPack.perspDepth.z = objectZ;
          dimentionsPack.perspDepth.p = perspectiveLayer;
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
