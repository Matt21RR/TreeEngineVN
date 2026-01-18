import { RenderEngine } from "../renderCore/RenderEngine.tsx";
import EnabledObject from "./EnabledObject.ts";
import GraphObject from "./GraphObject.ts";

class Trigger extends EnabledObject{
  _relatedTo:string|null = null

  private _onHold:Function|null
  private _onRelease:Function|null
  private _onEnter:Function|null
  private _onLeave:Function|null
  private _onWheel:Function|null
  private _onMouseMove:Function|null

  constructor(tInfo){
    super();
    if(!("id" in tInfo))
      throw new Error("Trying to create a Trigger without id");
    if(!tInfo.relatedToBypass){
      if(!("relatedTo" in tInfo))
        throw new Error("Trying to create a Trigger without the graphObject id that will be related to");
    }

    this._id = tInfo.id;
    this._relatedTo =   tInfo.relatedTo ?? null;
    this._enabled =     tInfo.enabled ?? true;
    //if superposition is true the engine will ignore the graphObjects that are over the graphobject related to the trigger
    //superposition: tInfo.superposition != undefined ? tInfo.superposition : false,
    this._onHold =      tInfo.onHold ?? null;
    this._onRelease =   tInfo.onRelease ?? null;
    this._onEnter =     tInfo.onEnter ?? null;
    this._onLeave =     tInfo.onLeave ?? null;
    this._onWheel =     tInfo.onWheel ?? null;
    this._onMouseMove = tInfo.onMouseMove ?? null;
  }

  get id(){return this._id}

  get relatedTo() {return this._relatedTo;}
  set relatedTo(x) {this._relatedTo = x;}

  get onHold() {return this._onHold;}
  set onHold(x) {this._onHold = x;}

  get onRelease() {return this._onRelease;}
  set onRelease(x) {this._onRelease = x;}

  get onEnter() {return this._onEnter;}
  set onEnter(x) {this._onEnter = x;}

  get onLeave() {return this._onLeave;}
  set onLeave(x) {this._onLeave = x;}

  get onWheel() {return this._onWheel;}
  set onWheel(x) {this._onWheel = x;}

  get onMouseMove() {return this._onMouseMove;}
  set onMouseMove(x) {this._onMouseMove = x;}

  check(engineOrMouseRef:RenderEngine|React.MouseEvent|React.TouchEvent, action:string){
    if(action == "mouseMove")//check onEnter
      action = "onEnter";
    if(!this[action]|| !this.enabled){
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

class KeyboardTrigger extends EnabledObject{
  private _keys:Array<string>;

  private _onPress:Function|null
  private _onHold:Function|null
  private _onRelease:Function|null

  constructor(tInfo){
    super();
    this._keys = typeof tInfo.keys == "string" ? [tInfo.keys] : tInfo.keys;
    this._enabled =     tInfo.enabled ?? true;
    this._onPress =     tInfo.onPress ?? null;
    this._onHold =      tInfo.onHold ?? null;
    this._onRelease =   tInfo.onRelease ?? null;
  }

  get id(){return this._keys.join(" ")}

  get keys(){return this._keys}

  get onPress() {return this._onPress;}
  set onPress(x) {this._onPress = x;}

  get onHold() {return this._onHold;}
  set onHold(x) {this._onHold = x;}

  get onRelease() {return this._onRelease;}
  set onRelease(x) {this._onRelease = x;}


  check(engineRef:RenderEngine,action:string){
    if(!this[action] || !this.enabled){
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