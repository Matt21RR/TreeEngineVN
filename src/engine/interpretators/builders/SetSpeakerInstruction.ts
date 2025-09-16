import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

class SetSpeakerInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}
    try {
      if(getToken(0).type == "word"){
        if(getToken(1).type == "word" && getToken(1).value.toLowerCase() == "says"){
          return {match:true, actor: getToken(0).value};
        }
      }
      return {match:false};
    } catch (error) {
      return {match:false};
    }
  }
  interpretate(isInRoutineMode: boolean, extractedData:Dictionary) {
    const actor:string  = extractedData.actor;

    let res :Array<string> = [];

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    res.push(
     `
      engine.actualSpeaker = engine.actors.get('${actor}');
     `
    );
    if(isInRoutineMode){
      res.push(
        "});"
      );
    }
    return res.join(" \n ");
  }
}

export default SetSpeakerInstruction;