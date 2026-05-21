import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";
import { TokenType } from "../Token.ts";

class WaitInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, [
      {
        0:{type:TokenType.word, wordMatch:"wait"},
        1:{type:TokenType.number, result:(tokens)=>{
          return {waitTime: tokens[1].value};
        }}
      },
      {
        0:{type:TokenType.word, wordMatch:"wait", result:()=>{
          return {waitTime: null};
        }}
      }
    ]);
  }
  interpretate(isInRoutineMode: boolean, extractedData:Dictionary) {
    const waitTime:string|null = extractedData.waitTime;
    let res:Array<string> = [];

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    if(waitTime != null){
      res.push(`engine.resume = false; setTimeout(()=>{engine.resume = true;},${waitTime});`);
    }else{
      res.push("engine.resume = false;");
    }
    if(isInRoutineMode){
      res.push(
        "});"
      );
    }

    return res.join(" \n ");
  }
}

export default WaitInstruction;