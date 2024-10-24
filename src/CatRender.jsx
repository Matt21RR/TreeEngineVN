import React from 'react'
import { Button1 } from './engine/components/buttons'
import image1 from "./1142016.jpg";

const vertexShaderSource = /*glsl*/`
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0, 1);
    v_texCoord = a_texCoord;
  }
`

const fragmentShaderSourceH = /*glsl*/`
  precision lowp float;
  uniform sampler2D u_image;
  uniform float u_textureSize;
  uniform float u_blurAmount;
  varying vec2 v_texCoord;

  void main() {
    vec4 color = vec4(0.0);
    float total = 0.0;
    for (float x = -3.0; x <= 3.0; x += 1.0) {
      vec2 offset = vec2(x * u_blurAmount / u_textureSize, 0.0);
      color += texture2D(u_image, v_texCoord + offset);
      total += 1.0;
    }
    gl_FragColor = color / total;
  }
`

const fragmentShaderSourceV = /*glsl*/`
  precision mediump float;
  uniform sampler2D u_image;
  uniform float u_textureSize;
  uniform float u_blurAmount;
  varying vec2 v_texCoord;

  void main() {
    vec4 color = vec4(0.0);
    float total = 0.0;
    for (float y = -3.0; y <= 3.0; y += 1.0) {
      vec2 offset = vec2(0.0, y * u_blurAmount / u_textureSize);
      color += texture2D(u_image, v_texCoord + offset);
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

class CatBlur extends React.Component{
  constructor(props){
    super(props);
    this.mounted = false;
    this.imageUrl = "";
    this.canvasRef = React.createRef();
    this.renData = [];
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      const canvas = this.canvasRef.current
      if (!canvas) return
      const gl = canvas.getContext('webgl2', { 
        premultipliedAlpha: true, 
        antialias:false, 
        preserveDrawingBuffer: false, 
        depth: false, 
        stencil: false});
      if (!gl) {
        // setError('WebGL no está soportado en tu navegador')
        return
      }

      
      const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      const fragmentShaderH = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSourceH);
      const fragmentShaderV = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSourceV);
      const programH = createProgram(gl, vertexShader, fragmentShaderH);
      const programV = createProgram(gl, vertexShader, fragmentShaderV);

      const image = new Image()
      image.crossOrigin = "anonymous"
      image.src = image1;
      image.onload = () => {
        canvas.width = image.width;// image.width;
        canvas.height = image.height; //image.height;
  
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true)
        const textures = [createAndSetupTexture(gl,image),createAndSetupTexture(gl,image)]

        this.renData = [gl, programH, programV, textures, canvas.width, canvas.height];

        window.parh = 0
        // Example of using requestAnimationFrame for benchmarking
        const animate = (currentTime) => {
          const fps = 1000 / (currentTime - lastTime);
          console.log(`FPS: ${fps.toFixed(1)}`);
          lastTime = currentTime;
          window.parh +=0.01;
          this.setBlurAmount(window.parh);
          if(window.parh > 4){
            window.parh = 1;
          }
          requestAnimationFrame(animate);
        }

        let lastTime = 0;
        requestAnimationFrame(animate);
      }

    }
  }
  setBlurAmount(amount){
    applyBlur(this.renData[0], this.renData[1], this.renData[2], this.renData[3], this.renData[4], this.renData[5], amount);
  }
  render(){
    return (
      <div className="flex flex-col items-center bg-background rounded-lg shadow-md w-full h-full">
        {/* {error ? (
          <p className="text-red-500">{error}</p>
        ) : ( */}
          <canvas ref={this.canvasRef} className="border border-border rounded-lg shadow-lg" />
        {/* )} */}
        <div className="w-full max-w-xs space-y-2 absolute bottom-0">
          <label htmlFor="blur-amount" className="text-sm font-medium text-foreground">
            Intensidad de desenfoque
          </label>
          <input
            type='range'
            id="blur-amount"
            min={0}
            max={8}
            step={0.1}
            // value={[blurAmount]}
            onChange={(value) => this.setBlurAmount(value.target.value*1)}
            aria-label="Ajustar intensidad de desenfoque"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Imagen de gato con efecto de desenfoque aplicado usando WebGL
        </p>
      </div>
    )
  }
}
export {CatBlur}