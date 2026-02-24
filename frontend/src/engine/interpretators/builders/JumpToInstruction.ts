import InstructionInterface from "../InstructionInterface.ts";

class JumpToInstruction extends InstructionInterface{
  isOfThisType(instruction){
    return this.conditionsChecker(instruction, {
      0: {type:"word", wordMatch:"jumpto"},
      // 1: {type:"separator", wordMatch:":"},
      1: {type:"word", result:(tokens)=>{
        return {label: tokens[1].value}
      }}
    });
  }
  protected interpretate(isInRoutineMode: boolean, extractedData: { [key: string]: any; }) {
    const label:string = extractedData.label;

    let res:Array<string> = [];

    // if(isInRoutineMode){
    //   res.push(
    //     "engine.routines.push((engine)=>{"
    //   );
    // }
    res.push(
      ` engine.runNode("${label}");`
    );
    // if(isInRoutineMode){
    //   res.push(
    //     "});"
    //   );
    // }
    return res.join(" \n ");
  }
}

export default JumpToInstruction;