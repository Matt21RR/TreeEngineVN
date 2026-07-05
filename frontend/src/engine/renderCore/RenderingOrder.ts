import { ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import GraphObject from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";

export type CalculationOrder = Array<string>;

function _deepRootSearch(
    graphObject: GraphObject, 
    generalIdMap: Set<string>, 
    visited: CalculationOrder = []): CalculationOrder {
  //if the parent is not in the generalOrderMap, we need to go up the tree until we find a parent that is in the generalOrderMap or we reach a root element (no parent)
  const isInGeneralOrder = generalIdMap.has(graphObject.parentRef?.id || "");

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

function generateCalculationOrder(graphArray: RenList<GraphObject>): CalculationOrder {
  const allIds = graphArray.enabledIds;
  const totalItems = allIds.length;

  // Pre-size the output array instead of growing it with push()
  const final: CalculationOrder = new Array(totalItems);
  let writeIndex = 0;

  // Single Set instead of finalIdSet + unprocessedIds
  const processed = new Set<string>();

  // Reused scratch stack, avoids per-branch array allocation
  const stack: GraphObject[] = [];

  for (let i = 0; i < totalItems; i++) {
    const startId = allIds[i];
    if (processed.has(startId)) continue;

    // Walk up the parent chain iteratively (no recursion, no stack-depth limit)
    stack.length = 0;
    let current: GraphObject | undefined = graphArray.fastGet(startId);

    while (current && !processed.has(current.id)) {
      stack.push(current);
      current = current.parentRef as GraphObject | undefined;
    }

    // `current` is either undefined (we bottomed out at a root) or an
    // already-processed ancestor whose accomulatedZ is already final.
    let parentZ = current ? current.accomulatedZ : 0;

    // Unwind from closest-to-root down to startId so each node can use
    // its parent's just-computed accomulatedZ.
    for (let j = stack.length - 1; j >= 0; j--) {
      const node = stack[j];
      node.accomulatedZ = node.z + parentZ;
      parentZ = node.accomulatedZ;

      processed.add(node.id);
      final[writeIndex++] = node.id;
    }
  }

  return final;
}

function generateRenderingOrder(dimentionsPack: Record<string, ObjectRenderingData>) {
  const ids = Object.keys(dimentionsPack);
  if (ids.length === 0) return [];

  // Sort directly on the array. V8 can optimize this much better 
  // than the Map -> Array.from -> flatMap pipeline.
  return ids.sort((a, b) => {
    return dimentionsPack[b].z - dimentionsPack[a].z;
  });
}

export {generateCalculationOrder, generateRenderingOrder}