import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";
import { TokenType } from "../Token.ts";

class RunInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:TokenType.word, wordMatch:"run"},
      1: [
        {
          1: {type:TokenType.word, instructionLength:2, result:(tokens)=>{
            return {scene: tokens[1].value};
          }}   
        },{
          1: {type:TokenType.word, instructionLength:5},
          2: {type:TokenType.operator, wordMatch:"-"},
          3: {type:TokenType.operator, wordMatch:">"},
          4: {type:TokenType.word, result:(tokens)=>{
            return {scene: tokens[1].value, node: tokens[4].value};
          }}
        }
      ]
    });
  }
  interpretate(isInRoutineMode: boolean, extractedData: Dictionary) {
    const scene:string = extractedData.scene;
    const node:string = extractedData.node;
    let res = "";

    res =
      `engine.routines.push((engine)=>{
        engine.runScript('${scene}'${node?`, '${node}'`:''});
      });`;
    return res;
  }
}

export default RunInstruction;