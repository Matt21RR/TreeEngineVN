import { ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import GraphObject from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";

export type CalculationOrder = Array<string>;
// type CalculationOrder = [string,number,number][];

function _deepRootSearch(
    graphObject: GraphObject, 
    generalIdMap: Array<string>, 
    visited: CalculationOrder = []): CalculationOrder {
  //if the parent is not in the generalOrderMap, we need to go up the tree until we find a parent that is in the generalOrderMap or we reach a root element (no parent)
  const isInGeneralOrder = generalIdMap.includes(graphObject.parentRef?.id || "");

  if(graphObject.parentRef && !isInGeneralOrder){
    const newVisited = _deepRootSearch(graphObject.parentRef, generalIdMap, visited);

    newVisited.push(graphObject.id);
    graphObject.accomulatedZ = graphObject.z + graphObject.parentRef.accomulatedZ;
    return newVisited;

  //if the parent is in the generalOrderMap, we can calculate the weight and z based on the parent's data
  }else if(graphObject.parentRef && isInGeneralOrder){
    const parentData = graphObject.parentRef;

    visited.push(graphObject.id);
    graphObject.accomulatedZ = graphObject.z + parentData.accomulatedZ;
    return visited;

  }else { //Root element, no parent
    visited.push(graphObject.id);
    graphObject.accomulatedZ = graphObject.z;
    return visited; //Root element has weight 0 and its own z
  }
}

function generateCalculationOrder(graphArray: RenList<GraphObject>) {
  let final: Array<string> = [];
  let processedCount = 0;
  const orderMap = new Map<string, number>(); // id -> index in order array
  
  // Get all IDs once
  const allIds = graphArray.enabledIds;
  const totalItems = allIds.length;
  
  // Queue for items ready to process
  // let unprocessedIds = new Set(allIds);
  let unprocessedIds = [...allIds]

  let graphObject: GraphObject;
  let currentIndex: number;
  
  while (processedCount < totalItems) {
    // graphObject = graphArray.fastGet(unprocessedIds.values().next().value);
    graphObject = graphArray.fastGet(unprocessedIds[0]);
    // if (!graphObject) continue;

    if(graphObject.parentRef){
      const branchToParentRoot = _deepRootSearch(graphObject, final);
      //*Process branch to root, adding elements to order if they haven't been processed yet
      branchToParentRoot.forEach(element => {
        currentIndex = final.length;
        final.push(element);
        processedCount++;
        unprocessedIds.splice(unprocessedIds.indexOf(element),1);

        //Note: The accomulatedZ of each element is calculated in the _deepRootSearch function,
        // so update that value in that function to avoid having to recalculate it here, since 
        // we already accesing to the element in that function
      });
    }else{
      currentIndex = final.length;
      final.push(graphObject.id);
      processedCount++;

      unprocessedIds.splice(0,1);

      graphObject.accomulatedZ = graphObject.z;
    }
  }

  return final;
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

export {generateCalculationOrder, generateRenderingOrder}