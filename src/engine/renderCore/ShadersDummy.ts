import {GraphObject} from "../engineComponents/GraphObject.ts"
import { ShaderCanvas } from "./ShaderCanvas.ts";
import {Assets, Sprite} from "pixi.js";
class Shader{
  #image: Sprite;
  #resolution: {width:number,height:number};
  #id:string;
  constructor(image: HTMLImageElement,id:string){
    // this.#image = this.convertImageToCanvas(image);
    Assets.load(image).then((texture)=>{
      this.#image = new Sprite(texture);
    })

    this.#id = id;
    
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    this.#resolution = {width,height};
  }
  get id(){return this.#id;}
  // get texture(){return this.#image;}
  get resolution(){return this.#resolution}
  /**
   * 
   * @param {GraphObject} graphObject 
   */
  getTexture(graphObject:GraphObject){
    return this.#image;
  }
}
export {Shader}