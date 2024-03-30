import React from "react";
import { RenderEngine } from "../renderCore/RenderEngine";
import gsap from "gsap";
import { GraphObject, Trigger } from "../renderCore/graphObj";
import { Button1 } from "../components/buttons";

class TexturesE extends React.Component {
  render(){
    return(<>
      <Button1 text="Textures" action={()=>{
        console.log("Waypoint establecido en", this.props.threeRef.camera.position)
      }}/>
    </>);
  }
}
class AnimationsE extends React.Component {
  render(){
    return(<>
      <Button1 text="Animations" action={()=>{
        console.log("Waypoint establecido en", this.props.threeRef.camera.position)
      }}/>
    </>);
  }
}
class WaypointsE extends React.Component {
  render(){
    return(<>
      <Button1 text="Set waypoint" action={()=>{
        console.log("Waypoint establecido en", this.props.threeRef.camera.position)
      }}/>
    </>);
  }
}
class ObjectsE extends React.Component {
  constructor(props){
    super(props);
    this.object = new GraphObject();
    this.selectedObject = "";
    this.hoveredObject = "";
    this.mounted = false;
    this.hide = false;
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      const engine = this.props.engine;
      engine.drawObjectLimits = true;
      // keyboardOptions.Numpad8 = ()=>{//Chek if a mesh was selected?.... nah

      //   this.updateWireframe();
      // }
    }
  }
  updateWireframe(){
    this.props.reRender();
  }
  objectsList(){
    const engine = this.props.engine;
    const reRender = this.props.reRender;
    let objects = engine.graphArray.objects;
    return(
      objects.map((graphObject)=>(

        <Button1 text={graphObject.id} 
          action={()=>{
            this.selectedObject = graphObject.id;
            engine.objectsToDebug = [graphObject.id];
            reRender();
          }}
          enter={()=>{
            this.hoveredObject = graphObject.id;
            engine.objectsToDebug = [this.selectedObject, graphObject.id];
            reRender();
          }}
          leave={()=>{
            this.hoveredObject = "";
            engine.objectsToDebug = [this.selectedObject];
            reRender();
          }}
        />
        ))
    );
  }
  createObject(){
    return(
      <>
        <Button1 text={"Create GraphObject"} action={()=>{

          this.props.reRender();
        }}/>
      </>
    );
  }
  editObject(){
    if(this.selectedObject != ""){
      return(
        <>
          {/* Width: {this.selectedMesh.position.x}
          Height
          Depth
          x: {this.selectedMesh.position.x}
          y: {this.selectedMesh.position.y}
          z: {this.selectedMesh.position.z} */}
        </>
      );
    }
  }
  render(){
      return(
        <>
          <div className="flex flex-col max-h-full">
            <div>
              Objects List
            </div>

            <div className="relative w-full overflow-auto">
              {this.objectsList()}
            </div>
          </div>
          <div className="flex flex-col max-h-full">
            <div>
              Create
            </div>

            <div className="relative w-full overflow-auto">
              {this.createObject()}
            </div>
          </div>
          <div className="flex flex-col max-h-full">
            <div>
              Edit
            </div>

            <div className="relative w-full overflow-auto">
              {this.editObject()}
            </div>
          </div>
        </>
      )
  }
}


class EditTools extends React.Component {
  constructor(props){
    super(props);
    this.engine = new RenderEngine();
    this.editing = false;
  }
  componentDidMount(){
    window.setTimeout(()=>{
      console.log(new GraphObject());
      const engine = this.engine;
      const kTDef = {};//Key triggers definition
      kTDef.KeyR = {
        onPress:()=>{
          this.editing = !this.editing;
          if(this.editing){
            this.engine.camera.usePerspective = true;
          }else{
            this.engine.camera.usePerspective = false;
          }
        }
      };

      kTDef.KeyW = {
        onHold:()=>{
          engine.camera.position.z += .1;
        }
      }
      kTDef.KeyS = {
        onHold:()=>{
          engine.camera.position.z -= .1;
        }
      }
      kTDef.KeyA = {
        onHold:()=>{
          engine.camera.position.x -= .1;
        }
      }
      kTDef.KeyD = {
        onHold:()=>{
          engine.camera.position.x += .1;
        }
      }
      kTDef.Space={
        onHold:()=>{
          engine.camera.position.y -= .1;
        }
      }
      kTDef.ShiftLeft={
        onHold:()=>{
          engine.camera.position.y += .1;
        }
      }

      const keyboardTriggers = this.engine.keyboardTriggers;
      Object.keys(kTDef).forEach(keyDef => {
        kTDef[keyDef].id = keyDef;
        keyboardTriggers.push(Trigger.create(kTDef[keyDef]));
      });

      this.forceUpdate();
    },200);
  }
  showSections(){
    if(this.engine != null && !this.hide){
      return(
        <div className="w-full h-[200px] bg-[#2f2f2fba] z-50 flex text-white">
          <div className="flex flex-col">
            <WaypointsE engine={this.engine} reRender={()=>{this.forceUpdate()}}/>
            <TexturesE engine={this.engine} reRender={()=>{this.forceUpdate()}}/>
          </div>
          <ObjectsE engine={this.engine} reRender={()=>{this.forceUpdate()}}/>
        </div>
      );
    }
  }
  render(){
    return(
      <>
        <RenderEngine setEngine={(engine)=>{this.engine=engine;}}/>
        <div className="w-full h-auto absolute bottom-0" id="GUI">
          <Button1 
            action={()=>{
              this.hide = !this.hide;
              this.forceUpdate();}}
            text={this.hide?"Mostrar":"Ocultar"}
            />
          {this.showSections()}
        </div>
      </>
    )
  }
}
export {EditTools}