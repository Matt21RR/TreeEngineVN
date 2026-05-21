import { Dictionary } from "../../../global.ts";
import { arrayChuncker, arrayFlatter } from "../../logic/Misc.ts";
import InstructionInterface from "../InstructionInterface.ts";
import { TokenType } from "../Token.ts";

class OptionInstruction extends InstructionInterface{
  isOfThisType(instruction){
    /**
     * 	 * "yes" then { "that's fantastic" }
     *   * "maybe" if { Math.random() >= 0.5 } then { jumpto "fire" } 
     *   * "no"
     */
    let firstElement, firstExpresion;
    let secondElement, secondExpresion;
    return this.conditionsChecker(instruction, {
      0: {type:TokenType.operator, wordMatch:"*"},
      1: [
        { 
          1: {type:TokenType.text, instructionLength:2, result:(tokens)=>{
            return {label: tokens[1].value};
          }}
        },
        {
          1: {type:TokenType.text},
          2: {type:TokenType.word, condition:(token)=>{
            firstElement = token.value;
            return ["if", "nextNode"].includes(token.value);
          }},
          3: [
            {
              3: {instructionLength:4, result:(tokens)=>{
                if(firstElement == "nextNode"){
                  firstExpresion = tokens[3].value;
                }else{
                  let tokArray = tokens[3] as unknown as Array<any>;
                  tokArray.shift();
                  tokArray.pop();
                  firstExpresion = `(engine)=>{${arrayFlatter(tokArray).map(e=>e.value).join("")} }`;
                }
                return {[firstElement]: firstExpresion, label: tokens[1].value};
              }}
            },{
              3: {instructionLength:6},
              4: {type:TokenType.word, condition:(token)=>{
                secondElement = token.value;
                return ["if", "nextNode"].includes(token.value) && secondElement != firstElement;
              }},
              5: {result:(tokens)=>{
                if(firstElement == "nextNode"){
                  firstExpresion = tokens[3].value;
                }else{
                  let tokArray = tokens[3] as unknown as Array<any>;
                  tokArray.shift();
                  tokArray.pop();
                  firstExpresion = `(engine)=>{${arrayFlatter(tokArray).map(e=>e.value).join("")} }`;
                }
                
                if(secondElement == "nextNode"){
                  secondExpresion = tokens[5].value;
                }else{
                  let tokArray = tokens[5] as unknown as Array<any>;
                  tokArray.shift();
                  tokArray.pop();
                  firstExpresion = `(engine)=>{${arrayFlatter(tokArray).map(e=>e.value).join("")} }`;
                }

                return {[firstElement]: firstExpresion, [secondElement]: secondExpresion, label: tokens[1].value};
              }}
            }
          ]
        }
      ]
    });
  }
  interpretate(isInRoutineMode: boolean, extractedData:Dictionary) {
    const label = extractedData.label;
    const condition = extractedData.if;
    const nextNode = extractedData.nextNode ? `"${extractedData.nextNode}"` : undefined;
    const res =
    `{label: ${label}, condition: ${condition}, nextNode: ${nextNode}}`;

    return res;
  }
}


export default class DecisionInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:TokenType.word, wordMatch:"ask", instructionLength:3},
      1: {type:TokenType.text},
      2: {isArray:true, result:(tokens)=>{
        let tokArray = tokens[2] as unknown as Array<any>;
        tokArray.shift();
        tokArray.pop();
        // debugger;
        return {tokArray: tokArray};
      }}
    });
  }
  interpretate(isInRoutineMode: boolean, extractedData:Dictionary) {
    const tokArray = extractedData.tokArray as Array<any>;
    const optionInstruction = new OptionInstruction();
    const options = arrayChuncker(tokArray, (token)=>{return token.type == "lineBreak"})
      .map((chunk)=>{
        return optionInstruction.isOfThisType(chunk.filter((token)=>(token.type != "space")));
      })
      .filter(optionData=>optionData.match)
      .map(optionData=>{
        return optionInstruction.interpretate(isInRoutineMode, optionData);
      })
      .join(",");
    const res =
    `engine.routines.push((engine)=>{
      const optionsData = [${options}];
      engine.uiInstance.loadDecisions(optionsData);
    });`;

    return res;
  }
}