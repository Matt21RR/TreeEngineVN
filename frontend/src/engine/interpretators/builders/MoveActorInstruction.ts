import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

export default class MoveActorInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:"word", wordMatch:"move"},
      1: {type:"word"},
      2: {type:"word", wordMatch:"to"},
      3: [
        {
          3: {type:"word", instructionLength:6},
          4: {type:"word", wordMatch:"in"},
          5: {type:"number", result:(tokens)=>{
            return {
              actorId: tokens[1].value, 
              markId: tokens[3].value, 
              duration: tokens[5].value};
          }}
        },
        {
          3: {type:"word", result:(tokens)=>{
            return {
              actorId: tokens[1].value, 
              markId: tokens[3].value};
          }}
        }
      ]
    });
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