import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

class SetInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const creatableObjects = ["GraphObject","TextureAnim","Animation","Trigger","CodedRoutine","KeyboardTrigger","Engine"];
    return this.conditionsChecker(instruction,{
      0: {type:"word", wordMatch:"set"},
      1: {type:"word", condition:(token)=>{return creatableObjects.includes(token.value)}},
      2: {type:["word","text"], result: (tokens)=>{
        return {
          branch: tokens[1].value, 
          id: tokens[2].type == "word" ? "'"+tokens[2].value+"'" : tokens[2].value};
      }}
    });
  }
  interpretate(isInRoutineMode:boolean, extractedData: Dictionary) {
    const branch:string = extractedData.branch;
    const id:string = extractedData.id;
    const value:string = extractedData.value;

    let res:Array<string> = [];

    const dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    res.push(
      `let ${dynaVarName} = ${value};`
    );
    if(branch != "Engine")
      res.push(
        `Object.keys(${dynaVarName}).forEach(key=>{`
      );
    switch(branch){
      case "Engine":
        res.push(
          `
            if(${id} in engine){
              if(${dynaVarName} instanceof Object && engine[${id}] instanceof Object){
                ExtendedObjects.modify(${dynaVarName},engine[${id}]);
              }else{
                engine[${id}] = ${dynaVarName};
              }
            }else{
              console.error("${id} don't exists in RenderEngine Class");
            }
          `
        );
        break;
      case "GraphObject":
        res.push(
          `engine.graphArray.get(${id})[key] = ${dynaVarName}[key];`
        );
        break;
      case "TextureAnim":
        res.push(
          `engine.textureAnims.get(${id})[key] = ${dynaVarName}[key];`
        );
        break;
      case "Trigger":
        res.push(
          `engine.triggers.get(${id})[key] = ${dynaVarName}[key];`
        );
        break;
      case "KeyboardTrigger":
        res.push(
          `engine.keyboardTriggers.get(${id})[key] = ${dynaVarName}[key];`
        );
        break;
      case "Animation":
        res.push(
          `engine.anims.get(${id})[key] = ${dynaVarName}[key];`
        );
        break;
      case "CodedRoutine":
        res.push(
          `engine.codedRoutines.get(${id})[key] = ${dynaVarName}[key];`
        );
        break;
      //TODO: add throw error on default
    }
    if(branch != "Engine")
    res.push(
      "});",
    );
    if(isInRoutineMode){
      res.push(
        "});"
      );
    }
    return res.join(" \n ");
  }
}

export default SetInstruction;