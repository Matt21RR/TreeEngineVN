import InstructionInterface from "../InstructionInterface.ts";

class NarrationInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const getToken = (idx)=>{return instruction[idx];}

    if(getToken(0).type == "word" && getToken(0).value.toLowerCase() == "narration"){
      if(getToken(1).constructor.name == "Array"){
        return {match:true};
      }
    }
    return {match:false};
  }
  interpretate(isInRoutineMode: boolean, extractedData:{[key:string]:any}) {
    const value:string = extractedData.value;
    const res =
    `engine.routines.push((engine)=>{
      engine.triggers.get('avanzarNarracion').enabled = true;
      engine.paragraphNumber = 0;
      engine.voiceFrom = 'nobody';
      engine.narration = ${value};
      engine.paragraph += engine.getStr(engine.lambdaConverter(engine.narration[0]));
      engine.graphArray.get('narrationBox').text = '';
      engine.graphArray.get('narrationBox').enabled = true;
      engine.resume = false;
    });`;

  return res;
  }
}

export default NarrationInstruction;