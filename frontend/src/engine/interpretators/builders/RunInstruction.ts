import { Dictionary } from "../../../global.ts";
import { Chaos } from "../ChaosInterpreter.ts";
import InstructionInterface from "../InstructionInterface.ts";

class RunInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const runableObjects = ["script"];
    return this.conditionsChecker(instruction, {
      0: {type:"word", wordMatch:"run"},
      1: {type:"word", condition:(token)=>{return runableObjects.includes(token.value)}},
      2: {type:"text", result:(tokens)=>{
        return {branch: tokens[1].value, id: tokens[2].value};
      }}
    });
  }
  interpretate(isInRoutineMode: boolean, extractedData: Dictionary) {
    const branch:string = extractedData.branch;
    const id:string = extractedData.id;
    const chaosReference:Chaos = extractedData.chaosReference;
    let res = "";

    switch (branch) {
      case "script":
        res =
          `engine.routines.push((engine)=>{
            engine.loadScript('${chaosReference.scriptsUrls[id.replaceAll('"',"")]}',${id})
          });`;
        break;
    }
    return res;
  }
}

export default RunInstruction;