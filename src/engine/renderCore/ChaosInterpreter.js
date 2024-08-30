import $ from "jquery";
import { isArray } from "lodash";
class ChaosInterpreter {
  constructor(){

  }
  kreator(script){
    var instructions = this.instructionsDesintegrator(script);
    var scenes = this.separateScenes(instructions);
    let res = [];
    if(isArray(scenes)){
      scenes = scenes.map(instruction=>{
        return this.evaluateStuff(instruction);
      });
    }else{
      Object.keys(scenes).map(sceneName=>{
        const scene = scenes[sceneName];
        scene.forEach(instruction=>{
          res =  this.evaluateStuff(instruction);
        });
        scenes[sceneName] = res;
      })
    }
    console.log(scenes);

  }
  instructionsDesintegrator(script){
    var instructions = [];
    var acomulateLines = "";
    var indexWhereCommandObjectStart = 0;
    var counter = 0;//counts the openned {, [, (,

    script = script.replaceAll(/(@{2})+\w+/g,(e)=>{
      return e.replace("@@","engine.gameVars.");
    })

    script.split(/\r\n|\r|\n/,-1).forEach((line) =>{
      var lineF = line;
      if(counter != 0){

      }
      acomulateLines+=lineF; 

      lineF.split("").forEach(char=>{
        if(char == "{" || char == "[" || char == "("){counter++;} 
        if(char == "}" || char == "]" || char == ")"){counter--;}
        
        if(indexWhereCommandObjectStart == 0 && counter != 0){
          var e ={};
          e[acomulateLines.indexOf("{")] = "{";
          e[acomulateLines.indexOf("[")] = "[";
          e[acomulateLines.indexOf("(")] = "(";
          delete e[-1];
          indexWhereCommandObjectStart = Object.keys(e)[0];
        }
      });

      let command = "";
      let parameters = [];
      let value = "";
      if(counter == 0){//Counter keeps being zero
        if(indexWhereCommandObjectStart != 0){
          parameters = acomulateLines.slice(0,indexWhereCommandObjectStart);
          value = acomulateLines.slice(indexWhereCommandObjectStart);
        }else{
          //check jumpline
          indexWhereCommandObjectStart = acomulateLines.lastIndexOf(" ");
          if(indexWhereCommandObjectStart == -1){
            parameters = acomulateLines;
            value = acomulateLines;
          }else{
            parameters = acomulateLines.slice(0,indexWhereCommandObjectStart);
            value = acomulateLines.slice(indexWhereCommandObjectStart+1);
          }
        }

        parameters = parameters.trim().split(" ").filter(word => {return word != ""});
        if(parameters.length != 0){
          command = parameters.shift();
        }

        instructions.push({
          command : command,
          parameters : parameters,
          value : value,
          text : acomulateLines
        })
        acomulateLines = "";
        indexWhereCommandObjectStart = 0;
      }else if(lineF.replaceAll(" ","") == ""){
        indexWhereCommandObjectStart = 0;
      }
    });
    console.log(instructions);
    console.log(this.separateScenes(instructions));
    instructions.forEach(instruction => {
      console.log(this.evaluateStuff(instruction));
    })
    return(instructions);
  }
  separateScenes(primitiveScripts){
    var sceneStack = new Object();
    var commandStack = [];
    var sceneId = "";
    primitiveScripts.forEach(instruction => {
        if(instruction.command == "scene" || instruction.command ==  "module"){
            if(sceneId != ""){
              Object.assign(sceneStack,{[sceneId]:commandStack})
              commandStack = [];    
            }
            sceneId = instruction.value;
        }else if(instruction.command == "end" && instruction.value == "file"){
          Object.assign(sceneStack,{[sceneId]:commandStack});
        }else{
          commandStack.push(instruction);    
        }
    });
    if(Object.keys(sceneStack) == 0){
      sceneStack = commandStack;
    }
    return sceneStack;
  }
  //With the dam instructions separated we will...
  /**
   * 
   * @param {String} instruction 
   * @param {String} Scrapped Value of the instruction
   */
  evaluateStuff(instruction){
    let command = instruction.command;
    let parameters = instruction.parameters;
    let creationType = "";
    let id = "";
    let value = instruction.value;
    let text = instruction.text;
    let res = [];

    var dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");

    const creationAdecuation =()=>{
      command = "create";
      //removes parenthesis
      value = value.split("")
      value.shift();
      value.pop();
      value = value.join("");
      value = "["+value+"]"
    }
    if(parameters.length == 3){
      if(parameters[0] == "=" && parameters[1] == "new"){
        id = '"'+command+'"';
        creationAdecuation();
        creationType = parameters[2];
      }
    }
    if(command == "new"){
      creationAdecuation();
      creationType = parameters[0];
    }

    switch(command){
      case ">":
        res.push(
          text.replace(">","")
        );
        break;
      case "load":
        const loadType = parameters[0];
        switch (loadType) {
          case "textures":
            res.push(
              "engine.continue = false;",
              "$.get("+value+").then()"
            );
            break;
          case "sounds":
            
            break;
          case "script":

            break;
        }
        break;
      case "wait":
        res.push(
          "engine.continue = false;"
        );
        if(value != ""){
          const time = value*1;
          res.push(
            "setTimeout(()=>{engine.continue = true},"+ (time)+");"
          );
        }
        break;
      case "continue":
        res.push(
          "engine.continue = true;"
        );
        break;
      case "narration":
        res.push(
          "engine.triggers.get('avanzarNarracion').enabled = true;",
          "engine.paragraphNumber = 0;",
          "engine.voiceFrom = 'nobody';",
          "engine.narration = ("+value+").join('\n');",
          "",
          "engine.paragraph += '\n' + engine.narration.split('\n')[0];",
          "engine.graphArray.get('narrationBox').text = '';",
          "engine.graphArray.get('narrationBox').enabled = true;",
          "",
          "engine.continue = false;",
        );

        break;
      case "$":
        res.push(
          "engine.dialogNumber = 0;",
          "engine.voiceFrom = "+parameters[0]+";",
          "engine.dialog = "+value+";",
          "",
          "engine.graphArray.get('dialogbox').text = '';",
          "engine.graphArray.get('dialogbox').enabled = true;",
          "",
          "engine.graphArray.get('voiceByName').enabled = true;",
          "",
          "engine.continue = false;",
        );
        break;
      case "create":
        res.push(
          "var "+dynaVarName+" = "+value+";"
        );
        switch(creationType){
          case "GraphObject":
            res.push(
              "Object.assign("+dynaVarName+",{id:"+id+"})",

              "engine.graphArray.push(new GraphObject("+dynaVarName+"));"
            );
            break;
          case "TextureAnim":
            res.push(
              "var data"+dynaVarName+" = {",
              "   list:"+dynaVarName+"[0],",
              "   id:"+id+",",
              "};",
              "Object.assign(data"+dynaVarName+","+dynaVarName+"[1]);",

              "engine.textureAnims.push(new TextureAnim(data"+dynaVarName+")));"
            );
            break;
          case "Trigger":
            res.push(
              "var data"+dynaVarName+" = {",
              "   id:"+id+",",
              "   relatedTo:"+dynaVarName+"[0],",
              "};",
              "Object.assign(data"+dynaVarName+","+dynaVarName+"[1]);",

              "engine.triggers.push(new Trigger(data"+dynaVarName+")));"
            );
            break;
          case "KeyboardTrigger":
            res.push(
              "var data"+dynaVarName+" = {",
              "   keys:"+dynaVarName+"[0],",
              "};",
              "Object.assign(data"+dynaVarName+","+dynaVarName+"[1]);",

              "engine.keyboardTriggers.push(new KeyboardTrigger(data"+dynaVarName+")));"
            );
            break;
          case "Animation":
            res.push(
              "var data"+dynaVarName+" = {",
              "   id:"+id+",",
              "   relatedTo:"+dynaVarName+"[0],",
              "   keyframes:"+dynaVarName+"[1],",
              "};",
              "Object.assign(data"+dynaVarName+","+dynaVarName+"[2]);",
              
              "engine.anims.push(new Animation(data"+dynaVarName+")));"
            );
            break;
          case "CodedRoutine":
            res.push(
              "Object.assign("+dynaVarName+",{id:"+id+"})",

              "engine.codedRoutines.push(new CodedRoutine("+dynaVarName+"));"
            );
            break;
        }
    }
    return res;
  }
}
export {ChaosInterpreter as Chaos};