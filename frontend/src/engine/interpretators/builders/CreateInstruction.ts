import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";


class CreateInstruction extends InstructionInterface{
  isOfThisType(instruction): Dictionary {
    const creatableObjects = ["GraphObject","TextureAnim","Animation","Trigger","CodedRoutine","KeyboardTrigger", "Actor", "StageMark"];
    let result = this.conditionsChecker(instruction, {
      0: {type: ["word", "text"]},
      1: {type: "operator", wordMatch: "="},
      2: {type: "word", wordMatch: "new"},
      3: {type: "word", condition: (token)=>{return creatableObjects.includes(token.value)}},
      4: {isArray: true, result: (tokens)=>{
        return {
          match:true, 
          branch: tokens[3].value, 
          id: tokens[0].type == "word" ? '"'+tokens[0].value+'"' : tokens[0].value
        };
      }}
      
    });

    if(!result.match){
      result = this.conditionsChecker(instruction, {
        0: {type: "word", wordMatch: "new"},
        1: {type: "word", wordMatch: "KeyboardTrigger"},
        2: {isArray: true, result: (tokens)=>{
          return {
            match: true, 
            branch: tokens[1].value, 
            id: null};
        }}
      });
    }
    
    return result;
  }


  interpretate(isInRoutineMode: boolean, extractedData:Dictionary): string{
    const value:string = extractedData.value;
    const branch:string = extractedData.branch;
    const id:string = extractedData.id;

    let res:Array<string> = [];

    const dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");

    if(isInRoutineMode){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    res.push(
      `var ${dynaVarName} = ${value};`
    );
    switch(branch){
      case "GraphObject":
        res.push(
          `Object.assign(${dynaVarName} ,{id:${id}});
          engine.graphArray.push(new engine.constructors.graphObject(${dynaVarName}))`
        );
        break;
      case "TextureAnim":
        res.push(
          `var data${dynaVarName} = {
              list:${dynaVarName}[0],
              id:${id}
          };
          Object.assign(data${dynaVarName},${dynaVarName}[1]);

          engine.textureAnims.push(new engine.constructors.textureAnim(data${dynaVarName}));`
        );
        break;
      case "Trigger":
        res.push(
          `
          let data${dynaVarName};
          if(${dynaVarName}.constructor.name == "Array"){
            data${dynaVarName} = {
              id:${id},
              relatedTo:${dynaVarName}[0],
            };
            Object.assign(data${dynaVarName},${dynaVarName}[1]);

          }else{
            data${dynaVarName} = {
              id:${id},
            };
            Object.assign(data${dynaVarName},${dynaVarName});
          }

          engine.triggers.push(new engine.constructors.trigger(data${dynaVarName}));
          `
        );
        break;
      case "KeyboardTrigger":
        res.push(
          `var data${dynaVarName} = {
              keys:${dynaVarName}[0]
          };
          Object.assign(data${dynaVarName},${dynaVarName}[1]);

          engine.keyboardTriggers.push(new engine.constructors.keyboardTrigger(data${dynaVarName}));`
        );
        break;
      case "Animation":
        res.push(
          `var data${dynaVarName} = {
             id:${id},
             relatedTo:${dynaVarName}[0],
             keyframes:${dynaVarName}[1],
          };
          Object.assign(data${dynaVarName},${dynaVarName}[2]);
          
          engine.anims.push(new engine.constructors.animation(data${dynaVarName}));`
        );
        break;
      case "CodedRoutine":
        res.push(
          `Object.assign(${dynaVarName},{id:${id}});

          engine.codedRoutines.push(new engine.constructors.codedRoutine(${dynaVarName}));`
        );
        break;
      case "Actor":
        res.push(
          `Object.assign(${dynaVarName} ,{id:${id}});
          
          engine.graphArray.push(
            new engine.constructors.graphObject(
              {
                id:(${id} + "->ActorParent"),
                enabled: true
              }
            )
          );

          if (${dynaVarName}.body){
            // Type changes here, from string to GraphObject ref
            // Replace the bodyId with the reference to the graphobject in the interpretation phase
            ${dynaVarName}.body = engine.graphArray.fastGet( ${dynaVarName}.body );
            ${dynaVarName}.body.parent = ${id} + "->ActorParent";
          }

          if (${dynaVarName}.emotions){
            // Type changes here, from Dictionary<string> to Dictionary<GraphObject>
            // replace the emotions maskId with the reference to the graphobject in the interpretation phase

            for (const emotion in ${dynaVarName}.emotions) {
              const maskId = ${dynaVarName}.emotions[emotion];
              ${dynaVarName}.emotions[emotion] =  engine.graphArray.fastGet(maskId);
              ${dynaVarName}.emotions[emotion].parent = ${id} + "->ActorParent"
            }

          }
          
          engine.actors.push(new engine.constructors.actor(${dynaVarName}));`
        );
        break;

      case "StageMark":
        res.push(
          `Object.assign(${dynaVarName} ,{id:${id}});
          engine.stageMarks.push(new engine.constructors.stageMark(${dynaVarName}))`
        );
        break;
    }
    if(isInRoutineMode){
      res.push(
        "});"
      );
    }
    return res.join(" \n ");
  }
}

export default CreateInstruction;