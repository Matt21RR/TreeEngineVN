export default class Shader{
  #image: ImageBitmap;
  #resolution: {width:number,height:number, widthHeightRelation:number, heightWidthRelation:number};
  #id:string;

  constructor(){
    return this;
  }

  instanceIt(image: HTMLImageElement,id:string):Promise<Shader>{
    return new Promise((response)=>{
      createImageBitmap(image).then((res)=>{
        this.#image = res;

        this.#id = id;
        
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        const widthHeightRelation = width/height;
        const heightWidthRelation = height/width;


        this.#resolution = {width,height, widthHeightRelation, heightWidthRelation};
        response(this);
      })
    })

  }
  get id(){return this.#id;}
  // get texture(){return this.#image;}
  get resolution(){return this.#resolution}
  /**
   * 
   * @param {GraphObject} graphObject 
   */
  getTexture(){
    return this.#image;
  }
}