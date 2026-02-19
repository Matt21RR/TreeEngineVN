import { Dictionary } from "../../global.ts";
import { arrayFlatter } from "../logic/Misc.ts";
import { Chaos } from "./ChaosInterpreter.ts";
import Instruction from "./Instruction.ts";
import Token from "./Token.ts";

interface TokenCondition{
  type?: string | Array<string>,
	isArray?: boolean,
	wordMatch?:string,
	instructionLength?: number,
	condition?: (token:Token)=>boolean,
  result?:(tokens: Array<Token>)=>Dictionary,
}

type TokenPattern = {
  [key: number]: TokenCondition | Array<TokenPattern>;
};

abstract class InstructionInterface{
  protected abstract isOfThisType(instruction: Instruction|Token): Dictionary;
  protected abstract interpretate(isInRoutineMode:boolean, extractedData:Dictionary):(string|Dictionary);
  protected agrupable = false;

  isAgrupable(){
    return this.agrupable;
  }

  protected conditionsChecker(instruction: Instruction, conditions: TokenPattern | Array<TokenPattern>): Dictionary{
    if(Array.isArray(conditions)){
      for(let condition of conditions){
        const res = this.conditionsChecker(instruction, condition);
        if(res.match){
          return res;
        }
      }
      return {match:false};
    }
    for(let idx in conditions){
      const condition = conditions[idx];
      // console.log("Checking condition for token ", idx, " with condition ", condition);
      const token = instruction[Number(idx)];
      if(token === undefined){//there is no token in the instruction for this condition, so it can't be of this type
        break;
      }

      if(Array.isArray(condition)){
        return this.conditionsChecker(instruction, condition as Array<TokenPattern>);
      }else{
        const tokenCondition = condition as TokenCondition;
        if(tokenCondition.isArray && !Array.isArray(token)){
            break;
        }else if(!tokenCondition.isArray && Array.isArray(token)){
            break;
        }
        if(tokenCondition.type){
          if(Array.isArray(tokenCondition.type)){
            if(!(tokenCondition.type as Array<string>).includes((token as Token).type)){
              break;
            }
          }else if((token as Token).type != tokenCondition.type){
            break;
          }
        }
        if(tokenCondition.wordMatch && ((token as Token).value.toLowerCase() != tokenCondition.wordMatch.toLowerCase()) ){
            break;
        }
        if(tokenCondition.instructionLength){
          if(Array.isArray(instruction) && (instruction.length != tokenCondition.instructionLength)){
            break;
          }
        }
        if(tokenCondition.condition){
          if(!tokenCondition.condition(token as Token)){
            break;
          }
        }
      }
      if(!Array.isArray(condition) && (condition as TokenCondition).result){
        const result = (condition as TokenCondition).result(instruction as Array<Token>);
        Object.assign(result, {match:true});
        return result;
      }
      // console.log("Condition for token ", idx, " passed");
    }

    return {match:false};
  }

  private getStrParamsFromInstruction(instruction: Instruction){
    const plainTokenListOfParams = arrayFlatter((instruction.at(-1) as Array<Token>).flat());
    return this.getStrParamsFromTokenList(plainTokenListOfParams);
  }

  protected getStrParamsFromTokenList(instruction: Array<Token>){
    var strParams = instruction.map(token=>token.value).join("");

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
    if (Array.isArray((instruction as Instruction).at(-1))){
      strParams = this.getStrParamsFromInstruction(instruction);
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