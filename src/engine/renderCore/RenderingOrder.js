import { GraphObject } from "../engineComponents/GraphObject";
import RenList from "../engineComponents/RenList.ts";

/**
 * Genera el orden de renderización de los elementos en pantalla tomando en cuenta el valor z
 */
function generateCalculationOrder(graphArray = new RenList(GraphObject)){
  var ordered = 0;
  var order = [];
  var dictionary = [];
  while (ordered < graphArray.length) {
    graphArray.ids().forEach(id=>{
      if(dictionary.indexOf(id) == -1){
        const gObject = graphArray.get(id);
        const parent = gObject.parent;
        if(parent == ""){
          order.push({id:id,weight:0,z:gObject.z});
          gObject.accomulatedZ = gObject.z;
          dictionary.push(id);
          ordered++;
        }
        if(dictionary.indexOf(parent) != -1){
          if(graphArray.get(parent).pendingRenderingRecalculation){
            graphArray.get(id).pendingRenderingRecalculation = true;
          }
          order.push({id,weight:order[dictionary.indexOf(parent)].weight +1});
          gObject.accomulatedZ = gObject.z + graphArray.get(parent).accomulatedZ;
          dictionary.push(id);
          ordered++;
        }
      }
    });
  }
  return order;
}
function arrayiseTree(calculationOrder){
  var base ={};
  var arr = [];
  calculationOrder.map(element=>{
    if(!([element.weight] in base)){
      Object.assign(base,{[element.weight]:[]});
    }
    base[element.weight].push(element.id);
  });
  for (const weight in base) {
    arr = arr.concat(base[weight]);
  }
  return arr;
}


export {generateCalculationOrder, arrayiseTree}