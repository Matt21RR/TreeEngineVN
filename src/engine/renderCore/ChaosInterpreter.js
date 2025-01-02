import $ from "jquery";
import { isArray } from "lodash";
class ChaosInterpreter {
  constructor(){
    this.sounds = {};
    this.textures = {};
    this.scripts = {};
    this.scriptsUrls = {};
    this.projectRoot = "http://localhost/renderEngineBackend/game/";
    this.listScripts();
  }
  getSound(){
    return this.projectRoot + "snd/sounds.json";
  }
  getTexture(){
    return this.projectRoot + "img/textures.json";
  }
  getScript(id){
    //Preload JSONs
  }
  listScripts(){
    return new Promise((resolve,reject)=>{
      fetch(this.projectRoot + "scripts/scripts.json").then(res => {return res.json()}).then(scriptsData=>{
        Object.keys(scriptsData).forEach((scriptId)=>{
          scriptsData[scriptId] = this.projectRoot + "scripts/" + scriptsData[scriptId].replace("./","");
        })
        Object.assign(scriptsData,{"gameEntrypoint":"http://localhost/renderEngineBackend/game/main.txt"})
        this.scriptsUrls = scriptsData
        resolve(scriptsData);
      });
    })
  }
  loadScripts(doNothing){
    const self = this;
    return new Promise((resolve,reject)=>{
      if(doNothing){
        resolve();
      }else{
        fetch(this.projectRoot + "scripts/scripts.json").then(res => {return res.json()}).then(scriptsData=>{
          Promise.all(
            Object.keys(scriptsData).map(scriptId => {
              const jsonPath = this.projectRoot + "scripts/" + scriptsData[scriptId].replace("./","");
              return new Promise(resolveScript=>{
                fetch(jsonPath).then(           
                  scriptData => {return scriptData.text();}).then((res2)=>{
                    self.kreator(res2,false).then(
                    (textScr)=>{
                      Object.assign(self.scripts,textScr);
                      resolveScript();
                    }
                  )}
                )
              })
            })
          ).then(()=>{resolve()});
        });
      }
    })
  }
  kreator(script,loadAudioVisual = true){
    return new Promise((resolve,reject)=>{
      //TODO: add textures and sounds js exists check
      this.loadScripts(!loadAudioVisual).then(()=>{
        var instructions = this.instructionsDesintegrator(script);
        var scenes = this.separateScenes(instructions);
        let res = [];
        if(isArray(scenes)){
          if(loadAudioVisual){
            res.push("engine.loadTexture('"+this.getTexture()+"').then(()=>{");
            res.push("engine.loadSound('"+this.getSound()+"').then(()=>{");
          }
            scenes.map((instruction,idx)=>{
              res = res.concat(this.evaluateStuff(idx,instruction));
            });
          if (loadAudioVisual) {
            res.push("  });");
            res.push("});");
          }
          scenes = {"gameEntrypoint":res};
        }else{
          Object.keys(scenes).map(sceneName=>{
            const scene = scenes[sceneName];
  
            if(loadAudioVisual){
              res.push("engine.loadTexture('"+this.getTexture()+"').then(()=>{");
              res.push("engine.loadSound('"+this.getSound()+"').then(()=>{");
            }
              scene.forEach((instruction,idx)=>{
                res = res.concat(this.evaluateStuff(idx,instruction));
              });
            if (loadAudioVisual) {
              res.push("  });");
              res.push("});");
            }
            scenes[sceneName] = res;
            res = [];
          })
        }
        resolve(scenes);
      })
    });
  }
  checkIfIsWord(line){
    const arr = line.match(/([a-z]|[A-Z])+/g);
    if(arr != null)
      if(arr.length == 1)
        return true;
      
    return false;
  }
  checkIfKeywordInLine(line){
    const keywords = ["set","run","new","wait","show","continue","jumpto","flag"];

    for (let index = 0; index < keywords.length; index++) {
      const keyword = keywords[index];
      const parts = line.split(" ").filter(e=>{return e != ""});
      if(parts.length>0){
        if(parts[0] == keyword){
          return true;
        }else if(this.checkIfIsWord(parts[0]) && parts[1] == "=>"){
          console.error("akkord"); 
        }
      }
    }
    return false;
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
        if(this.checkIfKeywordInLine(lineF)){
          lineF = this.evaluateStuff(0,this.instructionsDesintegrator(lineF)[0],false).join("");
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
        if (command == "" && parameters.length == 0){
          command = value;
          value = "";
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
  evaluateStuff(index, instruction,routine = true){
    let command = instruction.command;
    let parameters = instruction.parameters;
    let creationType = "";
    let settingType = "";
    let id = "";
    let value = instruction.value;
    let text = instruction.text;
    let res = [];
    let pre = "";

    var dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");

    const creationAdecuation =()=>{
      command = "create";
      //removes parenthesis
      value = value.split("")
      value.shift();
      value.pop();
      value = value.join("");
      if(creationType == "Animation" || creationType=="TextureAnim" || creationType=="Trigger" || creationType=="KeyboardTrigger"){
        value = "["+value+"]"
      }else{
        value = value
      }
    }
    if(parameters.length == 3){
      if(parameters[0] == "=" && parameters[1] == "new"){
        id = '"'+command+'"';
        creationType = parameters[2];
        creationAdecuation();
      }
    }
    if(command == "new"){
      creationType = parameters[0];
      creationAdecuation();
    }
    if(command == "set"){
      settingType = parameters[0];
      id = parameters[1];
    }

    // res.push("//**Instruction #"+index+"*/")
    switch(command){
      case ">":
        res.push(
          text.replace(">","")
        );
        break;
      case "load":
        const loadType = parameters[0];
        switch (loadType) {
          case "script":
            res.push(
              this.scripts[value.replaceAll('"',"")].join("")
            );
            break;
        }
        break;
      case "run":
        const runType = parameters[0];
        switch (runType) {
          case "script":
            res.push(
              "engine.routines.push((engine)=>{",
              " engine.loadScript('"+this.scriptsUrls[value.replaceAll('"',"")]+"')",
              "});"
            );
            break;
        }
        break;
      case "wait":
        res.push(
          "engine.routines.push((engine)=>{"
        );
        if(value != ""){
          const time = value*1;
          res.push(
            "engine.continue = false; setTimeout(()=>{engine.continue = true;},"+ (time)+");"
          );
        }else{
          res.push(
            "engine.continue = false;"
          );
        }
        res.push(
          "});"
        );
        break;
      case "continue":
        res.push(
          "engine.routines.push((engine)=>{",
          "engine.continue = true;",
          "});"
        );
        break;
      case "narration":
        res.push(
          "engine.routines.push((engine)=>{",
            "engine.triggers.get('avanzarNarracion').enabled = true;",
            "engine.paragraphNumber = 0;",
            "engine.voiceFrom = 'nobody';",
            "engine.narration = "+value+";",

            "engine.paragraph += engine.getStr(engine.lambdaConverter(engine.narration[0]));",
            "engine.graphArray.get('narrationBox').text = '';",
            "engine.graphArray.get('narrationBox').enabled = true;",

            "engine.continue = false;",
          "});"
        );

        break;
      case "$":
        res.push(
          "engine.routines.push((engine)=>{",
            "engine.dialogNumber = 0;",
            "engine.voiceFrom = '"+parameters[0]+"';",
            "engine.dialog = "+value+";",

            "engine.graphArray.get('dialogbox').text = '';",
            "engine.graphArray.get('dialogbox').enabled = true;",

            "engine.graphArray.get('voiceByName').enabled = true;",

            "engine.continue = false;",
          "});"
        );
        break;
      case "create":
        if(routine){
          res.push(
            "engine.routines.push((engine)=>{"
          );
        }
        res.push(
          "var "+dynaVarName+" = "+value+";"
        );
        switch(creationType){
          case "GraphObject":
            res.push(
              "Object.assign("+dynaVarName+",{id:"+id+"});",

              "engine.graphArray.push(new engine.constructors.graphObject("+dynaVarName+"));"
            );
            break;
          case "TextureAnim":
            res.push(
              "var data"+dynaVarName+" = {",
              "   list:"+dynaVarName+"[0],",
              "   id:"+id+",",
              "};",
              "Object.assign(data"+dynaVarName+","+dynaVarName+"[1]);",

              "engine.textureAnims.push(new engine.constructors.textureAnim(data"+dynaVarName+"));"
            );
            break;
          case "Trigger":
            res.push(
              "var data"+dynaVarName+" = {",
              "   id:"+id+",",
              "   relatedTo:"+dynaVarName+"[0],",
              "};",
              "Object.assign(data"+dynaVarName+","+dynaVarName+"[1]);",

              "engine.triggers.push(new engine.constructors.trigger(data"+dynaVarName+"));"
            );
            break;
          case "KeyboardTrigger":
            res.push(
              "var data"+dynaVarName+" = {",
              "   keys:"+dynaVarName+"[0],",
              "};",
              "Object.assign(data"+dynaVarName+","+dynaVarName+"[1]);",

              "engine.keyboardTriggers.push(new engine.constructors.keyboardTrigger(data"+dynaVarName+"));"
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
              
              "engine.anims.push(new engine.constructors.animation(data"+dynaVarName+"));"
            );
            break;
          case "CodedRoutine":
            res.push(
              "Object.assign("+dynaVarName+",{id:"+id+"});",

              "engine.codedRoutines.push(new engine.constructors.codedRoutine("+dynaVarName+"));"
            );
            break;
        }
        if(routine){
          res.push(
            "});"
          );
        }
        break;
      case "set":
        if(routine){
          res.push(
            "engine.routines.push((engine)=>{"
          );
        }
        res.push(
          "var "+dynaVarName+" = "+value+";"
        );
        res.push(
          "Object.keys("+dynaVarName+").forEach(key=>{",
        );
        switch(settingType){
          case "GraphObject":
            res.push(
              "engine.graphArray.get('"+id+"')[key] = "+dynaVarName+"[key];"
            );
            break;
          case "TextureAnim":
            res.push(
              "engine.textureAnims.get('"+id+"')[key] = "+dynaVarName+"[key];"
            );
            break;
          case "Trigger":
            res.push(
              "engine.triggers.get('"+id+"')[key] = "+dynaVarName+"[key];"
            );
            break;
          case "KeyboardTrigger":
            res.push(
              "engine.keyboardTriggers.get('"+id+"')[key] = "+dynaVarName+"[key];"
            );
            break;
          case "Animation":
            res.push(
              "engine.anims.get('"+id+"')[key] = "+dynaVarName+"[key];"
            );
            break;
          case "CodedRoutine":
            res.push(
              "engine.codedRoutines.get('"+id+"')[key] = "+dynaVarName+"[key];"
            );
            break;
        }
        res.push(
          "});",
        );
        if(routine){
          res.push(
            "});"
          );
        }
        break;
      case "show":
        if(routine){
          res.push(
            "engine.routines.push((engine)=>{"
          );
        }
        res.push(
          "engine.graphArray.get('"+value+"').enabled = true;"
        );
        if(routine){
          res.push(
            "});"
          );
        }
        break;
      case "hide":
        if(routine){
          res.push(
            "engine.routines.push((engine)=>{"
          );
        }
        res.push(
          "engine.graphArray.get('"+value+"').enabled = false;"
        );
        if(routine){
          res.push(
            "});"
          );
        }
        break;
    }
    if(res.length == 0 && instruction.text != ""){
      console.warn("Unable to generate excecution code from this:");
      console.warn("Routine: "+routine);
      console.table(instruction);
    }
    return res;
  }
}
export {ChaosInterpreter as Chaos};