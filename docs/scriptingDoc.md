# Engine (camera post-process)

Fullscreen camera post-process. WebGPU client only (Canvas2D no-op).

```js
set Engine camera globalBlur = 256
```

- **globalBlur**: *`number`* radius in px of the fullscreen dual kawase blur (0 = off).

```js
set Engine camera globalRgbSplit = {channels:{r:{angle:180,mag:1},g:{angle:90,mag:0},b:{angle:0,mag:1}},maxMag:12}
```

- **globalRgbSplit**: *`object|null`* fullscreen rgb split (default `{channels:{},maxMag:0}` = off).
  - **channels**: per channel `r`/`g`/`b` (missing channel = mag 0 = resting). A present channel without `angle` falls back to per-channel defaults: r=180, g=90, b=0.
    - **angle**: *`number`* in degrees. 0=right, 90=down, 180=left, 270=up (0..360).
    - **mag**: *`number`* 0..1. Real channel magnitude = mag \* maxMag px.
  - **maxMag**: *`number`* max magnitude in screen px. The effect only runs if `maxMag != 0` and the `mag` of some channel is `> 0`.

To disable it, prefer to reassign the zeroed defaults instead of `null`
(assigning `null` works at runtime, but leaves a `null` inside the camera object,
and the internal flatten of `ExtendedObjects` when animating the camera does not tolerate it):

```js
set Engine camera globalRgbSplit = {channels:{},maxMag:0}
```

```js
// Example: soft vertical fringes, red going up (270) and blue going down (90)
set Engine camera globalRgbSplit = {channels:{r:{angle:270,mag:0.6},g:{angle:0,mag:0},b:{angle:90,mag:0.6}},maxMag:8}
```

# Engine (camera 3D model shading)

Lighting, HDR tone mapping and bloom for **3D models** (`ModelObject`). WebGPU
client only (Canvas2D no-op). Sprites and UI are never affected. Everything is
off by default: existing scenes look the same.

```js
set Engine camera globalLighting = 3
set Engine camera globalLight = {azim:0.6,elev:0.8,ambient:0.25,intensity:1.2}
set Engine camera globalToneMapping = "aces"
set Engine camera globalExposure = 1.2
set Engine camera globalBloom = {enabled:true,threshold:0.8,intensity:0.8,radius:6}
set Engine camera globalAO = {enabled:true,radius:0.05,intensity:1}
```

- **nearPlane**: *`number`* closest distance to the eye that is drawn, in world units (default `0.005`). Geometry closer than this is clipped. Lower it if you place the camera very close to (or inside) tiny-scaled models; raising it improves depth precision in very large scenes.
- **globalLighting**: *`number`* 0 = unlit (default; base color + emissive), 1 = Lambert, 2 = Phong, 3 = PBR (GGX/Cook-Torrance with metallic-roughness and occlusion maps). Normal maps apply in modes 1–3.
- **globalLight**: *`object`* directional light: `azim`/`elev` (radians), `ambient` (0–1), `shininess` and `specStrength` (Phong), `intensity` (PBR, default 1).
- **globalToneMapping**: *`string`* `"none"` (default, plain clamp), `"aces"`, `"agx"` or `"neutral"` (Khronos PBR Neutral). Compresses lights brighter than 1 (e.g. emissive strength) instead of clipping them.
- **globalExposure**: *`number`* multiplies the 3D lighting before tone mapping (default 1).
- **globalBloom**: *`object`* glow around 3D models' lights brighter than `threshold` (after exposure). Default `{enabled:false,threshold:1,intensity:0.6,radius:4}`. `radius` is the blur radius in px. Toggling `enabled` rebuilds GPU pipelines (avoid toggling every frame; animate `intensity` instead).
- **globalAO**: *`object`* screen-space ambient occlusion (SSAO) for 3D models: darkens the ambient light in corners, creases and contact areas. Default `{enabled:false,radius:0.05,intensity:1,bias:0.02,power:1.5,debug:false}`. `radius` is in world units (how far occluders count; the screen is about 1 unit wide, so typical values are 0.02–0.1), `bias` (0–0.9) reduces self-shadowing on curved surfaces, `power` sharpens the contrast and `debug:true` shows only the AO buffer, full screen in grayscale (white = no occlusion; sprites and backgrounds are hidden). Only affects lit modes (`globalLighting` 1–3), opaque/cutout surfaces (not translucent materials) and models that are not `ignoreWorldRotation`. It adds no extra geometry pass (models write a small G-buffer while they are drawn; the AO is computed and applied afterwards), and when disabled it costs nothing. Toggling `enabled` rebuilds GPU pipelines like `globalBloom` (animate `intensity` instead of toggling every frame).

