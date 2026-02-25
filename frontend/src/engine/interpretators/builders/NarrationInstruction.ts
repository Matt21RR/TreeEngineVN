import { Dictionary } from "../../../global.ts";
import AgrupableInstructionInterface from "../AgrupableInstructionInterface.ts";
import { Interpretation } from "../ChaosInterpreter.ts";

class NarrationInstruction extends AgrupableInstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:"text", instructionLength:1, result:(tokens)=>{
        return {narration: tokens[0].value}
      }}
    });
  }
  interpretate(isInRoutineMode: boolean, extractedData:Dictionary) {
    const narration:string = extractedData.narration;
    const res =
    `engine.routines.push((engine)=>{
      engine.resume = false;

      engine.narration.push(${narration});

      engine.paragraph += engine.getStr(engine.lambdaConverter(engine.narration[0]));
      engine.graphArray.get('narrationBox').enabled = true;
    });`;

    return res;
  }
  agrupator(interpretedInstructions: Array<Interpretation>): Interpretation {
    let newResult = interpretedInstructions
      .map(e=> (e.result as string)
        .split("\n")
        .slice(2,-3)
        .join("\n"))
      .join("\n")

    newResult = `engine.routines.push((engine)=>{
      engine.resume = false;

      ${newResult}

      engine.paragraph += engine.getStr(engine.lambdaConverter(engine.narration[0]));
      engine.graphArray.get('narrationBox').enabled = true;
    });`;

    let res = structuredClone(interpretedInstructions[0]);
    res.result = newResult;
    return res
  }
}

export default NarrationInstruction;