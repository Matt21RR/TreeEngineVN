import InstructionInterface from "../InstructionInterface.ts";

class JumpToInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}

    try {
      if(instruction.length == 3){ //Check for Narration
        if(getToken(0).type == "word" && getToken(0).value.toLowerCase() == "node"){
          if(getToken(1).type == "separator" && getToken(1).value == ":"){
            if(getToken(2).type == "word"){
              return {match:true,label: getToken(2).value}
            }
          }
        }
      }
      return {match:false}; 
    } catch (error) {
      return {match:false};
    }
  }
  protected interpretate(isInRoutineMode: boolean, extractedData: { [key: string]: any; }) {
    const label:string = extractedData.label;

    let res:Array<string> = [];

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    res.push(
      ` engine.loadNode(${label});`
    );
    if(isInRoutineMode){
      res.push(
        "});"
      );
    }
    return res.join(" \n ");
  }
}

export default JumpToInstruction;