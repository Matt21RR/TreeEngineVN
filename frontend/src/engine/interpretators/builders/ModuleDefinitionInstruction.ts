import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

class ModuleDefinitionInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:"word", wordMatch:"module"},
      1: {type:"word", result:(tokens)=>{
        return {moduleId: tokens[1].value}
      }}
    });
  }
  interpretate(isInRoutineMode: boolean, extractedData:Dictionary): Object {
    const moduleId: string = extractedData.moduleId;
    return {define:"module",id:moduleId};
  }
}

export default ModuleDefinitionInstruction;