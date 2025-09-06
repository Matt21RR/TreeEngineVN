class EnabledObject {
  protected _enabled:boolean;
  _updateEnabled:(id:string,enabled:boolean)=>void; //semi-observer for enabled list update
  _id:string;

  get id(){
    return this._id;
  }

  set updateEnabled(x:(id:string,enabled:boolean)=>void){
    this._updateEnabled = x;
    this._updateEnabled(this.id,this.enabled);
  }

  get enabled() {return this._enabled}
  set enabled(x) {
    this._updateEnabled(this.id,x);
    this._enabled = x;
  }
}
export default EnabledObject