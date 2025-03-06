import { arrayFlatter } from "../logic/Misc.ts";

class Token{
  constructor(value,type,index){
    this._value = value;
    this._type = type;
    this._index = index;
  }
  get value(){return this._value;}
  set value(value){this._value = value;}
  get type(){return this._type;}
  set type(type){this._type = type;}
  get index(){return this._index;}
  set index(index){this._index = index;}
}


class ChaosInterpreter {
  constructor(){
    this.sounds = {};
    this.textures = {};
    this.scripts = {};
    this.scriptsUrls = {};
    this.projectRoot = window.backendRoute + "/renderEngineBackend/game/";
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
        Object.assign(scriptsData,{"gameEntrypoint":window.backendRoute + "/renderEngineBackend/game/main.txt"})
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
  #isASceneOrModule(groupedInstructions){
    return groupedInstructions.constructor.name != "Array";
  }
  kreator(script,loadAudioVisual = true){
    return new Promise((resolve,reject)=>{
      //TODO: add textures and sounds js exists check
      this.loadScripts(!loadAudioVisual).then(()=>{

        //TODO: ignore lines with no content
        var instructions = this.instructionsDesintegrator(script);

        var groupedInstructions = this.separateScenes(instructions);

        let scenes;

        let res = [];
        //*is not a scene or module (it must be a MAIN or ISOLATED script)
        if(!this.#isASceneOrModule(groupedInstructions)){
          if(loadAudioVisual){
            res.push("engine.loadTexture('"+this.getTexture()+"').then(()=>{");
            res.push("engine.loadSound('"+this.getSound()+"').then(()=>{");
          }
            groupedInstructions.map((instruction,idx)=>{
              res = res.concat(this.interpretateScriptInstruction(instruction));
            });
          if (loadAudioVisual) {
            res.push("  });");
            res.push("});");
          }
          scenes = {"gameEntrypoint":res};
        }else{//*is a scene or module
          scenes = groupedInstructions;
          Object.keys(scenes).map(sceneName=>{
            const scene = scenes[sceneName];
  
            if(loadAudioVisual){
              res.push("engine.loadTexture('"+this.getTexture()+"').then(()=>{");
              res.push("engine.loadSound('"+this.getSound()+"').then(()=>{");
            }
              scene.forEach((instruction,idx)=>{
                res = res.concat(this.interpretateScriptInstruction(instruction));
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
  #checkIfIsWord(line){
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
        }else if(this.#checkIfIsWord(parts[0]) && parts[1] == "=>"){//? If the first word is a word and the second is an arrow
          console.error("akkord"); 
        }
      }
    }
    return false;
  }

  #lexer(script){
    // Regular expression to match words, punctuation, and special characters
    const regex = /((\d+\.?\d*)|(\.\d*)|"([^"]*)"|'([^']*)'|`([^´]*)`|([^\w\s])|(\s{1,})|(\w+)|[=();,{}"'`])/g;

    // Apply regex to split the string
    const result = script.match(regex);
    const tokenList = result.map((val,index)=>{
          let symbol;
          if(val.match(/\n{1,}/)){
            symbol="lineBreak";
          }else if(val.match(/"([^"]*)"|'([^']*)'|`([^´]*)`/)){
            symbol="text";
          }else if(val.match(/[+\-*/%^=!<>&|]/)){
            symbol="operator";
          }else if(val.match(/(\d+\.?\d*)|(\.\d*)/)){
            symbol="number";
          }else if(val.match(/[\(\{\[]/)){
            symbol="openBracket";
          }else if(val.match(/[\)\}\]]/)){
            symbol="closeBracket";
          }else if(val.match(/[\.,;:]/)){
            symbol="separator";
          }else if(val.match(/\s{1,}/)){
            symbol="space";
          }else{
            symbol="word";//Probably ;)
          }

          return new Token(val,symbol,index);
      });

      return tokenList;
  }
  #tokenListToText(tokenList){
    return arrayFlatter(tokenList).map(token=>{return token.value}).join("");
    // return flater(tokenList).join("").map();
  }

  #preParser(tokenList, bracketsChain = []){
    var abs = [];
    var acum = bracketsChain.map(a=>a);
    var isJsCode = false;
    var loops = 0;
    var bracketCounter = bracketsChain.length;
    for (let idx = 0; idx < tokenList.length; idx++) {
      loops++;
      const token = tokenList[idx];
      if(token.type == "openBracket"){
        let res,checked;
        [res, checked] = this.#preParser(tokenList.slice(idx+1),[token]);
        loops += checked;
        idx += checked;
        acum.push(res);
        continue;
      }
      if(token.type == "closeBracket"){
        if(
          token.value == "]" && bracketsChain.at(-1).value == "[" ||
          token.value == "}" && bracketsChain.at(-1).value == "{" ||
          token.value == ")" && bracketsChain.at(-1).value == "("
        ){
          acum.push(token);
          bracketsChain.pop();
          bracketCounter--;
          if(bracketCounter == 0){
            //TODO: Preventive check if the acum have script instructions
            return [acum,loops];
          }
        }else{
          console.error("Syntax error: "+token.value+" in token "+token.index+", expected "+bracketsChain.at(-1).value);
          debugger;
          //TODO: Add a throw error
          break;
        }
      }
      if(token.type == "lineBreak" && bracketCounter == 0){
        if(isJsCode){
          abs.push(new Token(this.#tokenListToText(acum),"jsCode",acum[0].index));
        }else{//* If is not a js code, then it is a script instruction
          abs.push(acum);
        }
        isJsCode = false;
        acum = [];
        continue;
      }
      if(acum.length == 0 && token.type == "operator"){
        if(token.value == ">"){
          isJsCode = true;
          continue
        }
      }
      if(isJsCode || token.type == "word" || token.type == "lineBreak" || token.type == "number" || token.type == "text" || token.type == "operator" || token.type == "separator" || (acum.length != 0 && token.type == "space")){
        acum.push(token);

        //*Cuando un token de salto de linea sea agregado,comprobar si acum tiene saltos de linea anteriores    
        //*si es verdad, comprobar que el contenido presente entre saltos de linea sea una instruccion del motor    
        //*en caso de que sea verdad, se debe de convertir inmediatamente ese contenido de instruccion del motor
        //*a codigo de js: new Token(...,js,plausibleInstruction[0].index)

        var plausibleInstruction = [];

        if(token.type == "lineBreak"){
          var prevLineBreakFound = false;
          
          for(let idxB = acum.length-2; idxB > 0; idxB--){
            const tokB = acum[idxB];
            if(tokB.type == "lineBreak"){
              prevLineBreakFound = true;
              break;
            }
            plausibleInstruction.push(tokB);
          }
          if(prevLineBreakFound){
            plausibleInstruction.reverse();
            
            const [itWasAScriptInstruction,interpretResult] = this.#interpretateInstruction(plausibleInstruction,true);
            if(itWasAScriptInstruction){
              acum.splice((acum.length-1)-plausibleInstruction.length);
              acum.push(
                new Token( interpretResult, "jsCode", plausibleInstruction[0].index)
              );
              acum.push(
                new Token( "\n", "lineBreak", plausibleInstruction[1].index)
              )
            }
          }
        }
        continue;
      }
    }
    return abs;
  }
  //*instruction:Array<Token|Array<any>>
  #isCreateInstruction(instruction){
    const creatableObjects = ["GraphObject","TextureAnim","Animation","Trigger","CodedRoutine","KeyboardTrigger"];
    const getToken = (idx)=>{return instruction[idx];}

    try {
      if(getToken(0).type == "word"){
        if(getToken(1).type == "operator" && getToken(1).value == "="){
          if(getToken(2).type == "word" && getToken(2).value == "new"){
            if(getToken(3).type == "word" && creatableObjects.includes(getToken(3).value)){
              if(getToken(4).constructor.name == "Array"){
                return [true, getToken(3).value, getToken(0).value];
              }
            }
          }
        }
      }
      //*OR
      if(getToken(0).type == "word" && getToken(0).value == "new"){
        if(getToken(1).type == "word" && getToken(1).value == "KeyboardTrigger"){
          if(getToken(2).constructor.name == "Array"){
            return [true, getToken(1).value, null];
          }
        }
      }
      return [false,null]; 
    } catch (error) {
      return [false,null];
    }
  }
  #isSetInstruction(instruction){
    const creatableObjects = ["GraphObject","TextureAnim","Animation","Trigger","CodedRoutine","KeyboardTrigger"];
    const getToken = (idx)=>{return instruction[idx];}

    if(getToken(0).type == "word" && getToken(0).value.toLowerCase() == "set"){
      if(getToken(1).type == "word" && creatableObjects.includes(getToken(1).value)){
        if(getToken(2).type == "word"){
          return [true,getToken(1).value,getToken(2).value];

        }
      }
    }
    return [false,null]
  }
  #isRunInstruction(instruction){
    const runableObjects = ["script"];
    const getToken = (idx)=>{return instruction[idx];}

    if(getToken(0).type == "word" && getToken(0).value.toLowerCase() == "run"){
      if(getToken(1).type == "word" && runableObjects.includes(getToken(1).value)){
        if(getToken(2).type == "text"){
          return [true,getToken(1).value,getToken(2).value];
        }
      }
    }
    return [false,null]
  }
  #getStrParamsFromTokenList(instruction){
    const plainTokenListOfParams = arrayFlatter(instruction.at(-1).flat())
    var strParams = plainTokenListOfParams.map(token=>token.value).join("");

