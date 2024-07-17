import React from "react";
import "./fonts.css"
import { IconButton } from "../engine/components/buttons";

class Guide extends React.Component{
  constructor(props){
    super(props);
    this.invert = false;
  }
  mainTitle(title,desc = ""){
    return(
      <div className="px-6 py-10 relative">
        <div className="font-['montserrat'] font-bold text-[32px] text-center">
          {title}
        </div>
        <div className="font-['times'] mx-2 my-2 text-[16px]">
          {desc}
        </div>
      </div>
    );
  }
  sectionTitle(title,desc = ""){
    return(
      <div className="px-6 py-10 relative">
        <div className="font-['montserrat'] font-bold text-[28px]">
          {title}
        </div>
        <div className="font-['liberationItalic'] mx-7 my-2 text-[14px]">
          {desc}
        </div>
      </div>
    );
  }
  subTitle(title,desc = ""){
    return(
      <>
        <div className="mt-4 h-[1px] bg-gray-500 mb-2 w-full"/>
        <div className="px-4 pb-3 relative w-full flex">

          <div className="font-['montserrat'] font-medium text-[16px]">
            {title}
          </div>
          <div className="font-['liberationItalic'] mx-5 my-auto text-[12px]">
            {desc}
          </div>
        </div>      
      </>

    );
  }
  element(title,desc = ""){
    return(
      <div style={{lineHeight:1.15}} className="font-['times'] my-2 mx-3 relative">
        <span style={{lineHeight:1.15}} className="font-['barlow'] font-[550] text-[17.5px]">
          {title}
        </span>
        {typeof desc != "string" ? desc.map((e,index)=>{return index == 0 ? <span style={{lineHeight:1.1}}>{e}</span> : <div style={{marginLeft:e.search(/\S|$/)*.25*2+"rem",lineHeight:1.1}}>{e}</div>}) : <span style={{lineHeight:1.1}}>{desc}</span>}
      </div>
    );
  }
  showContent(){

  }
  section(fun = null){
    return <div className='bg-white px-10 py-14 absolute w-full h-full overflow-auto'  style={{filter:"invert("+(this.invert?1:0)+")"}}>
      {fun == null ? "_No content_" : fun.map(content =>{ return content == "" ? <br/> : content })}
    </div>
  }
  controls(){
    return <div className="bottom-0 flex w-full h-12 opacity-50 z-10 absolute bg-black"   style={{filter:"invert("+(this.invert?1:0)+")"}}>
      <IconButton 
        icon="show" 
        style={"w-11 h-8 min-w-[3rem] my-auto"} 
        iconStyle={"w-8 h-8 my-auto mx-auto"}
        action={()=>{this.invert = !this.invert; this.forceUpdate(); console.log(this.invert);}}/>
    </div>
  }
  render(){
    return(
      <div className="bg-white relative w-full h-full contents">
        {this.section(
          [
            this.mainTitle("RenderEngine","Motor de renderización para videojuegos 2D"),
            this.sectionTitle("Redacción de script"),
            this.subTitle("Interpretación del script del juego"),
            this.sectionTitle("RenderEngine Class","RenderEngine class will be referenced as “engine”"),
            this.element("array engine.consolMessagesArray: ","Used to store the message that you want to show over the canvas used to render the scene (probably useful in debug)."),
            this.element("bool engine.isMobile: ","Used to determine how to handle the triggers (by MouseEvents or TouchEvents)."),
            this.element("bool engine.mounted: ","Used to avoid a double execution bug of the componentDidMount function."),
            this.element("object engine.canvasRef: ",[
              "Is a reference to the vars and canvas used to render the scene.",
              "",
              "  {",
              "    context: Context of the canvas where the scene are being rendered,",
              "    scale: scale used to render the scene,",
              "    resolutionWidth: resolutionWidth of the canvas element,",
              "    resolutionHeight: resolutionHeight of the canvas element,",
              "    fps:{",
              "      maxFps: frames drew per second,",
              "      fpsAdjustValue: magic number (EwE),",
              "      promedio: average of the maxFps at the last five seconds,",
              "      elapsed: time elapsed between calls to draw frames }",
              "  }",
            ]),
            this.element("number engine.engineTime: ","Time of the engine, used in animations. Acomulates the deltas between calls to render"),
            "",
            this.element("string engine.actualSceneId: ","Id of the scene that are being rendered"),
            this.element("object engine.masterScript: ",[
              "Stores the interpreted script data",
              "  {",
              "    sceneA:{",
              "      animations: object",
              "      codedRoutines: array",
              "      flags: object",
              "      gameVars: object",
              "      graphObjects: array",
              "      idDirectory: object",
              "      routines: array",
              "      sounds:array",
              "      textures: object",
              "      triggers: array		",
              "    }",
              "  }",
            ]),
            
            this.subTitle("References to classes"),
            this.element("GraphObject engine.graphObject: ","Reference to the GraphObject class"),
            this.element("Animation engine.animation: ","Reference to the Animation class"),
            this.element("ScriptInterpreter engine.scriptInterpreter: ","Reference to the ScriptInterpreter class"),
            this.element("CodedRoutine engine.codedRoutine: ","Reference to the CodedRoutine class"),
            
            this.subTitle("Scene resources lists"),
            this.element("ObjectArray(Instance) engine.graphArray: ","Instance of the ObjectArray class where the graphObjects of the actual scene are stored."),
            this.element("ObjectArray(Instance) engine.anims: ","Instance of the ObjectArray class where the anims of the actual scene are stored."),
            this.element("ObjectArray(Instance) engine.triggers: ","Instance of the ObjectArray class where the triggers of the actual scene are stored."),
            this.element("object engine.gameVars: ","Object that contains the vars that are needed for the game (control vars in the game logic)."),
            this.element("ObjectArray(Instance) engine.texturesList: ","Instance of the ObjectArray class where the textures (Shader class instances) of the actual scene are stored."),
            this.element("ObjectArray(Instance) engine.soundsList: ","Instance of the ObjectArray class where the triggers of the actual scene are stored."),
            
            this.subTitle("Keyboard Triggers"),
            this.element("ObjectArray(Instance) engine.keyboardTriggers: ","Instance of the ObjectArray class where the triggers, specifically related to the keyboard, of the actual scene are stored."),
            this.element("object engine.pressedKeys: ","Object with what are controlled the pressing of multiple keys at the same time"),

            this.subTitle("Routines","Or whatever that are written after the declaration of the structures in a scene, on the script"),
            this.element("ObjectArray(Instance) engine.codedRoutines: ","Instance of the ObjectArray class where the codedRoutines of the actual scene are stored."),
            this.element("array engine.routines: ","Array with the code that the engine will excecute sequentialy (lines of code written after the “END DECLARATION” line)."),
            this.element("object engine.flags: ","Object where the keys stores the flags names, and the values are the number of the routine where is located the flag. The flags result useful using the command JUMPTO (JUMPTO flagName), to go to the routine that are after the definition of the flag (FLAG flagName), and continue the sequential execution of the routines since there."),
            this.element("number engine.routineNumber: ","Stores the number of the routine that are being (or already was) executed."),
            this.element("bool engine.continue: ","Controls the resumes or stop of the cyclical execution of the routines."),

            this.subTitle("Dialogs"),
            this.element("ObjectArray(Instance) engine.codedRoutines: ","Instance of the ObjectArray class where the codedRoutines of the actual scene are stored."),
            this.element("array engine.routines: ","Array with the code that the engine will excecute sequentialy (lines of code written after the “END DECLARATION” line)."),
            this.element("object engine.flags: ","Object where the keys stores the flags names, and the values are the number of the routine where is located the flag. The flags result useful using the command JUMPTO (JUMPTO flagName), to go to the routine that are after the definition of the flag (FLAG flagName), and continue the sequential execution of the routines since there."),
            this.element("number engine.routineNumber: ","Stores the number of the routine that are being (or already was) executed."),
            this.element("bool engine.continue: ","Controls the resumes or stop of the cyclical execution of the routines."),

            this.subTitle("Rendering-related Stuff"),
            this.element("object engine.camera: ",[
              "The values used during the 'rendering' process (calculation of where a graphObject must be in the display).",
              "",
              "  {",
              "    maxZ:10000,",
              "    origin:{x:.5,y:.5},",
              "    position:{ //Position of the canvas in the three-dimensional space",
              "      x: 0,",
              "      y: 0,",
              "      z: 0,",
              "      angle: 0  //Value automatically updated. Don't modify it",
              "    },",
              "    usePerspective: enable or disable the deepness calculation using the z values",
              "  }",
            ]),
            this.sectionTitle("How-To","This is the section where, at least")
          ]
        )}
        {this.controls()}
      </div>
    );
  }
}

export {Guide}