import { Dictionary } from "../../../global.ts";
import { arrayFlatter } from "../../logic/Misc.ts";
import AgrupableInstructionInterface from "../AgrupableInstructionInterface.ts";
import { Interpretation } from "../ChaosInterpreter.ts";
import InstructionInterface from "../InstructionInterface.ts";

class DecisionOptionInstruction extends AgrupableInstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:"word", wordMatch:"ask", instructionLength:3},
      1: {type:"text"},
      2: {isArray:true, result:(tokens)=>{
        let tokArray = tokens[2] as unknown as Array<any>;
        tokArray.shift();
        tokArray.pop();
        console.log(tokArray);
        debugger;
        return {tokArray: tokArray};
        }}
    });
  }
  interpretate(isInRoutineMode: boolean, extractedData:Dictionary) {
    const value:string = extractedData.value;
    const tokArray = extractedData.tokArray as Array<any>;
    const tokenString = arrayFlatter(tokArray).join(" "); 
    const res =
    `engine.routines.push((engine)=>{
      ${tokenString}
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


export default class DecisionInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:"word", wordMatch:"ask", instructionLength:3},
      1: {type:"text"},
      2: {isArray:true, result:(tokens)=>{
        let tokArray = tokens[2] as unknown as Array<any>;
        tokArray.shift();
        tokArray.pop();
        // debugger;
        return {tokArray: tokArray};
      }}
    });
  }
  interpretate(isInRoutineMode: boolean, extractedData:Dictionary) {
    const value:string = extractedData.value;
    const tokArray = extractedData.tokArray as Array<any>;
    const tokenString = arrayFlatter(tokArray).map(e=>e.value).join(" "); 
    console.log(tokenString)
    const res =
    `engine.routines.push((engine)=>{
      ${tokenString}
    });`;

    return res;
  }
}