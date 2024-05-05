//If exists, the engine will read this file were will be listed the "custom structures" or 
//classes that extends the base classes (GraphObject, Trigger, Animation)

import { Battleground } from "./customComponents/battleground";

const customStructures = {
  GraphObject: { 
    Batteground: { //floor = new Battleground ({GraphObjectData},{BattlegroundData}) <=>{appearance:firstParam ,data:secondParam ,thirdParam}
      class: Battleground, 
      scriptStructure: [
        { type: "object",concatUnder:"appearance"}, //concating first param under "appearance" key
        { type: "object", concatUnder: "data"}, //concating second param under "data" key
        { type: "object" } //concating third param with main object
      ] 
    } 
  }
}
export {customStructures}