import { GraphObject } from "../engineComponents/GraphObject";

class Battleground extends GraphObject{
  constructor(data){
    super(data.appearance);
    this.mesh = data.mesh;
  }
}
export {Battleground}