import InstructionInterface from "../InstructionInterface.ts";
import Token from "../Token.ts";

class ModuleDefinitionInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}
    //@ts-ignore
    if(getToken(0) instanceof Token && getToken(0).type == "word" && getToken(0).value == "module"){
      //@ts-ignore
      if(getToken(1) instanceof Token && getToken(1).type == "word"){
        return {match:true, moduleId:getToken(1).value};
      }
    }
    return {match:false};
  }
  interpretate(isInRoutineMode: boolean, extractedData:{[key:string]:any}): Object {
    const moduleId: string = extractedData.moduleId;
    return {define:"module",id:moduleId};
  }
}

export default ModuleDefinitionInstruction;