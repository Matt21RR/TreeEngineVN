import $ from "jquery";
import { requiredTextures, requiredSounds } from "./RequireFile";
const script = require("./scriptTest.txt");

class ScriptInterpreter {
  textCommands = [];
  texturesToPush = [];
  build(func,errorConsol){
    $.get(script).then(e => {
      try {
        func(this.convertToEngineCommands(this.separateScenes(this.buildPrimitiveArray(e))));
      } catch (error) {
        errorConsol("Error! error de lectura del script")
        errorConsol(error.message)
      }

    }).catch(error=>errorConsol(error));
  }
  //Se reconocen las variables del juego con $. ej $clima
  replaceReferencesToGameVars(script,insideCodedExpr=false){
    //TODO: construir multiples reemplazos para cuando hay datos a izquierda, a derecha, a derecha e izquierda
    if(insideCodedExpr){
      return script.replaceAll(/\$+(\w)+/g,(a,_)=>{return "¬" + a.substring(1)+ ""})
    }else{
      return script.replaceAll(/\$+(\w)+/g,(a,_)=>{return "'engine.gameVars." + a.substring(1)+ "'"})
    }
    
  }
  replaceCodedExpresions(script){
    //TODO: construir multiples reemplazos para cuando hay datos a izquierda, a derecha, a derecha e izquierda
    return script.replaceAll(/\$\(+(.)+\)\$/g,(a,_)=>{return '"' + a.replaceAll('"',"'") + '"'})
  }
  stringToValue(str,commandLine,applyEngineReplacements=false){
    try {   
      let valueFunc;   
      if(applyEngineReplacements){
        valueFunc = new Function("return ("+this.engineReplaceCodedExpresions(this.replaceReferencesToGameVars(this.replaceCodedExpresions(str),true))+")");
      }else{
        valueFunc = new Function("return ("+this.replaceReferencesToGameVars(this.replaceCodedExpresions(str),true)+")");
      }
      return valueFunc();  
    } catch (error) {
      console.log(commandLine);
      throw new Error('Error de conversion: '+error.message +' in '+commandLine);
    }
  }

