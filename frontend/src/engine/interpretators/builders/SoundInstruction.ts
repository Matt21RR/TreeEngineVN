import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

export default class SoundInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:"word", wordMatch:"sound"},
      1: {type:["word","text"]},
      2: [
        {
          2: {type:"word", result:(tokens)=>{
            return {
              action: tokens[2].value,
              id: tokens[1].type == "word" ? "'"+tokens[1].value+"'" : tokens[1].value};
          }}
        },
        {
          2: {isArray:true, result:(tokens)=>{
            return {
              id: tokens[1].type == "word" ? "'"+tokens[1].value+"'" : tokens[1].value};
          }}
        }
      ]
    });
  }
  interpretate(isInRoutineMode:boolean, extractedData: Dictionary) {
    const id:string = extractedData.id;
    const action:string = extractedData.action;
    const value:string = extractedData.value;

    let res:Array<string> = [];

    var dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }

    if(value){
      res.push(
        `var ${dynaVarName} = ${value};`
      );

      res.push(
        `
        Object.keys(${dynaVarName}).forEach(key=>{
          engine.soundsList.fastGet(${id}).sound[key]( ${dynaVarName}[key] );
        });
        `
      );
    }
    if(action){
      res.push(`
        engine.soundsList.fastGet(${id}).sound.${action}();  
      `);
    }

    if(isInRoutineMode){
      res.push(
        "});"
      );
    }
    return res.join(" \n ");
  }
}