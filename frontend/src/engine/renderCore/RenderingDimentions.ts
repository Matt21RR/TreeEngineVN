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

/** Inversa exacta de rotate3DJS (rotacion ortonormal: deshace roll, pitch y yaw en ese orden). */
function rotate3DInverseJS(
  point: [number, number, number],
  roll: number, pitch: number, yaw: number
): [number, number, number] {
  const cr = Math.cos(roll),  sr = Math.sin(roll);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw),   sy = Math.sin(yaw);

  const x1 = point[0] * cr + point[1] * sr;
  const y2 = -point[0] * sr + point[1] * cr;
  const z2 = point[2];

  const y1 = y2 * cp + z2 * sp;
  const z1 = -y2 * sp + z2 * cp;

  const x0 = x1 * cy - z1 * sy;
  const z0 = x1 * sy + z1 * cy;
  return [x0, y1, z0];
}

/**
 * Caja orientada de un modelo 3D relativa al ojo de la camara. Las esquinas
 * se calculan igual que el vertex shader de mallas: local * escala ->
 * orientacion propia (roll/pitch/yaw) -> rotacion de mundo.
 */
interface ModelBoxView {
  /** El ojo esta dentro de la caja: el modelo nunca se descarta. */
  inside: boolean;
  /** Todas las esquinas tras el plano cercano (no se ve nada). */
  allBehind: boolean;
  /** Alguna esquina tras el plano cercano (la caja lo cruza). */
  anyBehind: boolean;
  /** Z (relativa al ojo) de la esquina mas cercana. */
  minZ: number;
  /** Offsets de las 8 esquinas respecto al centro, ya rotados (unidades mundo). */
  ox: Float64Array; oy: Float64Array; oz: Float64Array;
  /** Mayor |offset| en x/y (cull ortografico). */
  maxAbsX: number; maxAbsY: number;
}

const boxScratch: ModelBoxView = {
  inside: false, allBehind: false, anyBehind: false, minZ: 0,
  ox: new Float64Array(8), oy: new Float64Array(8), oz: new Float64Array(8),
  maxAbsX: 0, maxAbsY: 0,
};

/** Margen relativo del test "ojo dentro de la caja" (evita parpadeo en el borde). */
const INSIDE_BOX_MARGIN = 1.01;

function computeModelBox(
  half: [number, number, number], scale: number,
  roll: number, pitch: number, yaw: number,
  useWorld: boolean, wRoll: number, wPitch: number, wYaw: number,
  cx: number, cy: number, cz: number, near: number
): ModelBoxView {
  const out = boxScratch;
  const hx = half[0] * scale, hy = half[1] * scale, hz = half[2] * scale;

  //*Ojo dentro: el ojo (origen) en el espacio local de la caja.
  let e: [number, number, number] = [-cx, -cy, -cz];
  if (useWorld) e = rotate3DInverseJS(e, wRoll, wPitch, wYaw);
  e = rotate3DInverseJS(e, roll, pitch, yaw);
  out.inside = Math.abs(e[0]) <= hx * INSIDE_BOX_MARGIN
    && Math.abs(e[1]) <= hy * INSIDE_BOX_MARGIN
    && Math.abs(e[2]) <= hz * INSIDE_BOX_MARGIN;

  let behind = 0;
  let minZ = Infinity, maxAbsX = 0, maxAbsY = 0;
  for (let i = 0; i < 8; i++) {
    let c: [number, number, number] = [(i & 1) ? hx : -hx, (i & 2) ? hy : -hy, (i & 4) ? hz : -hz];
    c = rotate3DJS(c, roll, pitch, yaw);
    if (useWorld) c = rotate3DJS(c, wRoll, wPitch, wYaw);
    out.ox[i] = c[0]; out.oy[i] = c[1]; out.oz[i] = c[2];
    const z = cz + c[2];
    if (z < near) behind++;
    if (z < minZ) minZ = z;
    if (Math.abs(c[0]) > maxAbsX) maxAbsX = Math.abs(c[0]);
    if (Math.abs(c[1]) > maxAbsY) maxAbsY = Math.abs(c[1]);
  }
  out.allBehind = behind === 8;
  out.anyBehind = behind > 0;
  out.minZ = minZ;
  out.maxAbsX = maxAbsX;
  out.maxAbsY = maxAbsY;
  return out;
}

