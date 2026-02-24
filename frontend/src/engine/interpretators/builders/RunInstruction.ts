import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

class RunInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:"word", wordMatch:"run"},
      1: [
        {
          1: {type:"word", instructionLength:2, result:(tokens)=>{
            return {scene: tokens[1].value};
          }}   
        },{
          1: {type:"word", instructionLength:5},
          2: {type:"operator", wordMatch:"-"},
          3: {type:"operator", wordMatch:">"},
          4: {type:"word", result:(tokens)=>{
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