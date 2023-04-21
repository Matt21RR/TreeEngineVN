//sound and audio requires here
const novelJSON = require("../res/novel.json");
const elementosDeEscenario = require("../res/elementosDeEscenario.json")["elementosDeEscenario"];
const { NodeBuilder } = require("./NodeBuilder");
class NodesBuilder{

  static removeIncrustarKeyWord(rawScript){
    return(rawScript.replaceAll('"incrustar"','"reciclar"'));
  }
  static buildGameScript(providedNodesBase = new Object()){ 
    console.warn(providedNodesBase);
    try {
      var nodesBase;
      if(Object.keys(providedNodesBase).length == 0){
        nodesBase = structuredClone(JSON.parse(this.removeIncrustarKeyWord(JSON.stringify(novelJSON.nodosDeDialogo))));
      }else{
        console.warn(providedNodesBase);
        nodesBase = structuredClone(JSON.parse(this.removeIncrustarKeyWord(JSON.stringify(providedNodesBase))));
      }
      //then scan the nodes to fill the missing info and do the "recycling"
      var nodesWithId = 0;
      nodesBase.forEach(node => {
        nodesWithId += ("id" in node ? 1:0);
      });
      if(!((nodesWithId == nodesBase.length) || (nodesWithId == 0))){
        throw new Error("Id nodes quantity mismatch");
      }
      if(nodesWithId == 0){
        structuredClone(Object.assign({},nodesBase).forEach((node,index) => {
          nodesBase[index] = structuredClone(Object.assign(nodesBase[index],{id:index})); 
        }));
      }
      //fill the missing info
      for (let index = 1; index < nodesBase.length; index++) {
        var node = structuredClone(Object.assign({},nodesBase[index]));
        var resNode = structuredClone(node);
        //Crear objetos vacios en caso de aucencia de la propiedad "dialogos"
        if(!("dialogo" in node)){
          resNode = structuredClone(Object.assign(resNode,{dialogo:new Object()}));
        }
        if("idNodoPrevio" in node){//nodo previo predefinido
          resNode = structuredClone(Object.assign({},NodeBuilder.scanNode(resNode,structuredClone(Object.assign({},this.nodeFinder(resNode.idNodoPrevio,nodesBase))))));
        }
        nodesBase[index] = resNode;
        //else{//nodo previo determinado como el de indice inferior al actual
        //   node = structuredClone(Object.assign({},NodeBuilder.scanNode(node,structuredClone(Object.assign({},this.nodeFinder(((node.id*1)-1),nodesBase))));
        // }
      }
      //Search nodes where are recycling from pre-build escenarioElement
      //Now inspect the nodes to do the recicle
      for (let index = 0; index < nodesBase.length; index++) {
        const node = structuredClone(Object.assign({},nodesBase[index]));
        var nodesWhereRecycle = NodeBuilder.scanNodeForRecycle(node);
        if(nodesWhereRecycle.length >0){
          nodesWhereRecycle.forEach((nodeWhereRecycle,index2) => {
            if("incrustMode" in nodeWhereRecycle){
              nodesWhereRecycle[index2] = structuredClone(Object.assign(nodeWhereRecycle,{areInmediateNextNode:false}));
            }else if("atIndex" in nodeWhereRecycle){
              nodesWhereRecycle[index2] = structuredClone(Object.assign(nodeWhereRecycle,{areInmediateNextNode:this.areInmediateNextNode(node.id,this.nodeFinder(nodeWhereRecycle.from,nodesBase)),data:this.nodeFinder(nodeWhereRecycle.from,nodesBase).escenario[nodeWhereRecycle.dataRequired][nodeWhereRecycle.atIndex]}));
            }else{
                nodesWhereRecycle[index2] = structuredClone(Object.assign(nodeWhereRecycle,{areInmediateNextNode:this.areInmediateNextNode(node.id,this.nodeFinder(nodeWhereRecycle.from,nodesBase)),data:this.nodeFinder(nodeWhereRecycle.from,nodesBase).escenario[nodeWhereRecycle.dataRequired]}));  
            }
            
          });
          //Now we are going to the hard steps:
          //check the entire script searching the recicled info and remove fadeIn/fadeOut animations where is required
          //Basicly, we can determine easily where we need to do the changes:
          //if a node are recicling from another node we need to check if that other node are the inmediate previous node of the actual done
          //checking if the next node id of the previous node are equal to the actual node id
          //Now we have the data to add where are requested the recycle
          nodesBase[index] =
          structuredClone(Object.assign({},
            NodeBuilder.introduceEscenarioRecycledData(structuredClone(Object.assign({},node)),[...nodesWhereRecycle])
            ));
        }
      }
    } catch (error) {
      console.log(error);
    }
    return nodesBase;
  }
  static areInmediateNextNode(actualNodeId,nodeWhereRecycle){
    try {
      if("nodoSiguiente" in nodeWhereRecycle){
        if(actualNodeId == nodeWhereRecycle.nodoSiguiente){
          return(true);
        }
      }else if(Array.isArray(nodeWhereRecycle.dialogo.usuario)){
        nodeWhereRecycle.dialogo.usuario.forEach(userDialogOption => {
          if(actualNodeId == userDialogOption.nodoSiguiente){
            return(true);
          }
        });
      }
      return(false);
    } catch (error) {
      console.error("CHECK nodoSiguiente in node #"+nodeWhereRecycle.id+"!!");
    }
  }
  static nodeFinder(idToFind,nodesBase){
    let resNode = new Object();
    for (let index = 0; index < nodesBase.length; index++) {
      const node = nodesBase[index];
      if(node.id == idToFind){
        resNode = structuredClone(Object.assign({},node));
        break;
      }
    }
    if(Object.keys(resNode).length == 0){
      throw new Error("nodo con la clave "+idToFind+" no encontrado");
    }
    return structuredClone(Object.assign({},resNode));
  }
  static getUninterpretedGameScript(){
    return structuredClone(Object.assign(novelJSON.nodosDeDialogo));
  }
  static getPredefinedGameEntities(){
    return structuredClone(elementosDeEscenario["elementosDeEscenario"]);
  }
  static getRequiredNodesList(_nodesBase=new Object()){
    const nodesBase = structuredClone(_nodesBase)
    var res = new Array();
    const iterateScript = (elementsList)=>{
      Object.keys(elementsList).forEach(elementKey => {
        if(elementKey == "reciclar"){
          res.push(elementsList[elementKey]);
        }else if(typeof elementsList[elementKey] == "object"){
          iterateScript(elementsList[elementKey]);
        }
      });
    }
    iterateScript(nodesBase);
    return [...new Set(res)];
  }
}
export {NodesBuilder}