export class SharedDisplayCalcs{
  private static instance: SharedDisplayCalcs;

  public lookupTable: Map<number,number>;
  public nDicoSet: Set<string> = new Set();
  public recalculateAll: boolean = false;
  public visibleRefs: Array<GraphObject> = [];
  /** Ids de modelo ya reportados como desconocidos (aviso unico por id). */
  public warnedUnknownModels: Set<string> = new Set();

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
    //camera.nearPlane (default 0.005): mismo valor que el depth range de la
    //GPU (Canvas.tsx). Antes 0.02 fijo: recortaba el suelo en escenas
    //escaladas muy pequenas (p.ej. habitaciones a radio 0.3 en la galeria).
    const NEAR_PLANE = Math.max(camera.nearPlane ?? 0.005, 0.0001);
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

        //*Modelos 3D (ModelObject): sin textura 2D; su tamano visible sale de
        //la caja/esfera del modelo. Carga perezosa (ModelManager): si el modelo
        //nunca se cargo no hay caja, y se pide por cercania al ojo (ver mas
        //abajo); si se cargo alguna vez su caja se recuerda y se pide al volver
        //a ser visible. Hasta estar en GPU queda pendiente de recalculo. Un id
        //que no existe se avisa UNA vez (los ids distinguen mayusculas).
        const modelManager = engine.modelManager;
        const modelId: string | null = (gObject as any)._model ?? null;
        const modelRadius = modelId ? modelManager.getBoundsRadius(modelId) : 0;
        const modelBoundsUnknown = !!modelId && modelRadius <= 0;
        if (modelBoundsUnknown && !modelManager.isKnown(modelId!) && !modelManager.isLoadedOrLoading(modelId!)) {
          const warned = SharedDisplayCalcs.getInstance().warnedUnknownModels;
          if (!warned.has(modelId!) && modelManager.hasIndex()) {
            warned.add(modelId!);
            console.error(`ModelObject '${gObject._id}': modelo '${modelId}' no esta en models.json. Disponibles: [${modelManager.indexedIds().join(", ")}]. Revisa game/models/models.json (ids case-sensitive).`);
          }
          gObject._pendingRenderingRecalculation = true;
          continue;
        }

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
        //*Escala modelo->mundo: fitRadius (radio deseado en unidades mundo,
        //util cuando el tamano real del modelo no se conoce al crearlo) o la
        //escala acumulada normal.
        const fitRadius: number = (gObject as any)._fitRadius ?? 0;
        const modelScale = modelId && fitRadius > 0 && modelRadius > 0
          ? (fitRadius / modelRadius) * parentScaleAccum
          : gObject._accomulatedScale;

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

        //*Modelo nunca cargado: sin caja todavia, se pide cuando su centro
        //esta cerca del ojo (lazyLoadDistance) y se espera a tenerlo.
        if (modelBoundsUnknown) {
          const ex = worldX + camCenterX - halfAspectWidth;
          const ey = worldY + camCenterY - cameraOriginY;
          const ez = worldZ + camCenterZ;
          if (Math.sqrt(ex * ex + ey * ey + ez * ez) <= modelManager.lazyLoadDistance) {
            modelManager.requestModel(modelId!);
          }
          gObject._pendingRenderingRecalculation = true;
          continue;
        }

        //*Modelos 3D: culling por su caja orientada, no por el centro. Coords
        //relativas al ojo (px = c0 + PL*(world + camCenter - origen optico)).
        //Con el ojo dentro de la caja nunca se descarta, mire donde mire.
        let box: ModelBoxView | null = null;
        if(modelId){
          const half = engine.modelManager.getBoundsHalfExtents(modelId);
          if(half){
            box = computeModelBox(
              half, modelScale,
              gObject._rotate, gObject._pitch, gObject._yaw,
              hasWorldRotation && !gObject._ignoreParallax, worldRoll, worldPitch, worldYaw,
              worldX + camCenterX - halfAspectWidth, worldY + camCenterY - cameraOriginY, worldZ + camCenterZ,
              NEAR_PLANE
            );
          }
        }

        const isBehindCamera = box
          ? (!box.inside && box.allBehind)
          : worldZ + camCenterZ < NEAR_PLANE;
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
          let meshPpu = 0;
          if(modelId){
            //1 unidad modelo = 1 unidad mundo; 1 unidad mundo = H px en orto.
            meshPpu = canvasResolutionHeight * modelScale;
            objectWidth = objectHeight = Math.max(modelRadius * 2 * meshPpu, 1);
          }