    let valParams;
    try {
      valParams = new Function ("return ["+strParams.substring(1,strParams.length-1)+"]");
      return "["+strParams.substring(1,strParams.length-1)+"]";
    } catch (error) {
      valParams = new Function ("return "+strParams);
      return strParams;
    }
  }
  #interpretateInstruction(_instruction,recursiveMode = false){
    var itWasAScriptInstruction = false;
    var result = _instruction;
    if(_instruction.length == 0){
      return [false,result];
    }
    const instruction = _instruction.filter(tk=>{return (tk.constructor.name == "Array")|(tk.type != "space")});

    let strParams;

    const [isCreateInstruction,createBranch,createElementId] = this.#isCreateInstruction(instruction);
    if(isCreateInstruction){
      itWasAScriptInstruction = true
      strParams = this.#getStrParamsFromTokenList(instruction);
      result = this.#interpretateCreateInstruction(createBranch,createElementId,strParams,!recursiveMode);
    }
    const [isSetInstruction,setBranch,setElementId] = this.#isSetInstruction(instruction);
    if(isSetInstruction){
      itWasAScriptInstruction = true;
      strParams = this.#getStrParamsFromTokenList(instruction);
      result = this.#interpretateSetInstruction(setBranch,setElementId,strParams,!recursiveMode);
    }
    const [isRunInstruction,runBranch,runElementId] = this.#isRunInstruction(instruction);
    if(isRunInstruction){
      itWasAScriptInstruction = true;
      result = this.#interpretateRunInstruction(runBranch,runElementId,!recursiveMode);
    }

    return [itWasAScriptInstruction,result]
  }
  instructionsDesintegrator(script){
    script += "\n"; //To avoid the last line to be ignored
    var tokenList = this.#lexer(script);
    var abs = this.#preParser(tokenList);

    var collection = [];
    for (const instruction of abs) {
      if(instruction.constructor.name == "Array"){
        collection.push(this.#interpretateInstruction(instruction));
      }else{
        console.error(instruction.constructor.name);
        console.log(instruction);
      }
      // console.log(/\n\n/);
    }
    console.log(collection);
    

    var instructions = [];
    var acomulateLines = "";
    var indexWhereCommandObjectStart = 0;
    var counter = 0;//counts the openned {, [, (,

    script.split(/\r\n|\r|\n/,-1).forEach((line) =>{
      var lineF = line;

      if(counter != 0){
        if(this.checkIfKeywordInLine(lineF)){
          lineF = this.interpretateScriptInstruction(this.instructionsDesintegrator(lineF)[0],false).join("");
        }
      }

      acomulateLines+=lineF; 

      lineF.split("").forEach(char=>{
        if(char == "{" || char == "[" || char == "("){counter++;} //Si se está entrando a una estructura
        if(char == "}" || char == "]" || char == ")"){counter--;} //Si se está saliendo de una estructura
        
        if(counter != 0 && indexWhereCommandObjectStart == 0){ //Si se ha entrado en una estructura, y no se ha encontrado el inicio de la instrucción
          var e ={}; 
          e[acomulateLines.indexOf("{")] = "{";
          e[acomulateLines.indexOf("[")] = "[";
          e[acomulateLines.indexOf("(")] = "(";
          delete e[-1];//Si no se encuentra algun caracter, este se almacenará bajo la clave -1, asi que hay que borrarla del objeto
          indexWhereCommandObjectStart = Object.keys(e)[0];//Se selecciona el primer caracter encontrado en las lineas que se tienen acumuladas del script
        }
      });

      let command = "";
      let parameters = [];
      let value = "";
      if(counter == 0){//Si ya se salió de, o no se ha entrado a una estructura de datos
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
        }else if(instruction.command == "end" && (instruction.value == "scene" || instruction.value == "module")){
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
  #isACreationInstruction(instruction){
    var flag = false;
    if( instruction.command == "new"){
      flag = true;
    }else if(instruction.parameters.length == 3 && instruction.parameters[1] == "new"){
      flag = true;
    }
    return flag;
  }
  #isACreationInstructionWithId(instruction){
    if(instruction.parameters.length == 3 && instruction.parameters[1] == "new"){
      return true;
    }
    return false;
  }
  #instructionCreationAdecuation(instruction,creationType){
    let res = structuredClone(instruction);
    delete res.parameters;
    res.creationType = creationType;
    res.command = "create";
    //removes parenthesis
    var value = instruction.value.slice(1,instruction.value.length-1);
    
    if(creationType == "Animation" || creationType=="TextureAnim" || creationType=="Trigger" || creationType=="KeyboardTrigger"){
      value = "["+value+"]"
    }
    res.value = value;

    return res;
  }
  #interpretateCreateInstruction(createBranch,id,value,routine=true){
    let res = [];

    var dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");

    if(routine){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    res.push(
      `var ${dynaVarName} = ${value};`
    );
    switch(createBranch){
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
    }
    if(routine){
      res.push(
        "});"
      );
    }
    return res.join(" \n ");

  }
  #interpretateSetInstruction(setBranch,id,value,routine=true){
    let res = [];

    var dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");

    if(routine){
      res.push(
        "engine.routines.push((engine)=>{"
      );
    }
    res.push(
      `var ${dynaVarName} = ${value};`
    );
    res.push(
      `Object.keys(${dynaVarName}).forEach(key=>{`
    );
    switch(setBranch){
      case "GraphObject":
        res.push(
          `engine.graphArray.get('${id}')[key] = ${dynaVarName}[key];`
        );
        break;
      case "TextureAnim":
        res.push(
          `engine.textureAnims.get('${id}')[key] = ${dynaVarName}[key];`
        );
        break;
      case "Trigger":
        res.push(
          `engine.triggers.get('${id}')[key] = ${dynaVarName}[key];`
        );
        break;
      case "KeyboardTrigger":
        res.push(
          `engine.keyboardTriggers.get('${id}')[key] = ${dynaVarName}[key];`
        );
        break;
      case "Animation":
        res.push(
          `engine.anims.get('${id}')[key] = ${dynaVarName}[key];`
        );
        break;
      case "CodedRoutine":
        res.push(
          `engine.codedRoutines.get('${id}')[key] = ${dynaVarName}[key];`
        );
        break;
      //TODO: add throw error on default
    }
    res.push(
      "});",
    );
    if(routine){
      res.push(
        "});"
      );
    }
    return res.join(" \n ");
  }
  #interpretateRunInstruction(runBranch,id,routine=true){
    let res = [];

    switch (runBranch) {
      case "script":
        res.push(
          "engine.routines.push((engine)=>{",
          " engine.loadScript('"+this.scriptsUrls[id.replaceAll('"',"")]+"')",
          "});"
        );
        break;
    }
    return res.join(" \n ");
  }
      
  //With the dam instructions separated we will...
  /**
   * 
   * @param {String} instruction 
   * @param {String} Scrapped Value of the instruction
   */
  interpretateScriptInstruction(instruction,routine = true){
    let command = instruction.command;
    let parameters = instruction.parameters;
    let creationType = "";
    let settingType = "";
    let id = "";
    let res = [];

    var dynaVarName = "ref"+(performance.now()*Math.random()).toFixed(8).replaceAll(".","");

    if(this.#isACreationInstruction(instruction)){
      if(this.#isACreationInstructionWithId(instruction)){
        id = '"'+command+'"';
        creationType = parameters[2];
      }else{
        creationType = parameters[0];
      }
      instruction = this.#instructionCreationAdecuation(instruction,creationType);
      command = instruction.command;
    }

    if(command == "set"){
      settingType = parameters[0];
      id = parameters[1];
    }

    let value = instruction.value;
    let text = instruction.text;

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
            const sceneOrModuleId = value.replaceAll('"',"");
            //!If there is some error here that probably means that the scene or module is not being loaded or don't exists
            if(!(sceneOrModuleId in this.scripts)){
              console.error("List of scripts and modules:",Object.keys(this.scripts));
              throw new Error("Scene or module "+sceneOrModuleId+" not found or don't exists.");
            }
            res.push(
              this.scripts[sceneOrModuleId].join("")
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