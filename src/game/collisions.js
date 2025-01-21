/**
 * 
 * @param {String} src 
 * @returns {Promise<Object>}
 */
function extractor(src){
  return new Promise((resolve,reject)=>{
    fetch(src)
    .then(res=>res.text())
      .then(response => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response, "application/xml");
        const svgAtribbs  = doc.documentElement.attributes;
        const width = Number(svgAtribbs.getNamedItem("width").value);
        const height = Number(svgAtribbs.getNamedItem("height").value);
        if(!width || !height){
          reject(`${src} units aren't in pixels.`)
        }
        const groups = doc.getElementsByTagName("g");
        Array.from(groups).forEach(layer=>{
          const layerAttribs = layer.attributes;
          if("inkscape:label" in layerAttribs){
            if(layerAttribs.getNamedItem("inkscape:label").value == "collisionLayer"){
              resolve({data:Array.from(layer.children), width, height}); //*collisionNodes
            }
          }
        });
        reject(src+" don't have a layer with the alias 'collisionLayer'.");
      })
  })
}

export {extractor}

class Collision {
  #x
  #y
  #width
  #height
}
class CollisionMatrix{
  #collisions
  #matrix
  /**
   * 
   * @param {Array[HTMLElement]} nodes 
   */
  constructor(nodes){
    this.#matrix = [[]];
  }
}