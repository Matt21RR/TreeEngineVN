import { RenderEngine } from "../renderCore/RenderEngine";

class Trigger{
  #id
  #relatedTo
  #enabled

  #onPress //Keyboard
  #onHold
  #onRelease
  #onEnter
  #onLeave

  constructor(tInfo){
    if(!("id" in tInfo))
      throw new Error("Trying to create a Trigger without id");

    this.#id = tInfo.id;
    this.#relatedTo = "relatedTo" in tInfo ? tInfo.relatedTo : "Keyboard";
    this.#enabled = "enabled" in tInfo ? tInfo.enabled : true;
    //if superposition is true the engine will ignore the graphObjects that are over the graphobject related to the trigger
    //superposition: tInfo.superposition != undefined ? tInfo.superposition : false,
    this.#onPress = "onPress" in tInfo ? tInfo.onPress : null;//Special for keyboard
    this.#onHold = "onHold" in tInfo ? tInfo.onHold : null;
    this.#onRelease = "onRelease" in tInfo ? tInfo.onRelease : null;
    this.#onEnter = "onEnter" in tInfo ? tInfo.onEnter : null;
    this.#onLeave = "onLeave" in tInfo ? tInfo.onLeave : null;
  }

  get id(){return this.#id}

  get relatedTo() {return this.#relatedTo;}
  set relatedTo(x) {this.#relatedTo = x;}

  get enabled() {return this.#enabled;}
  set enabled(x){this.#enabled = x;}

  get onPress() {return this.#onPress;}
  set onPress(x) {this.#onPress = x;}

  get onHold() {return this.#onHold;}
  set onHold(x) {this.#onHold = x;}

  get onRelease() {return this.#onRelease;}
  set onRelease(x) {this.#onRelease = x;}

  get onEnter() {return this.#onEnter;}
  set onEnter(x) {this.#onEnter = x;}

  get onLeave() {return this.#onLeave;}
  set onLeave(x) {this.#onLeave = x;}

  check(engineRef = new RenderEngine(),action = new String()){
    if(action == "mouseMove")//check onEnter
      action = "onEnter";
    if(this[action] == null || !this.enabled){
      return;
    }
    const numberOfArguments = this[action].length;
    if(numberOfArguments == 0){
      this[action]();
    }else if(numberOfArguments == 1){
      this[action](engineRef);
    }else if (numberOfArguments == 2){
      const graphObjectRef = engineRef.graphArray.get(this.relatedTo);
      this[action](engineRef,graphObjectRef);
    }else{
      throw new Error("Too much arguments (",numberOfArguments,") for the function defined to the action ",action,", for the trigger",this.id)
    }
  }
}

export {Trigger}