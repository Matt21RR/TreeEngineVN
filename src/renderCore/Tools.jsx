import React from "react";
import * as THREE from 'three';
import { Button1 } from "../components/buttons";

class Waypoints extends React.Component {
  render(){
    return(<>
      <Button1 text="Set waypoint" action={()=>{
        console.log("Waypoint establecido en", this.props.threeRef.camera.position)
      }}/>
    </>);
  }
}
class Objects extends React.Component {
  constructor(props){
    super(props);
    this.wireframes = [];
    this.selectedMesh = "";
    //this.selectedMesh = new THREE.Mesh();
    this.mounted = false;
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      let keyboardOptions = this.props.threeRef.keyboardOptions;
      let threeRef = this.props.threeRef;
      var rotateIn = "";
      keyboardOptions.Numpad8 = ()=>{//Chek if a mesh was selected?.... nah
        this.selectedMesh.position.z -= .1;
        this.updateWireframe();
      }
      keyboardOptions.Numpad2 = ()=>{
        this.selectedMesh.position.z += .1;
        this.updateWireframe();
      }
      keyboardOptions.Numpad6 = ()=>{
        this.selectedMesh.position.x += .1;
        this.updateWireframe();
      }
      keyboardOptions.Numpad4 = ()=>{
        this.selectedMesh.position.x -= .1;
        this.updateWireframe();
      }
      keyboardOptions.Numpad9 = ()=>{
        if(rotateIn == ""){
          this.selectedMesh.position.y += .1;
        }else{
          console.log(this.selectedMesh);
          this.selectedMesh.rotation[rotateIn] += .1
        }
        this.updateWireframe();
      }
      keyboardOptions.Numpad7 = ()=>{
        if(rotateIn == ""){
          this.selectedMesh.position.y -= .1;
        }else{
          console.log(this.selectedMesh);
          this.selectedMesh.rotation[rotateIn] -= .1
        }
        this.updateWireframe();
      }
      //*SELECT AXIS
      keyboardOptions.Numpad1 = ()=>{ //x
        rotateIn = "x";
      }
      keyboardOptions.Numpad5 = ()=>{ //Y
        rotateIn = "y";
      }
      keyboardOptions.Numpad3 = ()=>{//Z
        rotateIn = "z";
      }
      keyboardOptions.Numpad0 = ()=>{//unselectRotation
        rotateIn = "";
      }
    }
  }
  updateWireframe(){
    let scene = this.props.threeRef.scene;
    let mesh = this.selectedMesh;
    console.log(scene,mesh,this.wireframes);
    this.wireframes.forEach(wireframe => {
      scene.remove(wireframe);
    });
    this.wireframes = [];

    const wireframe = new THREE.WireframeGeometry( mesh.geometry );
    const wireframelines = new THREE.LineSegments( wireframe );
    wireframelines.applyMatrix4(mesh.matrix);
    this.wireframes.push(wireframelines);
    scene.add( wireframelines );
    this.props.reRender();
  }
  objectsList(){
    let scene = this.props.threeRef.scene;
    return(
      scene.children.map((mesh)=>(

        <Button1 text={mesh.geometry.type} hide={mesh.geometry.type == "WireframeGeometry"} action={()=>{
          this.wireframes.forEach(wireframe => {
            scene.remove(wireframe);
          });
          this.wireframes = [];
          const wireframe = new THREE.WireframeGeometry( mesh.geometry );
          const wireframelines = new THREE.LineSegments( wireframe );
          wireframelines.applyMatrix4(mesh.matrix);
          this.wireframes.push(wireframelines);
          scene.add( wireframelines );
          this.selectedMesh = mesh;
          this.props.reRender();
        }}/>
        ))
    );
  }
  createObject(){
    let scene = this.props.threeRef.scene;
    return(
      <>
        <Button1 text={"Create Sprite Shape"} action={()=>{
          const material = new THREE.MeshBasicMaterial( { color: "rgb(61,114,94)" } ); // Crear el material para la

          const geometry = new THREE.BoxGeometry( 1, 1, 0 ); // Crear geometría cúbica con dimensiones(x, y, z).
          const cube = new THREE.Mesh( geometry, material ); // Crear una malla que agrupará la geometría
          scene.add( cube );
          this.props.reRender();
        }}/>
        <Button1 text={"Create Cube"} action={()=>{
          const material = new THREE.MeshBasicMaterial( { color: "rgb(61,114,94)" } ); // Crear el material para la

          const geometry = new THREE.BoxGeometry( 1, 1, 1 ); // Crear geometría cúbica con dimensiones(x, y, z).
          const cube = new THREE.Mesh( geometry, material ); // Crear una malla que agrupará la geometría
          scene.add( cube );
          this.props.reRender();
        }}/>
      </>
    );
  }
  editObject(){
    if(this.selectedMesh != ""){
      return(
        <>
          Width: {this.selectedMesh.position.x}
          Height
          Depth
          x: {this.selectedMesh.position.x}
          y: {this.selectedMesh.position.y}
          z: {this.selectedMesh.position.z}
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

class Tools extends React.Component {
  constructor(props){
    super(props);
    this.mounted = false; 
  }
  showSections(){
    if(this.props.threeRef != null){
      return(
        <>
          <Waypoints threeRef={this.props.threeRef} reRender={()=>{this.forceUpdate()}}/>
          <Objects threeRef={this.props.threeRef} reRender={()=>{this.forceUpdate()}}/>
        </>
      );
    }
  }
  render(){
    return(
      <div className="absolute bottom-0 w-full h-1/4 bg-[#5561ffba] z-50 flex">
        {this.showSections()}
      </div>
    );
  }
}
export {Tools,Objects}