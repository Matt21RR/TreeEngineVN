import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";
import { TokenType } from "../Token.ts";

export default class ArriveInstruction extends InstructionInterface{
  isOfThisType(instruction): Dictionary {
    let result = this.conditionsChecker(instruction,{
      0: {type:TokenType.word},
      1: {type:TokenType.word, wordMatch:"arrives"},
      2: {type:TokenType.word, wordMatch:"to"},
      3: [
        {
          3:{type:TokenType.word, instructionLength:6},
          4:{type:TokenType.word, wordMatch:"in"},
          5:{type:TokenType.number, result:(tokens)=>{
            return {
              actorId: tokens[0].value, 
              markId: tokens[3].value, 
              duration: tokens[5].value};
          }}
        },
        {
          3:{type:TokenType.word, result:(tokens)=>{
            return {
              actorId: tokens[0].value, 
              markId: tokens[3].value};
          }}
        }
      ]
    });

    return result;
  }

  interpretate(isInRoutineMode: boolean, extractedData: Dictionary) {
    const actorId:string = extractedData.actorId;
    const markId:string = extractedData.markId;
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