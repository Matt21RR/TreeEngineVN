import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

class NodeDefinitionInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {instructionLength:3, type:"word", wordMatch:"node"},
      1: {type:"separator", wordMatch:":"},
      2: {type:"word", result:(tokens)=>{
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