import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

class ResumeInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction,{
      0: {type:"word", wordMatch:"resume", result:()=>{return {}}}
    });
  }
  interpretate(isInRoutineMode: boolean,extractedData:Dictionary) {
    let res:Array<string> = [];

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    res.push(
        `engine.resume = true;`
    );
      
    if(isInRoutineMode){
      res.push(
        "});"
      );
    }
    return res.join(" \n ");
  }
}

export default ResumeInstruction;