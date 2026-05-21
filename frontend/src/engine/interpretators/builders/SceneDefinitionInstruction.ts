import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";
import { TokenType } from "../Token.ts";

class SceneDefinitionInstruction extends InstructionInterface{
  isOfThisType(instruction) {
    return this.conditionsChecker(instruction, {
      0: {type:TokenType.word, wordMatch:"scene"},
      1: {type:TokenType.word, result:(tokens)=>{
        return {sceneId: tokens[1].value};
      }}
    });
  }
  interpretate(isInRoutineMode: boolean, extractedData: Dictionary): Object {
    const sceneId: string = extractedData.sceneId;
    return {define:"scene",id:sceneId};
  }
}

export default SceneDefinitionInstruction;