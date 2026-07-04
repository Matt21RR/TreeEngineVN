import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";
import { TokenType } from "../Token.ts";

class SetInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const creatableObjects = ["GraphObject","TextureAnim","Animation","Trigger","CodedRoutine","KeyboardTrigger","Engine"];
    return this.conditionsChecker(instruction,{
      0: {type:TokenType.word, wordMatch:"set"},
      1: {type:TokenType.word, condition:(token)=>{return creatableObjects.includes(token.value)}},
      2: {type:[TokenType.word,TokenType.text]},
      3:[
        { //Set GraphObject fury {opacity:0.9}
          3: {isArray:true, instructionLength:4, result: (tokens)=>{
              return {
                branch: tokens[1].value, 
                id: tokens[2].type == TokenType.word ? "'"+tokens[2].value+"'" : tokens[2].value,
                property: null,
                operation: null,
                valSet:null
              };
            }}
        },
        { //Set GraphObject fury opacity += yoink.val
          //Set Engine camera position.x += yoink.val
          //Set Engine camera position[axis] += yoink.val
          3:{type:TokenType.word, result: (tokens)=>{
            console.log(tokens)
            let property = "";
            let endPropertyDef = false;
            let operation = "";
            let value = "";
            let endOperationDef = false;
            tokens.slice(3).forEach((token)=>{
              if(token.type != TokenType.operator && !endPropertyDef){
                property += token.value;
              }
              else if(token.type == TokenType.operator && !endOperationDef){
                endPropertyDef = true;
                operation += token.value;
              }
              else{
                endOperationDef = true;
                value += token.value;
              }
            });
            return {
              branch: tokens[1].value, 
              id: tokens[2].type == TokenType.word ? "'"+tokens[2].value+"'" : tokens[2].value,
              property,
              operation,
              valSet:value
            };

          }}//Element parameter key
          
        }
      ]
    });
  }
  interpretate(isInRoutineMode:boolean, extractedData: Dictionary) {
    console.log(extractedData);
    const branch:string = extractedData.branch;
    const id:string = extractedData.id;
    const value:string = extractedData.value;

    let property:string = extractedData.property;
    property = property ? "." + property : null;
    const operation:string = extractedData.operation ?? "=";
    const valSet:string = extractedData.valSet == "undefined" ? 
            //remove the first and last brackets
            extractedData.value.substring(1, extractedData.value.length - 1) : 
            extractedData.valSet;

    let res:Array<string> = [];
    const dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");
    const dynaValueConstName = dynaVarName+"_const";

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    if(property && operation && valSet){
      res.push(`
        const ${dynaValueConstName} = ${valSet.at(-1) == ';' ? valSet : valSet + ';'}
      `);
    }else{
      res.push(
        `let ${dynaVarName} = ${value};`
      );
      if(branch != "Engine")
        res.push(
          `Object.keys(${dynaVarName}).forEach(key=>{
            const ${dynaValueConstName} = ${dynaVarName}[key];
          `
        );
    }

    const branchesOperations = {
      Engine:() => res.push(
        property ? `engine[${id}]${property} ${operation} ${dynaValueConstName};` : 
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
        ),
      GraphObject:() => res.push(
          `engine.graphArray.get(${id})${property ?? "[key]"} ${operation} ${dynaValueConstName};`
        ),
      TextureAnim:() =>
        res.push(
          `engine.textureManager.textureAnims.get(${id})${property ?? "[key]"} ${operation} ${dynaValueConstName};`
        ),
      Trigger:() => res.push(
          `engine.triggers.get(${id})${property ?? "[key]"} ${operation} ${dynaValueConstName};`
        ),
      KeyboardTrigger:() => res.push(
          `engine.inputManager.keyboardTriggers.get(${id})${property ?? "[key]"} ${operation} ${dynaValueConstName};`
        ),
      Animation:() => res.push(
          `engine.anims.get(${id})${property ?? "[key]"} ${operation} ${dynaValueConstName};`
        ),
      CodedRoutine:() => res.push(
          `engine.codedRoutines.get(${id})${property ?? "[key]"} ${operation} ${dynaValueConstName};`
        )
    }
    branchesOperations[branch]?.() ?? console.error("SetInstruction: Branch not found: " + branch);

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