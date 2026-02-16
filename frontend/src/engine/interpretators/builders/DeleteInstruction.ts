import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

class DeleteInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const creatableObjects = ["GraphObject","TextureAnim","Animation","Trigger","CodedRoutine","KeyboardTrigger", "Actor", "StageMark"];

    return this.conditionsChecker(instruction,{
      0: {type: "word", wordMatch:"delete"},
      1: {type: "word", condition: (token)=>{return creatableObjects.includes(token.value)}},
      2: {type: ["word", "text"], result: (tokens)=>{
        return {
          branch: tokens[1].value, 
          id: tokens[2].type == "word" ? "'"+tokens[2].value+"'" : tokens[2].value
        };
      }}
    });
  }
  interpretate(isInRoutineMode:boolean, extractedData: Dictionary) {
    const branch:string = extractedData.branch;
    const id:string = extractedData.id;

    let res:Array<string> = [];

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    switch(branch){
      case "GraphObject":
        res.push(
          `engine.graphArray.remove(${id});`
        );
        break;
      case "TextureAnim":
        res.push(
          `engine.textureAnims.remove(${id});`
        );
        break;
      case "Trigger":
        res.push(
          `engine.triggers.remove(${id});`
        );
        break;
      case "KeyboardTrigger":
        res.push(
          `engine.keyboardTriggers.remove(${id});`
        );
        break;
      case "Animation":
        res.push(
          `engine.anims.remove(${id});`
        );
        break;
      case "CodedRoutine":
        res.push(
          `engine.codedRoutines.remove(${id});`
        );
        break;
      //TODO: add throw error on default
    }
    if(isInRoutineMode){
      res.push(
        "});"
      );
    }
    return res.join(" \n ");
  }
}

export default DeleteInstruction;