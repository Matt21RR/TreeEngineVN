export type ScriptInstructionSyntax = {
  syntax: string,
  description?: string
}

export type SubEntry = {
  subtitle: string,
  syntax: string,
  description?: string
}

export type ScriptInstructionEntry = {
  name: string,
  category: ScriptInstructionCategory,
  description: string,
  syntaxes: Array<ScriptInstructionSyntax>,
  variants?: Array<SubEntry>,
  example?: string
}

export type ScriptInstructionCategory =
  | "Structure and flow"
  | "Dialog"
  | "Actors"
  | "Objects"
  | "Sound"
  | "Javascript"

export const scriptInstructionCategories: Array<ScriptInstructionCategory> = [
  "Structure and flow",
  "Dialog",
  "Actors",
  "Objects",
  "Sound",
  "Javascript"
]

export const scriptInstructionsCatalog: Array<ScriptInstructionEntry> = [
  {
    name: "scene",
    category: "Structure and flow",
    description: "Defines the start of a scene's scope. All the code below belongs to the scene until an end closes it.",
    syntaxes: [
      { syntax: "scene sceneId", description: "sceneId: name of the scene" }
    ],
    example: "scene mainMenu"
  },
  {
    name: "end",
    category: "Structure and flow",
    description: "Closes the current scope (scene, module or node).",
    syntaxes: [],
    variants: [
      { subtitle: "Close scene", syntax: "end scene" },
      { subtitle: "Close module", syntax: "end module" },
      { subtitle: "Close node", syntax: "end node" }
    ],
    example: "end scene"
  },
  {
    name: "module",
    category: "Structure and flow",
    description: "Defines the start of a module's scope: reusable code that can be included in any scene with include.",
    syntaxes: [
      { syntax: "module moduleId", description: "moduleId: name of the module" }
    ],
    example: "module dialogModule"
  },
  {
    name: "include",
    category: "Structure and flow",
    description: "Directly copies the content of the given module where this instruction is used. The module must exist.",
    syntaxes: [
      { syntax: "include \"moduleId\"" }
    ],
    example: "include \"editorNivelKeybinds\""
  },
  {
    name: "node",
    category: "Structure and flow",
    description: "Defines the start of a node's scope. Must be written inside a scene and only activates while the scene is active. Closed with node ends.",
    syntaxes: [
      { syntax: "node: nodeId", description: "nodeId: name of the node" }
    ],
    example: "node: IdunnoBro"
  },
  {
    name: "node ends",
    category: "Structure and flow",
    description: "Closes the current node's scope.",
    syntaxes: [
      { syntax: "node ends" }
    ],
    example: "node ends"
  },
  {
    name: "run",
    category: "Structure and flow",
    description: "Runs a scene (executing its main). Also allows jumping directly to a node of another scene.",
    syntaxes: [],
    variants: [
      { subtitle: "Run scene", syntax: "run sceneName" },
      {
        subtitle: "Run scene jumping to a node",
        syntax: "run sceneName -> nodeName",
        description: "jumps directly to the given node of the scene"
      }
    ],
    example: "run sceneName -> nodeName"
  },
  {
    name: "jumpto",
    category: "Structure and flow",
    description: "Jumps to a node defined in the active scene (the rest of the section's code is no longer executed).",
    syntaxes: [
      { syntax: "jumpto nodeName" }
    ],
    example: "jumpto myNode"
  },
  {
    name: "wait",
    category: "Structure and flow",
    description: "Pauses the sequential execution of commands (the queue is asynchronous). With a duration it resumes by itself; without one it waits until a resume.",
    syntaxes: [],
    variants: [
      {
        subtitle: "With duration (ms)",
        syntax: "wait timeInMs",
        description: "time: ms until execution resumes"
      },
      {
        subtitle: "Indefinite pause",
        syntax: "wait",
        description: "pauses until a resume clears it"
      }
    ],
    example: "wait 1500"
  },
  {
    name: "resume",
    category: "Structure and flow",
    description: "Resumes the sequential execution of commands paused by a durationless wait. Usually used inside a Trigger.",
    syntaxes: [
      { syntax: "resume" }
    ],
    example: "resume"
  },
  {
    name: "set",
    category: "Objects",
    description: "Modifies properties of any scene element, or engine-internal properties with Engine.",
    syntaxes: [],
    variants: [
      {
        subtitle: "Property dictionary",
        syntax: "set elementType id {property: value, ...}",
        description: "elementType: GraphObject | TextureAnim | Animation | Trigger | KeyboardTrigger | CodedRoutine"
      },
      {
        subtitle: "Property with operator",
        syntax: "set elementType id property operator value",
        description: "operator: = | += | -= etc. Accepts nested paths like position.x or position[axis]"
      },
      {
        subtitle: "Engine (core)",
        syntax: "set Engine engineId {property: value, ...}",
        description: "e.g. set Engine camera {position:{x,y,z},usePerspective:true} or set Engine camera globalBlur = 256"
      }
    ],
    example: "set GraphObject dialogbox {text:\"\"}"
  },
  {
    name: "new (creation)",
    category: "Objects",
    description: "Creates an element in the scene and registers it with the given id. Each type has its own signature:",
    syntaxes: [],
    variants: [
      {
        subtitle: "GraphObject",
        syntax: "id = new GraphObject({properties...})",
        description: "props with defaults: enabled=false, parent=\"\", text, fitContent, center, verticalCenter, color=\"gray\", font=\"Arial\", fontSize=18, boxColor=\"transparent\", horizontalMargin, verticalMargin, textureName, brightness=1, contrast=1, grayscale=0, hueRotate=0, blur=0, invert=0, saturate=1, sepia=0, opacity=1, x, y, z, scale=1, widthScale=1, heightScale=1, useEngineUnits, rotate, ignoreParallax"
      },
      {
        subtitle: "TextureAnim",
        syntax: "id = new TextureAnim([\"texture1\", \"texture2\", ...], {duration, speed})",
        description: "list of sprite frames; props: duration=1000, speed=1"
      },
      {
        subtitle: "Animation",
        syntax: "id = new Animation(relatedTo, {keyframes}, {props})",
        description: "relatedTo: id of the animated GraphObject. keyframes: {timestampMs:{property:value}}. props: ease, loops, reverse, infinite, loopback, duration, enabled, delay, onComplete"
      },
      {
        subtitle: "Animation (changes)",
        syntax: "id = new Animation(relatedTo, {changes}, {duration: ms})",
        description: "alternative with final changes instead of keyframes (duration is required in this case)"
      },
      {
        subtitle: "Trigger",
        syntax: "id = new Trigger(relatedTo, {onHold, onRelease, onEnter, onLeave, onWheel, onMouseMove})",
        description: "relatedTo: id of the GraphObject that defines its shape (optional). Behavior signatures: ()=>{} | (engine)=>{} | (engine, mouseCoord)=>{} | (engine, mouseCoord, object)=>{}"
      },
      {
        subtitle: "KeyboardTrigger",
        syntax: "new KeyboardTrigger([\"key1\", \"key2\"], {onHold, onRelease})",
        description: "anonymous shape without id (the key combination is its id). Also accepts id = new KeyboardTrigger(...)"
      },
      {
        subtitle: "CodedRoutine",
        syntax: "id = new CodedRoutine({code:(engine)=>{...}, continious:true})",
        description: "code: function with the executable body; continious: whether it runs continuously (e.g. the dialog typing agent)"
      },
      {
        subtitle: "Actor",
        syntax: "id = new Actor({active, name, body, emotions})",
        description: "defaults: active=false, name=\"\", body=null, emotions=[]. body and emotions reference GraphObject mask ids; they get re-parented to id->ActorParent"
      },
      {
        subtitle: "StageMark",
        syntax: "id = new StageMark({x, y, z})",
        description: "reference point for move/arrives; defaults: x=null, y=null, z=null"
      }
    ],
    example: "hello = new GraphObject({ enabled: true, text: \"Hi!\" })"
  },
  {
    name: "delete",
    category: "Objects",
    description: "Removes an element (or all, with all) from the space assigned to its type.",
    syntaxes: [],
    variants: [
      {
        subtitle: "Delete one",
        syntax: "delete elementType id",
        description: "elementType: GraphObject | TextureAnim | Animation | Trigger | KeyboardTrigger | CodedRoutine | Actor | StageMark"
      },
      {
        subtitle: "Delete all",
        syntax: "delete all elementType"
      }
    ],
    example: "delete GraphObject hello"
  },
  {
    name: "sound",
    category: "Sound",
    description: "Controls a registered sound (or its file). Direct playback actions or configuration with a dictionary.",
    syntaxes: [],
    variants: [
      { subtitle: "Play", syntax: "sound id play" },
      { subtitle: "Pause", syntax: "sound id pause" },
      { subtitle: "Stop", syntax: "sound id stop" },
      {
        subtitle: "Configuration",
        syntax: "sound id {property: value, ...}",
        description: "e.g. {loop:false} — id may be the registered id or \"file name\""
      }
    ],
    example: "sound \"dealWasAccepted\" play"
  },
  {
    name: "- (dialog)",
    category: "Dialog",
    description: "Shows a dialog line from the active speaker (pauses the flow until you advance). If no actor is assigned with says, the general dialog box is used.",
    syntaxes: [],
    variants: [
      {
        subtitle: "Simple line",
        syntax: "- \"text\""
      },
      {
        subtitle: "With configuration",
        syntax: "- \"text\" {config}",
        description: "config inside the text: e.g. {speed:0.4} changes the typing speed"
      },
      {
        subtitle: "Template literal",
        syntax: "- \"text ${expression}\"",
        description: "interpolates JavaScript expressions into the text"
      }
    ],
    example: "-\"In the end \" {speed:0.4} \"there's nothing even matter.\""
  },
  {
    name: "narration",
    category: "Dialog",
    description: "Shows narration text in the narration box. Pauses the flow until you advance.",
    syntaxes: [
      { syntax: "\"text\"", description: "a full line between quotes, without a prefix" }
    ],
    example: "\"And so begins the story.\""
  },
  {
    name: "says",
    category: "Dialog",
    description: "Marks the actor as the active speaker: the following dialog lines are spoken in their name. Fades out the previous speaker.",
    syntaxes: [
      { syntax: "actorName says" }
    ],
    example: "john says"
  },
  {
    name: "ask",
    category: "Dialog",
    description: "Question with selectable options in the UI. Each option goes on a new line inside the braces, starting with *. Options can combine a condition and a target node.",
    syntaxes: [],
    variants: [
      {
        subtitle: "Basic structure",
        syntax: "ask \"question\" { options... }"
      },
      {
        subtitle: "Simple option",
        syntax: "* \"label\"",
        description: "advances to the next line of the flow"
      },
      {
        subtitle: "Option with condition",
        syntax: "* \"label\" if { jsExpression }",
        description: "only appears if the condition is met"
      },
      {
        subtitle: "Option with target node",
        syntax: "* \"label\" nextNode \"nodeId\"",
        description: "jumps to the given node"
      },
      {
        subtitle: "Combined option",
        syntax: "* \"label\" if { jsExpression } nextNode \"nodeId\"",
        description: "condition and target node together"
      }
    ],
    example: "ask \"question\" {\n* \"yes\"\n* \"maybe\" if { Math.random() >= 0.5 } nextNode \"fire\"\n* \"no\"\n}"
  },
  {
    name: "move",
    category: "Actors",
    description: "Creates an animation that moves the actor to the position of the given StageMark.",
    syntaxes: [],
    variants: [
      { subtitle: "Without duration", syntax: "move actorName to stageMarkId" },
      {
        subtitle: "With duration",
        syntax: "move actorName to stageMarkId in ms",
        description: "ms: animation duration in milliseconds (without it dur=0, teleport)"
      }
    ],
    example: "move elisa to midLeft in 500"
  },
  {
    name: "arrives",
    category: "Actors",
    description: "The actor walks from off-screen to the StageMark, with fade-in of its mask/opacity.",
    syntaxes: [],
    variants: [
      { subtitle: "Without duration", syntax: "actorName arrives to stageMarkId" },
      {
        subtitle: "With duration",
        syntax: "actorName arrives to stageMarkId in ms",
        description: "defaults when no ms: movement 500ms, fade 1000ms"
      }
    ],
    example: "mrX arrives to midRight in 700"
  },
  {
    name: "gets",
    category: "Actors",
    description: "Changes the actor's emotion, cross-fading between the masks (emotions) defined at creation.",
    syntaxes: [],
    variants: [
      { subtitle: "Without duration", syntax: "actorName gets emotionId" },
      {
        subtitle: "With duration",
        syntax: "actorName gets emotionId in ms"
      }
    ],
    example: "elisa gets angry in 400"
  },
  {
    name: "@ (javascript)",
    category: "Javascript",
    description: "Runs JavaScript directly in the script. Allows automating tasks and even creating engine instructions inside lambdas.",
    syntaxes: [],
    variants: [
      {
        subtitle: "Expression",
        syntax: "@ expression",
        description: "executes the JavaScript line as-is"
      },
      {
        subtitle: "Reusable function",
        syntax: "@ const fn = () => { ... }",
        description: "define a lambda and then call it with @ fn();"
      },
      {
        subtitle: "With engine instructions",
        syntax: "@ for (...) { `id` = new GraphObject({...}) }",
        description: "inside an @ block, creates engine instructions using a dynamic id between backticks"
      }
    ],
    example: "@ console.log( Math.random() );"
  }
]