          const cornerX = objectLeft - objectWidth*0.5;
          const cornerY = objectTop - objectHeight*0.5;

          if(box){
            //*Modelo en orto: rectangulo de las esquinas de su caja (x1.5 por
            //el foreshorten local de la GPU). Ojo dentro: nunca se descarta.
            dimentionsPack.repeatPattern = false;
            dimentionsPack.meshScreenPx = Infinity;
            //LOD en orto: px por unidad modelo (x1.5: foreshorten local de la GPU)
            dimentionsPack.meshLodPx = box.inside ? 0 : canvasResolutionHeight*modelScale*1.5;
            if(!box.inside){
              const exX = box.maxAbsX*canvasResolutionHeight*1.5 + 2;
              const exY = box.maxAbsY*canvasResolutionHeight*1.5 + 2;
              if(objectLeft - exX > canvasResolutionWidth || objectTop - exY > canvasResolutionHeight ||
                 objectLeft + exX < 0 || objectTop + exY < 0){
                gObject._pendingRenderingRecalculation = true;
                continue;
              }
              //*Diminuto en pantalla: ni se dibuja ni se pide su carga.
              const screenPx = 2*Math.max(box.maxAbsX, box.maxAbsY)*canvasResolutionHeight;
              dimentionsPack.meshScreenPx = screenPx;
              if(screenPx < modelManager.minScreenPx){
                gObject._pendingRenderingRecalculation = true;
                continue;
              }
            }
          }else if(!gObject._repeatPattern){
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

          //*Visible pero aun no en GPU (expulsado o en carga): pedirlo y esperar.
          if(modelId && !modelManager.has(modelId)){
            modelManager.requestModel(modelId);
            gObject._pendingRenderingRecalculation = true;
            continue;
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
          dimentionsPack.meshPpu = meshPpu;
          dimentionsPack.meshView.k = 0;

        }else if(box){
          //*Modelo 3D en perspectiva. La GPU lo proyecta relativo al OJO (ver
          //meshView y el vertex shader de mallas), asi que funciona aunque el
          //centro quede tras la camara (camara dentro de una habitacion).
          //S(Z) = toAdd*(1/Z - invFar)/(1 - invFar) es la misma escala que
          //perspectiveDiff*toAddSizeHelper; K = px por unidad a Z = 1.
          const relX = worldX + camCenterX - halfAspectWidth;
          const relY = worldY + camCenterY - cameraOriginY;
          const objectZ = worldZ + camCenterZ;
          const invFar = 1/camera.maxZ;
          const K = canvasResolutionHeight*toAddSizeHelper/(1 - invFar);
          const c0x = canvasResolutionWidth*0.5;
          const c0y = canvasResolutionHeight*cameraOriginY;

          //Tamano proyectado (lado mayor del rectangulo de la caja, px).
          //Infinity = ojo dentro o caja cruzando el plano cercano (no aplica).
          dimentionsPack.meshScreenPx = Infinity;
          //*LOD: px por unidad modelo en la ESQUINA MAS CERCANA de la caja
          //(conservador: en escenas grandes vistas de cerca, lo proximo al ojo
          //se ve mas grande que el centro). 0 = nivel original (ojo dentro o
          //caja cruzando el plano cercano).
          dimentionsPack.meshLodPx = (!box.inside && !box.anyBehind)
            ? K*(1/box.minZ - invFar)*modelScale
            : 0;
          if(!box.inside){
            //Lejos: hasta la esquina mas cercana es diminuta.
            if(!box.anyBehind && toAddSizeHelper*(1/box.minZ - invFar)/(1 - invFar) <= 0.003){
              gObject._pendingRenderingRecalculation = true;
              continue;
            }
            //Fuera de pantalla: rectangulo de las 8 esquinas proyectadas. Si la
            //caja cruza el plano cercano no se proyecta (conservador: se dibuja).
            if(!box.anyBehind){
              let minPx = Infinity, maxPx = -Infinity, minPy = Infinity, maxPy = -Infinity;
              for (let i = 0; i < 8; i++) {
                const f = K*(1/(objectZ + box.oz[i]) - invFar);
                const px = c0x + (relX + box.ox[i])*f;
                const py = c0y + (relY + box.oy[i])*f;
                if(px < minPx) minPx = px;
                if(px > maxPx) maxPx = px;
                if(py < minPy) minPy = py;
                if(py > maxPy) maxPy = py;
              }
              if(minPx > canvasResolutionWidth || minPy > canvasResolutionHeight || maxPx < 0 || maxPy < 0){
                gObject._pendingRenderingRecalculation = true;
                continue;
              }
              //*Diminuto en pantalla (< minScreenPx): ni se dibuja ni se pide su
              //carga. Un modelo de pocos px cuesta lo mismo que a pantalla
              //completa (todos sus triangulos) y no aporta nada visible.
              const screenPx = Math.max(maxPx - minPx, maxPy - minPy);
              dimentionsPack.meshScreenPx = screenPx;
              if(screenPx < modelManager.minScreenPx){
                gObject._pendingRenderingRecalculation = true;
                continue;
              }
            }
          }

          //*Visible pero aun no en GPU (expulsado o en carga): pedirlo y esperar.
          if(!modelManager.has(modelId!)){
            modelManager.requestModel(modelId!);
            gObject._pendingRenderingRecalculation = true;
            continue;
          }

          //Datos de pantalla del centro (orden, depuracion, texto). Con el
          //centro tras el plano cercano no hay proyeccion: valores neutros.
          const centerVisible = objectZ > NEAR_PLANE;
          const pl = centerVisible ? K*(1/objectZ - invFar) : 0;
          perspectiveScale = centerVisible ? pl/canvasResolutionHeight : 1;
          const meshPpu = centerVisible ? pl*modelScale : 1;
          const objectLeft = centerVisible ? c0x + relX*pl : c0x;
          const objectTop = centerVisible ? c0y + relY*pl : canvasResolutionHeight*0.5;
          const objectSize = centerVisible ? Math.max(modelRadius*2*meshPpu, 1) : canvasResolutionWidth;

          dimentionsPack.repeatPattern = false;
          dimentionsPack.x  = objectLeft;
          dimentionsPack.y  = objectTop;
          dimentionsPack.z  = objectZ;
          dimentionsPack.corner.x = objectLeft - objectSize*0.5;
          dimentionsPack.corner.y = objectTop - objectSize*0.5;

          dimentionsPack.base.x = worldX;
          dimentionsPack.base.y = worldY;
          dimentionsPack.base.z = worldZ;

          dimentionsPack.sizeInDisplay  = perspectiveScale;
          dimentionsPack.width  = objectSize;
          dimentionsPack.height  = objectSize;

          dimentionsPack.rotation = gObject._rotate;
          dimentionsPack.pitch = gObject._pitch;
          dimentionsPack.yaw = gObject._yaw;
          dimentionsPack.roll = gObject._rotate;
          dimentionsPack.ignoreWorldRotation = gObject._ignoreParallax ? 1 : 0;
          dimentionsPack.perspDepth.z = objectZ;
          dimentionsPack.perspDepth.p = pl;
          dimentionsPack.meshPpu = meshPpu;
          dimentionsPack.meshView.x = relX;
          dimentionsPack.meshView.y = relY;
          dimentionsPack.meshView.z = objectZ;
          dimentionsPack.meshView.k = K;
          dimentionsPack.meshView.s = modelScale;

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
          let meshPpu = 0;
          if(modelId){
            //perspectiveLayer = px por unidad mundo a esta profundidad;
            //objectScale ya incluye perspectiveScale: usar la base acumulada.
            meshPpu = perspectiveLayer * gObject._accomulatedScale;
            objectWidth = objectHeight = Math.max(modelRadius * 2 * meshPpu, 1);
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
          dimentionsPack.meshPpu = meshPpu;
        }

        //Renderers key per-object GPU resources (text textures) by this id
        dimentionsPack.id = gObject._id;

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
          }else{
            //Layout is computed per frame by the renderer; drop any stale fitContent layout
            dimentionsPack.text.value = null;
          }
        }else{
          dimentionsPack.text.value = null;
        }
        nDicoSet.add(gObject._id);
        visibleRefsOut.push(gObject);

        //Dynamic texts (lambdas / template literals) can change without touching the proxy,
        //so a fitContent box must be re-laid out every frame
        gObject._pendingRenderingRecalculation = gObject._fitContent && gObject._text !== null &&
          (typeof gObject._text == "function" || (typeof gObject._text == "string" && gObject._text.includes("${")));

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
