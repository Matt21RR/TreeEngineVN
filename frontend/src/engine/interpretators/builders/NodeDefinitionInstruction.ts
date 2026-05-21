import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";
import { TokenType } from "../Token.ts";

class NodeDefinitionInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {instructionLength:3, type:TokenType.word, wordMatch:"node"},
      1: {type:TokenType.separator, wordMatch:":"},
      2: {type:TokenType.word, result:(tokens)=>{
        return {nodeId: tokens[2].value}
      }}
    });
  }
  protected interpretate(isInRoutineMode: boolean, extractedData:Dictionary): Object {
    const nodeId: string = extractedData.nodeId;
    return {define:"node",id:nodeId};
  }
}

export default NodeDefinitionInstruction;