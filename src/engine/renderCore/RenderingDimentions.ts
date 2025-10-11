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
  dimentionsPack: Record<string,ObjectRenderingData>, 
  calculationOrder: CalculationOrder,
  camera: CameraData){
    var a = 0;

    const ab = performance.now();
  
    const engine = RenderEngine.getInstance();
  
    const prevDimentionsPack = engineRenderingDataCloner(dimentionsPack);

    dimentionsPack = {}; //wipe

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

    a += performance.now()-ab;

    var analyzed = 0;

    var origin = {x:0, y:0};

    // Instead of adding properties later, initialize all at once:
    let res: ObjectRenderingData = {
      id: "",
      x: 0, y: 0, z: 0,
      corner: { x: 0, y: 0 },
      base: { x: 0, y: 0, z: 0 },
      sizeInDisplay: 0,
      width: 0, height: 0,
      rotation: 0,
      text: undefined
    };
    let gObject: GraphObject;
    let texRef: Shader;
    let addition = {x:0,y:0};
    let objectScale = 0;
    let objectLeft = 0;
    let objectTop = 0;
    let objectZ = 0;
    let perspectiveLayer = {width:0,height:0};
    let objectWidth = 0;
    let objectHeight = 0;
    let testD = 0;

    for (let index = 0; index < graphArray.length; index++) {
      const as = performance.now();
      
      gObject = graphArray.get(arrayisedTree[index]);
      
      if(!gObject.pendingRenderingRecalculation){
        dimentionsPack[gObject.id] = prevDimentionsPack[gObject.id];
        a += performance.now() - as;
        //TODO: if text value is not null, jump to text attribs recalculation
        continue;
      }

      analyzed++;
      // engine.redraw = true;

      texRef = gObject.textureName == null ? null : engine.getTexture(gObject);

      if(gObject.parent != "" && gObject.parent in dimentionsPack){
        origin.x = dimentionsPack[gObject.parent].base.x;
        origin.y = dimentionsPack[gObject.parent].base.y;
      }

      if (!camera.usePerspective && gObject.ignoreParallax){
        addition.x = camCenter.x;
        addition.y = camCenter.y;
      }

      objectScale = gObject.scale;
      objectZ = gObject.accomulatedZ;
      testD = 0.99;

      if(!camera.usePerspective || gObject.ignoreParallax){
        objectLeft = ((gObject.x + origin.x + addition.x)*canvas.resolution.height) + (camera.origin.x-0.5)*canvas.resolution.width;
        objectTop = (gObject.y + origin.y + addition.y + (camera.origin.y-0.5))*canvas.resolution.height;
        //objectZ = gObject.accomulatedZ + camera.position.z;
      }else{
        objectLeft = gObject.x + origin.x + camCenter.x;
        objectTop = gObject.y + origin.y + camCenter.y;
        objectZ += camCenter.z;

        const perspectiveDiff = 1 - ((1/objectZ)-1)/perspectiveDiffHelper;
        const perspectiveScale = perspectiveDiff * toAddSizeHelper;

        //*with testD > 0.003 we ensure the very far of|behind the camera elements won't be further calculated
        if(perspectiveScale<=0.003){
          continue;
        }
        objectScale *= perspectiveScale;
        testD = perspectiveScale;

        //*recalculate gObject coords
        perspectiveLayer.width = canvas.resolution.height*perspectiveScale;
        perspectiveLayer.height = canvas.resolution.height*perspectiveScale;

        //it will calc were the image must to be, inside the perspectiveLayer
        objectLeft *= perspectiveLayer.width;
        objectTop *= perspectiveLayer.height;
        //now add the origin of the perspectiveLayer
        objectLeft += -(perspectiveLayer.width-canvas.resolution.height)*(1.77/2);
        objectTop += -(perspectiveLayer.height-canvas.resolution.height)*camera.origin.y;
      }
      a += performance.now() - as;

      // if(objectLeft>canvas.resolution.width || objectTop>canvas.resolution.height){
      //   continue;
      // }

      //By default values for the textboxes
      objectWidth = canvas.resolution.width*objectScale*gObject.widthScale;
      objectHeight = canvas.resolution.height*objectScale*gObject.heightScale;

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

      const cornerX = objectLeft - objectWidth/2;
      const cornerY = objectTop - objectHeight/2;

      if((cornerX + objectWidth) < 0 || (cornerY + objectHeight)<0 || cornerX > canvas.resolution.width || cornerY > canvas.resolution.height){
        continue;
      }

      res = {
        id: gObject.id,
        x : objectLeft,
        y : objectTop,
        z : objectZ,
        corner:{
          x:cornerX,
          y:cornerY
        },
        base:{
          x:origin.x + gObject.x,
          y:origin.y + gObject.y,
          z:gObject.accomulatedZ
        },
        sizeInDisplay : testD,
        width : objectWidth,
        height : objectHeight,
        rotation: gObject.rotate
      };

      //TODO: texts requires continous recomputing
      const strRef = gObject.text == null ? null : getStr(gObject.text);
      if(strRef != null){
        const fontSizeRenderingValue = gObject.fontSizeNumeric*canvas.resolution.scale*(developmentRatio)*testD;
        const objectWidthMargin = (fontSizeRenderingValue/gObject.fontSize)*gObject.horizontalMargin;
        const objectHeightMargin = (fontSizeRenderingValue/gObject.fontSize)*gObject.verticalMargin;

        res.text = {
            fontSize:fontSizeRenderingValue,
            margin:{
              horizontal:objectWidthMargin, 
              vertical:objectHeightMargin}
            }

        if(gObject.fitContent){
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
            objectHeight = lastText.y + fontSizeRenderingValue/2 + objectHeightMargin*2;
          }

          for (let index = 0; index < texts.length; index++) {
            texts[index].y += objectHeightMargin + (objectTop - objectHeight/2) ;  
          }

          res.corner.y = (objectTop - objectHeight/2);
          res.height = objectHeight;
          res.text!.value = texts;
        }
      }
      dimentionsPack[gObject.id] = res;
      gObject.pendingRenderingRecalculation = false;

    }
    // console.log(`Analyzed: ${analyzed} of ${graphArray.length} in ${performance.now()-ab}ms non: ${a}`);
    return dimentionsPack;
  }

export {generateObjectsDisplayDimentions}