Model features read from the `.glb`: base color, emissive, metallic-roughness,
occlusion and normal textures, vertex colors (`COLOR_0`), a second UV set
(`TEXCOORD_1`, used by baked lightmaps through each texture's `texCoord`) and
tangents (`TANGENT`; derived per pixel when missing) and per-texture
`KHR_texture_transform` (offset, rotation, scale and `texCoord` override).

# Engine (camera grid helper)

Infinite 3D helper grid anchored to the world (Blender-style, with distance
fade). WebGPU client only (Canvas2D no-op). Useful to visualize 3D space
(depth, rotation, perspective).

```js
set Engine camera showGrid = true
```

- **showGrid**: *`boolean`* enables the grid (default `false`).
- **showGridXZ**: *`boolean`* floor plane `y=0` (default `true`).
- **showGridXY**: *`boolean`* frontal plane `z=0` (default `false`).
- **showGridYZ**: *`boolean`* lateral plane `x=0` (default `false`).
  The checks combine freely (several planes at once composite back-to-front).
- **gridSize**: *`number`* reference scale in world units (default `4`, clamp 0.5..100). The grid is infinite: `gridSize/gridDivisions` sets the cell step and `gridSize` the fade range (crisp up to ~3x, gone by ~10x).
- **gridDivisions**: *`number`* cells per `gridSize` unit (default `16`, clamp 2..64).
- **gridColor**: *`string`* CSS color of the lines (default `"#8a93a6"`).
- **gridOpacity**: *`number`* 0..1 (default `0.5`).
- **showAxes**: *`boolean`* XYZ colored axes (X red, Y green, Z blue, default `true`). The axes extend to the fade range with the same distance fade as the grid.

```js
// Example: floor + side wall with axes for staging a scene
set Engine camera showGridXZ = true
set Engine camera showGridYZ = true
set Engine camera gridSize = 6
set Engine camera gridDivisions = 24
set Engine camera showAxes = true
set Engine camera showGrid = true
```

# GraphObject

## Creation Command

```js
id = new GraphObject(properties...)
```
- **id**: *`string`*
- **properties**: *`Dictionary<any>`*

### Properties (and it's default values)

```javascript
enabled = false;
parent = "";

text = null;
fitContent = false;
center = false;
verticalCenter = false;
color = "gray";
font = "Arial";
fontSize = 18;
boxColor = "transparent";
horizontalMargin = 0;
verticalMargin = 0;

textureName = null;

brightness = 1;
contrast = 1;
grayscale = 0;
hueRotate = 0; // deg
blur = 0; // px
invert = 0;
saturate = 1;
sepia = 0;
opacity = 1;

x = 0;
y = 0;
z = 0;

scale = 1;
widthScale = 1;
heightScale = 1;
```

# ModelObject

3D prop estatico (GLB) renderizado por el pipeline `mesh` (unlit: `baseColor` sin luces).

## Creation Command

```js
duck = new ModelObject({
  enabled: true,
  model: "duck",
  x: 0.5,
  y: 0.5,
  z: 0,
  scale: 0.15
})
```

- **model**: *`string|null`* — id del modelo en `game/models/models.json`. Se carga **cuando hace falta** (ver *Carga de modelos* abajo).
- **fitRadius**: *`number|null`* — radio deseado en unidades mundo: el modelo se escala para medir eso sea cual sea su tamaño real (sustituye a `scale`; útil para mostrar modelos de tamaños muy distintos con el mismo tamaño aparente, p. ej. `fitRadius: 0.3`).
- Hereda posicion/rotacion/escala/padre/`Animation`/`Trigger` (visual) de `GraphObject`, con diferencias:
  - **Sin textura 2D**: ignora `texture`, `repeat`, `text` y filtros 2D (`brightness`, `blur`, etc.).
  - **Escala rigida**: 1 unidad del modelo = 1 unidad mundo; `widthScale`/`heightScale` no deforman (usar `scale`).
  - **Sin colisiones**: no participa en `CollisionLayer` (los triggers asociados usan su caja 2D aproximada solo como referencia visual).

### Carga de modelos (memoria)

Los modelos no se cargan todos al iniciar: el arranque solo registra `models.json` y cada `ModelObject` pide su modelo cuando su centro está a menos de `lazyLoadDistance` del ojo (o, si ya se cargó alguna vez, cuando su caja vuelve a ser visible). Aparece al terminar su carga (en un worker, sin bloquear). Al superar el presupuesto de VRAM se liberan los modelos que llevan más tiempo sin verse (nunca los visibles) y se recargan solos si vuelven a verse.

```js
@ engine.modelManager.requestModel("tavern_baked")       // precargar uno antes de mostrarlo
@ engine.modelManager.gpuBudget = 1024 * 1024 * 1024     // presupuesto de VRAM en bytes (default 1.5 GB)
@ engine.modelManager.maxTextureSize = 1024              // lado máximo de texturas al cargar (default 2048, 0 = sin tope)
@ engine.modelManager.lazyLoadDistance = 6               // distancia de carga de modelos nunca cargados (default 4)
@ engine.modelManager.unloadModel("tavern_baked")        // liberar uno manualmente
@ engine.modelManager.minScreenPx = 3                    // no dibujar ni cargar modelos que midan menos de esto en pantalla (px, 0 = off)
```

- `engine.modelManager.gpuBytesUsed()` devuelve la VRAM estimada en uso.
- `engine.modelManager.preloadAll = true` restaura la precarga completa al arrancar (debe fijarse antes de que el motor ejecute la escena de entrada).
- `maxTextureSize` se aplica a los modelos que se carguen a partir de ese momento.

### LOD (niveles de detalle)

Cada modelo se dibuja con versiones simplificadas (meshoptimizer) cuando está lejos: por cada parte se usa el nivel más simple cuya diferencia con el original no supere `lodMaxErrorPx` píxeles en pantalla. Los niveles se generan **una sola vez** y se guardan en `game/models/_lod/<archivo>.glb.lod`:

- Al arrancar, el motor borra los `.lod` de modelos que ya no están en `models.json` y genera en segundo plano (sin bloquear ni usar VRAM) los de los modelos nuevos.
- Si un `.glb` se reemplaza por otro con el mismo nombre, su `.lod` se detecta como inválido (hash) y se regenera al cargarlo.
- Los `.lod` son assets más: distribúyelos con el juego para que no haya que generarlos en el equipo del jugador.

```js
@ engine.modelManager.lodMaxErrorPx = 1   // desviación máxima en pantalla (px) del nivel simplificado (0 = siempre el original)
@ engine.modelManager.lodCache = "sync"   // "sync" (default): sincroniza al arrancar | "lazy": solo al cargar cada modelo | "off": en memoria, sin disco
@ engine.modelManager.lodEnabled = false  // desactiva el LOD (se aplica a los modelos que se carguen después)
```

### Texturas comprimidas (BC7)

Las texturas de los modelos se suben a la GPU comprimidas en BC7, que ocupa ~4 veces menos VRAM que RGBA8, y se cargan sin decodificar PNG/JPG. Codificarlas es lento (varios segundos por textura grande), así que se hace **una sola vez** y se guarda en `game/models/_tex/<archivo>.glb.tex`, igual que los LOD:

- Al arrancar, el motor borra los `.tex` de modelos que ya no están en `models.json` y genera en segundo plano los de los modelos nuevos, usando varios workers. Mientras un modelo no tenga su `.tex`, se carga con RGBA8 como antes.
- Un `.tex` se invalida si cambia el `.glb` (hash) o `maxTextureSize`, y se regenera.
- Los `.tex` son assets más: distribúyelos con el juego. Ocupan algo más en disco que las imágenes originales.

```js
@ engine.modelManager.texCompression = "sync"   // "sync" (default): sincroniza al arrancar | "lazy": genera tras cargar cada modelo | "off": RGBA8 siempre
```

### Limitaciones

- Solo GLB con primitivas TRIANGLES e imágenes embebidas (bufferView o `data:` URI).
- Se ignora con warning: skins, animaciones, primitivas no-triangulo, imágenes con URI externa, `KHR_draco_mesh_compression`, `EXT_meshopt_compression`, `KHR_texture_basisu`.
- Cada material visible de un modelo es al menos 1 draw por frame (los transparentes, 2-3): las primitivas que comparten material se dibujan juntas.

# KeyboardTrigger

## Creation Command

```js
new KeyboardTrigger(keyboardShorcut..., behaviors...)
```

- **keyboardShorcut**: *`Array<string>`* or *`string`* — where string is the keyCode(s), array is for key code chains.
- **behaviors**: *`Dictionary<Function>`*

> [!NOTE]
> The *keyboardShorcut* is used also as KeyboardTrigger id

### Keyboard triggeable methods (or plausible keys for the dictionary behaviors)

- `onHold`
- `onRelease`

<br>

---

# Trigger

## Creation Command
```js
id = new Trigger(relatedTo, behaviors...)
```

- **id**: *`string`*
- **(not required) relatedTo**: *`string`* — The GraphObject that the trigger are "relatedTo" provides the "shape" of the trigger.
- **behaviors**: *`Dictionary<Function>`* — The behavior functions can have zero, one or two arguments, in the next order.

### When you have the "relatedTo" parameter

| Signature | Parameter 1 | Parameter 2 | Parameter 3 |
|-----------|-------------|-------------|-------------|
| `()=>{}` | | |
| `(engine)=>{}` | "engine" is an engine instance ref | |
| `(engine, mouseCoord)=>{}` |   | "mouseCoord" is the coord of the mouse in the game canvas | |
| `(engine, mouseCoord, object)=>{}` |  |  | "object" is a reference to the object related to the trigger |

### When you don't have the "relatedTo" parameter

| Signature | Parameter 1 | Parameter 2 |
|-----------|-------------|-------------|
| `()=>{}` | | |
| `(engine)=>{}` | "engine" is an engine instance ref | |
| `(engine, mouseCoord)=>{}` |   | "mouseCoord" is the coord of the mouse in the game canvas |

### Mouse triggeable methods (or plausible keys for the dictionary behaviors)

- `onHold`
- `onRelease`
- `onEnter`
- `onLeave`
- `onWheel`
- `onMouseMove`


<br>

---

# TextureAnim

## Creation Command

```js
id = new TextureAnim(textures..., properties...)
```

- **id**: *`string`*
- **textures**: *`Array<string>`* — list of the base textures to create the animation (or sprite)
- **properties**: *`Dictionary<any>`*

### Properties

```javascript
duration = 1000;
speed = 1;
```

<br>

---

# Animation

## Creation Command

```python
id = new Animation(relatedTo, keyframes... or changes..., properties...)
```

- **id**: *`string`*
- **relatedTo**: *`string`* — The GraphObject that the animation are "relatedTo"
- **keyframes**: *`Dictionary<number, Dictionary<any>>`*

> [!NOTE]
> Keyframes is a dictionary with timestamps as element key, and each element are the changes to set in that timestamp

- **changes**: *`Dictionary<any>`*

> [!NOTE]
> Changes is the list of parameters to be set with the animation

- **properties**: *`Dictionary<any>`*

### Properties

```javascript
ease = aInfo.ease ? ease[aInfo.ease] : ease["linear"];
loops = "loops" in aInfo ? aInfo.loops * (aInfo.loopback ? 2 : 1) : 1; // by default 1 loop
reverse = 0; // if the animation are played in reverse
infinite = false; // infinite looping
loopback = false; // repeat the animation in reverse after end
duration = 0; // is required to set this if you use "changes" instead of "keyframes"
enabled = false;
delay = NaN; // time before start the animation
to = aInfo.to || {};
onComplete = null; // function to run after the animation finishes
```

<br>

---

# CodedRoutine

## Creation Command

```js
new CodedRoutine(keyboardShorcut..., behaviors...)
```

- **keyboardShorcut**: *`Array<string>`* or string — where string is the keyCode(s), array is for key code chains.
- **behaviors**: *`Dictionary<Function>`*

<br>

---

# StageMark

## Creation Command

```ts
id = new StageMark(properties...)
```
- **id**: *`string`*
- **properties**: *`Dictionary<number>`*

### Properties (and it's default values)

```ts
  x: number = null
  y: number = null
  z: number = null
```

<br>

---
# Actor
## Creation Command

```ts
id = new Actor(properties...)
```
- **id**: *`string`*
- **properties**: *`Dictionary<any>`*

### Properties (and it's default values)

```ts
  active: boolean = false
  name: string = ""
  body: string = null
  emotions: Dictionary<string> = []
```

> [!NOTE]
> When the script is interpreted, some of the properties of the constructed actor differ in type from the parameters passed:
> ```ts 
> body: GraphArray
> emotions: Dictionary<GraphArray>
> ```

<br>

---

# **Edition Command (for any element type except Sound)**

```python
set elementType id properties...
```

- **elementType**: *`string`* — Element type
- **id**: *`string`* — Element id
- **properties**: *`Dictionary<any>`* — Dictionary of properties of the element to be changed

<br>

---

# Sound
## Edition Command

```ts
sound id properties...
```
- **id**: *`string`*
- **properties**: *`Dictionary<any>`*

### Properties (and it's default values)

```ts
  loop: boolean = false
```

## Action Command

```ts
sound id action
```
- **id**: *`string`*
- **action**: *`string`*

### Available actions

- `play`
- `pause`
- `stop`

<br>

---
# Wait, Stop and Resume

> [!IMPORTANT]
>Because commands are stacked and executed asynchronously, one after another, the engine must be notified when to wait, stop, or resume executing the commands in the queue.

## Wait Command

```ts
wait time
```
- **time**: *`number`* - Time in ms until resume the commands excecution

## Stop and Resume Commands

```ts
wait
```

```ts
resume
```
> [!NOTE] 
> You may have already suspected this, but just to clarify... yes, "continue" is a reserved word in JavaScript. Therefore, to avoid unexpected problems, "resume" is used instead.

## How to use Wait, Stop and Resume commands in an script

Each command written in a script will be stacked and executed in FIFO (first in, first out) order asynchronously, meaning that the engine will not wait for a command's actions to finish before moving on to the next command. This can be inconvenient when working with animations or when you want, for example, to play a sound for x seconds and, after those x seconds, display something on the screen.

For cases such as these, where you must wait for one action to finish before moving on to the next, the *`wait`* and *`resume`* commands are used.

### A use case (example) for the wait command

Suppose you need to play a sound for a certain amount of time and then stop it.

```ts
  sound "introduction" play
  wait 2500
  sound "introduction" stop
```
The first command starts playing a sound, in this case 'introduction'. The second command tells the engine to pause the sequential execution of commands for 2500ms. After 2500ms, the engine will resume sequential command execution and execute the third command, which stops playing the 'introduction' sound.

### A use case (example) for the stop and resume commands

It is not always possible to know exactly how long it will take before the sequential execution of commands can or should continue.
This can occur with chained animations, events activated by triggers, among others.

```ts
acceptDealTrigger = new Trigger ({
  relatedTo: "acceptDealButton",
  onRelease:()=>{
    resume
  }
})
wait

//when the command excecution will be resumed, it will continue here
delete Trigger "acceptDealTrigger" 
delete GraphObject "acceptDealButton"
sound "dealWasAccepted" play
```
According to the previous command, the engine will do:

1. Creates a trigger named "acceptDealTrigger" that's linked to a button called "acceptDealButton". When the button is released, it executes the resume command, resuming the sequential excecution of commands with the command delete (#3).
2. The wait command pauses sequential execution of commands until the trigger fires (when the user releases the button).
3. Delete the trigger "acceptDealTrigger"
4. Delete the button, removing the "acceptDealButton" GraphObject from the scene
5. Play the sound "dealWasAccepted"

<br>

---
# Javascript Interoperation

This allows to mix the game engine script commands with javascript code. The possibility of making this combination has its advantages.

## Javascript outside a script command

Simply type "@" as the first character of the line, followed by a space, and then type the JavaScript code you want to execute.

```ts
@ console.log( Math.random() );
```

If the JavaScript code you want to add to your script takes up more than one line, you can write the code as a variable or constant that stores a lambda function with the code inside, and then execute that lambda function by using the "@" symbol again on the next line to call that function.

```ts
//Create a lambda function with the code inside
@ const ourInterestingFunction = () => {
    console.log("This is a interesting function.");
    const num = 2.7;
    const floorInteger = Math.floor(num);
    console.log(`This is the previous integer to the number ${num}: ${floorInteger}`)
}

//excecuting that lambda function
@ ourInterestingFunction();
```

You can also insert engine script commands within JavaScript code. This can be useful when you want to automate a specific task, such as executing the command to create graphic objects multiple times.


```ts
@ const indexes = [...new Array(10)].map( (_, index) => index );
@ for (let index of indexes) {
    //GraphObject creation instruction
    `tree${index}` = new GraphObject({
      enabled:true,
      texture:"treeTexture",
      x:(index/10),
      y:(0.5),
      scale:0.15
    })
}
```


<br>

---
# Scoped (Scenes, Nodes and Modules) behavior and script commands

## Scenes and Nodes
### Scene Scope Definition:
```ts
scene sceneName
  //script commands of the scene
  ...
end scene
```
### Scene Run Command
```ts
run sceneName
```

### Node Scope Definition
```ts
  node: nodeName
    //script commands of the node
    ...
  node ends
```
> [!NOTE]
> the creation of a node requires to be inside a scene, and the node will only be active when the scene is active. This allows you to create different nodes for different parts of the same scene, and activate them as needed.

### Node JumpTo (Run) Command
```ts
jumpto nodeName
```
Also you can (theorically, i'm implemented it but not checked if this works well) jump directly to a node in another scene using this: 
```ts
run sceneName -> nodeName
```

## Modules
A module is a bunch of script commands and code that can be reused inside any scene.
### Module Scope Definition
```ts
module moduleName
  //script commands of the module
  ...
end module
```
### Module Include Command
The content of a module is straightly copied where you use the include command.

```ts
include "moduleName"
```
