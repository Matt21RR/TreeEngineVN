import { Dictionary } from "../../global.ts";
import { GraphObject } from "./GraphObject.ts"

type ActorType = {
  id:string;
  active?:boolean;
  name:string;
  body:GraphObject;
  emotions?:Dictionary<GraphObject>|null;
  emotion?:string;
}

class Actor{
  #id:string;
  #active:boolean;
  #name:string;
  #body:GraphObject;
  #emotions:Dictionary<GraphObject>|null;
  #activeEmotionLayer:GraphObject|null;
  #emotion:string|null;

  constructor(data:ActorType){
    this.#id = data.id;
    this.#active = data.active ?? false;
    this.#name = data.name;
    this.#body = data.body; // replace the bodyId with the reference to the graphobject in the interpretation phase
    this.#emotions = data.emotions ?? {}; // replace the emotions maskId with the reference to the graphobject in the interpretation phase
    this.#activeEmotionLayer = null;
    // this.#emotion = data.emotion ?? null
  }
  get id(){return this.#id;}
  get active(){return this.#active;}
  get name(){return this.#name;}
  get body(){return this.#body;}
  get activeEmotionlayer(){return this.#activeEmotionLayer}
  // get emotions(){return this.#emotions;}
  // get emotion(){return this.#emotion;}

  set emotion(x:string){
    if(this.#emotions && (x in this.#emotions)){
      if(this.#activeEmotionLayer){
        this.#activeEmotionLayer.enabled = false;
      }
      this.#activeEmotionLayer = this.#emotions[x];
      this.#activeEmotionLayer.enabled = true;
    }
  }

  removeFocus(){
    this.#body.brightness = 0.8;
    if(this.#activeEmotionLayer){
      this.#activeEmotionLayer.brightness = 0.8;
    }
  }

}

export default Actor;