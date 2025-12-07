import { arrayFlatter } from "../logic/Misc.ts";
import CreateInstruction from "./builders/CreateInstruction.ts";
import DialogInstruction from "./builders/DialogInstruction.ts";
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
import Token from "./Token.ts";
import Instruction from "./Instruction.ts";
import NodeDefinitionInstruction from "./builders/NodeDefinitionInstruction.ts";
import StructureEndInstruction from "./builders/StructureEndInstruction.ts";
import AgrupableInstructionInterface from "./AgrupableInstructionInterface.ts";
import JumpToInstruction from "./builders/JumpToInstruction.ts";
import SetSpeakerInstruction from "./builders/SetSpeakerInstruction.ts";
import { Dictionary } from "../../global.ts";
import sequencedPromise from "./new.ts";

class ChaosInterpreterResources {
  scripts: Dictionary<{main:string,nodes:{}}>
  scriptsUrls: Dictionary<string>
  constructor(){
    this.scripts = {};
    this.scriptsUrls = {};
  }
}

class ChaosInterpreter {
  scripts:Dictionary<{main:string,nodes:{}}>
  scriptsUrls:Dictionary<string>
  projectRoot:string
  constructor(){
    this.scripts = {};
    this.scriptsUrls = {};
    this.projectRoot = window.projectRoute;
    this.listScripts();
    //@ts-ignore
    window.chaos = this;
  }
  supportedInstructions = [
      new CreateInstruction(),
      new DialogInstruction(),
      new LoadInstruction(),
      new ModuleDefinitionInstruction(),
      new NodeDefinitionInstruction(),
      new JumpToInstruction(),
      new SetSpeakerInstruction(),
      new StructureEndInstruction(),
      new NarrationInstruction(),
      new PlayInstruction(), 
      new ResumeInstruction(),
      new RunInstruction(),
      new SceneDefinitionInstruction(),
      new SetInstruction(),
      new DeleteInstruction(),
      new WaitInstruction()
    ];

  invokeSupportedInstruction(instructionType: string){
    return this.supportedInstructions.find(inst => inst.constructor.name == instructionType);
  }

  private getSound(){
    return this.projectRoot + "snd/sounds.json";
  }
  private getTexture(){
    return this.projectRoot + "img/textures.json";
  }
  listScripts(): Promise<Dictionary>{
    const self = this;
    return new Promise((resolve)=>{
      fetch(self.projectRoot + "scripts/scripts.json").then(res => {return res.json()}).then((scriptsData:Dictionary) =>{
        Object.keys(scriptsData).forEach((scriptId)=>{
          scriptsData[scriptId] = self.projectRoot + "scripts/" + scriptsData[scriptId].replace("./","");
        })
        Object.assign(scriptsData, {"gameEntrypoint": self.projectRoot + "main.txt"});
        self.scriptsUrls = scriptsData;
        resolve(scriptsData);
      });
    })
  }
  private interpretateFile(scriptFileName:string): Promise<Dictionary<{main:string,nodes:Dictionary<string>}>>{
    const self = this;
    const jsonPath = `${self.projectRoot}scripts/${scriptFileName}`;

    console.log(`=> Trying to load ${scriptFileName}`)
    return new Promise(resolve=>{
      fetch(jsonPath).then(          
        scriptData => {return scriptData.text();}).then((res)=>{
          self.kreator(res,false).then(
          (textScr)=>{
            console.log(`${scriptFileName} loaded`)
            Object.assign(self.scripts,textScr);
            resolve(textScr);
          }
        )}
      )
    })
  }
  loadScripts(doNothing:boolean):Promise<null>{
    const self = this;
    return new Promise((resolve,reject)=>{
      if(doNothing){
        resolve(null);
      }else{ 
        fetch(self.projectRoot + "scripts/scripts.json").then(res => res.json() ).then(scriptsData=>{
          const h = Object.keys(scriptsData).map(scriptId => 
            ()=>{
              return new Promise(resolveInner=>{
                const scriptFileName = scriptsData[scriptId].replace("./","");
                self.interpretateFile(scriptFileName).then( ()=>{resolveInner(null)} );
              })
            }
          );
          sequencedPromise(h).then( ()=>resolve(null) );
        });
      }
    })
  }
  kreator(script:string,loadAudioVisual = true):Promise<Dictionary<{main:string,nodes:Dictionary<string>}>>{
    return new Promise((resolve,reject)=>{ 
      //TODO: add textures and sounds js exists check
      this.loadScripts(!loadAudioVisual).then(()=>{
        //TODO: ignore lines with no content
        var scenes = this.instructionsDesintegrator(script) as Dictionary<{main:string,nodes:Dictionary<string>}>;
        resolve(scenes);
      })
    });
  }

