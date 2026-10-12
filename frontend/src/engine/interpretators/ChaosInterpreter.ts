import { arrayFlatter } from "../logic/Misc.ts";
import Token, { TokenType } from "./Token.ts";
import Instruction from "./Instruction.ts";
import AgrupableInstructionInterface from "./AgrupableInstructionInterface.ts";
import { Dictionary } from "../../global.ts";
import sequencedPromise from "./new.ts";
import { RequestFile, ScanFiles } from "../../../wailsjs/go/main/App.js";
import supportedInstructions from "./SupportedInstructions.ts";

const MAX_NESTED_DEPENDENCY_REPROCESS = 3;

export type ScenesDictionary = Dictionary<{main:string,nodes:Dictionary<string>}>;
export type ModulesDictionary = Dictionary<string>;
export enum InterpretationDropReason {
  NoSceneOrModuleDefined,
  ModuleDependencyUnfulfilled,
  SceneDependencyUnfulfilled,
  Other
}
type InterpretationError = {
  message: string;
  reason: InterpretationDropReason;
  detail?: string;
}
export type InterpretedData = {scenes: ScenesDictionary, modules: ModulesDictionary, dropped?: InterpretationError};

class ChaosInterpreter {
  scenes:Dictionary<{main:string,nodes:{}}>
  modules:Dictionary<string>
  scriptsUrls:Dictionary<string>
  projectRoot:string
  constructor(){
    this.scenes = {};
    this.modules = {}; //The modules only have a code body, no nodes
    this.scriptsUrls = {};
    this.projectRoot = window.projectRoute;
    this.listScripts();
    //@ts-ignore
    window.chaos = this;
  }
  wipeData(){
    this.scenes = {};
    this.modules = {};
    this.scriptsUrls = {};
  }

  invokeSupportedInstruction(instructionType: string){
    return supportedInstructions.find(inst => inst.constructor.name == instructionType); //TODO: check this
  }

  private getSound(){
    return this.projectRoot + "sounds/sounds.json";
  }
  private getTexture(){
    return this.projectRoot + "textures/textures.json";
  }
  listScripts(): Promise<Dictionary>{
    const self = this;
    return new Promise((resolve)=>{
      ScanFiles(self.projectRoot + "scripts", "script")
        .then((scriptsData:Dictionary) =>{
          console.log("Scripts found in the scripts folder:", scriptsData);
          Object.keys(scriptsData).forEach((scriptId)=>{
            scriptsData[scriptId] = self.projectRoot + "scripts/" + scriptsData[scriptId].replace("./","");
          })
          Object.assign(scriptsData, {"gameEntrypoint": self.projectRoot + "main.txt"});
          self.scriptsUrls = scriptsData;
          resolve(scriptsData);
        })
        .catch(err=>{
          console.error(err)
          console.warn("Running engine without scripts dictionary!!!");
        });
    })
  }
  loadScripts(doNothing:boolean):Promise<null>{
    const self = this;
    return new Promise( (resolve, reject) =>{
      if(doNothing){
        resolve(null);
      }else{ 
        ScanFiles(self.projectRoot + "scripts", "script")
          .then(scriptsData=>{
            console.log(scriptsData);
            // debugger;
            const h = Object.keys(scriptsData).map(scriptId => 
              ()=>{
                const scriptFileName = scriptsData[scriptId].replace("./","");

                return self.buildProcessPromise(scriptFileName)
              }
            );
          self.processWithRetry(h, MAX_NESTED_DEPENDENCY_REPROCESS).then(()=>{
            resolve(null);
          })
        })
        .catch((err)=>{reject(err)})
      }
    })
  }
  private buildProcessPromise(scriptFileName:string):Promise<null>{
    const self = this;
    return new Promise((resolve,reject)=>{
      self.interpretateFile(scriptFileName)
        .then( 
          ()=>{
            console.log(`=> ${scriptFileName} loaded successfully!!`);
            resolve(null)} 
        )
        .catch(err=>{
          console.error(`Error while loading the script ${scriptFileName}: `, err);
          reject({...err, scriptFileName});
        });
    })
  }

  processWithRetry(
    promiseFactories: (() => Promise<any>)[],
    maxRetries: number
  ): Promise<void> {
    return sequencedPromise(promiseFactories).then((result) => {
      const reprocessPile = result.rejects
        .filter(
          (reject: {promise:()=>Promise<any>, details: InterpretationError}) =>
            reject.details.reason === InterpretationDropReason.ModuleDependencyUnfulfilled ||
            reject.details.reason === InterpretationDropReason.SceneDependencyUnfulfilled
        )
        //@ts-ignore
        .map((reject: {promise:()=>Promise<any>, details: InterpretationError}) => reject.promise);

      if (reprocessPile.length > 0 && maxRetries > 0) {
        return this.processWithRetry(
          reprocessPile,
          maxRetries - 1
        );
      }
    });
  }

