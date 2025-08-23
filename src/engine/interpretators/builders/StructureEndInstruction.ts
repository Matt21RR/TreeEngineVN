import { ScriptStructure } from "../ChaosInterpreter.ts";
import InstructionInterface from "../InstructionInterface.ts";

class StructureEndInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}

    try {
      if(instruction.length == 2){
        if(getToken(0).type == "word" && 
          Object.keys(ScriptStructure)
          .filter(key=>isNaN(key as any))
          .map(key=>key.toLowerCase())
          .includes(getToken(0).value.toLowerCase())){
          if(getToken(1).type == "word" && getToken(1).value.toLowerCase() == "ends"){
            return {match:true,end:getToken(0).value.toLowerCase()}
          }
        }
      }
      return {match:false}; 
    } catch (error) {
      return {match:false};
    }
  }
  protected interpretate(isInRoutineMode: boolean, extractedData:{[key:string]:any}): Object {
    return {end:extractedData.end};
  }
}

export default StructureEndInstruction;