export default class StageMark{
  private _id:string;
  private _x: number|null
  private _y: number|null
  private _z: number|null

  constructor(smInfo){
    if(!("id" in smInfo))
      throw new Error("Trying to create a StageMark without id");

    this._id = smInfo.id;

    this._x = smInfo.x ?? null;
    this._y = smInfo.y ?? null;
    this._z = smInfo.z ?? null;
  }

  get id(){return this._id;}

  get x() {return this._x;}
  get y() {return this._y;}
  get z() {return this._z;}

  get point (){
    let pt = {};
    if(this._x){ Object.assign( pt, {x: this._x}) };
    if(this._y){ Object.assign( pt, {y: this._y}) }
    if(this._z){ Object.assign( pt, {z: this._z}) }
    return pt;
  }
}