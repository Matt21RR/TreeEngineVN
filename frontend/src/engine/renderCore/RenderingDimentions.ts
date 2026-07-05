import GraphObject from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";
import { getStr, wrapText } from "../logic/Misc.ts";
import { CameraData } from "./RenderEngine.d.tsx";
import { RenderEngine } from "./RenderEngine.tsx";
import EngTexture from "./EngTexture.ts";

import RenderMiscCanvas2D from "./RenderMiscCanvas2D.ts";
const RenderDebug = RenderMiscCanvas2D;

enum DisplayDimensionIndex {
  OriginX = 0,
  OriginY,
  AdditionX,
  AdditionY,
  ObjectScale,
  ObjectLeft,
  ObjectTop,
  ObjectZ,
  PerspectiveLayer,
  ObjectWidth,
  ObjectHeight,
  PerspectiveScale,
  PerspectiveDiff,
  CornerX,
  CornerY,
}

export class SharedDisplayCalcs{
  private static instance: SharedDisplayCalcs;

  public lookupTable: Map<number,number>;
  public nDicoSet: Set<string> = new Set();
  public recalculateAll: boolean = false;

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
    const canvasResolutionWidth = canvasResolution.width;
    const canvasResolutionHeight = canvasResolution.height;

    const engine = RenderEngine.getInstance();
    const sharedInstance = SharedDisplayCalcs.getInstance();

    sharedInstance.nDicoSet.clear();

    const camCenter = {
      x: -camera.position.x + 0.5,
      y: -camera.position.y + 0.5,
      z: -camera.position.z + 0.56
    };

    const developmentRatio = canvasResolutionHeight/engine.developmentDeviceHeight;
    const perspectiveDiffHelper = (1/camera.maxZ) - 1;
    const toAddSizeHelper = (camera.position.angle*canvasResolutionHeight*camera.maxZ) / canvasResolutionHeight;


    let gObject: GraphObject;

    let parent: GraphObject;

    let texRef: EngTexture;
    let strRef: any;

    let analyzed = 0;

    const displayValues = new Float64Array(DisplayDimensionIndex.CornerY + 1);

    const finalCameraHorizontalPixelOrigin = (camera.origin.x-0.5)*canvasResolutionWidth;

    let dimentionsPack = null;

