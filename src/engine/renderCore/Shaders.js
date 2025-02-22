import GraphObject from "../engineComponents/GraphObject.ts"
const vertexShaderSource = /*glsl*/`
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0, 1);
    v_texCoord = a_texCoord;
  }
`

var fragmentShaderSourceH = /*glsl*/`
  precision lowp float;
  uniform sampler2D u_image;
  uniform float u_textureSize;
  uniform float u_blurAmount;
  const float u_sampleRange = %sampleRange;
  const float u_step = %step;
  varying vec2 v_texCoord;

  // Gaussian function: e^(-(x^2)/(2σ^2)) where σ (sigma) is 3.0
  float gaussian(float x) {
    float sigma = 4.0;
    return exp(-(x * x) / (2.0 * sigma * sigma));
  }

  void main() {
    vec4 color = vec4(0.0);
    float total = 0.0;

    for (float x = -u_sampleRange; x <= u_sampleRange; x += u_step) {
      float weight = gaussian(x);
      vec2 offset = vec2(x * u_blurAmount / u_textureSize, 0.0);
      color += texture2D(u_image, v_texCoord + offset) * 1.0;
      total += 1.0;
    }
    gl_FragColor = color / total;
  }
`

var fragmentShaderSourceV = /*glsl*/`
  precision mediump float;
  uniform sampler2D u_image;
  uniform float u_textureSize;
  uniform float u_blurAmount;
  const float u_sampleRange = %sampleRange;
  const float u_step = %step;
  varying vec2 v_texCoord;

  // Gaussian function: e^(-(x^2)/(2σ^2)) where σ (sigma) is 3.0
  float gaussian(float x) {
    float sigma = 4.0;
    return exp(-(x * x) / (2.0 * sigma * sigma));
  }

  void main() {
    vec4 color = vec4(0.0);
    float total = 0.0;
    for (float y = -u_sampleRange; y <= u_sampleRange; y += u_step) {
      float weight = gaussian(y);
      vec2 offset = vec2(0.0, y * u_blurAmount / u_textureSize);
      color += texture2D(u_image, v_texCoord + offset) * 1.0;
      total += 1.0;
    }
    gl_FragColor = color / total;
  }
`

/**
 * 
 * @param {WebGLRenderingContext} gl 
 * @param {number} type 
 * @param {string} source 
 * @returns 
 */
function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}
/**
 * 
 * @param {WebGLRenderingContext} gl 
 * @param {WebGLShader} vertexShader 
 * @param {WebGLShader} fragmentShader 
 * @returns 
 */
function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  return program
}
/**
 * 
 * @param {WebGLRenderingContext} gl 
 * @param {HTMLImageElement} image
 * @returns
 */
function createAndSetupTexture(gl,image) {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return texture
}

/**
 * 
 * @param {WebGLRenderingContext} gl 
 * @param {WebGLProgram} programH
 * @param {WebGLProgram} programV
 * @param {WebGLTexture} texture 
 * @param {number} width 
 * @param {number} height 
 * @param {number} blurAmount 
 */