  directKreator(script:string){
    return this.instructionsDesintegrator(script,true,true) as string;
  }

  tokenization(script:string){
    script += "\n"; //To avoid the last line to be ignored
    var tokenList = this.lexer(script).filter(tk=>{return (tk.constructor.name == "Array")||((tk as Token).type != "space")});
    var abs = this.preParser(tokenList);
    return abs;
  }

  private instructionsDesintegrator(script:string, ignoreSceneOrModuleDefinitionCheck = false, recursiveMode=false){
    script += "\n"; //To avoid the last line to be ignored
    var tokenList = this.lexer(script);
    var abs = this.preParser(tokenList);
    
    var collection:Array<Interpretation> = [];

    for (let index = 0; index < abs.length; index++) {
      const instruction = abs[index] as Instruction|Token;
      if(instruction instanceof Array){
        const interpretation = this.interpretateInstruction(instruction as Instruction,recursiveMode);
        //@ts-ignore
        if(interpretation.itWasAScriptInstruction){
          if (interpretation.isAgrupable && collection.at(-1)?.matchName == interpretation.matchName){
            const supportedInstruction = this.invokeSupportedInstruction(interpretation.matchName);
            const mixedInterpretation = (supportedInstruction as AgrupableInstructionInterface)
              .agrupator([collection.at(-1) as Interpretation,interpretation]);

            collection.pop();
            collection.push(mixedInterpretation);

          }else{
            collection.push(interpretation);
          }
        } 
        continue;
      }else if(instruction instanceof Token){
        if(instruction.type == "jsCode"){
          collection.push({itWasAScriptInstruction:true,result:instruction.value,matchName:"",isAgrupable:false});
          continue;
        }
      }
      console.warn("Un-understandable or unsupported instruction",instruction);
    }
    // window.arc = (JSON.stringify(collection));
    if(ignoreSceneOrModuleDefinitionCheck){
      return collection.map(inst=>inst.result).join("\n");
    }else{
      return this.haveSceneOrModuleDefinition(collection);
    }
  }

