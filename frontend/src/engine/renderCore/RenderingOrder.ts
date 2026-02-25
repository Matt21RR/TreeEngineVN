import { ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import GraphObject from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";

//export type CalculationOrder = {id:string,weight:number,z:number}[];
type CalculationOrder = [string,number,number][];

function _deepRootSearch(
    graphObject: GraphObject, 
    generalOrder: CalculationOrder, 
    generalOrderMap: Map<string, number>, 
    visited: CalculationOrder = []): [number, number, CalculationOrder] {
  //if the parent is not in the generalOrderMap, we need to go up the tree until we find a parent that is in the generalOrderMap or we reach a root element (no parent)
  const isInGeneralOrder = generalOrderMap.has(graphObject.parentRef?.id || "");

  if(graphObject.parentRef && !isInGeneralOrder){
    const [levels, z, newVisited] = _deepRootSearch(graphObject.parentRef, generalOrder, generalOrderMap, visited);

    newVisited.push([graphObject.id, levels, graphObject.z]);
    graphObject.accomulatedZ = graphObject.z + z;
    return [levels + 1, z + graphObject.z, newVisited];

  //if the parent is in the generalOrderMap, we can calculate the weight and z based on the parent's data
  }else if(graphObject.parentRef && isInGeneralOrder){
    const parentIndex = generalOrderMap.get(graphObject.parentRef.id);
    const parentData = generalOrder[parentIndex];

    visited.push([graphObject.id, parentData[1] + 1, graphObject.z + parentData[2]]);
    graphObject.accomulatedZ = graphObject.z + parentData[2];
    return [parentData[1] + 1, graphObject.z + parentData[2], visited];

  }else {
    visited.push([graphObject.id, 0, graphObject.z]);
    graphObject.accomulatedZ = graphObject.z;
    return [0, graphObject.z, visited]; //Root element has weight 0 and its own z
  }
}

function generateCalculationOrder(graphArray: RenList<GraphObject>) {
  let final: Array<string> = [];
  const order: CalculationOrder = [];
  let processedCount = 0;
  const orderMap = new Map<string, number>(); // id -> index in order array
  
  // Get all IDs once
  const allIds = graphArray.enabledIds;
  const totalItems = allIds.length;
  
  // Queue for items ready to process
  let unprocessedIds = new Set(allIds);

  let graphObject: GraphObject;
  let parentRef: GraphObject | undefined;
  let currentIndex: number;
  
  while (processedCount < totalItems) {
    graphObject = graphArray.fastGet(unprocessedIds.values().next().value);
    if (!graphObject) continue;

    parentRef = graphObject.parentRef;

    if(parentRef){
      const [_,__,branchToParentRoot] = _deepRootSearch(graphObject, order, orderMap);
      //*Process branch to root, adding elements to order if they haven't been processed yet
      branchToParentRoot.forEach(element => {
        currentIndex = order.length;
        order.push(element);
        final.push(element[0]);
        orderMap.set(element[0], currentIndex);
        processedCount++;
        unprocessedIds.delete(element[0]);

        //Note: The accomulatedZ of each element is calculated in the _deepRootSearch function,
        // so update that value in that function to avoid having to recalculate it here, since 
        // we already accesing to the element in that function
      });
    }else{
      currentIndex = order.length;
      order.push([graphObject.id, 0, graphObject.z]);
      final.push(graphObject.id);
      orderMap.set(graphObject.id, currentIndex);
      processedCount++;
      unprocessedIds.delete(graphObject.id);

      graphObject.accomulatedZ = graphObject.z;
    }
  }

  return final;
}

/**
 * Aplana el CalculationOrder para generar un array de los id de los elementos
 * ordenado según el orden de renderización de los elementos (primero los padres, 
 * luego los hijos, y dentro de cada grupo ordenados por z)
 * @param calculationOrder 
 * @returns 
 */
function arrayiseTree(calculationOrder: CalculationOrder) {
  if (calculationOrder.length === 0) return [];

  // Sort by weight first, then by z-index
  const sorted = calculationOrder.sort((a, b) => {
    if (a[1] !== b[1]) {
      // Sort by weight ascending (parents before children)
      return a[1] - b[1];
    }
    return a[2] - b[2]; // Sort by z within same weight
  });
  
  // Extract IDs
  return sorted.map(element => element[0]);
}

function generateRenderingOrder(dimentionsPack: Record<string, ObjectRenderingData>) {
  const ids = Object.keys(dimentionsPack);
  
  if (ids.length === 0) return [];
  
  // Group by z-index using Map (preserves numeric keys)
  const zGroups = new Map<number, string[]>();
  
  for (const id of ids) {
    const z = dimentionsPack[id].z;
    const group = zGroups.get(z);
    
    if (group) {
      group.push(id);
    } else {
      zGroups.set(z, [id]);
    }
  }
  
  // Sort z-indices descending and flatten
  return Array.from(zGroups.entries())
    .sort((a, b) => b[0] - a[0]) // Sort by z-index descending
    .flatMap(([_, ids]) => ids);  // Extract all IDs in order
}

function generateRenderingOrder_(graphArray: RenList<GraphObject>) {
  if (graphArray.enabledIds.length === 0) return [];
  
  // Group by z-index using Map (preserves numeric keys)
  const zGroups = new Map<number, string[]>();
  for (const graphObject of graphArray.enabledList()) {
    const z = graphObject.dimentionsPack.z;
    const group = zGroups.get(z);
    
    if (group) {
      group.push(graphObject.id);
    } else {
      zGroups.set(z, [graphObject.id]);
    }
  }
  
  // Sort z-indices descending and flatten
  return Array.from(zGroups.entries())
    .sort((a, b) => b[0] - a[0]) // Sort by z-index descending
    .flatMap(([_, ids]) => ids);  // Extract all IDs in order
}

export {generateCalculationOrder, arrayiseTree, generateRenderingOrder}