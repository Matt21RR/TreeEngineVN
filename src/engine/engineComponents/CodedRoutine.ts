import { RenderEngine } from "../renderCore/RenderEngine.tsx";
import EnabledObject from "./EnabledObject.ts";

class CodedRoutine extends EnabledObject{
  #id
  #continious

  #code

  constructor(tInfo){
    super();
    if(!("id" in tInfo))
      throw new Error("Trying to create a Trigger without id");

    this.#id = tInfo.id;
    this._enabled = tInfo.enabled || true;
    this.#continious = tInfo.continious || false;
    this.#code = tInfo.code || null;
  }
  
  print() {
    const output =  `CodedRoutine {
      id: ${this.#id},
      enabled: ${this._enabled},
      continious: ${this.#continious},
      code: ${this.#code}
    }`;
    
    console.log(output);
  }

  get id(){return this.#id}

  get continious() {return this.#continious;}
  set continious(x) {this.#continious = x;}

  get code() {return this.#code;}
  set code(x) {this.#code = x;}

  run(engineRef:RenderEngine){
    try {
      if(this.#code == null || !this.enabled){
        return;
      }
      const numberOfArguments = this.#code.length;
      if(numberOfArguments == 0){
        this.#code();
      }else if(numberOfArguments == 1){
        this.#code(engineRef);
      }else if(numberOfArguments == 2){
        this.#code(engineRef,engineRef.engineTime);
      }else{
        this.print();
        throw new Error(`Too much arguments (${numberOfArguments}) , for the codedRoutine "${this.id}"`);
      }
      if(!this.#continious){
        this.enabled = false;
      } 
    } catch (error) {
      console.error(error);
      this.print()
      debugger;
    }
  }
  
}

export {CodedRoutine}