import React from 'react';

import { MenuButton, Button1, ListCheckedBox, InputText, InputCheck } from "./components/Buttons";
import { GraphObject } from "../engine/engineComponents/GraphObject";
import { Window } from '../windows/Window';
import Swal from 'sweetalert2';


class Property extends React.Component{
  constructor(props){
    super(props);
    this.inputRef = {}
    this.checkNullRef = null
    this.checkFunctionRef = {}

    this.isNull = this.props.defaultValue==null;
  }
  render(){
    const object = this.props.object;
    const type = this.props.type;
    const key = this.props.keyd;
    const defaultValue = this.props.defaultValue;
    
    const change = (e)=>{
      if(type.includes("number")){
        if(isNaN(e)){
          return;
        }
        e *= 1;
      }
      object[key] = e;
      this.forceUpdate();
    }
    
    return(
        <div className='flex'>
          <div className='w-48'>{key}</div>
          {type == "boolean"?
            <InputCheck
              defaultValue={defaultValue}
              action={(e)=>{
                change(e);
              }}
              label={defaultValue}
            />
            :
            <InputText 
            type={type=="number"? "number" : "text"}
            defaultValue={defaultValue}
            action={(e)=>{
              change(e);
              this.isNull = false;
              if(this.checkNullRef != null){
                this.checkNullRef.checked = false;
                this.checkNullRef.forceUpdate();
              }
            }}
            selfSet={(e)=>{this.inputRef = e}}
            />
          }
          {type.includes("null") ? 
            <InputCheck 
              label="isNull" 
              checked={defaultValue==null}
              selfSet={(e)=>{this.checkNullRef = e}}
              action={(e)=>{
                if(e){
                  this.isNull = true;
                  this.inputRef.val("");
                  change(null);
                }
              }}/>
          : <></>}
        </div>
    );
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
    this.showStates = false;
    this.keys = 0;
    this.value = "";
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      this.props.selfRef(this);
      const engine = this.props.engine;
      engine.drawObjectLimits = true;
    }
  }
  objectsList(){
    const engine = this.props.engine;
    const reRender = this.props.reRender;
    let objects = engine.graphArray.objects;
    return(
      objects.map((graphObject)=>(

        <Button1 text={graphObject.id} 
          color={graphObject.enabled ? undefined : "bg-orange-400"}
          action={()=>{
            this.selectedObject = graphObject.id;
            engine.objectsToDebug = [graphObject.id];
            reRender();
            this.forceUpdate();
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
  listProperties(){
    if(this.selectedObject != ""){
      const engine = this.props.engine;
      let types;
      try {
        types = engine.graphArray.get(this.selectedObject).dataType;  
      } catch (error) {
        this.selectedObject = "";
        return;
      }
      const obj = engine.graphArray.get(this.selectedObject);
      const objInfo = obj.dump();
      
      return(
        Object.keys(objInfo).map(key=>(
            <Property
              object={obj}
              keyd={key}
              type={types[key]}
              defaultValue={objInfo[key]}
            />
          ))
      );
    }
  }
  render(){
    const eng = this.props.engine;
      return(
        <div className='text-white flex flex-row h-full'>
          <div className="flex flex-col max-h-full p-2">
            <div>
              Objects List
            </div>
            <Button1 
              text="create"
              action={()=>{
                Swal.fire({
                  text: "GraphObject id: ",
                  showDenyButton: false,
                  showConfirmButton: true,
                  confirmButtonColor:"green",
                  showCancelButton: true,
                  confirmButtonText: "Crear",
                  cancelButtonText: "Cancelar",
                  input:"text"
                }).then((result) => {
                  if (result.isConfirmed && result.value != "") {
                    eng.graphArray.push(new GraphObject({id:result.value, enabled:true}));
                  }
                });

              }}
              />
            <MenuButton text="Unselect" action={()=>{eng.objectsToDebug = [];this.selectedObject=""; this.forceUpdate();}}/>
            <div className="relative w-full overflow-auto">
              {this.objectsList()}
            </div>
          </div>
          <div className="flex flex-col h-full w-full p-2">
            <div>
              Edit
            </div>

            <div className="relative h-full w-full overflow-hidden text-sm px-2 flex flex-col">
              <div className='grow overflow-auto'>
                {this.listProperties()}
              </div>
            </div>
          </div>
        </div>
      )
  }
}
class TriggersE extends React.Component {
  constructor(props) {super(props);}
  list() {
    const engine = this.props.engine;
    const objectsERef = this.props.objectsERef;
    const reRender = this.props.reRender;
    let triggers = this.props.engine.triggers.objects;
    return (
      triggers.map((trigger) => (
        <div className={'border-4 flex flex-col relative my-1 h-auto'}>
            {"id: " + trigger.id}
            <div className='flex flex-row'>
              {"relatedTo: " + trigger.relatedTo} 
              <Button1 text={"Select"} 
                action={()=>{
                  objectsERef.selectedObject = trigger.relatedTo;
                  engine.objectsToDebug = [trigger.relatedTo];
                  reRender();
                }}
                enter={()=>{
                  objectsERef.hoveredObject = trigger.relatedTo;
                  engine.objectsToDebug = [objectsERef.selectedObject, trigger.relatedTo];
                  reRender();
                }}
                leave={()=>{
                  objectsERef.hoveredObject = "";
                  engine.objectsToDebug = [objectsERef.selectedObject];
                  reRender();
                }}
              />
            </div>
            <ListCheckedBox list={[
              {text:"onHold", check:typeof trigger.onHold == "function", actionName:"Test",action:()=>{trigger.check(engine,"onHold")}},
              {text:"onRelease", check:typeof trigger.onRelease == "function", actionName:"Test",action:()=>{trigger.check(engine,"onRelease")}},
              {text:"onEnter", check:typeof trigger.onEnter == "function", actionName:"Test",action:()=>{trigger.check(engine,"onEnter")}},
              {text:"onLeave", check:typeof trigger.onLeave == "function", actionName:"Test",action:()=>{trigger.check(engine,"onLeave")}},
            ]} />

        </div>
      )
      )
    );
  }
  render() {
    return (
      <div className='w-full h-full pt-5 pb-16'>
        <div className='relative h-full text-white overflow-auto'>
          <div className='relative h-full w-full px-8 text-white'>
            <MenuButton text="Reload" action={()=>{this.forceUpdate();}}/>
            {this.list()}
          </div>
        </div>
        <div className='absolute bottom-0 h-8 w-full flex flex-col '>
          <div className='relative w-fit my-auto mx-auto text-white text-sm'>
            The triggers can be re-used changing the relatedTo object id
          </div>
        </div>
      </div>

    );
  }
  
}
class SoundsE extends React.Component {
  constructor(props) {super(props);}
  list() {
    let sounds = this.props.engine.soundsList.objects;
    console.log(sounds);
    return (
      sounds.map((sound) => (
        <div className={'border-4 flex flex-row w-[98%] relative my-1'}>
          <div className={'m-2 h-16 w-72 '}>
            <Button1 text="play" action={()=>{sound.sound.play();}}/>
          </div>
          <div className='absolute right-4 top-0 text-white'>
            <MenuButton text={sound.id} />
          </div>
          <div className='absolute right-4 top-5 text-white'>
            <MenuButton text={"duration: "+sound.sound.duration().toFixed(2) + "s"} />
          </div>
          <div className='absolute right-4 top-10 text-white'>
            <MenuButton text={"format: "+sound.sound._format} />
          </div>
        </div>
      )
      )
    );
  }
  renderContent() {
    return (
      <div className='w-full h-full pt-5 pb-16'>
        <div className='relative h-full overflow-auto'>
          <div className='relative h-full w-full px-8 grid-flow-row auto-rows-min grid-cols-2 grid'>
          {this.list()}
          </div>
        </div>
        <div className='absolute bottom-0 h-8 w-full flex flex-col '>
          <div className='relative w-fit my-auto mx-auto text-white text-sm'>The sounds need to be defined manually in the script file</div>
          
        </div>
      </div>

    );
  }
  render() {
    return (
      <Window
        content={()=>this.renderContent()}
        clicked={()=>this.props.clicked()}
        title={"Available Sounds"}
        exit={()=>this.props.exit()}
      />
    );
  }
}
export { SoundsE, TriggersE, ObjectsE }