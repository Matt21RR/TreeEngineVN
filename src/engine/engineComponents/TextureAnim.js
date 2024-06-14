import { RenderEngine } from "../renderCore/RenderEngine";

class TextureAnim{
  #id
  #enabled
  #list = [];

  #duration = 1000;
  #timer = 0;
  #speed = 1;

  constructor(tInfo){
    if(!("id" in tInfo))
      throw new Error("Trying to create a TextureArray without id");

    this.#id = tInfo.id;
    this.#enabled = "enabled" in tInfo ? tInfo.enabled : true;
    this.#list = "list" in tInfo ? tInfo.list : [];

    this.#duration = "duration" in tInfo ? tInfo.duration : 1000;
    this.#timer = "timer" in tInfo ? tInfo.timer : 0;
    this.#speed = "speed" in tInfo ? tInfo.speed : 1;

  }

  get id(){return this.#id}

  get enabled() {return this.#enabled;}
  set enabled(x){this.#enabled = x;}

  get duration() {return this.#duration;}
  set duration(x) {this.#duration = x;}

  get timer() {return this.#timer;}
  set timer(x) {this.#timer = x;}

  get speed() {return this.#speed;}
  set speed(x) {this.#speed = x;}

  getTexture(engDelta){
    this.#timer = engDelta;
    const listLength = this.#list.length;
    const delta = this.#timer % this.#duration;
    const step = this.#duration / listLength;
    const index = Math.floor(delta/step);

    return this.#list[index];
  }
}

export {TextureAnim}