    for (let index = 0; index < graphArray.length; index++) {
      gObject = graphArray.fastGet(calculationOrder[index]);
      displayValues[DisplayDimensionIndex.ObjectZ] = gObject.accomulatedZ;
      if(!gObject.pendingRenderingRecalculation && !sharedInstance.recalculateAll){
        sharedInstance.nDicoSet.add(gObject.id);
        //TODO: if text value is not null, jump to text attribs recalculation
      }else{
        if(gObject.childsRefs.size > 0){
          for (const childRef of gObject.childsRefs.values()){
            childRef.pendingRenderingRecalculation = true;
          }
        }
        if(displayValues[DisplayDimensionIndex.ObjectZ] + camCenter.z < 0){
          continue;
        }

        analyzed++;
        dimentionsPack = gObject.dimentionsPack;

        texRef = gObject.textureName ? engine.textureManager.getTexture(gObject.textureName) : null;
        
        if(gObject.parentRef && sharedInstance.nDicoSet.has(gObject.parentRef.id)){
          parent = gObject.parentRef;
          displayValues[DisplayDimensionIndex.OriginX] = parent.dimentionsPack.base.x;
          displayValues[DisplayDimensionIndex.OriginY] = parent.dimentionsPack.base.y;
        }

        if (!camera.usePerspective && gObject.ignoreParallax){
          displayValues[DisplayDimensionIndex.AdditionX] = camCenter.x;
          displayValues[DisplayDimensionIndex.AdditionY] = camCenter.y;
        }

        displayValues[DisplayDimensionIndex.ObjectScale] = gObject.scale;

        displayValues[DisplayDimensionIndex.PerspectiveScale] = 0.99;

        if(!camera.usePerspective || gObject.ignoreParallax){
          displayValues[DisplayDimensionIndex.ObjectLeft] = ((gObject.x + displayValues[DisplayDimensionIndex.OriginX] + displayValues[DisplayDimensionIndex.AdditionX])*canvasResolutionHeight) + finalCameraHorizontalPixelOrigin;
          displayValues[DisplayDimensionIndex.ObjectTop] = (gObject.y + displayValues[DisplayDimensionIndex.OriginY] + displayValues[DisplayDimensionIndex.AdditionY] + (camera.origin.y-0.5))*canvasResolutionHeight;
        }else{
          displayValues[DisplayDimensionIndex.ObjectLeft] = gObject.x + displayValues[DisplayDimensionIndex.OriginX] + camCenter.x;
          displayValues[DisplayDimensionIndex.ObjectTop] = gObject.y + displayValues[DisplayDimensionIndex.OriginY] + camCenter.y;
          displayValues[DisplayDimensionIndex.ObjectZ] += camCenter.z;

          const lookupTableIndex = Math.trunc(displayValues[DisplayDimensionIndex.ObjectZ]*1000)
          if(sharedInstance.lookupTable.has(lookupTableIndex)){
            displayValues[DisplayDimensionIndex.PerspectiveDiff] = sharedInstance.lookupTable.get(lookupTableIndex)!;
          }else{
            displayValues[DisplayDimensionIndex.PerspectiveDiff] = 1 - ((1/displayValues[DisplayDimensionIndex.ObjectZ])-1)/perspectiveDiffHelper;
            sharedInstance.lookupTable.set(lookupTableIndex, displayValues[DisplayDimensionIndex.PerspectiveDiff]);
          }

          displayValues[DisplayDimensionIndex.PerspectiveScale] = displayValues[DisplayDimensionIndex.PerspectiveDiff] * toAddSizeHelper;

          //*with perspectiveScale > 0.003 we ensure the very far of|behind the camera elements won't be further calculated
          if(displayValues[DisplayDimensionIndex.PerspectiveScale]<=0.003){
            continue;
          }
          displayValues[DisplayDimensionIndex.ObjectScale] *= displayValues[DisplayDimensionIndex.PerspectiveScale];

          //*recalculate gObject coords
          displayValues[DisplayDimensionIndex.PerspectiveLayer] = canvasResolutionHeight*displayValues[DisplayDimensionIndex.PerspectiveScale];

          //it will calc were the image must to be, inside the perspectiveLayer
          displayValues[DisplayDimensionIndex.ObjectLeft] *= displayValues[DisplayDimensionIndex.PerspectiveLayer];
          displayValues[DisplayDimensionIndex.ObjectTop] *= displayValues[DisplayDimensionIndex.PerspectiveLayer];
          //now add the originof the perspectiveLayer
          displayValues[DisplayDimensionIndex.ObjectLeft] += -(displayValues[DisplayDimensionIndex.PerspectiveLayer]-canvasResolutionHeight)*(0.88889); // 1.77/2 :display horizontal center
          displayValues[DisplayDimensionIndex.ObjectTop] += -(displayValues[DisplayDimensionIndex.PerspectiveLayer]-canvasResolutionHeight)*camera.origin.y;
        }

        //By default values for the textboxes
        displayValues[DisplayDimensionIndex.ObjectWidth] = canvasResolutionWidth*displayValues[DisplayDimensionIndex.ObjectScale]*gObject.widthScale;
        displayValues[DisplayDimensionIndex.ObjectHeight] = canvasResolutionHeight*displayValues[DisplayDimensionIndex.ObjectScale]*gObject.heightScale;

        if(texRef){
          if(!dimentionsPack.solvedTexture && !engine.textureManager.isATextureAnim(gObject.textureName!))
            dimentionsPack.solvedTexture = texRef;
          if(gObject.useEngineUnits){
            displayValues[DisplayDimensionIndex.ObjectWidth] = texRef.resolution.width*displayValues[DisplayDimensionIndex.ObjectScale]*gObject.widthScale*developmentRatio;
            displayValues[DisplayDimensionIndex.ObjectHeight] = texRef.resolution.height*displayValues[DisplayDimensionIndex.ObjectScale]*gObject.heightScale*developmentRatio;
          }else{
            displayValues[DisplayDimensionIndex.ObjectHeight] = (texRef.resolution.heightWidthRelation)*canvasResolutionWidth*displayValues[DisplayDimensionIndex.ObjectScale]*gObject.heightScale;
          }
        }else{
          //dimentionsPack.solvedTextureName = ""; Unused in RenderEngine
          if(gObject.useEngineUnits){
            displayValues[DisplayDimensionIndex.ObjectWidth] = canvasResolutionHeight*displayValues[DisplayDimensionIndex.ObjectScale]*gObject.widthScale;
          }
        }

        displayValues[DisplayDimensionIndex.CornerX] = displayValues[DisplayDimensionIndex.ObjectLeft] - displayValues[DisplayDimensionIndex.ObjectWidth]*0.5;
        displayValues[DisplayDimensionIndex.CornerY] = displayValues[DisplayDimensionIndex.ObjectTop] - displayValues[DisplayDimensionIndex.ObjectHeight]*0.5;

        if(!gObject.repeatPattern){
          dimentionsPack.repeatPattern = false;
          if(displayValues[DisplayDimensionIndex.CornerX] > canvasResolutionWidth || displayValues[DisplayDimensionIndex.CornerY] > canvasResolutionHeight || (displayValues[DisplayDimensionIndex.CornerX] + displayValues[DisplayDimensionIndex.ObjectWidth]) < 0 || (displayValues[DisplayDimensionIndex.CornerY] + displayValues[DisplayDimensionIndex.ObjectHeight])<0){
            continue;
          }
        }

        dimentionsPack.x  = displayValues[DisplayDimensionIndex.ObjectLeft];
        dimentionsPack.y  = displayValues[DisplayDimensionIndex.ObjectTop];
        dimentionsPack.z  = displayValues[DisplayDimensionIndex.ObjectZ];
        dimentionsPack.corner.x = displayValues[DisplayDimensionIndex.CornerX];
        dimentionsPack.corner.y = displayValues[DisplayDimensionIndex.CornerY];

        dimentionsPack.base.x = displayValues[DisplayDimensionIndex.OriginX] + gObject.x;
        dimentionsPack.base.y = displayValues[DisplayDimensionIndex.OriginY] + gObject.y;
        dimentionsPack.base.z = gObject.accomulatedZ;

        dimentionsPack.sizeInDisplay  = displayValues[DisplayDimensionIndex.PerspectiveScale];
        dimentionsPack.width  = displayValues[DisplayDimensionIndex.ObjectWidth];
        dimentionsPack.height  = displayValues[DisplayDimensionIndex.ObjectHeight];

        dimentionsPack.rotation = gObject.rotateRad;
        dimentionsPack.pitch = gObject.pitchRad;
        dimentionsPack.yaw = gObject.yawRad;
        dimentionsPack.roll = gObject.rollRad;

        //TODO: texts requires continous recomputing
        if(gObject.text !== null && (strRef = getStr(gObject.text)) !== null){
          const fontSizeRenderingValue = gObject.fontSizeNumeric*canvasResolution.scale*developmentRatio*displayValues[DisplayDimensionIndex.PerspectiveScale];
          const fontSizeHelper = fontSizeRenderingValue/gObject.fontSize;
          const objectWidthMargin = fontSizeHelper*gObject.horizontalMargin;
          const objectHeightMargin = fontSizeHelper*gObject.verticalMargin;

          dimentionsPack.text.fontSize = fontSizeRenderingValue;
          dimentionsPack.text.margin.horizontal = objectWidthMargin;
          dimentionsPack.text.margin.vertical = objectHeightMargin;

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
              fontSizeRenderingValue*0.5,
              dimentionsPack.width - objectWidthMargin*2,
              0,
              fontSizeRenderingValue,
              gObject.center, 
              false
            );

            const lastText = texts.at(-1);
            if (lastText) {
              displayValues[DisplayDimensionIndex.ObjectHeight] = lastText.y + fontSizeRenderingValue*0.5 + objectHeightMargin*2;
            }

            for (let index = 0; index < texts.length; index++) {
              texts[index].y += objectHeightMargin + (displayValues[DisplayDimensionIndex.ObjectTop] - displayValues[DisplayDimensionIndex.ObjectHeight]*0.5);  
            }

            dimentionsPack.corner.y = (displayValues[DisplayDimensionIndex.ObjectTop] - displayValues[DisplayDimensionIndex.ObjectHeight]*0.5);
            dimentionsPack.height = displayValues[DisplayDimensionIndex.ObjectHeight];

            dimentionsPack.text.value = texts;
          }
        }else{
          dimentionsPack.text.value = null;
        }
        sharedInstance.nDicoSet.add(gObject.id);

        gObject.pendingRenderingRecalculation = false;

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