  buildPrimitiveArray(script) {
    var acomulateLines = "";
    var counter = 0;
    var ar = [];
    var indexWhereCommandObjectStart = 0;
    script.replaceAll("'","´").replaceAll('"',"'").split(/\r\n|\r|\n/,-1).filter(e=>{return e.replaceAll(" ","").indexOf("//")!=0}).forEach((line,lIndex) =>{
      var lineF = line.replaceAll("'",'"').replaceAll("´","'");
      if(counter != 0){
        if((lineF.replaceAll(" ","").indexOf("SET") == 0) || (lineF.replaceAll(" ","").indexOf("PUSH") == 0))
        lineF = this.setReplacer(lineF,lIndex);
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
  setReplacer(line,lIndex){
    var command;
    if(line.replaceAll(" ","").indexOf("SET") == 0){
      command = line.slice(line.indexOf("SET")).split(" ")
    }else if(line.replaceAll(" ","").indexOf("PUSH") == 0){
      command = line.slice(line.indexOf("PUSH")).split(" ")
    }
    
    const type = command[0];
    const branch = command[1];
    const id = command[2];
    const params = line.indexOf('{') != 0? line.slice(line.indexOf('{')) : command[3];
    var res = "";
    var dynaVar = "ref"+(performance.now()*Math.random()).toFixed(7).replaceAll(".","");
    const parsedParams = this.stringToValue(params,lIndex+"::"+line);
    if(type == "PUSH"){
      switch (branch) {
        case "GRAPHOBJECT":
          //change the texture reference to the actual file
          res = "var "+dynaVar+"= "+params+";";
          if(Object.keys(parsedParams).indexOf("texture") != -1){//para objetos graficos que no son de texto
            res += dynaVar+".texture = engine.texturesArray['"+parsedParams.texture+"'];";
          }
          res += "engine.graphArray.push(engine.graphObj.create("+dynaVar+"));";
          break;
        case "TRIGGER":

          break;
        case "ANIMATION":

          break;
        case "CODED_ANIMATION":
  
          break;
        case "CAMERA":
          break;
        case "VAR":
          res = "engine.gameVars."+id+" = "+params+";"
          break;
      
        default:
          throw new Error("Command #"+lIndex+" ,is not a replaceable command: "+line);
          break;
      }
    }else if(type == "SET")
    switch (branch) {
      case "GRAPHOBJECT":
        res = "var "+dynaVar+"= engine.graphArray.get('"+id+"');"
        Object.keys(parsedParams).forEach(key => {
          res += dynaVar+"._"+key+" = "+parsedParams[key]+";"; 
        });
        
        break;
      case "TRIGGER":
        res = "var "+dynaVar+"= engine.triggers.get('"+id+"');"
        break;
      case "ANIMATION":
        res = "let "+dynaVar+"= engine.anims.get('"+id+"');"
        Object.keys(parsedParams).forEach(key => {
          res += dynaVar+"._"+key+" = "+parsedParams[key]+";"; 
        });
        break;
      case "CODED_ANIMATION":

        break;
      case "CAMERA":
        //use the code from SET ANIMATION to gameCamera with enabled:true
        //since this will run at 'runtime'...
        var camParams = '{relatedTo:"engineCamera",enabled:true,'+params.slice(1);
        res = "engine.anims.push(engine.animation.create("+camParams+"));";
        //TODO: onComplete = delete yourself ;)
        break;
      case "VAR":
        res = "engine.gameVars."+id+" = "+params+";"
        break;
      case "SCENE":
        res = "engine.actualSceneId = "+params+";";//orden para cambiar la escena
        res += "engine.loadScene();";
        break;
      default:
        throw new Error("Command #"+lIndex+" ,is not a replaceable command: "+line);
        break;
    }
    return res;
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
      scenes:{},
      gameVars:{},//gamevars to add to the thread
    }
    var scene ={
      gameVars:{},
      textures:null,
      sounds:null,
      graphObjects:[],
      triggers:[],
      animations:[],
      codedRoutines:[],
    }
    commandStacks.forEach(commandStack=>{
      const sceneId = Object.keys(commandStack)[0];
      scene ={
        gameVars:{},
        textures:null,
        sounds:null,
        graphObjects:[],
        triggers:[],
        animations:[],
        codedRoutines:[],
      }
      commandStack[sceneId].forEach((command,comNumber)=>{
        const commandType = Object.keys(command)[0].split(" ");
        let value;
        if(commandType[1] == "CODEDROUTINE" || commandType[1] == "TRIGGER" || commandType[1] == "ANIMATION"){
          value = this.stringToValue(command[Object.keys(command)[0]],this.textCommands[comNumber+1],true);
        }else{
          value = this.stringToValue(command[Object.keys(command)[0]],this.textCommands[comNumber+1]);
        }
        
        
        if(commandType[0] == "IGNORE"){

        }else if(commandType[0] == "PUSH"){
          switch (commandType[1]) {
            case "GAMEVARS":
              scene.gameVars = value;
              break;
            case "TEXTURES":
              Object.keys(value).forEach((textureRef) => {
                value[textureRef] = (requiredTextures[textureRef]);
              });
              scene.textures = value;
              break;
            case "SOUNDS":
              Object.keys(value).forEach((soundRef) => {
                value[soundRef] = (requiredSounds[soundRef]);
              });
              scene.sounds = value;
              break;
            case "GRAPHOBJECT":
              scene.graphObjects.push(value);
              break;
            case "TRIGGER":
              scene.triggers.push(value);
              break;
            case "ANIMATION":
              scene.animations.push(value);
              break;
            case "CODEDROUTINE":
              scene.codedRoutines.push(value);
              break;
          
            default:
              throw new Error("Command #"+comNumber+" ,is not a registered command: "+Object.keys(command)[0]);
              break;
          }
        }else if(commandType[0] == "SET"){//This chunk of the code probabily isnt being used

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
            case "SCENE":

            default:
              // throw new Error("Command #"+comNumber+" ,is not a registered command: "+Object.keys(command)[0]);
              break;
          }
        }
      });
      Object.assign(roadMap.scenes,{[sceneId]:scene})
    });
    return roadMap.scenes;
  }
  //*Engine functions
  engineReplaceReferencesToGameVars(script,insideCodedExpr=false){
    return script.replaceAll(/\¬+(\w)+/g,(a,_)=>{return "engine.gameVars." + a.substring(1)+ ""})
  }
  engineReplaceCodedExpresions(script){
    return script.replaceAll(/"\$\(?(.\n*)+\)\$"/g,(a,_)=>{
      //Remove return function only do the regex replacing
      return this.engineReplaceReferencesToGameVars(a.substring(3,a.length-3)).replaceAll(/\n/g,"/n");
    })
  }
}
export { ScriptInterpreter }