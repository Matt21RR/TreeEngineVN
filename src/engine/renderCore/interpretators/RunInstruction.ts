import { Chaos } from "../ChaosInterpreter";
import InstructionInterface from "./InstructionInterface.ts";

class RunInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const runableObjects = ["script"];
    const getToken = (idx)=>{return instruction[idx];}

    if(getToken(0).type == "word" && getToken(0).value.toLowerCase() == "run"){
      if(getToken(1).type == "word" && runableObjects.includes(getToken(1).value)){
        if(getToken(2).type == "text"){
          return {match:true, branch: getToken(1).value, id: getToken(2).value};
        }
      }
    }
    return {match:false};
  }
  interpretate(isInRoutineMode: boolean, extractedData: {[key:string]:any}) {
    const branch:string = extractedData.branch;
    const id:string = extractedData.id;
    const chaosReference:Chaos = extractedData.chaosReference;
    let res = "";

    switch (branch) {
      case "script":
        res =
          `engine.routines.push((engine)=>{
            engine.loadScript('${chaosReference.scriptsUrls[id.replaceAll('"',"")]}',${id})
          });`;
        break;
    }
    return res;
  }
}

export default RunInstruction;