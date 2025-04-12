import { Token } from "../ChaosInterpreter.ts";
import InstructionInterface from "./InstructionInterface.ts";

class SceneDefinitionInstruction extends InstructionInterface{
  isOfThisType(instruction) {
    const getToken = (idx:number)=>{return instruction[idx];}
    //@ts-ignore
    if(getToken(0) instanceof Token && getToken(0).type == "word" && getToken(0).value == "scene"){
      //@ts-ignore
      if(getToken(1) instanceof Token && getToken(1).type == "word"){
        return {match:true, sceneId: getToken(1).value};
      }
    }
    return {match:false};
  }
  interpretate(isInRoutineMode: boolean, extractedData: {[key:string]:any}): Object {
    const sceneId: string = extractedData.sceneId;
    return {define:"scene",id:sceneId};
  }
}

export default SceneDefinitionInstruction;