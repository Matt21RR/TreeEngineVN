import React from 'react';
import { charsFiles } from '../res/gameRes/characters/chars';
const elementosDeEscenario = require("../res/elementosDeEscenario.json")["elementosDeEscenario"];
console.log(elementosDeEscenario);
class NodeBuilder {
  static scanNode(_node, _previousNode) {
    var node = structuredClone(Object.assign({}, _node));
    const previousNode = structuredClone(Object.assign({}, _previousNode));
    const requiredItems = [
      "fondo",
      "personajes",
      "capaSuperior",
      "musica"
    ]
    var missingItems = new Array();
    if ("escenario" in node) {
      requiredItems.forEach(requiredItem => {
        if (!(requiredItem in node.escenario)) missingItems.push(requiredItem);
      });
    } else {
      node = structuredClone(Object.assign(node, { escenario: {} }));
      missingItems = requiredItems;
    }

    if (missingItems.length > 0) missingItems.forEach(missingItem => {
      if(missingItem in previousNode.escenario){
        //!Ignorar el indice incrustar
        node.escenario = structuredClone(Object.assign(node.escenario, { [missingItem]: previousNode.escenario[missingItem] }));
      }
    });

    return node;
  }
  static getElementoDelEscenario(id){
    var res = new Object();
    var elementClass = new String();
    switch (id[0]) {
      case "f"://fondos
        elementClass = "fondos";
        break;
      case "p"://personajes
        const charName = id.split(".")[1];
        if(id.split(".").length==2){//Get character with default preset
          return res = Object.assign({charName:charName},charsFiles[charName].defaultPreset);
        }else if(id.split(".").length==3){//Get character with a predefined preset
          const presetName = id.split(".")[2];
          return res = Object.assign({charName:charName},charsFiles[charName].presets[presetName]);
        }
        break;
      case "c"://capasSuperiores
        elementClass = "capasSuperiores";
        break;
      case "m"://musicas
        elementClass = "musicas";
        break;
    }
    if(elementClass != "personajes"){
      return res = Object.assign({},elementosDeEscenario[elementClass][id]);
    }
  }
  static scanNodeForRecycle(_node) {
    var node = structuredClone(Object.assign({}, _node));
    var nodesWhereRecycle = new Array();
    if("escenario" in node){
      for (let index = 0; index < Object.keys(node.escenario).length; index++) {
        const escenarioElement = node.escenario[Object.keys(node.escenario)[index]];
        if ((typeof escenarioElement == "object") && !Array.isArray(escenarioElement)) {
          if ("reciclar" in escenarioElement) {
            if(isNaN(parseInt(escenarioElement.reciclar[0]))){
              nodesWhereRecycle.push({ dataRequired: Object.keys(node.escenario)[index], from: escenarioElement.reciclar, data: this.getElementoDelEscenario(escenarioElement.reciclar), incrustMode:true });
  
            }else{
              nodesWhereRecycle.push({ dataRequired: Object.keys(node.escenario)[index], from: escenarioElement.reciclar });
            }
          }
        } else if (Array.isArray(escenarioElement)) {
          //rescan every element of this escenarioElement
          escenarioElement.forEach((elementOfEscenarioElement, index2) => {
            if ("reciclar" in elementOfEscenarioElement) {
              if(isNaN(parseInt(elementOfEscenarioElement.reciclar[0]))){
                nodesWhereRecycle.push({ atIndex: index2, dataRequired: Object.keys(node.escenario)[index], from: elementOfEscenarioElement.reciclar, data: this.getElementoDelEscenario(elementOfEscenarioElement.reciclar), incrustMode:true });
              }else{
                nodesWhereRecycle.push({ atIndex: index2, dataRequired: Object.keys(node.escenario)[index], from: elementOfEscenarioElement.reciclar });
                //I require to recycle the data that is storaged atIndex, in the escenarioElement, from the node with id...
              }
              
              
            }
          });
        }
      }
    }
    return (nodesWhereRecycle);
  }
  static estiloInicialAndFadeInMixer(elementProperties) {
    var res = elementProperties.estiloInicial;
    if ("fadeIn" in elementProperties) {
      res = structuredClone(Object.assign(elementProperties.estiloInicial, elementProperties.fadeIn));
    }
    return {estiloInicial:res};
  }
  static introduceEscenarioRecycledData(_node, _dataRecycled) {
    var node = structuredClone(Object.assign({}, _node));
    const dataRecycled = [..._dataRecycled];
    var areInmediateNextNode = false;
    dataRecycled.forEach(elementRecycled => { //from|dataRequired|atIndex|data
      Object.keys(elementRecycled.data).forEach(elementRecycledProperty => {
        if ("atIndex" in elementRecycled) {
          if (!(elementRecycledProperty in node.escenario[elementRecycled.dataRequired][elementRecycled.atIndex])) {
            if (elementRecycled.areInmediateNextNode && (elementRecycledProperty == "fadeIn" || elementRecycledProperty == "estiloInicial")) {
              if (elementRecycledProperty == "estiloInicial") {
                node.escenario[elementRecycled.dataRequired][elementRecycled.atIndex] = structuredClone(Object.assign(node.escenario[elementRecycled.dataRequired][elementRecycled.atIndex], this.estiloInicialAndFadeInMixer(elementRecycled.data)));
              }
            } else {
              node.escenario[elementRecycled.dataRequired][elementRecycled.atIndex] = structuredClone(Object.assign(node.escenario[elementRecycled.dataRequired][elementRecycled.atIndex], { [elementRecycledProperty]: elementRecycled.data[elementRecycledProperty] }));
            }
          }
        } else {
          if (!(elementRecycledProperty in node.escenario[elementRecycled.dataRequired])) {
            if (elementRecycled.areInmediateNextNode && (elementRecycledProperty == "fadeIn" || elementRecycledProperty == "estiloInicial")) {
              if (elementRecycledProperty == "estiloInicial") {
                node.escenario[elementRecycled.dataRequired] = structuredClone(Object.assign(node.escenario[elementRecycled.dataRequired], this.estiloInicialAndFadeInMixer(elementRecycled.data)));
              }
            } else {
              node.escenario[elementRecycled.dataRequired] = structuredClone(Object.assign(node.escenario[elementRecycled.dataRequired], { [elementRecycledProperty]: elementRecycled.data[elementRecycledProperty] }));
            }
          }
        }
      });
    });
    //remove the "recycle" property from every Escenario child & from the node
    var resNode = new Object();
    Object.keys(node).forEach(mainElement => {
      if (mainElement != "recycle") {
        if (mainElement == "escenario") {
          resNode = structuredClone(Object.assign(resNode, new Object({ escenario: new Object() })));
          Object.keys(node.escenario).forEach(escenarioElement => {
            if (Array.isArray(node.escenario[escenarioElement])) {
              resNode.escenario = structuredClone(Object.assign(resNode.escenario, new Object({ [escenarioElement]: new Array() })));
              node.escenario[escenarioElement].forEach((elementOfArray, arrayIndex) => {
                resNode.escenario[escenarioElement][arrayIndex] = new Object();
                Object.keys(elementOfArray).forEach(elementOfEscenarioChild => {
                  if (elementOfEscenarioChild != "recycled") {
                    if (areInmediateNextNode && (elementOfEscenarioChild == "fadeIn" || elementOfEscenarioChild == "estiloInicial")) {
                      if (elementOfEscenarioChild == "estiloInicial") {
                        //add estiloInicial/FadeInMixer
                        resNode.escenario[escenarioElement][arrayIndex] = structuredClone(Object.assign(resNode.escenario[escenarioElement][arrayIndex], this.estiloInicialAndFadeInMixer(node.escenario[escenarioElement][arrayIndex])));
                      }
                    } else {
                      resNode.escenario[escenarioElement][arrayIndex] = structuredClone(Object.assign(resNode.escenario[escenarioElement][arrayIndex], new Object({ [elementOfEscenarioChild]: node.escenario[escenarioElement][arrayIndex][elementOfEscenarioChild] })));
                    }
                  }
                });
              });
            } else {
              resNode.escenario = structuredClone(Object.assign(resNode.escenario, new Object({ [escenarioElement]: new Object() })));
              Object.keys(node.escenario[escenarioElement]).forEach(elementOfEscenarioChild => {
                if (elementOfEscenarioChild != "recycled") {
                  if (areInmediateNextNode && (elementOfEscenarioChild == "fadeIn" || elementOfEscenarioChild == "estiloInicial")) {
                    if (elementOfEscenarioChild == "estiloInicial") {
                      //add estiloInicial/FadeInMixer
                      resNode.escenario[escenarioElement] = structuredClone(Object.assign(resNode.escenario[escenarioElement], this.estiloInicialAndFadeInMixer(node.escenario[escenarioElement])));
                    }
                  } else {
                    resNode.escenario[escenarioElement] = structuredClone(Object.assign(resNode.escenario[escenarioElement], new Object({ [elementOfEscenarioChild]: node.escenario[escenarioElement][elementOfEscenarioChild] })));
                  }
                }
              });
            }
          });
        } else {
          resNode = structuredClone(Object.assign(resNode, { [mainElement]: node[mainElement] }));
        }
      }
    });
    return resNode;
  }
  static haveNextNode(node=new Object()){
    return ("id" in node && "nodoSiguiente" in node);
  }
  static getAAnimationDuration(animation) {
    let animationDuration = 0;
    if ("duration" in animation) {
      animationDuration += animation.duration;
    }
    if ("delay" in animation) {
      animationDuration += animation.delay;
    }
    return animationDuration;
  }
  static getFadeOutTriggerDuration(actualNode = new Object()) {
    // const actualNode = NodesBuilder.nodeFinder(this.state.actualNode,this.gameScript);
    var triggerDuration = 0;
    if("escenario" in actualNode){
      if ("fadeOut" in actualNode.escenario.fondo) {

        triggerDuration = this.getAAnimationDuration(actualNode.escenario.fondo.fadeOut);
      }
      if ("personajes" in actualNode.escenario) {
        actualNode.escenario.personajes.forEach(element => {
          if ("fadeOut" in element) {
            triggerDuration = this.getAAnimationDuration(element.fadeOut) > triggerDuration ? this.getAAnimationDuration(element.fadeOut) : triggerDuration;
          }
        });
      }
      if ("capaSuperior" in actualNode.escenario) {
        if (!Array.isArray(actualNode.escenario.capaSuperior)) {
          if ("fadeOut" in actualNode.escenario.capaSuperior) {
            triggerDuration = this.getAAnimationDuration(actualNode.escenario.capaSuperior.fadeOut) > triggerDuration ? this.getAAnimationDuration(actualNode.escenario.capaSuperior.fadeOut) : triggerDuration;
          }
        } else {
          actualNode.escenario.capaSuperior.forEach(element => {
            if ("fadeOut" in element) {
              triggerDuration = this.getAAnimationDuration(element.fadeOut) > triggerDuration ? this.getAAnimationDuration(element.fadeOut) : triggerDuration;
            }
          });
        }
      }
      if ("musica" in actualNode.escenario) {
        actualNode.escenario.musica.forEach(element => {
          if ("fadeOut" in element) {
            triggerDuration = this.getAAnimationDuration(element.fadeOut) > triggerDuration ? this.getAAnimationDuration(element.fadeOut) : triggerDuration;
          }
        });
      }
    }
    if("dialogo" in actualNode){
      if ("personaje" in actualNode.dialogo) {
        actualNode.dialogo.personaje.forEach(element => {
          if ("fadeOut" in element) {
            triggerDuration = this.getAAnimationDuration(element.fadeOut) > triggerDuration ? this.getAAnimationDuration(element.fadeOut) : triggerDuration;
          }
        });
      }
    }
    return triggerDuration;//if this thing is 0 and there's no dialogs set alarm
  }
  static checkIfInstantNode(actualNode = new Object()){
    var res = true;
    if ("cinematica" in actualNode) {
      res = false;//!add a recursive search of total duration
    }else if("dialogo" in actualNode){
      if ("personaje" in actualNode.dialogo) {
        if (actualNode.dialogo.personaje.length > 0){//no alarm
          res = false;
        }
      }else if ("usuario" in actualNode.dialogo) {
        if (actualNode.dialogo.usuario.length > 0){//no alarm
          res = false;
        }
      }
    }
    return res;
  }
}
export { NodeBuilder }