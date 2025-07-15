import InstructionInterface from "../InstructionInterface.ts";
import Token from "../Token.ts";

class PlayInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx:number)=>{return instruction[idx];}
    //@ts-ignore
    if(getToken(0) instanceof Token && getToken(0).type == "word" && getToken(0).value.toLowerCase() == "play"){
      //@ts-ignore
      if(getToken(1).type == "text"){
        return {match: true, song: getToken(1).value};
      }
    }
    return {match: false};
  }
  interpretate(isInRoutineMode: boolean, extractedData:{[key:string]:any}) {
    const song:string = extractedData.song;
    
    let res:Array<string> = [];

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    res.push(
      `engine.play(${song});`
    );
    if(isInRoutineMode){
      res.push(
        "});"
      );
    }
    return res.join(" \n ");
  }
}

export default PlayInstruction;