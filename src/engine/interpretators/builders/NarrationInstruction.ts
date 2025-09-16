import { Dictionary } from "../../../global.ts";
import AgrupableInstructionInterface from "../AgrupableInstructionInterface.ts";
import { Interpretation } from "../ChaosInterpreter.ts";

class NarrationInstruction extends AgrupableInstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}

    try {
      if(instruction.length == 1){ //Check for Narration
        if(getToken(0).type == "text")
        return {match:true, narration: getToken(0).value};
      }
      return {match:false};
    } catch (error) {
      return {match:false}; 
    }
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
    var newResult = interpretedInstructions
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

    var res = structuredClone(interpretedInstructions[0]);
    res.result = newResult;
    return res
  }
}

export default NarrationInstruction;