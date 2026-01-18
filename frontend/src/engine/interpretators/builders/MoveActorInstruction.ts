import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

export default class MoveActorInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx: number)=>{return instruction[idx];}

    if(instruction.length >= 4 && getToken(0).type == "word" && getToken(0).value.toLowerCase() == "move"){
      if(getToken(1).type == "word"){
        if(getToken(2).type == "word" && getToken(2).value.toLowerCase() == "to"){
          if(getToken(3).type == "word"){
            if(instruction.length == 6 && getToken(4).type == "word" && getToken(4).value.toLowerCase() == "in"){
              if(getToken(5).type == "number"){
                return {match:true, actorId: getToken(1).value, markId: getToken(3).value, duration: getToken(5).value};
              }
            }
            return {match:true, actorId: getToken(1).value, markId: getToken(3).value};
          }
        }
      }
    }
    return {match:false};
  }
  interpretate(isInRoutineMode: boolean, extractedData: Dictionary) {
    const actorId:string = extractedData.actorId;
    const markId:string = extractedData.markId;
    const duration:string = extractedData.duration;

    var dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");

    let res = [];
    
    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    res.push(
      `
        let data${dynaVarName} = {
            id:"animation${dynaVarName}",
            enabled:true,
            relatedTo:"${actorId}->ActorParent",
            keyframes:{ ${duration ?? '0'}: engine.stageMarks.fastGet("${markId}").point },
        };
      
        engine.anims.push(new engine.constructors.animation(data${dynaVarName}));
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