  private interpretateFile(scriptFileName:string): Promise<null>{
    console.log(scriptFileName);
    const self = this;
    const jsonPath = `${self.projectRoot}scripts/${scriptFileName}`;

    return new Promise((resolve, reject)=>{
      RequestFile(jsonPath)
        .then(res=> atob(res))
        .then(scriptData=>{
          self.kreator(scriptData, false)
            .then( (processedScenesAndModules)=>{
              resolve(null);
            })
            .catch(err=>{
              console.error(`Error while interpreting the script ${scriptFileName}: `, err);
              reject(err);
            })
      })
    })
  }

  kreator(script:string,loadAudioVisual = true):Promise<InterpretedData>{
    return new Promise((resolve,reject)=>{ 
      this.loadScripts(!loadAudioVisual)
        .catch((err)=>{
          console.log(err);
          console.log("The scripts file couldn't be loaded. Ignoring!!!");
        })
        .finally(()=>{
          try {
            let scenesAndNodes = this.instructionsDesintegrator(script) as InterpretedData;
            console.log("Scenes and modules processed: ", scenesAndNodes);
            Object.assign(this.scenes,scenesAndNodes.scenes);
            Object.assign(this.modules,scenesAndNodes.modules);
            resolve(scenesAndNodes);
          } catch (error) {
            console.error("Error while interpreting the script: ", error);
            reject(error as InterpretationError);
          }
        })
    });
  }

  directKreator(script:string){
    return this.instructionsDesintegrator(script,true,true) as string;
  }

  //Transpiles an exact piece of script (independently of scene/module scopes), with the same routine-wrapping behaviour as the full script interpretation
  fragmentKreator(script:string){
    return this.instructionsDesintegrator(script,true,false) as string;
  }

  //Useful for tokenization script checking, to check if the script have syntax errors before trying to interpretate it
  tokenization(script:string){
    script += "\n"; //To avoid the last line to be ignored
    let tokenList = this.lexer(script).filter(tk=>{return (Array.isArray(tk))||((tk as Token).type != TokenType.space)});
    let abs = this.preParser(tokenList);
    return abs;
  }

  checkScriptAgainstSupportedInstructions(script:string): Array<{res:any, matchedInstruction: string}>{
    const abs = this.tokenization(script);
    let res: Array<{res: any, matchedInstruction: string}> = [];

    for (const instruction of abs) {
      if(Array.isArray(instruction)){
        for (const supportedInstruction of supportedInstructions) {
          //@ts-ignore
          const resCheck = (supportedInstruction).check(instruction as Instruction,this,true);
          // console.log(resCheck, supportedInstruction.constructor.name);
          if(resCheck.match){
            res.push({res: resCheck.result, matchedInstruction: supportedInstruction.constructor.name});
            break;
          }
        }
      }
    }
    return res;
  }

  checkScriptAgainstSupportedInstruction(script:string, instructionType:string): boolean{
    const abs = this.tokenization(script);
    let res = false;
    for (const instruction of abs) {
      if( Array.isArray(instruction) ){
        const supportedInstruction = this.invokeSupportedInstruction(instructionType);
        //@ts-ignore
        const resCheck = (supportedInstruction).check(instruction as Instruction,this,true);
        if(resCheck.match){
          console.log(resCheck);
          res = true;
          break;
        }
      }
    }
    return res;
  }

