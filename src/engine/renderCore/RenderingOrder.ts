import { ObjectRenderingData } from "../engineComponents/CollisionLayer.ts";
import { GraphObject } from "../engineComponents/GraphObject.ts";
import RenList from "../engineComponents/RenList.ts";
import { CalculationOrder } from "./RenderEngine.d.tsx";

/**
 * Genera el orden de renderización de los elementos en pantalla tomando en cuenta el valor z
 */
function generateCalculationOrder(graphArray:RenList<GraphObject>){
  var ordered = 0;
  var order:CalculationOrder = [];
  var dictionary:Array<string> = [];
  var orderList:Array<string> = [];
  while (ordered < graphArray.length) {
    graphArray.ids().forEach(id=>{
      if(!dictionary[id]){
        const gObject = graphArray.get(id);
        const parent = gObject.parent;
        //No parent, or parent dont exist, or parent not enabled
        if(parent == "" || !(graphArray.get(parent)?.enabled)){
          order.push({id:id,weight:0,z:gObject.z});
          gObject.accomulatedZ = gObject.z;
          orderList.push(id);
          dictionary[id] = true;
          ordered++;
        }else if(!dictionary[parent]){
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


export {generateCalculationOrder, arrayiseTree, generateRenderingOrder}