import { Dictionary } from "../../global.ts";
import { TextLine } from "../logic/Misc.ts";
import Shader from "../renderCore/Shaders.ts";

export type ObjectRenderingData = {
  x:number, 
  y:number, 
  z:number, 
  width:number, 
  height:number, 
  rotation:number,
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
  solvedTexture:Shader,
  text?:{
    value?:Array<TextLine>,
    margin:{horizontal:number,vertical:number},
    fontSize:number
  }
  
}

type EngineRenderingData = Dictionary<ObjectRenderingData>;

class CollisionLayer {
  collisionMatrix:Array<Array<Set<string>>>;
  refTable: Map<string,Array<[number,number]>>;
  private renderingData:EngineRenderingData;

  constructor() {
    this.collisionMatrix = [];
    this.refTable = new Map();
    this.renderingData = {};
  }
  private getObjectBoundaries(objectData: ObjectRenderingData, displayWidth:number, displayHeight:number){
    //Horizontal boundaries
    let x = Math.floor( 10 * (objectData.corner.x / displayWidth));
    if(x<0){x=0;}
    let xEnd = Math.ceil( (10 * ((objectData.corner.x + objectData.width)/displayWidth)));
    if(xEnd>11){xEnd=11;}
  
    //Vertical boundaries
    let y = Math.floor( 10 * (objectData.corner.y / displayHeight));
    if(y<0){y=0;}
    let yEnd = Math.ceil( (10 * ((objectData.corner.y + objectData.height)/displayHeight)));
    if(yEnd>11){yEnd=11;}

    return {x, xEnd, y, yEnd};
  }
  
  update(renderingData:EngineRenderingData, displayWidth:number, displayHeight:number, excludedIds: Dictionary<boolean>) {
    this.collisionMatrix = [];
    this.refTable = new Map();
    this.renderingData = renderingData;
    for (let key in renderingData) {
      //*Aparently this increases the process load
      // if(!!excludedIds[key]){
      //   continue;
      // }

      const bounds = this.getObjectBoundaries(renderingData[key], displayWidth, displayHeight);

      for(let i = bounds.x; i < bounds.xEnd; i++) {
        for(let j = bounds.y; j < bounds.yEnd; j++) {
          if(!this.collisionMatrix[i]) {
            this.collisionMatrix[i] = [];
          }
          if(!this.collisionMatrix[i][j]) {
            this.collisionMatrix[i][j] = new Set<string>();
          }
          this.collisionMatrix[i][j].add(key);
          if(!this.refTable.has(key)) {
            this.refTable.set(key, []);
          }
          this.refTable.get(key)!.push([i, j]);
        }
      }
    }
  }
  private static isColliding(a:ObjectRenderingData, b:ObjectRenderingData) {
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
  private static isMouseColliding(mouseX:number, mouseY:number, object:ObjectRenderingData) {
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
    if(!this.refTable.has(key)) {
      console.warn(`Key ${key} not found in collision matrix`);
      return [];
    }
    let tuples = this.refTable.get(key)!;//Cells to check
    let collisionsToCheck:Set<string> = new Set();
    for(let tuple of tuples) {
      let [x, y] = tuple;//cell coord
      let cellPlausibles = this.collisionMatrix[x][y];
      cellPlausibles.forEach(id => collisionsToCheck.add(id));
    }
    if(collisionsToCheck.size === 0) {
      return [];
    }
    
    const entityData = this.renderingData[key];
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
      let targetData = this.renderingData[target];
      if(CollisionLayer.isColliding(entityData, targetData)) {
        collisions.push(target);
      }

    }
    return collisions;
  }

  checkMouse(mouseX:number, mouseY:number, resolution:{width:number, height:number}) {
    const mouseIndexX = Math.floor( 10 * (mouseX));
    const mouseIndexY = Math.floor( 10 * (mouseY));
    
    try {
      let collisionsToCheck:Set<string>;
      if(!(mouseIndexX in this.collisionMatrix) || !(mouseIndexY in this.collisionMatrix[mouseIndexX])){
        return [];
      }
      collisionsToCheck = this.collisionMatrix[mouseIndexX][mouseIndexY];
      if(!collisionsToCheck || collisionsToCheck.size === 0) {
        return [];
      }
      let collisions:Array<string> = [];
      for(let target of collisionsToCheck) {
        let targetData = this.renderingData[target];
        if(CollisionLayer.isMouseColliding(mouseX*resolution.width, mouseY*resolution.height, targetData)) {
          collisions.push(target);
        }
      }
      return collisions;
    } catch (error) {
      console.log("Error checking mouse collision", error);
      return [];
    }
  }

  /**
   * Get objects ids that are located in the same regions used by an object
   * @param {string} objectId 
   */
  getObjectsInSameGridCells(objectId: string){
    const cells = this.refTable.get(objectId);

    let objectsInSameCells:Set<string> = new Set();

    cells?.forEach(cellCoord=>{
      objectsInSameCells.union( this.collisionMatrix[ cellCoord[0] ][ cellCoord[1] ] );
      // this.collisionMatrix[ cellCoord[0] ][ cellCoord[1] ]
      //   .forEach(id => objectsInSameCells.add(id));
    });

    return objectsInSameCells;
  }

  getObjectsInSameGridCellsUsingBounds(renderingData:ObjectRenderingData, displayWidth:number, displayHeight:number){
    let objectsInSameCells:Set<string> = new Set();

    const bounds = this.getObjectBoundaries(renderingData, displayWidth, displayHeight);

    for(let i = bounds.x; i < bounds.xEnd; i++) {
      for(let j = bounds.y; j < bounds.yEnd; j++) {
        if(!this.collisionMatrix[i]) {
          continue;
        }
        if(!this.collisionMatrix[i][j]) {
          continue;
        }
        objectsInSameCells.union( this.collisionMatrix[i][j] );
      }
    }

    return objectsInSameCells;
  }
}
export default CollisionLayer;