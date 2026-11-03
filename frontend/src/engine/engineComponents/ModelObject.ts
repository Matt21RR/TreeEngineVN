import { Dictionary } from "../../global.ts"
import GraphObject from "./GraphObject.ts"

/**
 * Objeto grafico 3D: referencia un modelo GLB estatico del ModelManager
 * en vez de una textura 2D. Hereda posicion/rotacion/escala/padre/
 * opacidad/animaciones de GraphObject; el renderizado va por el pipeline
 * `mesh` (unlit) y NO participa en colisiones (decision D4).
 *
 * Convencion de escala: 1 unidad del modelo = 1 unidad mundo del engine
 * (igual que `useEngineUnits` en sprites). `widthScale`/`heightScale` no
 * deforman la malla (escala rigida); usar `scale`.
 */
class ModelObject extends GraphObject{
  static readonly dataTypes = {
    ...(GraphObject as any).dataTypes,
    model: ["string", "null"],
    fitRadius: ["number", "null"],
  }

  _model: string | null;
  //*Radio deseado en unidades mundo (sustituye a scale): el modelo se escala
  //para medir esto sea cual sea su tamano real. null/0 = usar scale.
  _fitRadius: number | null;

  constructor(graphInfo: Dictionary = {}){
    super(graphInfo);
    this._model = graphInfo.model ?? null;
    this._fitRadius = graphInfo.fitRadius ?? null;
  }

  get fitRadius() { return this._fitRadius; }
  set fitRadius(x) {
    const v = x == undefined ? null : Number(x);
    this._fitRadius = v != null && Number.isFinite(v) && v > 0 ? v : null;
  }

  get model() { return this._model; }
  set model(x) {
    const newName = (x != undefined) ? x : null;
    if (this._model !== newName) {
      this._model = newName;
    }
  }

  clone(cloneId: string){
    if(!cloneId)
      throw new Error("the id for the clonning operation that uses the object with id '"+this._id+"' is not defined");
    const graphData = this.dump();
    Object.assign(graphData,{id:cloneId});
    return new ModelObject(graphData);
  }
}

export default ModelObject
