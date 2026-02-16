import { Dictionary } from "../../../global.ts";
import { Chaos } from "../ChaosInterpreter.ts";
import InstructionInterface from "../InstructionInterface.ts";

class LoadInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const runableObjects = ["script"];
    return this.conditionsChecker(instruction, {
      0: {type:"word", wordMatch:"load"},
      1: {type:"word", condition:(token)=>{
        return runableObjects.includes(token.value);
      }},
      2: {type:"text", result:(tokens)=>{
        return {
          loadBranch: tokens[1].value, 
          loadId: tokens[2].value};
      }}
    });
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