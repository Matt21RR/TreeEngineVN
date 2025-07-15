import InstructionInterface from "../InstructionInterface.ts";
import Token from "../Token.ts";

class ScriptNodeinstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}

    try {
      if(instruction.length == 1){ //Check for Narration

      }
      if(instruction.length == 2){//Check for emotionless Dialog
        if(getToken(0).type == "operator" && getToken(0).value == "-"){
          if(getToken(1).type == "text"){
            return {match:true, text: getToken(1).value}
          }
        }
      }
      if(instruction.length == 3){//Check for dialog with emotion
        if(getToken(0).constructor.name == "Array" && getToken(0).length == 3){
          const emotion = getToken(0)[1].value as string;
          if(getToken(1).type == "operator" && getToken(1).value == "-"){
            if(getToken(2).type == "text"){
              return {match:true, text: getToken(2).value, emotion}
            }
          }
        }
      }

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