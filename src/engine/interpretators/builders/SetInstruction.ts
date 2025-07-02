import InstructionInterface from "../InstructionInterface.ts";

class SetInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const creatableObjects = ["GraphObject","TextureAnim","Animation","Trigger","CodedRoutine","KeyboardTrigger","Engine"];
    const getToken = (idx)=>{return instruction[idx];}
    if(getToken(0).type == "word" && getToken(0).value.toLowerCase() == "set"){
      if(getToken(1).type == "word" && creatableObjects.includes(getToken(1).value)){
        if(getToken(2).type == "word" || getToken(2).type == "text"){
          return {match: true, branch:getToken(1).value, id:getToken(2).type == "word" ? "'"+getToken(2).value+"'" : getToken(2).value};
        }
      }
    }
    return {match: false};
  }
  interpretate(isInRoutineMode:boolean, extractedData: {[key:string]:any}) {
    const branch:string = extractedData.branch;
    const id:string = extractedData.id;
    const value:string = extractedData.value;

    let res:Array<string> = [];

    var dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    res.push(
      `var ${dynaVarName} = ${value};`
    );
    if(branch != "Engine")
      res.push(
        `Object.keys(${dynaVarName}).forEach(key=>{`
      );
    switch(branch){
      case "Engine":
        res.push(
          `
            if(${id} in engine){
              if(${dynaVarName} instanceof Object && engine[${id}] instanceof Object){
                ExtendedObjects.modify(${dynaVarName},engine[${id}]);
              }else{
                engine[${id}] = ${dynaVarName};
              }
            }else{
              console.error("${id} don't exists in RenderEngine Class");
            }
          `
        );
        break;
      case "GraphObject":
        res.push(
          `engine.graphArray.get(${id})[key] = ${dynaVarName}[key];`
        );
        break;
      case "TextureAnim":
        res.push(
          `engine.textureAnims.get(${id})[key] = ${dynaVarName}[key];`
        );
        break;
      case "Trigger":
        res.push(
          `engine.triggers.get(${id})[key] = ${dynaVarName}[key];`
        );
        break;
      case "KeyboardTrigger":
        res.push(
          `engine.keyboardTriggers.get(${id})[key] = ${dynaVarName}[key];`
        );
        break;
      case "Animation":
        res.push(
          `engine.anims.get(${id})[key] = ${dynaVarName}[key];`
        );
        break;
      case "CodedRoutine":
        res.push(
          `engine.codedRoutines.get(${id})[key] = ${dynaVarName}[key];`
        );
        break;
      //TODO: add throw error on default
    }
    if(branch != "Engine")
    res.push(
      "});",
    );
    if(isInRoutineMode){
      res.push(
        "});"
      );
    }
    return res.join(" \n ");
  }
}

export default SetInstruction;