import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";
import { TokenType } from "../Token.ts";

class DeleteInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const creatableObjects = ["GraphObject","TextureAnim","Animation","Trigger","CodedRoutine","KeyboardTrigger", "Actor", "StageMark"];

    return this.conditionsChecker(instruction,{
      0: {type: TokenType.word, wordMatch:"delete"},
      1: [
        {
          1: {type: TokenType.word, condition: (token)=>{return creatableObjects.includes(token.value)}},
          2: {type: [TokenType.word, TokenType.text], result: (tokens)=>{
            return {
              branch: tokens[1].value, 
              all: false,
              id: tokens[2].type == TokenType.word ? "'"+tokens[2].value+"'" : tokens[2].value
            };
          }}
        },{
          1: {type: TokenType.word, wordMatch:"all"},
          2: {type: TokenType.word, condition: (token)=>{return creatableObjects.includes(token.value)}, result: (tokens)=>{
            return {
              branch: tokens[2].value, 
              all: true,
              id: null
            };
          }}
        }
      ]
    });
  }
  interpretate(isInRoutineMode:boolean, extractedData: Dictionary) {
    const branch:string = extractedData.branch;
    const id:string = extractedData.id;
    const all:boolean = extractedData.all;

    let res:Array<string> = [];

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    const assignedSpace = {
      "GraphObject": "graphArray",
      "TextureAnim": "textureManager.textureAnims",
      "Trigger": "triggers",
      "KeyboardTrigger": "inputManager.keyboardTriggers",
      "Animation": "anims",
      "CodedRoutine": "codedRoutines",
      "Actor": "actors",
      "StageMark": "stageMarks"

    }

    if(all){
      res.push(
        `engine.${assignedSpace[branch]}.wipe();`
      );
    } else {
      res.push(
        `engine.${assignedSpace[branch]}.remove(${id});`
      );
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