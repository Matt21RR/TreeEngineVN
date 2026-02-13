import React, { useEffect, useReducer, useRef, useState } from 'react';

import GraphObject from "../engine/engineComponents/GraphObject.ts";
import Swal from 'sweetalert2';
import { RenderEngine } from '../engine/renderCore/RenderEngine.tsx';
import InputCheck from './components/inputs/InputCheck.tsx';
import InputText from './components/inputs/InputText.tsx';
import { Button1, MenuButton } from './components/Buttons.tsx';
import { Trigger } from '../engine/engineComponents/Trigger.ts';
import InputTextArea from './components/inputs/InputTextArea.tsx';

interface PropertyProps {
  object:GraphObject,
  defaultValue:any,
  type:string,
  keyd:string
}

function Property (props: PropertyProps) {
  const [isNull, setIsNull] = useState(props.defaultValue == null);
  const [isFunction, setIsFunction] = useState(typeof props.defaultValue == "function");
  const [_, forceUpdate] = useReducer(x => x + 1, 0);
  const defaultValue = useRef(isFunction ? props.defaultValue?.toString() : props.defaultValue );

  const setDefaultValue = (e)=>{
    defaultValue.current = e;
    forceUpdate();
  }

  useEffect(()=>{
    try {
      setDefaultValue(props.defaultValue); 
    } catch (error) {
      setDefaultValue("err")
    }
  },[]);

  const object = props.object;
  const type = props.type;
  const key = props.keyd;

  const change = (e)=>{
    if(type.includes("number")){
      if(isNaN(e)){
        return;
      }
      e *= 1;
    }
    if(isFunction){
      try {
        object[key] = (new Function ("","return " + e))();  
      } catch (error) {
        object[key] = null;
      }
    }else{
      object[key] = e;
    }
    setDefaultValue(e);
  }

  const booleanTypeInput = ()=>{
    return <InputCheck
      checked={defaultValue.current}
      action={(e)=>{
        change(e);
      }}
      label={defaultValue.current}
    />
  }

  const numberTypeInput = ()=>{
    return <InputText 
      type={"number"}
      defaultValue={defaultValue.current}
      action={(e)=>{
        change(e);
        setIsNull(false);
      }}
    />
  }

  const anyTypeInput = ()=>{
    return <InputTextArea
      defaultValue={defaultValue.current}
      action={(e)=>{
          change(e);
          setIsNull(false);
      }}/>
  }

  const valueInput = ()=>{
    if(type == "boolean"){
      return booleanTypeInput();
    }
    if(type == "number"){
      return numberTypeInput();
    }
    return anyTypeInput();
  }
    
  return(
    <div className='flex'>
      <div className='w-48'>{key}</div>
      {valueInput()}
      {type.includes("null") ? 
        <InputCheck 
          label="isNull" 
          checked={defaultValue.current==null}
          action={(e)=>{
            if(e){
              setIsNull(true);
              change(null);
            }
          }}/>
      : <></>}

      {type.includes("function") ? 
        <InputCheck 
          label="isFunction" 
          checked={isFunction}
          action={(e)=>{
            setIsFunction(e)
          }}/>
      : <></>}
    </div>
  );
}

interface ObjectEditorProps {
  engine: RenderEngine,
  selectedObject:string,
  setSelectedObject: (objId:string)=>void
}

class ObjectEditor  extends React.Component<ObjectEditorProps> {
  constructor(props){
    super(props);
  }
  cloneSelectedButton(){
    const eng = this.props.engine;
    return <Button1 
          text="clone"
          action={()=>{
            Swal.fire({
              text: "GraphObject id for the clone: ",
              showDenyButton: false,
              showConfirmButton: true,
              confirmButtonColor:"green",
              showCancelButton: true,
              confirmButtonText: "Clonar",
              cancelButtonText: "Cancelar",
              input:"text"
            }).then((cloneId) => {
              if (cloneId.isConfirmed && cloneId.value != "") {
                if(eng.graphArray.exist(cloneId.value)){
                  Swal.fire({
                    title: 'Error!',
                    text: 'Ya existe un GraphObject con tal id',
                    icon: 'error',
                    confirmButtonText: 'Cool'
                  })
                }else{
                  eng.graphArray.push(eng.graphArray.get(this.props.selectedObject).clone(cloneId.value));
                }
              }
            }
          );
        }
      }
    />
  }
  deleteSelectedButton(){
    const eng = this.props.engine;
    return <Button1 
      text="delete"
      action={()=>{
        Swal.fire({
          text: "DELETE?: ",
          showDenyButton: false,
          showConfirmButton: true,
          confirmButtonColor:"red",
          showCancelButton: true,
          confirmButtonText: "Yes",
          cancelButtonText: "No"
        }).then((confir) => {
          if (confir.isConfirmed) {
            eng.graphArray.remove(this.props.selectedObject);
            this.props.setSelectedObject("");
          }
        });
      }}
    />
  }

