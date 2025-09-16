import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";
import Token from "../Token.ts";

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
  interpretate(isInRoutineMode: boolean, extractedData: Dictionary): Object {
    const sceneId: string = extractedData.sceneId;
    return {define:"scene",id:sceneId};
  }
}

export default SceneDefinitionInstruction;