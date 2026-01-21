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
useEngineUnits = !("parent" in graphInfo); // for scale
rotate = 0; // deg
// ignoreParallax forces the object to ignore the camera parallax movement
ignoreParallax = !("z" in graphInfo);
ignoreParallax = "ignoreParallax" in graphInfo ? graphInfo.ignoreParallax : this._ignoreParallax;
```

## Events Command - GraphObject parameters change actions

### Only when the parameter meet the condition
Will run once and then be removed

```js
id if (condition) do (obj?: GraphObject, engine?: RenderEngine)=>{}

id if (condition) do (obj?: GraphObject, engine?: RenderEngine)=>{} finally (obj?: GraphObject, engine?: RenderEngine)=>{}
```

### While the parameter meet the condition
Will run while the condition has been meet

```ts
id while (condition) do (obj?: GraphObject, engine?: RenderEngine, engineDelta?: number)=>{}

id while (condition) do (obj?: GraphObject, engine?: RenderEngine, engineDelta?: number)=>{} finally (obj?: GraphObject, engine?: RenderEngine, engineDelta?: number)=>{}
```


- **id**: *`string`*
- **properties**: *`Dictionary<any>`*

<br>

---

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

| Signature | Parameter 1 | Parameter 2 |
|-----------|-------------|-------------|
| `()=>{}` | | |
| `(engine)=>{}` | "engine" is an engine instance ref | |
| `(engine, object)=>{}` | "engine" is an engine instance ref | "object" is a reference to the object related to the trigger |

### When you don't have the "relatedTo" parameter

| Signature | Parameter 1 | Parameter 2 |
|-----------|-------------|-------------|
| `()=>{}` | | |
| `(mouseRef)=>{}` | "mouseRef" is an engine instance ref | |
| `(mouseRef, _)=>{}` | This syntax could lead in an engine error | |

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
Sound id properties...
```
- **id**: *`string`*
- **properties**: *`Dictionary<any>`*

### Properties (and it's default values)

```ts
  loop: boolean = false
```

## Action Command

```ts
Sound id action
```
- **id**: *`string`*
- **action**: *`string`*

### Available actions

- `play`
- `pause`
- `stop`