  listProperties(){
    if(this.props.selectedObject != ""){
      const engine = this.props.engine;
      let types;
      try {
        types = engine.graphArray.get(this.props.selectedObject).dataType;  
      } catch (error) {
        this.props.setSelectedObject("");
        return;
      }
      const obj = engine.graphArray.get(this.props.selectedObject);
      const objInfo = obj.dump();

      return(
        Object.keys(objInfo).map(key=>(
          <Property
            object={obj}
            key={Math.random()+window.performance.now()}
            keyd={key}
            type={types[key]}
            defaultValue={objInfo[key]}
          />
        ))
      );
    }
  }

  generateCreationScriptFromProperties(){
    const engine = this.props.engine;

    const defaultObjectValues =  new GraphObject().dump();
    const obj = engine.graphArray.get(this.props.selectedObject);
    const objInfo = obj.dump();
    let script = `${obj.id} = new GraphObject({\n`;
    Object.keys(objInfo).forEach(key=>{
      if(key != "id" && JSON.stringify(objInfo[key]) != JSON.stringify(defaultObjectValues[key])){ // Only include properties that are different from the default values
        let value = objInfo[key];
        if(typeof value == "string"){
          value = `"${value}"`;
        }else if(typeof value == "function"){
          value = value.toString();
        }
        script += `\t ${key} : ${value},\n`
      }
    });
    script += "});";
    return script;
  }

  GenerateCreationScriptButton(){
    return <Button1
              text="Generate creation script"
              action={()=>{
                Swal.fire({
                  title: `Creation Script for ${this.props.selectedObject}`,
                  html: `
                        <textarea spellcheck="false" class="h-96 w-full border rounded-md overflow-y-auto resize-none bg-stone-50">
                          ${this.generateCreationScriptFromProperties()}
                        </textarea>
                        <span class="text-[16px] leading-3 text-gray-800">
                          This is the creation script for the selected GraphObject with its current properties values.
                          You can copy and paste this script in your project to create the GraphObject with the same properties values as the current one.
                        </span>
                        `,
                  width: "800px"
                });
              }}
            />
  }
  
  render(){
    return <div className="h-full w-full max-w-full p-2 overflow-hidden">
            <div>
              Edit
            </div>
            <div className="h-full overflow-hidden text-sm flex flex-col">
              <div className='flex flex-row px-2'>
                {this.props.selectedObject == "" ? null : this.cloneSelectedButton()}
                {this.props.selectedObject == "" ? null : this.deleteSelectedButton()}
                {this.props.selectedObject == "" ? null : this.GenerateCreationScriptButton()}
              </div>
              <hr className="text-gray-200 my-1"/>
              <div className='overflow-auto w-auto px-2'>
                {this.listProperties()}
              </div>
            </div>
          </div>
  }
}

interface ObjectsEProps {
  engine:RenderEngine,
  selfRef:(el:ObjectsE)=>void,
  reRender:()=>void
}

class ObjectsE extends React.Component<ObjectsEProps> {
  object: GraphObject
  selectedObject: string
  hoveredObject: string
  mounted: boolean
  hide: boolean
  showStates: boolean
  keys: number
  value: string
  blockMouseTriggerButton: boolean
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

