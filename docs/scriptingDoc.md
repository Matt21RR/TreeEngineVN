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
