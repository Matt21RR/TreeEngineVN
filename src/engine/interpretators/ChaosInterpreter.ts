import { arrayFlatter } from "../logic/Misc.ts";
import CreateInstruction from "./builders/CreateInstruction.ts";
import DialogInstruction from "./builders/DialogInstruction.ts";
import InstructionInterface from "./InstructionInterface.ts";
import LoadInstruction from "./builders/LoadInstruction.ts";
import ModuleDefinitionInstruction from "./builders/ModuleDefinitionInstruction.ts";
import NarrationInstruction from "./builders/NarrationInstruction.ts";
import PlayInstruction from "./builders/PlayInstruction.ts";
import ResumeInstruction from "./builders/ResumeInstruction.ts";
import RunInstruction from "./builders/RunInstruction.ts";
import SceneDefinitionInstruction from "./builders/SceneDefinitionInstruction.ts";
import SetInstruction from "./builders/SetInstruction.ts";
import DeleteInstruction from "./builders/DeleteInstruction.ts";
import WaitInstruction from "./builders/WaitInstruction.ts";


declare global{
  interface Window{
    backendRoute:string,
    workRoute:string,
    projectRoute:string
  }
}

class Token{
  _value:any
  _type:string
  _index:number
  constructor(value:any,type:string,index:number){
    this._value = value;
    this._type = type;
    this._index = index;
    // if(index == 49){
    //   debugger
    // }
  }
  get value(){return this._value;}
  set value(value){this._value = value;}
  get type(){return this._type;}
  set type(type){this._type = type;}
  get index(){return this._index;}
  set index(index){this._index = index;}
}

type ProcesedInstruction = Array<[boolean,string|Instruction]>;

class Instruction extends Array<Token | Instruction>{
  get(index:number){
    this.at(index);
  }
  get index():number{
    if(this.length != 0){
      const lastElementInList:Token|Instruction = (this.at(-1) as Token|Instruction);
      if(lastElementInList.constructor.name == "Instruction"){
        return (lastElementInList as Instruction).index;
      }else{
        return (lastElementInList as Token).index;
      }
    }else{
      return 0;
    }
  }
}


