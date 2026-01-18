import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

class EmotionChangeInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx :number)=>{return instruction[idx];}

    try {
      if(instruction.length >= 3){ //Check for Narration
        if(getToken(0).type == "word"){
          if(getToken(1).type == "word" && getToken(1).value.toLowerCase() == "gets"){
            if(getToken(2).type == "word"){
              if(instruction.length == 5 && getToken(3).type == "word" && getToken(3).value.toLowerCase() == "in"){
                if(getToken(4).type == "number"){
                  return {match:true, actorId: getToken(0).value, emotionId: getToken(2).value, duration: getToken(4).value};
                }
              }
              return {match:true, actorId: getToken(0).value, emotionId: getToken(2).value}
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
    const emotionId:string = extractedData.emotionId;
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
        let actor = engine.actors.get("${actorId}");

        let data1${dynaVarName} = {
          id: "animation1${dynaVarName}",
          enabled: true,
          relatedTo: actor.getActiveMask().id,
          keyframes: { ${duration ?? '500'}: {opacity:0} },
        };

        let data2${dynaVarName} = {
          id: "animation2${dynaVarName}",
          enabled: true,
          relatedTo: actor.emotions["${emotionId}"].id,
          keyframes: { ${duration ?? '500'}: {opacity:1} },
        };

        engine.anims.push(new engine.constructors.animation(data1${dynaVarName}));
        engine.anims.push(new engine.constructors.animation(data2${dynaVarName}));

        actor.emotion = "${emotionId}";

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

export default EmotionChangeInstruction;