import { Dictionary } from "../../global.ts";
import { ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import GraphObject from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";
import { CalculationOrder } from "./RenderEngine.d.tsx";

/**
 * Genera el orden de renderización de los elementos en pantalla tomando en cuenta el valor z
 */
function old_generateCalculationOrder(graphArray:RenList<GraphObject>){
  var ordered = 0;
  var order:CalculationOrder = [];
  var dictionary:Dictionary<boolean> = {};
  var orderList:Array<string> = [];

  const allIds = graphArray.ids();

  while (ordered < graphArray.length) {
    allIds.forEach(id=>{
      if(!dictionary[id]){
        const gObject = graphArray.get(id);
        const parent = gObject.parent;
        //No parent, or parent dont exist, or parent not enabled
        if(!parent || !(graphArray.get(parent)?.enabled)){
          order.push({id:id,weight:0,z:gObject.z});
          gObject.accomulatedZ = gObject.z;
          orderList.push(id);
          dictionary[id] = true;
          ordered++;
        }else if(dictionary[parent]){
          const gParent = graphArray.get(parent);
          if(gParent.pendingRenderingRecalculation){
            gObject.pendingRenderingRecalculation = true;
          }
          const elementZ = gObject.z + gParent.accomulatedZ;
          gObject.accomulatedZ = elementZ;
          order.push({id,weight:order[orderList.indexOf(parent)].weight +1, z:elementZ});
          orderList.push(id);
          dictionary[id] = true;
          ordered++;
        }
      }
    });
  }
  return order;
}
/**
 * Genera el orden de renderización de los elementos en pantalla tomando en cuenta el valor z
 */
function generateCalculationOrder(graphArray: RenList<GraphObject>) {
  const order: CalculationOrder = [];
  const processed = new Set<string>();
  const orderMap = new Map<string, number>(); // id -> index in order array
  
  // Get all IDs once
  const allIds = graphArray.ids();
  const totalItems = allIds.length;
  
  // Queue for items ready to process
  let unprocessedIds = new Set(allIds);
  
  while (processed.size < totalItems) {
    const previousSize = processed.size;
    
    // Create array from remaining items to avoid modifying Set during iteration
    const toCheck = Array.from(unprocessedIds);
    
    for (const id of toCheck) {
      const gObject = graphArray.get(id);
      if (!gObject) continue;
      
      const parent = gObject.parent;
      const parentObj = parent ? graphArray.get(parent) : null;
      
      // Can process if: no parent, parent disabled, or parent already processed
      const canProcess = !parent || !parentObj?.enabled || processed.has(parent);
      
      if (canProcess) {
        let accumulatedZ: number;
        let weight: number;
        
        if (!parent || !parentObj?.enabled) {
          // Root element or orphan
          accumulatedZ = gObject.z;
          weight = 0;
        } else {
          // Has valid parent that's been processed
          const parentIndex = orderMap.get(parent)!;
          accumulatedZ = gObject.z + parentObj.accomulatedZ;
          weight = order[parentIndex].weight + 1;
          
          if (parentObj.pendingRenderingRecalculation) {
            gObject.pendingRenderingRecalculation = true;
          }
        }
        
        gObject.accomulatedZ = accumulatedZ;
        
        const currentIndex = order.length;
        order.push({ id, weight, z: accumulatedZ });
        orderMap.set(id, currentIndex);
        
        processed.add(id);
        unprocessedIds.delete(id);
      }
    }
    
    // Deadlock detection: if no progress was made, we have circular dependencies
    if (processed.size === previousSize) {
      console.error('Circular dependency detected in graph hierarchy');
      // Process remaining items as roots
      for (const id of unprocessedIds) {
        const gObject = graphArray.get(id);
        if (gObject) {
          gObject.accomulatedZ = gObject.z;
          order.push({ id, weight: 0, z: gObject.z });
        }
      }
      break;
    }
  }
  
  return order;
}
/**
 * Aplana la el CalculationOrder para generar un array de los id de los elementos
 * ordenado segun el orden de renderización de los elementos
 * @param calculationOrder 
 * @returns 
 */
function old_arrayiseTree(calculationOrder:CalculationOrder){
  var base ={};
  var arr = [];
  calculationOrder.map(element=>{
    if(!(element.weight in base)){
      Object.assign(base,{[element.weight]:[]});
    }
    base[element.weight].push(element.id);
  });
  for (const weight in base) {
    arr = arr.concat(base[weight]);
  }
  return arr;
}

/**
 * Aplana el CalculationOrder para generar un array de los id de los elementos
 * ordenado según el orden de renderización de los elementos
 * @param calculationOrder 
 * @returns 
 */
function arrayiseTree(calculationOrder: CalculationOrder) {
  if (calculationOrder.length === 0) return [];
  
  // Sort by weight first, then by z-index
  const sorted = calculationOrder.sort((a, b) => {
    if (a.weight !== b.weight) {
      return a.weight - b.weight;
    }
    return a.z - b.z; // Sort by z within same weight
  });
  
  // Extract IDs
  return sorted.map(element => element.id);
}



function old_generateRenderingOrder(dimentionsPack:Record<string,ObjectRenderingData>){
  var zRefs:{[z:string]:Array<string>} = {};
  var zetas:Array<number> = [];
  var renderingOrderById:Array<string> = [];
  Object.keys(dimentionsPack).forEach(id=>{
    const z:string = dimentionsPack[id].z.toString(); 
      if(zRefs[z] == undefined){ //Element with name z is not in objectZrefs
        Object.assign(zRefs,{[z]:[id]});
        zetas.push(parseFloat(z))
      }else{
        zRefs[z].push(id);
      }
  });
  zetas.sort((a, b) => b - a).forEach(zIndex => {
    zRefs[zIndex.toString()].forEach((id:string) => {
      renderingOrderById.push(id);
    });
  });
  return renderingOrderById;
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


export {generateCalculationOrder, arrayiseTree, generateRenderingOrder}