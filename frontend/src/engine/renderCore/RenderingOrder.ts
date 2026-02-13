import GraphObject from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";
import { CalculationOrder } from "./RenderEngine.d.tsx";

function _deepRootSearch(
    graphObject: GraphObject, 
    generalOrder: CalculationOrder, 
    generalOrderMap: Map<string, number>, 
    visited: CalculationOrder = []): [number, number, CalculationOrder] {

  //TODO: Accelerate this function by using a cache to store previously calculated paths to root for each id, so we don't have to recalculate the same paths multiple times
  //if the parent is not in the generalOrderMap, we need to go up the tree until we find a parent that is in the generalOrderMap or we reach a root element (no parent)
  const isInGeneralOrder = generalOrderMap.has(graphObject.parentRef?.id || "");

  if(graphObject.parentRef && !isInGeneralOrder){
    const [levels, z, newVisited] = _deepRootSearch(graphObject.parentRef, generalOrder, generalOrderMap, visited);

    newVisited.push({id: graphObject.id, weight: levels, z: graphObject.z});
    graphObject.accomulatedZ = graphObject.z + z;
    return [levels + 1, z + graphObject.z, newVisited];

  //if the parent is in the generalOrderMap, we can calculate the weight and z based on the parent's data
  }else if(graphObject.parentRef && isInGeneralOrder){
    const parentIndex = generalOrderMap.get(graphObject.parentRef.id);
    const parentData = generalOrder[parentIndex];

    visited.push({id: graphObject.id, weight: parentData.weight + 1, z: graphObject.z + parentData.z});
    graphObject.accomulatedZ = graphObject.z + parentData.z;
    return [parentData.weight + 1, graphObject.z + parentData.z, visited];

  }else {
    visited.push({id: graphObject.id, weight: 0, z: graphObject.z});
    graphObject.accomulatedZ = graphObject.z;
    return [0, graphObject.z, visited]; //Root element has weight 0 and its own z
  }
}

function generateCalculationOrder(graphArray: RenList<GraphObject>) {
  const order: CalculationOrder = [];
  const processed = new Set<string>();
  const orderMap = new Map<string, number>(); // id -> index in order array
  
  // Get all IDs once
  const allIds = graphArray.ids();
  const totalItems = allIds.length;
  
  // Queue for items ready to process
  let unprocessedIds = new Set(allIds);

  const iterator = unprocessedIds.values();
  
  while (processed.size < totalItems) {
    const graphObject = graphArray.get(iterator.next().value);
    if (!graphObject) continue;

    const parentRef = graphObject.parentRef;

    if(parentRef){
      const [_,__,branchToParentRoot] = _deepRootSearch(graphObject, order, orderMap);
      //*Process branch to root, adding elements to order if they haven't been processed yet
      branchToParentRoot.forEach(element => {
        const currentIndex = order.length;
        order.push(element);
        orderMap.set(element.id, currentIndex);
        processed.add(element.id);
        unprocessedIds.delete(element.id);

        //Note: The accomulatedZ of each element is calculated in the _deepRootSearch function,
        // so update that value in that function to avoid having to recalculate it here, since 
        // we already accesing to the element in that function
      });
    }else{
      const currentIndex = order.length;
      order.push({id: graphObject.id, weight: 0, z: graphObject.z});
      orderMap.set(graphObject.id, currentIndex);
      processed.add(graphObject.id);
      unprocessedIds.delete(graphObject.id);

      graphObject.accomulatedZ = graphObject.z;
    }
  }

  return order;
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
    if (a.weight !== b.weight) {
      // Sort by weight ascending (parents before children)
      return a.weight - b.weight;
    }
    return a.z - b.z; // Sort by z within same weight
  });
  
  // Extract IDs
  return sorted.map(element => element.id);
}

function generateRenderingOrder(graphArray: RenList<GraphObject>) {
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