  //Collects the writing errors of a script as absolute char spans, for editor squiggles
  checkScriptForErrors(script:string): Array<ScriptErrorSpan>{
    const errors: Array<ScriptErrorSpan> = [];
    script += "\n"; //To avoid the last line to be ignored
    const tokenList = this.lexer(script);
    const abs = this.preParser(tokenList, [], errors);

    const pushError = (charStart:number, charEnd:number, message:string) => {
      if(charStart >= 0){
        const lineStart = script.lastIndexOf("\n", charStart - 1) + 1;
        const lineEndIndex = script.indexOf("\n", charEnd);
        errors.push({
          charStart,
          charEnd,
          message,
          line: (script.substring(0, lineStart).match(/\n/g) ?? []).length,
          lineStart,
          lineEnd: lineEndIndex == -1 ? script.length : lineEndIndex
        });
      }
    };

    for (const instructionEntry of abs) {
      if(Array.isArray(instructionEntry)){
        //Filter spaces identically to interpretateInstruction
        const instruction = (instructionEntry as Instruction).filter((tk)=>{
          return Array.isArray(tk) || ((tk as Token).type != TokenType.space);
        });
        const flatTokens = arrayFlatter(instruction as Array<any>).filter(tk=>{
          return !Array.isArray(tk) && (tk instanceof Token) && (tk as Token).type != TokenType.space;
        });
        if(flatTokens.length == 0){ continue; }
        if(flatTokens.some(tk=>{
          return (tk as Token).type == TokenType.jsCode;
        })){ continue; }

        const charIndexes = flatTokens.map(tk=>(tk as Token).charIndex).filter(charIndex=>charIndex >= 0);
        if(charIndexes.length == 0){ continue; }
        const charStart = Math.min(...charIndexes);
        const charEnd = Math.max(...flatTokens
          .filter(tk=>(tk as Token).charIndex >= 0)
          .map(tk=>{
            return (tk as Token).charIndex + String((tk as Token).value).length;
          }));

        const lineStart = script.lastIndexOf("\n", charStart - 1) + 1;
        const lineText = script.substring(lineStart).split("\n")[0];
        if(lineText.trim().startsWith("//")){ continue; }

        let matched = false;
        for (const supportedInstruction of supportedInstructions) {
          //checkOnly: validation without interpretate (no string building, no console logging)
          //@ts-ignore
          const resCheck = (supportedInstruction).check(instruction as Instruction, this, true, true);
          if(resCheck.match){
            matched = true;
            break;
          }
        }
        if(!matched){
          pushError(charStart, charEnd, this.buildUnknownInstructionMessage(instruction as Instruction));
        }
      }else if(instructionEntry instanceof Token){
        if((instructionEntry as Token).type == TokenType.jsCode){ continue; }
        pushError(
          (instructionEntry as Token).charIndex,
          (instructionEntry as Token).charIndex + String((instructionEntry as Token).value).length,
          "Unknown or unsupported instruction"
        );
      }
    }
    return errors;
  }

  private static instructionHumanNames: Array<[string,string]> = [
    ["CreateInstruction", "new (creation)"],
    ["DecisionInstruction", "ask"],
    ["DialogInstruction", "- (dialog)"],
    ["IncludeInstruction", "include"],
    ["ModuleDefinitionInstruction", "module"],
    ["NodeDefinitionInstruction", "node"],
    ["JumpToInstruction", "jumpto"],
    ["SetSpeakerInstruction", "says"],
    ["StructureEndInstruction", "end"],
    ["NarrationInstruction", "narration"],
    ["ResumeInstruction", "resume"],
    ["RunInstruction", "run"],
    ["SceneDefinitionInstruction", "scene"],
    ["SetInstruction", "set"],
    ["DeleteInstruction", "delete"],
    ["WaitInstruction", "wait"],
    ["MoveActorInstruction", "move"],
    ["EmotionChangeInstruction", "gets"],
    ["ArriveInstruction", "arrives"],
    ["SoundInstruction", "sound"]
  ];

  private static knownKeywords: Array<string> = [
    "scene", "module", "node", "end", "ends", "include", "run", "jumpto",
    "set", "delete", "sound", "wait", "resume", "ask", "move", "arrives",
    "arrive", "gets", "says", "new"
  ];

