import { Dictionary } from "../../../global.ts";
import { Chaos } from "../ChaosInterpreter.ts";
import InstructionInterface from "../InstructionInterface.ts";

export default class IncludeInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:"word", wordMatch:"include"},
      1: {type:"text", result:(tokens)=>{ //id 
        return {
          loadId: tokens[1].value};
      }}
    });
  }
  interpretate(isInRoutineMode: boolean, extractedParams:Dictionary): string {
    const loadId:string = extractedParams.loadId;
    const chaosReference:Chaos = extractedParams.chaosReference;

    let res:string = "";

    const sceneOrModuleId = loadId.replaceAll('"',"");
    if(!(sceneOrModuleId in chaosReference.scripts)){
      console.error("List of scripts and modules:",Object.keys(chaosReference.scripts));
      console.log(chaosReference);  
      throw new Error("Scene or module "+sceneOrModuleId+" not found or don't exists.");
    }
    res = chaosReference.scripts[sceneOrModuleId].main;

    return res;
  }
}