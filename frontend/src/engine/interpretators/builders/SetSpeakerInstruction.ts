import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

class SetSpeakerInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:"word"},
      1: {type:"word", wordMatch:"says", result:(tokens)=>{
        return {actor: tokens[0].value}
      }}
    });
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
      if(engine.actualSpeaker){
        engine.actualSpeaker.getActiveMask().grayscale = 0.3;
      }
      engine.actualSpeaker = engine.actors.get('${actor}');
      engine.actualSpeaker.getActiveMask().grayscale = 0;
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