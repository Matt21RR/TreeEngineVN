class TextureAnim{
  #id:string
  #list:Array<string> = [];

  #duration:number = 1000;
  #timer:number = 0;
  #speed:number = 1;

  constructor(tInfo){
    if(!("id" in tInfo))
      throw new Error("Trying to create a TextureArray without id");

    this.#id =        tInfo.id;
    this.#list =      tInfo.list || [];

    this.#duration =  tInfo.duration || 1000;
    this.#timer =     tInfo.timer || 0;
    this.#speed =     tInfo.speed || 1;

  }

  get id(){return this.#id}

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