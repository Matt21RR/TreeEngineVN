type RenderingData = {
  x:number, 
  y:number, 
  z:number, 
  width:number, 
  height:number, 
  sizeInDisplay:number,
  /** corner is the top left coords of the rendered object */
  corner:{x:number, y:number},
  /** base data is unused by the collision system */
  base:Object,
  id:string
}

type EngineRenderingData = {
  [key:string]:RenderingData
};

type Tuple = [number, number];

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
      const xD = Math.floor( (10 * (data.width/displayWidth)) + 1);

    
      //Vertical boundaries
      const y = Math.floor( 10 * (data.corner.y / displayHeight));
      const yD = Math.floor( (10 * (data.height/displayHeight)) + 1);

      for(let i = x; i < x + xD; i++) {
        for(let j = y; j < y + yD; j++) {
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
    console.clear();
    console.table(this.collisionMatrix);
    console.table(this.refTable);
  }
  #isColliding(a:RenderingData, b:RenderingData) {
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
    console.log(key);
    let tuples = this.refTable[key];//Cells to check
    console.log(tuples)
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
}
export default CollisionLayer;