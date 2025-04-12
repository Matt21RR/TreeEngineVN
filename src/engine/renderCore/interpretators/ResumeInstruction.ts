import InstructionInterface from "./InstructionInterface.ts";

class ResumeInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}
    if(getToken(0).type == "word" && getToken(0).value.toLowerCase() == "resume"){
      return {match:true};
    }
    return {match:false};
  }
  interpretate(isInRoutineMode: boolean,extractedData:{[key:string]:any}) {
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