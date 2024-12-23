import { RenderEngine } from "../renderCore/RenderEngine";

class CodedRoutine{
  #id
  #enabled
  #continious

  #code

  constructor(tInfo){
    if(!("id" in tInfo))
      throw new Error("Trying to create a Trigger without id");

    this.#id = tInfo.id;
    this.#enabled = tInfo.enabled || true;
    this.#continious = tInfo.continious || false;
    this.#code = tInfo.code || null;
  }

  get id(){return this.#id}

  get enabled() {return this.#enabled;}
  set enabled(x){this.#enabled = x;}

  get continious() {return this.#continious;}
  set continious(x) {this.#continious = x;}

  get code() {return this.#code;}
  set code(x) {this.#code = x;}

  run(engineRef = new RenderEngine()){
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
        throw new Error("Too much arguments (",numberOfArguments,") , for the codedRoutine",this.id)
      }
      if(!this.#continious){
        this.#enabled = false;
      } 
    } catch (error) {
      console.log(this.#code);
      console.error(error);
      debugger;
    }
  }
}

export {CodedRoutine}