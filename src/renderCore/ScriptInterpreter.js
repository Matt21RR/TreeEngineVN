import $ from "jquery";
import { requiredTextures, requiredSounds } from "./RequireFile";
const script = require("./text2.txt");

class ScriptInterpreter {
  textCommands = [];
  texturesToPush = [];
  build(func,errorConsol){
    $.get(script).then(e => {
      try {
        const res = this.convertToEngineCommands(this.separateScenes(this.buildPrimitiveArray(e)));
        console.log(res);
        func(res);
      } catch (error) {
        errorConsol("Error! error de lectura del script")
        errorConsol(error.message)
        console.log(error);
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
        valueFunc = new Function("return ("+this.directReferencesReplacer(str)+")");
      }else{
        valueFunc = new Function("return ("+this.replaceReferencesToGameVars(this.replaceCodedExpresions(str),true)+")");
      }
      return valueFunc();  
    } catch (error) {
      let frag
      if(applyEngineReplacements){//change this
        frag = this.directReferencesReplacer(str);
      }else{
        frag = this.replaceReferencesToGameVars(this.replaceCodedExpresions(str),true);
      }
      console.log(applyEngineReplacements, frag,str);
      throw new Error('Error de conversion: '+error.message +' in '+commandLine);
    }
  }
  checkIfIsWord(line){
    const arr = line.match(/([a-z]|[A-Z])+/g);
    if(arr != null)
      if(arr.length == 1)
        return true;
      
    return false;
  }
  checkIfKeywordInLine(line){
    const keywords = ["SET","new","WAIT","CONTINUE","JUMPTO","FLAG"];

    for (let index = 0; index < keywords.length; index++) {
      const keyword = keywords[index];
      const parts = line.split(" ").filter(e=>{return e != ""});
      if(parts.length>0){
        // console.log(parts.length);
        if(parts[0] == keyword){
          return true;
        }else if(this.checkIfIsWord(parts[0]) && parts[1] == "=>"){
          console.error("akkord"); 
        }
      }
    }
    return false;
  }
  buildPrimitiveArray(script) {
    var acomulateLines = "";
    var counter = 0;
    var ar = [];
    var indexWhereCommandObjectStart = 0;
    script.replaceAll("'","´").replaceAll('"',"'").split(/\r\n|\r|\n/,-1).filter(e=>{return e.replaceAll(" ","").indexOf("//")!=0}).forEach((line,lIndex) =>{
      var lineF = line.replaceAll("'",'"').replaceAll("´","'");
      if(counter != 0){
        
        if(this.checkIfKeywordInLine(lineF)){
          lineF = this.setReplacer(lineF,lIndex);
        }
        
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
      if(counter == 0 && lineF.replaceAll(" ","") != ""){
        if(indexWhereCommandObjectStart != 0){
          ar.push({[acomulateLines.slice(0,indexWhereCommandObjectStart)]:acomulateLines.slice(indexWhereCommandObjectStart)})
        }else{
          indexWhereCommandObjectStart = acomulateLines.lastIndexOf(" ");
          if(indexWhereCommandObjectStart == -1){
            ar.push({[acomulateLines]:acomulateLines}); 
          }else{
            ar.push({[acomulateLines.slice(0,indexWhereCommandObjectStart)]:acomulateLines.slice(indexWhereCommandObjectStart+1)}); 
          }
          
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
    const replacement = (str)=>{return typeof str == "string" ? str.replaceAll(/\$+(\w)+/g,(a,_)=>{return "'¬" + a.substring(1)+ "'"}):str}
    const reverseReplacement = (str)=>{return typeof str == "string" ? str.replaceAll(/\¬+(\w)+/g,(a,_)=>{return "engine.gameVars." + a.substring(1)+ ""}) : str;}
    var command;
    const keywords = ["SET","new","WAIT","CONTINUE","JUMPTO","FLAG"];


    keywords.forEach(keyword => {
      if(line.split(" ").filter(e=>{return e != ""})[0] == keyword){
        command = line.slice(line.indexOf(keyword)).split(" ");
      }
    });
    
    const type = command[0];
    console.log(type);
    const branch = command[1];
    let id;
    let parsedParams;
    const params = line.indexOf('{') != 0? line.slice(line.indexOf('{')) : command[3];
    if(command.length > 2){
      id = command[2].indexOf('$') == -1? "'"+command[2]+"'" :  this.directReferencesReplacer(command[2]);
      parsedParams = this.stringToValue(replacement(params),lIndex+"::"+line);
    }
    var res = "";
    var dynaVar = "ref"+(performance.now()*Math.random()).toFixed(7).replaceAll(".","");
    
    const value = (vPrev)=>{
      return (typeof vPrev == "string" && vPrev.indexOf('¬') == -1 ? '"'+reverseReplacement(vPrev)+'"' : reverseReplacement(vPrev));
    }

    if(type == "new"){
      switch (branch) {
        case "GRAPHOBJECT":
          //change the texture reference to the actual file
          res = "var "+dynaVar+"= "+params+";";
          //Comentado porque probablemente ya no sea necesario usarlo
          if(Object.keys(parsedParams).indexOf("texture") != -1){//para objetos graficos que no son de texto
            res += dynaVar+".texture = engine.texturesArray['"+parsedParams.texture+"'];";
          }

          res += "engine.graphArray.push(engine.graphObj.create("+dynaVar+"));";
          
          break;
        case "TRIGGER":

          break;
        case "ANIMATION":

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
    }else if(type == "SET"){
      switch (branch) {
        case "GRAPHOBJECT":
          res = "var "+dynaVar+"= engine.graphArray.get("+id+");"
          Object.keys(parsedParams).forEach(key => {
            res += dynaVar+"._"+key+" = "+ value(parsedParams[key]) +";"; 
          });
          
          break;
        case "TRIGGER":
          res = "var "+dynaVar+"= engine.triggers.get("+id+");"
          break;
        case "ANIMATION":
          res = "let "+dynaVar+"= engine.anims.get("+id+");"
          Object.keys(parsedParams).forEach(key => {
            res += dynaVar+"._"+key+" = "+ value(parsedParams[key]) +";"; 
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
          res = id+" = "+params+";"
          break;
        case "SCENE":
          res = "engine.actualSceneId = "+params+";";//orden para cambiar la escena
          res += "engine.loadScene();";
          break;
        default:
          throw new Error("Command #"+lIndex+" ,is not a replaceable command: "+line);
          break;
      }
    }else if(type == "WAIT"){
        res += "engine.continue = false;"
        if(!isNaN(branch)){//!Check this
          res += "setTimeout(()=>{engine.continue = true},"+ (branch*1)+");";
        }
    }else if(type == "CONTINUE"){
      res += "engine.continue = true;";
    }else if(type == "JUMPTO"){//Esta orden le indicara al motor que debe de saltar hasta cierta orden y continuar la secuencia de ejecucion
      res += "engine.routineNumber = engine.flags."+branch+";";
    }else if(type == "FLAG"){ //!Esto no debería ser usado dentro de ninguna estructura
      //Object.assign(scene.flags,{[commandType[1]]:scene.routines.length})
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
        }else if(Object.keys(command)[0] == "END" && command.END == "FILE"){
          commandStacks.push({[sceneId]:commandStack});
          commandStack =[];    
        }else{
          commandStack.push(command);    
        }
        
    });
    return commandStacks;
  }
  convertToEngineCommands(commandStacks){
    var passFlag = false;
    var roadMap = {
      scenes:{},
      gameVars:{},//gamevars to add to the thread
    }
    commandStacks.forEach(commandStack=>{
      const sceneId = Object.keys(commandStack)[0];
      let scene = {
        gameVars:{},
        textures:null,
        sounds:null,
        graphObjects:[],
        triggers:[],
        animations:[],
        codedRoutines:[],
        routines:[],
        flags:{},

        idDirectory:{}//Esto será usado para saber que es lo que es está intentando cambiar (graphObject|trigger|animation)
      }
      commandStack[sceneId].forEach((command,comNumber)=>{
        //console.log(command);
        const commandType = Object.keys(command)[0].split(" ");
        var valueInString = command[Object.keys(command)[0]];
        if(valueInString[0] == "("){
          valueInString = valueInString.split("");
          valueInString[0] = "[";
          valueInString.pop();
          valueInString.push("]");
          valueInString = valueInString.join("");
        }
        let value;
        //Las siguientes dos ordenes le indicaran al motor cuando dejar de ejecutar las ordenes en secuencia
        if(commandType[0] == "WAIT"){
          scene.routines.push((engine)=>{
            engine.continue = false;
            if(!isNaN(command.WAIT)){
              setTimeout(()=>{engine.continue = true},command.WAIT*1)
            }
          });
        }else if(commandType[0] == "CONTINUE"){
          scene.routines.push((engine)=>{
            engine.continue = true;
          });
        }else if(commandType[0] == "JUMPTO"){//Esta orden le indicara al motor que debe de saltar hasta cierta orden y continuar la secuencia de ejecucion
          scene.routines.push("engine.routineNumber = engine.flags."+commandType[1]);
        }else if(commandType[0] == "FLAG"){
          Object.assign(scene.flags,{[commandType[1]]:scene.routines.length})//TODO: habrá que revisar si el valor length corresponde
        }else if(commandType[0] == "END"){//Excepcion para la palabra clave end
          
        }else if(commandType[1] == "CODEDROUTINE" || commandType[1] == "TRIGGER" || commandType[1] == "ANIMATION" || commandType[1] == "DIALOG" || commandType[1] == "NARRATION"){
          value = this.stringToValue(valueInString,this.textCommands[comNumber+1],true);
        }else{
          value = this.stringToValue(valueInString,this.textCommands[comNumber+1]);
        }  
        console.log(value);
        
        if(passFlag){
          if(commandType[0] == "SHOW"){
            if(commandType[1] == "DIALOG"){
              console.log(commandType[2],value);
              scene.routines.push((engine)=>{
                engine.dialogNumber = 0;
                engine.voiceFrom = commandType[2];
                engine.dialog = value;

                engine.graphArray.get("dialogbox").opacity = 1;

                engine.continue = false;
              });
            }else if(commandType[1] == "NARRATION"){
              scene.routines.push((engine)=>{
                  engine.triggers.get("avanzarNarracion").enabled = true;
                  engine.paragraphNumber = 0;
                  engine.voiceFrom = "nobody";
                  engine.narration = value.join("\n");

                  engine.paragraph += '\n' + engine.narration.split('\n')[0];
                  engine.graphArray.get("narrationBox").opacity = 1;

                  engine.continue = false;
                });
            }
          }else if(commandType[0] == "new"){
            if(commandType[2] == ""){
              console.warn("No id");
            }else{
              if(commandType[2] in scene.idDirectory){
                throw new Error (commandType[2] + " was already used as id for a "+ scene.idDirectory[commandType[2]])
              }else{
                Object.assign(scene.idDirectory,{[commandType[2]]:commandType[1]})//{id:type}
                //Here you will need to add the id to the "value" object
                Object.assign(value,{id:commandType[2]})
              }
            }

            switch (commandType[1]) {
              case "GAMEVARS":
                scene.gameVars = value;
                break;
              //*No se permite añadir texturas o sunidos tras creada la escena
              case "GRAPHOBJECT":
                scene.routines.push(engine=>{
                  engine.graphArray.push(engine.graphObj.create(value));
                });
                break;
              case "TRIGGER":
                
                break;
              case "ANIMATION":
                scene.routines.push(engine=>{
                  engine.anims.push(engine.animation.create(value))
                });

                break;
              case "CODEDROUTINE":
                
                break;
            
              default:
                //throw new Error("Command #"+comNumber+" ,is not a registered command: "+Object.keys(command)[0]);
                break;
            }
          }else if(commandType[0] == "SET"){
            console.log("using set in the onLoad thread");
            console.log("g",value);
            switch (commandType[1]) {
              case "GRAPHOBJECT":
                //scene.graphObjects.push(value);
                // scene.routines.push((engine)=>{

                // });
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
        }else if(commandType[1] == "=" && commandType[2] == "new"){
          if(commandType[0] in scene.idDirectory){
            throw new Error (commandType[0] + " was already used as id for a "+ scene.idDirectory[commandType[0]])
          }else{
            Object.assign(scene.idDirectory,{[commandType[0]]:commandType[3]})//{id:type}
          }
          switch (commandType[3]) {
            case "GameVars":
              //Here you will need to add the id to the "value" object
              Object.assign(value[0],{id:commandType[0]})
              scene.gameVars = value[0];
              break;
            case "GraphObject":
              Object.assign(value[0],{id:commandType[0]})
              scene.graphObjects.push(value[0]);
              break;
            case "Trigger":
              Object.assign(value[0],{id:commandType[0]})
              scene.triggers.push(value[0]);
              break;
            case "Animation":
              let res = {keyframes:value[1]}
              Object.assign(res,{id:commandType[0]})
              Object.assign(res,{relatedTo:value[0]})
              Object.assign(res,value[2])
              scene.animations.push(res);
              break;
            case "CodedRoutine":
              Object.assign(value[0],{id:commandType[0]})
              scene.codedRoutines.push(value[0]);
              break;
          
            default:
              throw new Error("Command #"+comNumber+" ,is not a registered command: "+Object.keys(command)[0]);
              break;
          }
        }else if(commandType[0] == "SET"){
          switch (commandType[1]) {
            case "GAMEVARS":
              scene.gameVars = value;
              break;
            case "TEXTURES":
              var res = new Object();
              value.forEach((textureName) => {
                Object.assign(res,{[textureName]:requiredTextures[textureName]});
              });
              scene.textures = res;
              break;
            case "SOUNDS":
              var res = new Object();
              value.forEach((soundName) => {
                Object.assign(res,{[soundName]:requiredSounds[soundName]});
              });
              scene.sounds = res;
              break;
          }
        }else if(commandType[0] == "END"){
          if(command.END == "DECLARATION"){
            if(!passFlag)passFlag=true;
          }
        }
      });
      Object.assign(roadMap.scenes,{[sceneId]:scene})
    });
    return roadMap.scenes;
  }

  directReferencesReplacer(script){
    return script.replaceAll(/\$+(\w)+/g,(a,_)=>{return "engine.gameVars." + a.substring(1)})
  }
}
export { ScriptInterpreter }