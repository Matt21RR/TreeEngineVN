import { Dictionary } from "../../../global.ts";
import { Chaos } from "../ChaosInterpreter.ts";
import InstructionInterface from "../InstructionInterface.ts";

class LoadInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const runableObjects = ["script"];
    const getToken = (idx)=>{return instruction[idx];}

    if(getToken(0).type == "word" && getToken(0).value.toLowerCase() == "load"){
      if(getToken(1).type == "word" && runableObjects.includes(getToken(1).value)){
        if(getToken(2).type == "text"){
          return {match: true, loadBranch: getToken(1).value, loadId: getToken(2).value};
        }
      }
    }
    return {match:false};
  }
  interpretate(isInRoutineMode: boolean, extractedParams:Dictionary): string {
    const loadBranch:string = extractedParams.loadBranch;
    const loadId:string = extractedParams.loadId;
    const chaosReference:Chaos = extractedParams.chaosReference;

    let res:string = "";

    switch (loadBranch) {
      case "script":
        const sceneOrModuleId = loadId.replaceAll('"',"");
        if(!(sceneOrModuleId in chaosReference.scripts)){
          console.error("List of scripts and modules:",Object.keys(chaosReference.scripts));
          console.log(chaosReference);  
          throw new Error("Scene or module "+sceneOrModuleId+" not found or don't exists.");
        }
        res = chaosReference.scripts[sceneOrModuleId].main;
        break;
    }
    return res;
  }
}

export default LoadInstruction;