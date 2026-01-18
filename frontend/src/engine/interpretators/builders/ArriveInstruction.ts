import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

export default class ArriveInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx :number)=>{return instruction[idx];}

    try {
      if(instruction.length >= 4){ //Check for Narration
        if(getToken(0).type == "word"){
          if(getToken(1).type == "word" && getToken(1).value.toLowerCase() == "arrives"){
            if(getToken(2).type == "word" && getToken(2).value.toLowerCase() == "to"){
              if(getToken(3).type == "word"){
                if(instruction.length == 6 && getToken(4).type == "word" && getToken(4).value.toLowerCase() == "in"){
                  if(getToken(5).type == "number"){
                    return {match:true, actorId: getToken(0).value, markId: getToken(3).value, duration: getToken(5).value};
                  }
                }
                return {match:true, actorId: getToken(0).value, markId: getToken(3).value}
              }
            }
          }
        }
      }
      return {match:false}; 
    } catch (error) {
      return {match:false};
    }
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
        const stageMark = engine.stageMarks.fastGet("${markId}").point;

        let data1${dynaVarName} = {
          id:"animation1${dynaVarName}",
          enabled:true,
          relatedTo:"${actorId}->ActorParent",
          keyframes:{ 
            0: {x: stageMark.x - 2, y: stageMark.y, z:stageMark.z},
            ${duration ?? '500'}: stageMark 
          }
        };

        const actor = engine.actors.get("${actorId}");

        let data2${dynaVarName} = {
          id: "animation2${dynaVarName}",
          enabled: true,
          relatedTo: actor.getActiveMask().id,
          keyframes: { ${duration ?? '1000'}: {opacity:1} },
        };
        
        engine.anims.push(new engine.constructors.animation(data1${dynaVarName}));
        engine.anims.push(new engine.constructors.animation(data2${dynaVarName}));

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