  private buildUnknownInstructionMessage(instruction: Instruction): string {
    //First word of the line: family hint and typo suggestion
    const firstToken = instruction[0] as Token;
    const firstWord = (String(firstToken?.value ?? "")).trim().toLowerCase();
    const firstWordIsKnown = ChaosInterpreter.knownKeywords.includes(firstWord);
    const suggestion = ChaosInterpreter.knownKeywords.find(keyword=>{
      if (this.levenshteinDistance(firstWord, keyword) <= 2) { return true; }
      //Typo in the prefix of a longer keyword
      return firstWord.length >= 2 && this.levenshteinDistance(firstWord, keyword.substring(0, firstWord.length)) <= 2;
    });

    if (!firstWordIsKnown && suggestion != null) {
      return `Unrecognized instruction: "${firstWord}" — did you mean "${suggestion}"?`;
    }

    //Deepest failure hint from the builders
    const namedFailures: Array<{depth:number, expected:string, got:string, keyword:string}> = [];
    for (const supportedInstruction of supportedInstructions) {
      const failure = (supportedInstruction as any).getFailure?.() ?? null;
      if (failure == null) { continue; }
      const found = ChaosInterpreter.instructionHumanNames.find(([className])=>className == supportedInstruction.constructor.name);
      const keyword = found ? found[1] : supportedInstruction.constructor.name;
      namedFailures.push({...failure, keyword});
    }

    //Prefer the failure of the builder whose keyword matches the first word of the line
    const keywordMatching = namedFailures.filter(failure=>{
      const keywordMainWord = failure.keyword.split(" ")[0].toLowerCase();
      return keywordMainWord == firstWord;
    });
    if (keywordMatching.length > 0) {
      namedFailures.length = 0;
      namedFailures.push(...keywordMatching);
    }

    const deepestFailure = namedFailures[namedFailures.length - 1];
    if (deepestFailure != null) {
      const expectedText = deepestFailure.expected ? deepestFailure.expected : "unexpected value";
      return `Invalid syntax for "${deepestFailure.keyword}": at token ${deepestFailure.depth} ${expectedText}, but got ${deepestFailure.got}`;
    }
    return "Unknown or unsupported instruction";
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a.length == 0) { return b.length; }
    if (b.length == 0) { return a.length; }
    const previousRow = new Array(a.length + 1).fill(0).map((_,i)=>i);
    for (let row = 1; row <= b.length; row++) {
      let lastDiagonal = previousRow[0];
      previousRow[0] = row;
      for (let col = 1; col <= a.length; col++) {
        const temp = previousRow[col];
        previousRow[col] = Math.min(
          previousRow[col] + 1,
          previousRow[col - 1] + 1,
          lastDiagonal + (b[row - 1] == a[col - 1] ? 0 : 1)
        );
        lastDiagonal = temp;
      }
    }
    return previousRow[a.length];
  }

  private instructionsDesintegrator(script:string, ignoreSceneOrModuleDefinitionCheck = false, recursiveMode=false){
    script += "\n"; //To avoid the last line to be ignored
    let tokenList = this.lexer(script);
    let abs = this.preParser(tokenList);
    
    let collection:Array<Interpretation> = [];

    for (let index = 0; index < abs.length; index++) {
      const instruction = abs[index] as Instruction|Token;
      if(Array.isArray(instruction)){
        const interpretation = this.interpretateInstruction(instruction as Instruction,recursiveMode);
        //@ts-ignore
        if(interpretation.itWasAScriptInstruction){
          //* Agrupation check: if the current interpretation is agrupable, and the last instruction 
          //* in the collection have the same matchName, then they will be mixed in one single instruction 
          //* with the agrupator method of the supported instruction class. This is useful for example, 
          //* for the DialogInstruction, to avoid that each line of dialog to be a different instruction, 
          //* and instead, they will be grouped in one single instruction with all the lines of dialog.
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
        if(instruction.type == TokenType.jsCode){
          collection.push({itWasAScriptInstruction:true,result:instruction.value,matchName:"",isAgrupable:false});
          continue;
        }
      }
      console.warn("Un-understandable or unsupported instruction",instruction);
    }

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
    const matches = Array.from(script.matchAll(regex)) as Array<RegExpMatchArray>;
    const tokenList = matches.map((match,index)=>{
          const val = match[0];
          const charIndex = match.index ?? -1;
          let symbol: TokenType;
          if(val.match(/\n{1,}/)){
            symbol=TokenType.lineBreak;
          }else if(val.match(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/)){
            symbol=TokenType.text;
          }else if(val.match(/[+\-*/%^=!<>&|]/)){
            symbol=TokenType.operator;
          }else if(val.match(/(\d+\.?\d*)|(\.\d*)/)){
            symbol=TokenType.number;
          }else if(val.match(/[\(\{\[]/)){
            symbol=TokenType.openBracket;
          }else if(val.match(/[\)\}\]]/)){
            symbol=TokenType.closeBracket;
          }else if(val.match(/[\.,;:]/)){
            symbol=TokenType.separator;
          }else if(val.match(/\s{1,}/)){
            symbol=TokenType.space;
          }else{
            symbol=TokenType.word;//Probably ;)
          }

          return new Token(val,symbol,index,charIndex);
      });

      return tokenList;
  }
  private tokenListToText(tokenList:Instruction){
    return arrayFlatter(tokenList).map(token=>{return token.value}).join("");
  }

  private preParser(tokenList:Array<Token>, bracketsPile:Array<Token> = [], errorCollector: Array<{charStart:number, charEnd:number, message:string}> = null) : [Instruction, number]|Instruction{
    let abs:Instruction = new Instruction();
    let acum:Instruction = bracketsPile.map(a=>a) as Instruction;
    let isJsCode = false;
    let loopsDone = 0;
    let bracketCounter = bracketsPile.length;
    for (let idx = 0; idx < tokenList.length; idx++) {
      loopsDone++;
      const token = tokenList[idx];
      if(token.type == TokenType.openBracket){
        // bracketCounter++;
        let [res, checked] = this.preParser(tokenList.slice(idx+1), [token], errorCollector) as [Instruction, number];
        loopsDone += checked;
        idx += checked;
        acum.push(res);
        continue;
      }
      if(token.type == TokenType.closeBracket){
        const latestBracketInPile =  bracketsPile.at(-1);
        if(latestBracketInPile !== undefined){
          if(
            token.value == "]" && latestBracketInPile.value == "[" ||
            token.value == "}" && latestBracketInPile.value == "{" ||
            token.value == ")" && latestBracketInPile.value == "("
          ){
            acum.push(token);
            bracketsPile.pop();
            bracketCounter--;
            if(bracketCounter == 0){
              //TODO: Preventive check if the acum have script instructions
              return [acum,loopsDone];
            }
          }else{
            console.error(`Syntax error: ${token.value} in token ${token.index}, expected ${latestBracketInPile.value}`);
            if(errorCollector != null){
              errorCollector.push({
                charStart: token.charIndex,
                charEnd: token.charIndex + String(token.value).length,
                message: `Syntax error: ${token.value}, expected ${latestBracketInPile.value}`
              });
            }
            //TODO: Add a throw error
            break;
          }
        }

      }
      if(token.type == TokenType.lineBreak && bracketCounter == 0){ //Si hay un salto de linea y ttodos los brackets se han cerrado
        if(isJsCode){
          if(this.tokenListToText(acum).length != 0){
            abs.push(
              new Token(this.tokenListToText(acum), TokenType.jsCode,acum[0].index)
            );
          }
        }else{//* If is not a js code, then it is a script instruction
          abs.push(acum);
        }
        isJsCode = false;
        acum = new Instruction();
        continue;
      }
      if(acum.length == 0 && token.type == TokenType.word && token.value == "@"){
        isJsCode = true;
        continue;
      }
      if(
        isJsCode || 
        token.type == TokenType.word || 
        token.type == TokenType.lineBreak || 
        token.type == TokenType.number || 
        token.type == TokenType.text || 
        token.type == TokenType.operator || 
        token.type == TokenType.separator || 
        (acum.length != 0 && token.type == TokenType.space)){

        acum.push(token);
        //*Cuando un token de salto de linea sea agregado,comprobar si acum tiene saltos de linea anteriores    
        //*si es verdad, comprobar que el contenido presente entre saltos de linea sea una instruccion del motor    
        //*en caso de que sea verdad, se debe de convertir inmediatamente ese contenido de instruccion del motor
        //*a codigo de js: new Token(...,js,plausibleInstruction[0].index)

        if(token.type == TokenType.lineBreak){
          let plausibleInstruction = new Instruction();
          let prevLineBreakFound = false;
          
          for(let idxInner = acum.length-2; idxInner > 0; idxInner--){
            const tokenB = acum[idxInner];

            if(tokenB.constructor === Token && (tokenB as Token).type == TokenType.lineBreak){
              prevLineBreakFound = true;
              break;
            }
            plausibleInstruction.push(tokenB);
          }
          if(prevLineBreakFound){
            plausibleInstruction.reverse();
            //@ts-ignore
            const interpretation = this.interpretateInstruction(plausibleInstruction, true);
            if(interpretation.itWasAScriptInstruction){
              acum.splice((acum.length-1)-plausibleInstruction.length); //Remover todos los tokens que conforman la posible instrucción
              acum.push(
                new Token( interpretation.result, TokenType.jsCode, plausibleInstruction[0].index)
              );

              acum.push(
                new Token( 
                  "\n", 
                  TokenType.lineBreak, 
                  plausibleInstruction[ plausibleInstruction.length>1 ? 1 : 0 ].index
                )
              );

            }
          }
        }
        continue;
      }
    }
    return abs;
  }

  private interpretateInstruction(_instruction:Instruction,recursiveMode: boolean): Interpretation{
    let itWasAScriptInstruction = false;
    let result:Dictionary<any>|string|Instruction = _instruction;
    let matchName = ""; //TODO: change this, to handle the class or null reference
    let isAgrupable = false;
    if(_instruction.length == 0){
      return {itWasAScriptInstruction,result,matchName,isAgrupable};
    }
    const instruction = _instruction.filter(tk=>{return Array.isArray(tk)||((tk as Token).type != TokenType.space)});

    for (const supportedInstruction of supportedInstructions) {
      //@ts-ignore
      const res = (supportedInstruction).check(instruction, this, !recursiveMode);
      if(res.match){
        itWasAScriptInstruction = true;
        result = res.result as Interpretation;
        matchName = supportedInstruction.constructor.name; //TODO: check this
        isAgrupable = supportedInstruction.isAgrupable();
        break;
      }
    }
    return {itWasAScriptInstruction,result,matchName,isAgrupable};
  }

  private haveSceneOrModuleDefinition(interpretedInstructions:Array<Interpretation>){
    let scenes: ScenesDictionary = {};
    let modules: ModulesDictionary = {};

    let actualStructureDefinition = {define:ScriptStructure.Scene, id:"gameEntrypoint"};
    scenes[actualStructureDefinition.id] = {main:"",nodes:{}};

    let fillingScene = false;
    let fillingModule = false;
    let fillingNode = false;

    let tag = actualStructureDefinition.id;
    let nodeTag = "";

    for (const interpretation of interpretedInstructions) {
      if(interpretation.itWasAScriptInstruction){
        if(interpretation.result.constructor === Object){
          const result = interpretation.result as Object;

          if("define" in result && "id" in result){
            const define = ScriptStructure.enumify(result.define as string);
            actualStructureDefinition = {define,id:result.id as string};
            if(define == ScriptStructure.Scene && !fillingModule && !fillingNode && !fillingScene){
              fillingScene = true;
              tag = actualStructureDefinition.id;
              scenes[tag] = {main:"", nodes:{}};
            }else if(define == ScriptStructure.Module && !fillingScene && !fillingNode && !fillingModule){
              fillingModule = true;
              tag = actualStructureDefinition.id;
              modules[tag] = "";
            }else if(define == ScriptStructure.Node && !fillingModule && fillingScene && !fillingNode){
              fillingNode = true;
              nodeTag = actualStructureDefinition.id;
              scenes[tag].nodes[nodeTag] = "";
            }
            continue;
          }else if("end" in result){
            const end = ScriptStructure.enumify(result.end as string);
            if(end == ScriptStructure.Node && fillingNode && fillingScene && !fillingModule){
              fillingNode = false;              
              nodeTag = "";
            }else if(end == ScriptStructure.Module && fillingModule && !fillingScene && !fillingNode){
              fillingModule = false;
              tag = "";
            }else if(end == ScriptStructure.Scene && fillingScene && !fillingNode){
              fillingScene = false;
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
        //Fallback if the gameEntrypoint is defined, whitout content in main or nodes, modules are empty, all the filling checks are false, 
        //and the current instruction is not a scene, module or node definition, then the instruction will be added to the gameEntrypoint main.
        if(!fillingScene && 
            !fillingModule && 
            !fillingNode && 
            "gameEntrypoint" in scenes && 
            Object.keys(scenes.gameEntrypoint.nodes).length == 0 && 
            scenes.gameEntrypoint.main == ""){
          fillingScene = true;
          tag = "gameEntrypoint";
          scenes[tag] = {main:"", nodes:{}};
        }

        else if(fillingScene && !fillingNode){
          scenes[tag].main+=interpretation.result+"\n";
        }else if(fillingScene && fillingNode){
          scenes[tag].nodes[nodeTag]+=interpretation.result+"\n";
        }else if(fillingModule){
          modules[tag]+=interpretation.result+"\n";
        }
      }
    }

    if("gameEntrypoint" in scenes && scenes.gameEntrypoint.main == "" && Object.keys(scenes.gameEntrypoint.nodes).length == 0){
      delete scenes.gameEntrypoint;
    }else if("gameEntrypoint" in scenes){
      scenes.gameEntrypoint.main = 
      `engine.textureManager.loadTexture('${this.getTexture()}').then(()=>{
        engine.audioManager.loadSound('${this.getSound()}').then(()=>{
          ${scenes.gameEntrypoint.main}
        });
      });`
    }

    return {scenes,modules};
  }
}

export type ScriptErrorSpan = {
  charStart: number,
  charEnd: number,
  message: string,
  line: number,
  lineStart: number,
  lineEnd: number
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