  private lexer(script:string){
    // Regular expression to match words, punctuation, and special characters
    const regex = /((\d+\.?\d*)|(\.\d*)|"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`|([^\w\s])|(\s{1,})|(\w+)|[=();,{}"'`])/g;

    // Apply regex to split the string
    const result = script.match(regex);
    const tokenList = (result as RegExpMatchArray).map((val,index)=>{
          let symbol:string;
          if(val.match(/\n{1,}/)){
            symbol="lineBreak";
          }else if(val.match(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/)){
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
  private tokenListToText(tokenList:Instruction){
    return arrayFlatter(tokenList).map(token=>{return token.value}).join("");
  }

  private preParser(tokenList:Array<Token>, bracketsChain:Array<Token> = []):[Instruction,number]|Instruction{
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
        [res, checked] = this.preParser(tokenList.slice(idx+1),[token]) as [Instruction,number];
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
            // debugger;
            //TODO: Add a throw error
            break;
          }
        }

      }
      if(token.type == "lineBreak" && bracketCounter == 0){
        if(isJsCode){
          if(this.tokenListToText(acum).length != 0){
            abs.push(new Token(this.tokenListToText(acum),"jsCode",acum[0].index));
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
            const interpretation = this.interpretateInstruction(plausibleInstruction,true);
            if(interpretation.itWasAScriptInstruction){
              acum.splice((acum.length-1)-plausibleInstruction.length);
              acum.push(
                new Token( interpretation.result, "jsCode", plausibleInstruction[0].index)
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

  private interpretateInstruction(_instruction:Instruction,recursiveMode = false): Interpretation{
    var itWasAScriptInstruction = false;
    let result:Dictionary<any>|string|Instruction = _instruction;
    let matchName = "";
    let isAgrupable = false;
    if(_instruction.length == 0){
      return {itWasAScriptInstruction,result,matchName,isAgrupable};
    }
    const instruction = _instruction.filter(tk=>{return (tk.constructor.name == "Array")||((tk as Token).type != "space")});

    for (const supportedInstruction of this.supportedInstructions) {
      //@ts-ignore
      const res = (supportedInstruction).check(instruction,this,!recursiveMode);
      if(res.match){
        itWasAScriptInstruction = true;
        result = res.result as Interpretation;
        matchName = supportedInstruction.constructor.name;
        isAgrupable = supportedInstruction.isAgrupable();
        break;
      }
    }
    return {itWasAScriptInstruction,result,matchName,isAgrupable};
  }

  private haveSceneOrModuleDefinition(interpretedInstructions:Array<Interpretation>){
    var scenes: Dictionary<{main:string,nodes:Dictionary<string>}> = {};
    var actualStructureDefinition = {define:ScriptStructure.Scene,id:"gameEntrypoint"};
    scenes[actualStructureDefinition.id] = {main:"",nodes:{}};

    var tag = actualStructureDefinition.id;
    var nodeTag = "";

    for (const interpretation of interpretedInstructions) {
      if(interpretation.itWasAScriptInstruction){
        if(interpretation.result.constructor.name == "Object"){
          const result = interpretation.result as Object;
          if("define" in result && "id" in result){
            const define = ScriptStructure.enumify(result.define as string);
            actualStructureDefinition = {define,id:result.id as string};
            if([ScriptStructure.Scene,ScriptStructure.Module].includes(define)){
              tag = actualStructureDefinition.id;
              scenes[tag] = {main:"",nodes:{}};
            }else if(define == ScriptStructure.Node){
              nodeTag = actualStructureDefinition.id;
              scenes[tag].nodes[nodeTag] = "";
            }
            continue;
          }else if("end" in result){
            const end = ScriptStructure.enumify(result.end as string);
            if(end == ScriptStructure.Node){
              nodeTag = "";
            }else if([ScriptStructure.Scene,ScriptStructure.Module].includes(end)){
              nodeTag = "";
              tag = "";
            }
            continue;
          }
        }
        if(tag == ""){
          throw new Error(
          "Script with no bounds!!",{cause:
            "ChaosInterpreter is trying to write interpreted code outside a structure. No scene or module defined!!"
          });
      }
        else if(nodeTag == ""){
          scenes[tag].main+=interpretation.result+"\n";
        }else{
          scenes[tag].nodes[nodeTag]+=interpretation.result+"\n";
        }
      }
    }
    if("gameEntrypoint" in scenes && scenes.gameEntrypoint.main == "" && Object.keys(scenes.gameEntrypoint.nodes).length == 0){
      delete scenes.gameEntrypoint;
    }else if("gameEntrypoint" in scenes){
      scenes.gameEntrypoint.main = 
      `engine.loadTexture('${this.getTexture()}').then(()=>{
        engine.loadSound('${this.getSound()}').then(()=>{
          ${scenes.gameEntrypoint.main}
        });
      });`
    }

    return scenes;
  }
}

type Interpretation = {
    itWasAScriptInstruction: boolean;
    result: Object | string | Instruction;
    matchName: string;
    isAgrupable: boolean;
}

enum ScriptStructure {
  Scene,
  Module,
  Node
}
namespace ScriptStructure {
  export function enumify(key:string): number{
    return ScriptStructure[key.replace(/^./, key[0].toUpperCase())];
  }
}

export {ChaosInterpreter as Chaos,ScriptStructure,Interpretation};