class ChaosInterpreter {
  sounds:{[key:string]:string}
  textures:{[key:string]:string}
  scripts:{[key:string]:string}
  scriptsUrls:{[key:string]:string}
  projectRoot:string
  constructor(){
    this.sounds = {};
    this.textures = {};
    this.scripts = {};
    this.scriptsUrls = {};
    this.projectRoot = window.projectRoute;
    this.listScripts();
    //@ts-ignore
    window.chaos = this;
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
        Object.assign(scriptsData,{"gameEntrypoint": this.projectRoot + "main.txt"})
        this.scriptsUrls = scriptsData
        resolve(scriptsData);
      });
    })
  }
  loadScripts(doNothing){
    const self = this;
    return new Promise((resolve,reject)=>{
      if(doNothing){
        resolve(null);
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
                      resolveScript(null);
                    }
                  )}
                )
              })
            })
          ).then(()=>{resolve(null)});
        });
      }
    })
  }
  kreator(script:string,loadAudioVisual = true){
    return new Promise((resolve,reject)=>{
      //TODO: add textures and sounds js exists check
      this.loadScripts(!loadAudioVisual).then(()=>{
        //TODO: ignore lines with no content
        var scenes = this.#instructionsDesintegrator(script);

        resolve(scenes);
      })
    });
  }

  directKreator(script:string){
    return this.#instructionsDesintegrator(script,true,true) as string;
  }

  #instructionsDesintegrator(script:string, ignoreSceneOrModuleDefinitionCheck = false, recursiveMode=false){
    script += "\n"; //To avoid the last line to be ignored
    var tokenList = this.#lexer(script);
    var abs = this.#preParser(tokenList);

    var collection:Array<[boolean,Object|string]> = [];

    for (let index = 0; index < abs.length; index++) {
      const instruction = abs[index] as Instruction|Token;
    
      if(instruction instanceof Array){
        const interpreted = this.#interpretateInstruction(instruction as Instruction,recursiveMode);
        //@ts-ignore
        if(interpreted[0]){
          collection.push(interpreted as [boolean,Object|string]);
        }
        continue;
      }else if(instruction instanceof Token){
        if(instruction.type == "jsCode"){
          collection.push([true,instruction.value]);
          continue;
        }
      }
      console.warn("Un-understandable or unsupported instruction",instruction);
    }
    if(ignoreSceneOrModuleDefinitionCheck){
      return collection.map(inst=>inst[1]).join("\n");
    }else{
      return this.#haveSceneOrModuleDefinition(collection);
    }
  }

  #lexer(script:string){
    // Regular expression to match words, punctuation, and special characters
    const regex = /((\d+\.?\d*)|(\.\d*)|"([^"]*)"|'([^']*)'|`([^`]*)`|([^\w\s])|(\s{1,})|(\w+)|[=();,{}"'`])/g;

    // Apply regex to split the string
    const result = script.match(regex);
    const tokenList = (result as RegExpMatchArray).map((val,index)=>{
          let symbol;
          if(val.match(/\n{1,}/)){
            symbol="lineBreak";
          }else if(val.match(/"([^"]*)"|'([^']*)'|`([^`]*)`/)){
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
  #tokenListToText(tokenList:Instruction){
    return arrayFlatter(tokenList).map(token=>{return token.value}).join("");
  }

  #preParser(tokenList:Array<Token>, bracketsChain:Array<Token> = []):[Instruction,number]|Instruction{
    var abs:Instruction = new Instruction();
    var acum:Instruction = bracketsChain.map(a=>a) as Instruction;
    var isJsCode = false;
    var loops = 0;
    var bracketCounter = bracketsChain.length;
    for (let idx = 0; idx < tokenList.length; idx++) {
      loops++;
      const token = tokenList[idx];
      if(token.type == "openBracket"){
        let res:Instruction;
        let checked:number;
        [res, checked] = this.#preParser(tokenList.slice(idx+1),[token]) as [Instruction,number];
        loops += checked;
        idx += checked;
        acum.push(res);
        continue;
      }
      if(token.type == "closeBracket"){
        const latestBracketInChain =  bracketsChain.at(-1);
        if(latestBracketInChain !== undefined){
          if(
            token.value == "]" && latestBracketInChain.value == "[" ||
            token.value == "}" && latestBracketInChain.value == "{" ||
            token.value == ")" && latestBracketInChain.value == "("
          ){
            acum.push(token);
            bracketsChain.pop();
            bracketCounter--;
            if(bracketCounter == 0){
              //TODO: Preventive check if the acum have script instructions
              // console.log(acum,loops);
              return [acum,loops];
            }
          }else{
            console.error(`Syntax error: ${token.value} in token ${token.index}, expected ${latestBracketInChain.value}`);
            debugger;
            //TODO: Add a throw error
            break;
          }
        }

      }
      if(token.type == "lineBreak" && bracketCounter == 0){
        if(isJsCode){
          if(this.#tokenListToText(acum).length != 0){
            // console.log(this.#tokenListToText(acum));
            abs.push(new Token(this.#tokenListToText(acum),"jsCode",acum[0].index));
          }
        }else{//* If is not a js code, then it is a script instruction
          abs.push(acum);
        }
        isJsCode = false;
        acum = new Instruction();
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

        var plausibleInstruction = new Instruction();

        if(token.type == "lineBreak"){
          var prevLineBreakFound = false;
          
          for(let idxB = acum.length-2; idxB > 0; idxB--){
            const tokB = acum[idxB];
            if(tokB.constructor.name == "Token" && (tokB as Token).type == "lineBreak"){
              prevLineBreakFound = true;
              break;
            }
            plausibleInstruction.push(tokB);
          }
          if(prevLineBreakFound){
            plausibleInstruction.reverse();
            //@ts-ignore
            const [itWasAScriptInstruction,interpretedResult] = this.#interpretateInstruction(plausibleInstruction,true);
            if(itWasAScriptInstruction){
              acum.splice((acum.length-1)-plausibleInstruction.length);
              acum.push(
                new Token( interpretedResult, "jsCode", plausibleInstruction[0].index)
              );
              if(plausibleInstruction.length>1){
                acum.push(
                  new Token( "\n", "lineBreak", plausibleInstruction[1].index)
                )
              }else{
                acum.push(
                  new Token( "\n", "lineBreak", plausibleInstruction[0].index)
                )
              }

            }
          }
        }
        continue;
      }
    }
    return abs;
  }

  #interpretateInstruction(_instruction:Instruction,recursiveMode = false){
    var itWasAScriptInstruction = false;
    let result:Object|string|Instruction = _instruction;
    if(_instruction.length == 0){
      return [false,result];
    }
    const instruction = _instruction.filter(tk=>{return (tk.constructor.name == "Array")||((tk as Token).type != "space")});

    //@ts-ignore
    //console.log(instruction.map(e=>e.value).join(" "));

    const supportedInstructions = [
      new CreateInstruction(),
      new DialogInstruction(),
      new LoadInstruction(),
      new ModuleDefinitionInstruction(),
      new NarrationInstruction(),
      new PlayInstruction(),
      new ResumeInstruction(),
      new RunInstruction(),
      new SceneDefinitionInstruction(),
      new SetInstruction(),
      new DeleteInstruction(),
      new WaitInstruction()
    ];

    for (const supportedInstruction of supportedInstructions) {
      //@ts-ignore
      const res = (supportedInstruction).check(instruction,this,!recursiveMode);
      if(res.match){
        result = res.result;
        return [true,result];
      }
    }
    return [itWasAScriptInstruction,result]
  }
  #haveSceneOrModuleDefinition(processedInstructions){
    var scenes = new Object();
    var lastSceneDefinition = "gameEntrypoint";
    scenes[lastSceneDefinition] = "";

    for (const instruction of processedInstructions) {
      if(instruction[0]){
        if(instruction[1].constructor.name == "Object" && "define" in instruction[1]){
          lastSceneDefinition = instruction[1].id;
          scenes[lastSceneDefinition] = "";
          continue;
        }
        scenes[lastSceneDefinition]+=instruction[1]+"\n";
      }
    }
    if("gameEntrypoint" in scenes && scenes.gameEntrypoint == ""){
      delete scenes.gameEntrypoint;
    }else if("gameEntrypoint" in scenes){
      scenes.gameEntrypoint = 
      `engine.loadTexture('${this.getTexture()}').then(()=>{
        engine.loadSound('${this.getSound()}').then(()=>{
          ${scenes.gameEntrypoint}
        });
      });`
    }

    return scenes;
  }
}
export {ChaosInterpreter as Chaos,Token,Instruction};