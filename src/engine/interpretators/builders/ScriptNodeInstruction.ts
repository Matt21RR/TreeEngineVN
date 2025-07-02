import { Instruction, Token } from "../ChaosInterpreter.ts";
import InstructionInterface from "../InstructionInterface.ts";

class ScriptNodeinstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}
//Reckord0 = new ScriptNode({actor:"actorId"})
    try {
      if(getToken(0).type == "word" || getToken(0).type == "text"){
        if(getToken(1).type == "operator" && getToken(1).value == "="){
          if(getToken(2).type == "word" && getToken(2).value == "new"){
            if(getToken(3).type == "word" && getToken(3).value == "ScriptNode"){
              if(getToken(4).constructor.name == "Array"){
                return {match:true, id: getToken(0).type == "word" ? '"'+getToken(0).value+'"' : getToken(0).value};
              }
            }
          }
        }
      }
      return {match:false}; 
    } catch (error) {
      return {match:false};
    }
  }
  protected interpretate(isInRoutineMode: boolean, extractedData: { [key: string]: any; }) {
    const value:string = extractedData.value;
    const id:string = extractedData.id;

    let res:Array<string> = [];

    var dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");

    res.push(
      `var ${dynaVarName} = ${value};`,

      `Object.assign(${dynaVarName} ,{id:${id}});`
    );


  }
}