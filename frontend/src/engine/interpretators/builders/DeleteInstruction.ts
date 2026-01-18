import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";

class DeleteInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const creatableObjects = ["GraphObject","TextureAnim","Animation","Trigger","CodedRoutine","KeyboardTrigger"];
    const getToken = (idx)=>{return instruction[idx];}

    if(getToken(0).type == "word" && getToken(0).value.toLowerCase() == "delete"){
      if(getToken(1).type == "word" && creatableObjects.includes(getToken(1).value)){
        if(getToken(2).type == "word" || getToken(2).type == "text"){
          return {
            match: true, 
            branch: getToken(1).value, 
            id: getToken(2).type == "word" ? "'"+getToken(2).value+"'" : getToken(2).value
          };
        }
      }
    }
    return {match: false};
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