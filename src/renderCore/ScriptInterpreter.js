import $ from "jquery";
import { requiredFiles } from "./RequireFile";
const script = require("./scriptTest.txt");

class ScriptInterpreter {
  #keywords = {
    "PUSH TEXTURES": "",
    "PUSH GRAPHOBJECT": "GraphObj.create(",
    "PUSH TRIGGER": "",
    "PUSH ANIMATION": "Animation.create(",
    "PUSH CODED_ANIMATION": "",
    "REMOVE TEXTURE": "",
    "REMOVE GRAPHOBJECT": "",
    "REMOVE TRIGGER": "",
    "REMOVE ANIMATION": "",
    "REMOVE CODED_ANIMATION": "",
  }
  textCommands = [];
  texturesToPush = [];
  liveUpdateMode = null;
  build(func,errorConsol){
    $.get(script).then(e => {
      window.rFiles = requiredFiles;
      try {
        func(this.convertToEngineCommands(this.separateScenes(this.buildPrimitiveArray(e))));
      } catch (error) {
        errorConsol("Error! error de lectura del script")
        errorConsol(error.message)
      }

    }).catch(error=>errorConsol(error));
  }

  buildPrimitiveArray(script) {
    var acomulateLines = "";
    var counter = 0;
    var ar = [];
    var indexWhereCommandObjectStart = 0;
    script.replaceAll("'","´").replaceAll('"',"'").split(/\r\n|\r|\n/,-1).filter(e=>{return e.replaceAll(" ","").indexOf("//")!=0}).forEach(line =>{
      const lineF = line.replaceAll("'",'"').replaceAll("´","'");
      if(counter != 0){
        if(lineF.replaceAll(" ","").indexOf("SET") == 0)
        this.setReplacer(lineF);
      }
      acomulateLines+=lineF; 

      lineF.split("").forEach(char=>{
        if(char == "{"){counter++;} 
        if(char == "}"){counter--;}
        
        if(indexWhereCommandObjectStart == 0 && counter != 0)indexWhereCommandObjectStart = acomulateLines.indexOf("{");
      });
      if(counter == 0 && lineF.replaceAll(" ","") != ""){
        if(indexWhereCommandObjectStart != 0){
          ar.push({[acomulateLines.slice(0,indexWhereCommandObjectStart)]:acomulateLines.slice(indexWhereCommandObjectStart)})
        }else{
          indexWhereCommandObjectStart = acomulateLines.lastIndexOf(" ");
          ar.push({[acomulateLines.slice(0,indexWhereCommandObjectStart)]:acomulateLines.slice(indexWhereCommandObjectStart+1)}); 
        }
        this.textCommands.push(acomulateLines);
        acomulateLines = "";
        indexWhereCommandObjectStart = 0;
      }else if(lineF.replaceAll(" ","") == ""){
        // acomulateLines = "";
        indexWhereCommandObjectStart = 0;
      }

    });
    console.log(ar);
    return(ar);
  }
  setReplacer(line){
    const command = line.slice(line.indexOf("SET")).split(" ");
    const type = command[1];
    const id = command[2];
    const params = type == "CAMERA"? command[2] : command[3];
    var res = "";
    var dynaVar = "ref"+(performance.now()*Math.random()).toFixed(7).replaceAll(".","");
    switch (type) {
      case "GRAPHOBJECT":
        res = "const "+dynaVar+"= engine.graphArray.get('"+id+"');"
        break;
      case "TRIGGER":
        res = "const "+dynaVar+"= engine.triggers.get('"+id+"');"
        break;
      case "ANIMATION":
        res = "const "+dynaVar+"= engine.anims.get('"+id+"');"
        break;
      case "CODED_ANIMATION":

        break;
      case "VAR":

        break;
    
      default:
        // throw new Error("Command #"+comNumber+" ,is not a registered command: "+Object.keys(command)[0]);
        break;
    }
    // console.log(type,id,params);
    console.warn(res);
  }
  separateScenes(primitiveScripts){
    var commandStacks = [];
    var commandStack = [];
    var sceneId = "";
    primitiveScripts.forEach(command => {
        if(Object.keys(command)[0] == "SCENE ID"){
            if(sceneId != ""){
                commandStacks.push({[sceneId]:commandStack});commandStack =[];    
            }
            sceneId = command["SCENE ID"];
        }else if(Object.keys(command)[0] != "END"){
            commandStack.push(command);    
        }else if(Object.keys(command)[0] == "END"){
            commandStacks.push({[sceneId]:commandStack});commandStack =[];    
        }
        
    });
    return commandStacks;
  }
  convertToEngineCommands(commandStacks){
    var roadMap = {
      conditionals:[],//if | animationOnComplete
      commandChuncks:{},
      gameVars:{},//gamevars to add to the thread
    }
    var scene ={
      textures:null,
      graphObjects:[],
      triggers:[],
      animations:[],
      codedAnimations:[],
    }
    commandStacks.forEach(commandStack=>{
      const sceneId = Object.keys(commandStack)[0];
      commandStack[sceneId].forEach((command,comNumber)=>{
        const commandType = Object.keys(command)[0].split(" ");
        var value;
        try {
          const valueFunc = new Function("return ("+command[Object.keys(command)[0]]+")");
          value = valueFunc();  
        } catch (error) {
          console.log(command)
          throw new Error(error.message +' in '+this.textCommands[comNumber+1])
        }
        if(commandType[0] == "IGNORE"){

        }else if(commandType[0] == "PUSH"){
          switch (commandType[1]) {
            case "GRAPHOBJECT":
              scene.graphObjects.push(value);
              break;
            case "TRIGGER":
              scene.triggers.push(value);
              break;
            case "ANIMATION":
              scene.animations.push(value);
              break;
          
            default:
              // throw new Error("Command #"+comNumber+" ,is not a registered command: "+Object.keys(command)[0]);
              break;
          }
        }else if(commandType[0] == "SET"){
          console.log(commandType)
          switch (commandType[1]) {
            case "GRAPHOBJECT":
              scene.graphObjects.push(value);
              break;
            case "TRIGGER":
              scene.triggers.push(value);
              break;
            case "ANIMATION":
              scene.animations.push(value);
              break;
            case "CODED_ANIMATION":
              scene.codedAnimations.push(value);
              break;
          
            default:
              // throw new Error("Command #"+comNumber+" ,is not a registered command: "+Object.keys(command)[0]);
              break;
          }
        }
      });
    });
    console.log(scene)
    return scene;
  }
}
export { ScriptInterpreter }