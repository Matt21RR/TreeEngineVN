import { Dictionary } from "../../global.ts";
import GraphObject from "./GraphObject.ts"

const OPACITY_0_WHEN_INSTANCE = true;

type ActorType = {
  id:string;
  active?:boolean;
  maskMode?:boolean; //maskMode means the actor emotions graphobjects must to overlaps the actor body graphobject
  //by default this behavior is off and also not implemented yet
  //so, right now, the actor show or it's body or its emotions graphobjects, not both
  name:string;
  body:GraphObject;
  emotions?:Dictionary<GraphObject>|null;
  emotion?:string;
}

class Actor{
  #id:string;
  #active:boolean;
  #maskMode:boolean;
  #name:string;
  #body:GraphObject;
  #emotions:Dictionary<GraphObject>|null;
  #emotion:string|null;

  constructor(data:ActorType){
    this.#id = data.id;
    this.#active = data.active ?? false;
    this.#maskMode = data.maskMode ?? false;//TODO: implement maskMode
    this.#name = data.name;
    this.#body = data.body; // replace the bodyId with the reference to the graphobject in the interpretation phase
    this.#emotions = data.emotions ?? {}; // replace the emotions maskId with the reference to the graphobject in the interpretation phase
    // this.#activeEmotionLayer = null;

    this.#emotion = data.emotion ?? null

    if(OPACITY_0_WHEN_INSTANCE){
      this.#body.opacity = 0;

      for (const emotion in this.#emotions) {
        this.#emotions[emotion].opacity = 0;
      }
    }
  }
  get id(){return this.#id;}
  get active(){return this.#active;}
  get name(){return this.#name;}
  get body(){return this.#body;}
  // get activeEmotionlayer(){return this.#activeEmotionLayer}

  get emotion(){return this.#emotion;}
  set emotion(x:string|null){
    if(!x){
      this.#emotion = x;
    }
    if(this.#emotions && (x in this.#emotions)){
      this.#emotion = x;
      // if(this.#activeEmotionLayer){
      //   this.#activeEmotionLayer.enabled = false;
      // }
      // this.#activeEmotionLayer = this.#emotions[x];
      // this.#activeEmotionLayer.enabled = true;
    }
  }

  get emotions(){return this.#emotions;}

  getActiveMask(){
    return this.#emotion ? this.#emotions[this.#emotion] : this.#body;
  }

  removeFocus(){
    this.#body.brightness = 0.8;
    if(this.#emotion){
      this.#emotions[this.#emotion].brightness = 0.8;
    }
    // if(this.#activeEmotionLayer){
    //   this.#activeEmotionLayer.brightness = 0.8;
    // }
  }

}

export default Actor;