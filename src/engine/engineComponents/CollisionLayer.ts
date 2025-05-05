type ObjectRenderingData = {
  x:number, 
  y:number, 
  z:number, 
  width:number, 
  height:number, 
  sizeInDisplay:number,
  /** corner is the top left coords of the rendered object */
  corner:{x:number, y:number},
  /** base data is unused by the collision system */
  base:{
    x: any;
    y: any;
    z: any;
  },
  id:string,
  text?:Array<[string,number,number]>,
  margin?:{horizontal:number,vertical:number}
}

type EngineRenderingData = {
  [key:string]:ObjectRenderingData
};

type Tuple = [number, number];

function engineRenderingDataCloner(engineRenderingData:EngineRenderingData){
  var newData:EngineRenderingData = {};
  for(const id in engineRenderingData){
    const el = engineRenderingData[id]
    newData[id] = el;
  }
  return newData;
}

class CollisionLayer {
  collisionMatrix:string[][][];
  refTable:{[key:string]:Array<Tuple>};
  #renderingData:EngineRenderingData;

  constructor() {
    this.collisionMatrix = [];
    this.refTable = {};
    this.#renderingData = {};
  }
  update(renderingData:EngineRenderingData, displayWidth:number, displayHeight:number) {
    this.collisionMatrix = [];
    this.refTable = {};
    this.#renderingData = renderingData;
    for (let key in renderingData) {
      const data = renderingData[key];
      //Horizontal boundaries
      const x = Math.floor( 10 * (data.corner.x / displayWidth));
      const xEnd = Math.ceil( (10 * ((data.corner.x + data.width)/displayWidth)));

    
      //Vertical boundaries
      const y = Math.floor( 10 * (data.corner.y / displayHeight));
      const yEnd = Math.ceil( (10 * ((data.corner.y + data.height)/displayHeight)));

      for(let i = x; i < xEnd; i++) {
        for(let j = y; j < yEnd; j++) {
          if(!this.collisionMatrix[i]) {
            this.collisionMatrix[i] = [];
          }
          if(!this.collisionMatrix[i][j]) {
            this.collisionMatrix[i][j] = [];
          }
          this.collisionMatrix[i][j].push(key);
          if(!this.refTable[key]) {
            this.refTable[key] = [];
          }
          this.refTable[key].push([i, j]);
        }
      }
    }
  }
  #isColliding(a:ObjectRenderingData, b:ObjectRenderingData) {
    let aX = a.corner.x;
    let aY = a.corner.y;
    let aW = a.width;
    let aH = a.height;

    let bX = b.corner.x;
    let bY = b.corner.y;
    let bW = b.width;
    let bH = b.height;

    if(aX < bX + bW){
      if(aX + aW > bX){
        if(aY < bY + bH){
          if(aY + aH > bY){
            return true;
          }
        }
      }
    }
    return false;
  }
  #isMouseColliding(mouseX:number, mouseY:number, object:ObjectRenderingData) {
    let aX = object.corner.x;
    let aY = object.corner.y;
    let aW = object.width;
    let aH = object.height;

    if(aX < mouseX){
      if(aX + aW > mouseX){
        if(aY < mouseY){
          if(aY + aH > mouseY){
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * check for collisions in a given GraphObject id
   * @param key GraphObject id
   * @param checkTargets Array of GraphObject ids to check for collisions
   * @returns 
   */
  check(key:string, checkTargets:Array<string>=[]){
    if(!(key in this.refTable)) {
      console.warn(`Key ${key} not found in collision matrix`);
      return [];
      // throw new Error(`Key ${key} not found in collision matrix`);
    }
    let tuples = this.refTable[key];//Cells to check
    let collisionsToCheck:Array<string> = [];
    for(let tuple of tuples) {
      let [x, y] = tuple;//cell coord
      let cellPlausibles = this.collisionMatrix[x][y];
      collisionsToCheck = collisionsToCheck.concat(cellPlausibles);
    }
    if(collisionsToCheck.length === 0) {
      return [];
    }
    
    const entityData = this.#renderingData[key];
    let collisions:Array<string> = [];
    for(let target of collisionsToCheck) {
      if(checkTargets.length > 0) {
        if(!checkTargets.includes(target)) {
          continue
        }
      }
      if(target === key) {
        continue;
      }
      let targetData = this.#renderingData[target];
      if(this.#isColliding(entityData, targetData)) {
        collisions.push(target);
      }

    }
    return collisions;
  }
  checkMouse(mouseX:number, mouseY:number, resolution:{width:number, height:number}) {
    const mouseIndexX = Math.floor( 10 * (mouseX));
    const mouseIndexY = Math.floor( 10 * (mouseY));
    
    try {
      let collisionsToCheck:Array<string>;
      if(!(mouseIndexX in this.collisionMatrix) || !(mouseIndexY in this.collisionMatrix[mouseIndexX])){
        return [];
      }
      collisionsToCheck = this.collisionMatrix[mouseIndexX][mouseIndexY];
      if(!collisionsToCheck || collisionsToCheck.length === 0) {
        return [];
      }
      let collisions:Array<string> = [];
      for(let target of collisionsToCheck) {
        let targetData = this.#renderingData[target];
        if(this.#isMouseColliding(mouseX*resolution.width, mouseY*resolution.height, targetData)) {
          collisions.push(target);
        }
      }
      return collisions;
    } catch (error) {
      console.log("Error checking mouse collision", error);
      return [];
    }
  }
}
export default CollisionLayer;
export {engineRenderingDataCloner, ObjectRenderingData}