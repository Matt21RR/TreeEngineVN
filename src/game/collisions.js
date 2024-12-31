/**
 * 
 * @param {string} src 
 */
function extractor(src){
  fetch(src)
    .then(res=>res.text())
      .then(response => {
        console.log(response);
        const parser = new DOMParser();
        const doc = parser.parseFromString(response, "application/xml");
        const collisionNodes = doc.getElementById("collisionLayer").children;
        if(collisionNodes == null){
          throw new Error(src+" don't have a 'collisionLayer' layer.");
        }
        
      })
}

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