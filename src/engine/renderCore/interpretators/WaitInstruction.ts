import InstructionInterface from "./InstructionInterface.ts";

class WaitInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}

    if(getToken(0).type == "word" && getToken(0).value.toLowerCase() == "wait"){
      if(getToken(1).type == "number"){
        return {match:true, waitTime: getToken(1).value};
      }else{
        return {match:true, waitTime: null};
      }
    }
    return {match:false}
  }
  interpretate(isInRoutineMode: boolean, extractedData:{[key:string]:any}) {
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