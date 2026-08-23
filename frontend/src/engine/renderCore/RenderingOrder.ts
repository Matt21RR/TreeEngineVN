import { ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import GraphObject from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";

export type CalculationOrder = Array<GraphObject>;

function asRaw(node: any): GraphObject {
  return node._rawSelf ?? node;
}

const orderCache: {
  source: RenList<GraphObject> | null;
  version: number;
  order: CalculationOrder;
} = { source: null, version: -1, order: [] };

const stamps = { arr: new Uint32Array(1024), counter: 0 };

function ensureStampCapacity(size: number) {
  if (stamps.arr.length >= size) return;
  let cap = stamps.arr.length;
  while (cap < size) cap *= 2;
  stamps.arr = new Uint32Array(cap);
  stamps.counter = 0;
}

/**
 * Genera el orden de calculo como referencias directas a los GraphObject.
 * El resultado se cachea y solo se regenera cuando cambia la estructura del
 * arbol (push/remove/wipe/enabled/parent/z). La iteracion parte de
 * enabledIds para respetar exactamente el orden historico.
 */
function generateCalculationOrder(graphArray: RenList<GraphObject>): CalculationOrder {
  const version = graphArray.structureVersion;
  if (orderCache.source === graphArray && orderCache.version === version) {
    return orderCache.order;
  }

  const enabledIds = graphArray.enabledIds;
  const totalItems = enabledIds.length;

  ensureStampCapacity(graphArray.objects.length + 1);
  const stampArr = stamps.arr;
  const stampId = ++stamps.counter;

  const final: CalculationOrder = [];
  const stack: GraphObject[] = [];

  for (let i = 0; i < totalItems; i++) {
    const startNode = asRaw(graphArray.fastGet(enabledIds[i]));
    const startHandle = startNode._renHandle;
    if (startHandle >= 0 && stampArr[startHandle] === stampId) continue;

    stack.length = 0;
    let current: GraphObject | null | undefined = startNode;

    while (current) {
      const rawCur = asRaw(current);
      const h = rawCur._renHandle;
      if (h >= 0 && stampArr[h] === stampId) break;
      stack.push(rawCur);
      current = rawCur._parentRef;
    }

    let parentZ = current ? asRaw(current)._accomulatedZ : 0;

    for (let j = stack.length - 1; j >= 0; j--) {
      const node = stack[j];
      node._accomulatedZ = node._z + parentZ;
      parentZ = node._accomulatedZ;

      const nh = node._renHandle;
      if (nh >= 0 && nh < stampArr.length) stampArr[nh] = stampId;
      final.push(node);
    }
  }

  orderCache.source = graphArray;
  orderCache.version = version;
  orderCache.order = final;
  return final;
}

/**
 * Variante por referencias: ordena in-place el array de refs visibles por z
 * (descendente, desempate estable por insercion) y devuelve un array nuevo
 * con los ids en el mismo orden.
 */
function generateRenderingOrderFromRefs(refs: Array<GraphObject>): Array<string> {
  const zs: number[] = new Array(refs.length);
  for (let i = 0; i < refs.length; i++) {
    zs[i] = refs[i].dimentionsPack.z;
  }
  const idx: number[] = new Array(refs.length);
  for (let i = 0; i < refs.length; i++) idx[i] = i;
  idx.sort((a, b) => (zs[b] - zs[a]) || (a - b));

  const sortedRefs: Array<GraphObject> = new Array(refs.length);
  const ids: Array<string> = new Array(refs.length);
  for (let j = 0; j < refs.length; j++) {
    const r = refs[idx[j]];
    sortedRefs[j] = r;
    ids[j] = r.id;
  }
  //Se devuelve tambien via mutacion del array entrante (scratch del caller)
  for (let j = 0; j < refs.length; j++) refs[j] = sortedRefs[j];
  return ids;
}

/**
 * Variante legacy por diccionario id->pack. Mismo resultado estable que la
 * implementacion original, pero comparando numeros en vez de hacer dos
 * lookups por diccionario en cada comparacion.
 */
function generateRenderingOrder(dimentionsPack: Record<string, ObjectRenderingData>): Array<string> {
  const ids = Object.keys(dimentionsPack);
  const n = ids.length;
  if (n === 0) return ids;

  const zs: number[] = new Array(n);
  for (let i = 0; i < n; i++) zs[i] = dimentionsPack[ids[i]].z;

  const idx: number[] = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  idx.sort((a, b) => (zs[b] - zs[a]) || (a - b));

  const out: Array<string> = new Array(n);
  for (let j = 0; j < n; j++) out[j] = ids[idx[j]];
  return out;
}

export {generateCalculationOrder, generateRenderingOrder, generateRenderingOrderFromRefs}
