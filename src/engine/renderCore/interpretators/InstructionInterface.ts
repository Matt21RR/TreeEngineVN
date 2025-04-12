import { arrayFlatter } from "../../logic/Misc.ts";
import { Chaos, Instruction, Token } from "../ChaosInterpreter.ts";

abstract class InstructionInterface{
  protected abstract isOfThisType(instruction: Instruction|Token):{[key:string]:any};
  protected abstract interpretate(isInRoutineMode:boolean, extractedData:{[key:string]:any}):any;

  #getStrParamsFromTokenList(instruction){
    const plainTokenListOfParams = arrayFlatter(instruction.at(-1).flat())
    var strParams = plainTokenListOfParams.map(token=>token.value).join("");

    if(strParams.indexOf("(") == 0){
      strParams = strParams.substring(1,strParams.length-1);
    }
    if(
      strParams[0] == "[" && strParams.at(-1) == "]"
      || strParams[0] == "{" && strParams.at(-1) == "}"
    ){
      return strParams;
    }else{
      return "["+strParams+"]";
    }
  }

  check(instruction, chaosReference:Chaos, isInRoutineMode:boolean){
    let strParams = "";
    if ((instruction as Instruction).at(-1) instanceof Array){
      strParams = this.#getStrParamsFromTokenList(instruction);
    }


    const extractedData = this.isOfThisType(instruction);
    if(extractedData.match){
      extractedData["value"] = strParams;
      extractedData["chaosReference"] = chaosReference;
      var interpretation = this.interpretate(isInRoutineMode,extractedData);
      return {match:true, result:interpretation}
    }else{
      return {match:false}
    }
  }
}

export default InstructionInterface;