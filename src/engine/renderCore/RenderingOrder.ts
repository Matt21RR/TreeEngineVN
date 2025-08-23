import { ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import { GraphObject } from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList";
import { CalculationOrder } from "./RenderEngine.d.tsx";

/**
 * Genera el orden de renderización de los elementos en pantalla tomando en cuenta el valor z
 */
function generateCalculationOrder(graphArray:RenList<GraphObject>){
  var ordered = 0;
  var order:CalculationOrder = [];
  var dictionary:Array<string> = [];
  while (ordered < graphArray.length) {
    graphArray.ids().forEach(id=>{
      if(dictionary.indexOf(id) == -1){
        const gObject = graphArray.get(id);
        const parent = gObject.parent;
        if(parent == "" || !graphArray.exist(parent) || (parent != "" && !graphArray.get(parent).enabled)){
          order.push({id:id,weight:0,z:gObject.z});
          gObject.accomulatedZ = gObject.z;
          dictionary.push(id);
          ordered++;
        }else if(dictionary.indexOf(parent) != -1){
          const gParent = graphArray.get(parent);
          if(gParent.pendingRenderingRecalculation){
            gObject.pendingRenderingRecalculation = true;
          }
          const elementZ = gObject.z + gParent.accomulatedZ;
          gObject.accomulatedZ = elementZ;
          order.push({id,weight:order[dictionary.indexOf(parent)].weight +1, z:elementZ});
          dictionary.push(id);
          ordered++;
        }
      }
    });
  }
  return order;
}
function arrayiseTree(calculationOrder:CalculationOrder){
  //TODO: I don't remember what this funcion does 
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

function generateRenderingOrder(dimentionsPack:Record<string,ObjectRenderingData>){
  var zRefs = {};
  var zetas:Array<number> = [];
  var renderingOrderById:Array<string> = [];
  Object.keys(dimentionsPack).forEach(id=>{
    const z:string = dimentionsPack[id].z.toString(); 
      if(Object.keys(zRefs).indexOf(z) == -1){
        Object.assign(zRefs,{[z]:[id]});
        zetas.push(parseFloat(z))
      }else{
        zRefs[z].push(id);
      }
  });
  zetas.sort((a, b) => a - b).reverse().forEach(zIndex => {
    zRefs[zIndex.toString()].forEach((id:string) => {
      renderingOrderById.push(id);
    });
  });
  return renderingOrderById;
}


export {generateCalculationOrder, arrayiseTree, generateRenderingOrder}