import { Dictionary } from "../../../global.ts";
import { isTemplateLiteral, templateLiteralSplitter } from "../../logic/Misc.ts";
import AgrupableInstructionInterface from "../AgrupableInstructionInterface.ts";
import { Interpretation } from "../ChaosInterpreter.ts";
import Token from "../Token.ts";

class DialogInstruction extends AgrupableInstructionInterface{
  private specialInstructionReductor(instruction){
    var dec:Array<string> = [];
    for (const token of instruction) {
      if(token.constructor.name == "Array"){
        const configDict = this.getStrParamsFromTokenList(token);
        dec.push(`{type:"config",value:${configDict}}`);
        continue;
      }
      else if((token as Token).type == "text"){ //is token and must to be an text token
        if(isTemplateLiteral(token.value)){
          const templateLit = templateLiteralSplitter(token.value);
          for (const element of templateLit) {
            if(element.indexOf("${") == 0){
              dec.push(`{type:"expresion",value:"${element}"}`);
            }else{
              dec = dec.concat(element.split("").filter(e=>e != '"').map(e=>{return `{type:"text",value:"${e}"}`}))
            }
          }
        }else{
          dec = dec.concat(token.value.split("").filter(e=>e != '"').map(e=>{return `{type:"text",value:"${e}"}`}))
        }
        continue;
      }
      throw new Error();
    }
    return dec.join(",");
  }
  protected isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}

    try {
      if(instruction.length >= 2){//Check for emotionless Dialog
        var emotion = "";
        if(getToken(0).type == "operator" && getToken(0).value == "-"){
          instruction.shift();
          if(getToken(0).constructor.name == "Array" && getToken(0).length == 3){//Check for dialog with emotion
            emotion = getToken(0)[1].value as string;
            instruction.shift();
          }
          if(getToken(0).type == "text"){
            var dialog = this.specialInstructionReductor(instruction);
            if(emotion != ""){
              dialog = `{type:"config",value:{emotion:"${emotion}"}} ,` + dialog;
            }
            return {match:true, dialog}
          }
        }
      }
      return {match:false}; 
    } catch (error) {
      console.error(error);
      return {match:false};
    }
  }
  interpretate(isInRoutineMode: boolean, extractedData:Dictionary) {
    const dialog:string = "["+extractedData.dialog+"]";
    const dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");
    const res =
    `engine.routines.push((engine)=>{
      engine.resume = false;
      engine.graphArray.get('dialogbox').text = '';
      engine.dialogNumber = 0;
      engine.charNumber = 0;

      const ${dynaVarName} = ${dialog};
      engine.dialog.push(${dynaVarName}); //TODO: Map the dictionary to know the config values to backup

      engine.graphArray.get('dialogbox').enabled = true;
      engine.graphArray.get('voiceByName').enabled = true;
    });`;

    return res;
  }
  agrupator(interpretedInstructions: Array<Interpretation>): Interpretation {
    var newResult = interpretedInstructions
      .map(e=> (e.result as string)
        .split("\n")
        .slice(5,-3)
        .join("\n"))
      .join("\n")

    newResult = `engine.routines.push((engine)=>{
      engine.resume = false;
      engine.graphArray.get('dialogbox').text = '';
      engine.dialogNumber = 0;
      engine.charNumber = 0;

      ${newResult}

      engine.graphArray.get('dialogbox').enabled = true;
      engine.graphArray.get('voiceByName').enabled = true;
    });`;

    var res = structuredClone(interpretedInstructions[0]);
    res.result = newResult;
    return res
  }
}

export default DialogInstruction