    this.blockMouseTriggerButton = false;
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
            engine.objectsToDebug.clear();
            engine.objectsToDebug.add(graphObject.id);
            reRender();
            this.selectedObject = graphObject.id;
            this.forceUpdate();
          }}
          enter={()=>{
            this.hoveredObject = graphObject.id;
            engine.objectsToDebug.clear();
            engine.objectsToDebug.add(this.selectedObject);
            engine.objectsToDebug.add(graphObject.id);
            reRender();
          }}
          leave={()=>{
            this.hoveredObject = "";
            engine.objectsToDebug.clear();
            engine.objectsToDebug.add(this.selectedObject);
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
            key={Math.random()+window.performance.now()}
            keyd={key}
            type={types[key]}
            defaultValue={objInfo[key]}
          />
        ))
      );
    }
  }
  selectWithMouseButton(){
    const eng = this.props.engine;
    return <Button1
      text="Select with mouse"
      hide={this.blockMouseTriggerButton}
      action={()=>{
        this.blockMouseTriggerButton = true;
        this.forceUpdate();
        const triggerName = "dspTrg" + (performance.now()*Math.random()).toFixed(8).replaceAll(".","")
        const trigger = new Trigger({
          onMouseMove:(_,mouse)=>{
            let resolution = eng.canvasRef.resolution;
            const collisions = eng.collisionLayer.checkMouse(mouse.mX,mouse.mY,resolution);
            const top = collisions.at(-1);
            eng.objectsToDebug.clear();
            eng.objectsToDebug.add(this.selectedObject);
            eng.objectsToDebug.add(top);
          },
          onRelease:(_,mouse)=>{
            this.blockMouseTriggerButton = false;
            this.forceUpdate();

            let resolution = eng.canvasRef.resolution;
            const collisions = eng.collisionLayer.checkMouse(mouse.mX,mouse.mY,resolution);
            const top = collisions.at(-1);
            if(top){
              eng.objectsToDebug.clear();
              eng.objectsToDebug.add(top);
              this.selectedObject = top;
              this.forceUpdate();
            }
            eng.triggers.remove(triggerName);
          },
          id: triggerName
        }); 
        eng.triggers.push(
          trigger
        )
      }}
    />
  }
  creationButton(){
    const eng = this.props.engine;
    return <Button1 
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
  }
  cloneButton(){
    const eng = this.props.engine;
    return <Button1 
              text="clone"
              action={()=>{
                Swal.fire({
                  text: "GraphObject id to clone: ",
                  showDenyButton: false,
                  showConfirmButton: true,
                  confirmButtonColor:"green",
                  showCancelButton: true,
                  confirmButtonText: "Clonar",
                  cancelButtonText: "Cancelar",
                  input:"text"
                }).then((targetId) => {
                  if (targetId.isConfirmed && targetId.value != "") {
                    if(!eng.graphArray.exist(targetId.value)){
                      Swal.fire({
                        title: 'Error!',
                        text: 'No existe un GraphObject con tal id',
                        icon: 'error',
                        confirmButtonText: 'Cool'
                      })
                    }else{
                      Swal.fire({
                        text: "GraphObject id for the clone: ",
                        showDenyButton: false,
                        showConfirmButton: true,
                        confirmButtonColor:"green",
                        showCancelButton: true,
                        confirmButtonText: "Clonar",
                        cancelButtonText: "Cancelar",
                        input:"text"
                      }).then((cloneId) => {
                        if (cloneId.isConfirmed && cloneId.value != "") {
                          if(eng.graphArray.exist(cloneId.value)){
                            Swal.fire({
                              title: 'Error!',
                              text: 'Ya existe un GraphObject con tal id',
                              icon: 'error',
                              confirmButtonText: 'Cool'
                            })
                          }else{
                            eng.graphArray.push(eng.graphArray.get(targetId.value).clone(cloneId.value));
                          }
                        }
                      });
                    }
                    
                  }
                });
              }}
              />
  }
  cloneSelectedButton(){
    const eng = this.props.engine;
    return <Button1 
          text="clone"
          action={()=>{
            Swal.fire({
              text: "GraphObject id for the clone: ",
              showDenyButton: false,
              showConfirmButton: true,
              confirmButtonColor:"green",
              showCancelButton: true,
              confirmButtonText: "Clonar",
              cancelButtonText: "Cancelar",
              input:"text"
            }).then((cloneId) => {
              if (cloneId.isConfirmed && cloneId.value != "") {
                if(eng.graphArray.exist(cloneId.value)){
                  Swal.fire({
                    title: 'Error!',
                    text: 'Ya existe un GraphObject con tal id',
                    icon: 'error',
                    confirmButtonText: 'Cool'
                  })
                }else{
                  eng.graphArray.push(eng.graphArray.get(this.selectedObject).clone(cloneId.value));
                }
              }
            }
          );
        }
      }
    />
  }
  deleteSelectedButton(){
    const eng = this.props.engine;
    return <Button1 
      text="delete"
      action={()=>{
        Swal.fire({
          text: "DELETE?: ",
          showDenyButton: false,
          showConfirmButton: true,
          confirmButtonColor:"red",
          showCancelButton: true,
          confirmButtonText: "Yes",
          cancelButtonText: "No"
        }).then((confir) => {
          if (confir.isConfirmed) {
            eng.graphArray.remove(this.selectedObject);
          }
        });
      }}
    />
  }
  render(){
    const eng = this.props.engine;
      return(
        <div className='text-white grid grid-cols-[180px_auto_1fr] h-full w-full'>
          <div className="grid grid-rows-[auto_auto_auto_auto_1fr] h-full overflow-hidden p-2">
            <div>
              Objects List
            </div>
            {this.creationButton()}
            {this.cloneButton()}
            {this.selectWithMouseButton()}
            <MenuButton text="Unselect / Refresh" action={()=>{eng.objectsToDebug.clear();this.selectedObject=""; this.forceUpdate();}}/>
            <div className="relative w-full overflow-auto">
              {this.objectsList()}
            </div>
          </div>
          <div className="text-gray-200 w-0.5 h-full"/>
          <ObjectEditor engine={eng} selectedObject={this.selectedObject} setSelectedObject={(objId)=>{
            this.selectedObject = objId;
            this.forceUpdate();
          }}/>
        </div>
      )
  }
}

export { ObjectsE }