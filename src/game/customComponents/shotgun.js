import { GraphObject } from "../engineComponents/GraphObject";

class Shotgun extends GraphObject{
  constructor(data){
    super(data.appearance);
    this.mesh = data.mesh;
  }
}
export {Shotgun}