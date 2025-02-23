import { RenderEngine } from "../renderCore/RenderEngine.tsx";
import { GraphObject } from "./GraphObject";

class Trigger{
  #id:string
  #relatedTo:string|null = null
  #enabled:boolean

  #onHold:Function|null
  #onRelease:Function|null
  #onEnter:Function|null
  #onLeave:Function|null
  #onWheel:Function|null
  #onMouseMove:Function|null

  constructor(tInfo){
    if(!("id" in tInfo))
      throw new Error("Trying to create a Trigger without id");
    if(!tInfo.relatedToBypass){
      if(!("relatedTo" in tInfo))
        throw new Error("Trying to create a Trigger without the graphObject id that will be related to");
    }

    this.#id = tInfo.id;
    this.#relatedTo =   tInfo.relatedTo ?? null;
    this.#enabled =     tInfo.enabled ?? true;
    //if superposition is true the engine will ignore the graphObjects that are over the graphobject related to the trigger
    //superposition: tInfo.superposition != undefined ? tInfo.superposition : false,
    this.#onHold =      tInfo.onHold ?? null;
    this.#onRelease =   tInfo.onRelease ?? null;
    this.#onEnter =     tInfo.onEnter ?? null;
    this.#onLeave =     tInfo.onLeave ?? null;
    this.#onWheel =     tInfo.onWheel ?? null;
    this.#onMouseMove = tInfo.onMouseMove ?? null;
  }

  get id(){return this.#id}

  get relatedTo() {return this.#relatedTo;}
  set relatedTo(x) {this.#relatedTo = x;}

  get enabled() {return this.#enabled;}
  set enabled(x){this.#enabled = x;}

  get onHold() {return this.#onHold;}
  set onHold(x) {this.#onHold = x;}

  get onRelease() {return this.#onRelease;}
  set onRelease(x) {this.#onRelease = x;}

  get onEnter() {return this.#onEnter;}
  set onEnter(x) {this.#onEnter = x;}

  get onLeave() {return this.#onLeave;}
  set onLeave(x) {this.#onLeave = x;}

  get onWheel() {return this.#onWheel;}
  set onWheel(x) {this.#onWheel = x;}

  get onMouseMove() {return this.#onMouseMove;}
  set onMouseMove(x) {this.#onMouseMove = x;}

  check(engineOrMouseRef:RenderEngine|React.MouseEvent|React.TouchEvent, action:string){
    if(action == "mouseMove")//check onEnter
      action = "onEnter";
    if(this[action] == null || !this.enabled){
      return;
    }
    const numberOfArguments = this[action].length;
    if(numberOfArguments == 0){
      this[action]();
    }else if(numberOfArguments == 1){
      this[action](engineOrMouseRef);
    }else if (numberOfArguments == 2 && this.relatedTo != null){
      //@ts-ignore
      const graphObjectRef:GraphObject = engineOrMouseRef.graphArray.get(this.relatedTo);
      this[action](engineOrMouseRef,graphObjectRef);
    }else{
      throw new Error(`Too much arguments (${numberOfArguments}) for the function defined to the action ${action}, for the trigger "${this.id}`)
    }
  }
}

class KeyboardTrigger{
  #keys:Array<string>;
  #enabled:boolean

  #onPress:Function|null
  #onHold:Function|null
  #onRelease:Function|null

  constructor(tInfo){
    this.#keys = typeof tInfo.keys == "string" ? [tInfo.keys] : tInfo.keys;
    this.#enabled =     tInfo.enabled ?? true;
    this.#onPress =     tInfo.onPress ?? null;
    this.#onHold =      tInfo.onHold ?? null;
    this.#onRelease =   tInfo.onRelease ?? null;
  }

  get id(){return this.#keys.join(" ")}

  get keys(){return this.#keys}

  get enabled() {return this.#enabled;}
  set enabled(x){this.#enabled = x;}

  get onPress() {return this.#onPress;}
  set onPress(x) {this.#onPress = x;}

  get onHold() {return this.#onHold;}
  set onHold(x) {this.#onHold = x;}

  get onRelease() {return this.#onRelease;}
  set onRelease(x) {this.#onRelease = x;}


  check(engineRef:RenderEngine,action:string){
    if(this[action] == null || !this.enabled){
      return;
    }
    const numberOfArguments = this[action].length;
    if(numberOfArguments == 0){
      this[action]();
    }else if(numberOfArguments == 1){
      this[action](engineRef);
    }else{
      throw new Error(`Too much arguments (${numberOfArguments}) for the function defined to the action ${action}, for the trigger "${this.id}`)
    }
  }
}

export {Trigger, KeyboardTrigger}