function applyBlur(gl, programH, programV, textures, width, height, blurAmount) {
  // Create framebuffers
  const fbos = [gl.createFramebuffer(), gl.createFramebuffer()]

  // Set up textures
  for (let i = 0; i < 2; i++) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[i])
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[i], 0)
  }

  // Set up geometry
  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

  const texCoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)

  // Horizontal pass
  gl.useProgram(programH)
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[0])
  gl.viewport(0, 0, width, height)

  const positionLocationH = gl.getAttribLocation(programH, 'a_position')
  gl.enableVertexAttribArray(positionLocationH)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.vertexAttribPointer(positionLocationH, 2, gl.FLOAT, false, 0, 0)

  const texCoordLocationH = gl.getAttribLocation(programH, 'a_texCoord')
  gl.enableVertexAttribArray(texCoordLocationH)
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.vertexAttribPointer(texCoordLocationH, 2, gl.FLOAT, false, 0, 0)

  gl.bindTexture(gl.TEXTURE_2D, textures[1])
  gl.uniform1f(gl.getUniformLocation(programH, 'u_textureSize'), width)
  gl.uniform1f(gl.getUniformLocation(programH, 'u_blurAmount'), blurAmount)

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

  // Vertical pass
  gl.useProgram(programV)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null) // Render to canvas
  gl.viewport(0, 0, width, height)

  const positionLocationV = gl.getAttribLocation(programV, 'a_position')
  gl.enableVertexAttribArray(positionLocationV)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.vertexAttribPointer(positionLocationV, 2, gl.FLOAT, false, 0, 0)

  const texCoordLocationV = gl.getAttribLocation(programV, 'a_texCoord')
  gl.enableVertexAttribArray(texCoordLocationV)
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.vertexAttribPointer(texCoordLocationV, 2, gl.FLOAT, false, 0, 0)

  gl.bindTexture(gl.TEXTURE_2D, textures[0])
  gl.uniform1f(gl.getUniformLocation(programV, 'u_textureSize'), height)
  gl.uniform1f(gl.getUniformLocation(programV, 'u_blurAmount'), blurAmount)


  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

  // Clean up
  gl.deleteFramebuffer(fbos[0])
  gl.deleteFramebuffer(fbos[1])
}

class Shader{
  #renData;
  #image;
  #id;
  #canvas;
  #renderedTree;
  constructor(image,id,widthArg = null, heightArg = null){
    this.#image = image;
    this.#renData = [];
    this.#id = id;
    this.#renderedTree = {
      blur:{}
    }
    
    const width = widthArg == null ?  image.naturalWidth : widthArg;
    const height = heightArg == null ? image.naturalHeight : heightArg;

    const canvas = document.createElement('canvas');
    this.#canvas = canvas;
    canvas.width = width;// image.width;
    canvas.height = height; //image.height;



    const gl = canvas.getContext('webgl2', { 
      premultipliedAlpha: true, 
      antialias:false, 
      preserveDrawingBuffer: false, 
      depth: false, 
      stencil: false});

    //*Set fragmentShaders blur quality
    fragmentShaderSourceH = fragmentShaderSourceH.replace('%sampleRange',"6.0");
    fragmentShaderSourceV = fragmentShaderSourceV.replace('%sampleRange',"6.0");
    fragmentShaderSourceH = fragmentShaderSourceH.replace('%step',"1.0");
    fragmentShaderSourceV = fragmentShaderSourceV.replace('%step',"1.0");

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShaderH = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSourceH);
    const fragmentShaderV = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSourceV);
    const programH = createProgram(gl, vertexShader, fragmentShaderH);
    const programV = createProgram(gl, vertexShader, fragmentShaderV);
    const textures = [createAndSetupTexture(gl,image),createAndSetupTexture(gl,image)]

    this.#renData = [gl, programH, programV, textures, canvas.width, canvas.height];
  }
  get id(){return this.#id;}
  get texture(){return this.#image;}

  /**
   * copyCanvas returns a canvas containing the same image as the given canvas.
   * @param {HTMLCanvasElement} original 
   * @param {boolean} createMode 
   * @returns HTMLCanvasElement
   */
  copyCanvas(original,createMode = false) {
    var copy = document.createElement('canvas');
    copy.width = original.width;
    copy.height = original.height;
    if(!createMode){
      copy.getContext('2d').drawImage(original, 0, 0);  // Copy the image.
    }
    return copy;
  }
  /**
   * 
   * @param {GraphObject} graphObject 
   */
  getTexture(graphObject){
    if (Math.round(graphObject.blur)!=0){
      applyBlur(this.#renData[0], this.#renData[1], this.#renData[2], this.#renData[3], this.#renData[4], this.#renData[5], graphObject.blur);
      return this.#canvas;
    }
    else{
      return this.#image;
    }
  }
}
export {Shader}