import { Dictionary } from "../../../global.ts";
import InstructionInterface from "../InstructionInterface.ts";


class CreateInstruction extends InstructionInterface{
  isOfThisType(instruction){
    const creatableObjects = ["GraphObject","TextureAnim","Animation","Trigger","CodedRoutine","KeyboardTrigger", "Actor", "StageMark"];
    const getToken = (idx)=>{return instruction[idx];}

    try {
      if(getToken(0).type == "word" || getToken(0).type == "text"){
        if(getToken(1).type == "operator" && getToken(1).value == "="){
          if(getToken(2).type == "word" && getToken(2).value == "new"){
            if(getToken(3).type == "word" && creatableObjects.includes(getToken(3).value)){
              if(getToken(4).constructor === Array){
                return {
                  match:true, 
                  branch: getToken(3).value, 
                  id: getToken(0).type == "word" ? '"'+getToken(0).value+'"' : getToken(0).value
                };
              }
            }
          }
        }
      }
      //*OR
      if(getToken(0).type == "word" && getToken(0).value == "new"){
        if(getToken(1).type == "word" && getToken(1).value == "KeyboardTrigger"){
          if(getToken(2).constructor === Array){
            return {
              match: true, 
              branch: getToken(1).value, 
              id: null
            };
          }
        }
      }
      return {match:false}; 
    } catch (error) {
      return {match:false};
    }
  }
  interpretate(isInRoutineMode: boolean, extractedData:Dictionary): string{
    const value:string = extractedData.value;
    const branch:string = extractedData.branch;
    const id:string = extractedData.id;

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
          `var data${dynaVarName} = {
             id:${id},
             relatedTo:${dynaVarName}[0],
          };
          Object.assign(data${dynaVarName},${dynaVarName}[1]);

          engine.triggers.push(new engine.constructors.trigger(data${dynaVarName}));`
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