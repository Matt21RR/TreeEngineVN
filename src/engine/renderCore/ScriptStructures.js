import { Animation } from "../engineComponents/Animation"
import { GraphObject } from "../engineComponents/GraphObject"

const scripttructures = {
  GraphObject: { 
    class:GraphObject,
    scriptStructure:[
      { type: "object" } //concating with main object
    ]
  },
  Animation: {
    class: Animation,
    scriptStructure: [
      { type: "string", concatUnder: "relatedTo" },
      [
        { type: "object", keysType: "number", concatUnder:"keyframes"},
        { type: "object", keysType: "notNumber", concatUnder:"to" }
      ],
      { type:"object" } //configfgfgfgfgfgfgfgfg
    ]
  },
  Trigger: {
    class: Trigger,
    scriptStructure: [
      { type: "string", concatUnder: "relatedTo" }, //concating first param under "relatedTo" key
      { type: "object" } //concating with main object
    ]
  },
  Batteground: { //floor = new Battleground ({GraphObjectData},{BattlegroundData}) <=>{appearance:firstParam ,data:secondParam ,thirdParam}
    class: Battleground, 
    scriptStructure: [
      { type: "object",concatUnder:"appearance"}, //concating first param under "appearance" key
      { type: "object", concatUnder: "data"}, //concating second param under "data" key
      { type: "object" } //concating third param with main object
    ] 
  } 
}
export {scriptStructures}