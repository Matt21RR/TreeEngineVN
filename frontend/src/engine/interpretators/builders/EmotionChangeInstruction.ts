import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";
import { TokenType } from "../Token.ts";

class EmotionChangeInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction,{
      0: {type: TokenType.word},
      1: {type: TokenType.word, wordMatch: "gets"},
      2: [
        {
          2: {type: TokenType.word, instructionLength: 5},
          3: {type: TokenType.word, wordMatch: "in"},
          4: {type: TokenType.number, result:(tokens)=>{
            return {
              actorId: tokens[0].value, 
              emotionId: tokens[2].value,
              duration: tokens[4].value};
          }}
        },
        {
          2: {type: TokenType.word, result:(tokens)=>{
            return {
              actorId: tokens[0].value, 
              emotionId: tokens[2].value};
          }}
        }
      ]
    });
  }
  
  interpretate(isInRoutineMode: boolean, extractedData: Dictionary) {
    const actorId:string = extractedData.actorId;
    const emotionId:string = extractedData.emotionId;
    const duration:string = extractedData.duration;

    const dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");

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