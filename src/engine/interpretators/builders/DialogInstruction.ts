import InstructionInterface from "../InstructionInterface.ts";

class DialogInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}
    if(getToken(0).type == "word" && getToken(0).value.toLowerCase() == "speak"){
      if(getToken(1).constructor.name == "Array"){
        return {match:true, actor: "..."};
      }else if(getToken(1).type == "word"){
        if(getToken(2).constructor.name == "Array"){
          return {match:true, actor:getToken(1).value};
        }
      }
    }
    return {match:false};
  }
  interpretate(isInRoutineMode: boolean, extractedData:{[key:string]:any}) {
    const actor:string  = extractedData.actor;
    const dialogs:string = extractedData.value;

    let res :Array<string> = [];

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }

    res.push(
     `engine.dialogNumber = 0;
      engine.voiceFrom = '${actor}';
      engine.dialog = ${dialogs};

      engine.graphArray.get('dialogbox').text = '';
      engine.graphArray.get('dialogbox').enabled = true;

      engine.graphArray.get('voiceByName').enabled = true;

      engine.resume = false;`
    );
    if(isInRoutineMode){
      res.push(
        "});"
      );
    }
    return res.join(" \n ");
  }
}

export default DialogInstruction;