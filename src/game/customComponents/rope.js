import { GraphObject } from "../../engine/engineComponents/GraphObject";

class Rope extends GraphObject{
  constructor(data){
    super(data.appearance);
    this.mesh = data.mesh;
  }
}
export {Rope}