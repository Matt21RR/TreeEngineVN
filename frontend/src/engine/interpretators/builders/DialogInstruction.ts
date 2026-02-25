import { Dictionary } from "../../../global.ts";
import { isTemplateLiteral, templateLiteralSplitter } from "../../logic/Misc.ts";
import AgrupableInstructionInterface from "../AgrupableInstructionInterface.ts";
import { Interpretation } from "../ChaosInterpreter.ts";
import Token from "../Token.ts";

class DialogInstruction extends AgrupableInstructionInterface{
  private specialInstructionReductor(instruction){

    let dec:Array<string> = [];
    for (const token of instruction) {
      if(Array.isArray(token)){
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
    return this.conditionsChecker(instruction,{
      0: {type:"operator", wordMatch:"-"},
      1: {type:"text", result:(tokens)=>{
        tokens.shift();
        const dialog = this.specialInstructionReductor(tokens);
        return {dialog};
      }}
    });
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
    let newResult = interpretedInstructions
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

    let res = structuredClone(interpretedInstructions[0]);
    res.result = newResult;
    return res
  }
}

export default DialogInstruction