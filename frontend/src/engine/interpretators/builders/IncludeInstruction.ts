import { Dictionary } from "../../../global.ts";
import { Chaos, InterpretationDropReason } from "../ChaosInterpreter.ts";
import InstructionInterface from "../InstructionInterface.ts";
import { TokenType } from "../Token.ts";

export default class IncludeInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:TokenType.word, wordMatch:"include"},
      1: {type:TokenType.text, result:(tokens)=>{ //id 
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
    if(!(sceneOrModuleId in chaosReference.modules)){
      console.error("List of scripts and modules:",Object.keys(chaosReference.modules));
      console.log(chaosReference);  
      
      console.log("Module "+sceneOrModuleId+" not found or don't exists.");
      throw {
              message: `Module ${sceneOrModuleId} not found or don't exists.`,
              reason: InterpretationDropReason.ModuleDependencyUnfulfilled
            };
    }
    res = chaosReference.modules[sceneOrModuleId];

    return res;
  }
}