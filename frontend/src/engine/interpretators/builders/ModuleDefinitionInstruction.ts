import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";
import { TokenType } from "../Token.ts";

class ModuleDefinitionInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:TokenType.word, wordMatch:"module"},
      1: {type:TokenType.word, result:(tokens)=>{
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