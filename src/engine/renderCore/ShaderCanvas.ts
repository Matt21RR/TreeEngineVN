class ShaderCanvas{
  context: WebGL2RenderingContext;
  private static instance: ShaderCanvas;

  constructor(){
    if(typeof ShaderCanvas.instance === "object"){
      return ShaderCanvas.instance;
    }
    this.context = ShaderCanvas.createSharedContext();
    ShaderCanvas.instance = this;
    return this;
  }
  private static createSharedContext(){
    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl2', { 
      premultipliedAlpha: true, 
      antialias:false, 
      preserveDrawingBuffer: false, 
      depth: false, 
      stencil: false}) as WebGL2RenderingContext;
    return gl;
  }
  
}
export {ShaderCanvas}