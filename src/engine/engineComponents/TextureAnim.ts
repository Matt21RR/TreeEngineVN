class TextureAnim{
  private _id:string
  private _list:Array<string> = [];

  private _duration:number = 1000;
  private _speed:number = 1;

  constructor(tInfo){
    if(!("id" in tInfo))
      throw new Error("Trying to create a TextureArray without id");

    this._id =        tInfo.id;
    this._list =      tInfo.list || [];

    this._duration =  tInfo.duration || 1000;
    this._speed =     tInfo.speed || 1;

  }

  get id(){return this._id}

  get duration() {return this._duration;}
  set duration(x) {this._duration = x;}

  get speed() {return this._speed;}
  set speed(x) {this._speed = x;}

  getTexture(engDelta: number){
    const listLength = this._list.length;
    const delta = engDelta % this._duration;
    const step = this._duration / listLength;
    const index = Math.floor(delta/step);

    return this._list[index];
  }
}

export {TextureAnim}