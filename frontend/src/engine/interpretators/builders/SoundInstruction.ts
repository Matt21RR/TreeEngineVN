import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

export default class SoundInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}
    if(getToken(0).type == "word" && getToken(0).value.toLowerCase() == "sound"){
      if(getToken(1).type == "word" || getToken(1).type == "text"){
        if(getToken(2).type == "word"){
          return {
            match: true,
            action: getToken(2).value,
            id: getToken(1).type == "word" ? "'"+getToken(1).value+"'" : getToken(1).value
          };
        } else {
          return {
            match: true, 
            id: getToken(1).type == "word" ? "'"+getToken(1).value+"'" : getToken(1).value
          };
        }
      }
    }
    return {match: false};
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