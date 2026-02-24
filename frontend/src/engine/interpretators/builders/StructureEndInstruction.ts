import { Dictionary } from "../../../global.ts";
import { ScriptStructure } from "../ChaosInterpreter.ts";
import InstructionInterface from "../InstructionInterface.ts";

class StructureEndInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const structTypeCheck = (value:string)=>{
      return Object.keys(ScriptStructure)
      .filter(key=>isNaN(key as any))
      .map(key=>key.toLowerCase())
      .includes(value.toLowerCase());
    }
    return this.conditionsChecker(instruction, {
      0: {type:"word", wordMatch:"end"},
      1: {type:"word",  condition:(token)=>{
        return structTypeCheck(token.value.toLowerCase());
      }, result: (tokens)=>{
        return {end:tokens[1].value.toLowerCase()};
      }}
    });
  }
  protected interpretate(isInRoutineMode: boolean, extractedData:Dictionary): Object {
    return {end:extractedData.end};
  }
}

export default StructureEndInstruction;