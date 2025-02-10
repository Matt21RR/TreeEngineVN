
type RenderingData = {
  [key:string]:
  {
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
    id:string}};

class CollisionLayer {
  collisionMatrix:number[][];

  constructor() {
    this.collisionMatrix = [];
  }
  update(renderingData:RenderingData, displayWidth:number, displayHeight:number) {
    let verticalBoundaries:{[key:number]:number[]};
    let horizontalBoundaries:{[key:number]:number[]};
    for (let key in renderingData) {
      let data = renderingData[key];
      //Horizontal boundaries
      let x1 = Math.floor(data.corner.x / displayWidth);
      let x2 = Math.floor((data.corner.x + data.width) / displayWidth);

    
      //Vertical boundaries
      let y1 = Math.floor(data.corner.y / displayHeight);
      let y2 = Math.floor((data.corner.y + data.height) / displayHeight);

      // Update the collision layer
    }
    // Update the collision layer
  }
}