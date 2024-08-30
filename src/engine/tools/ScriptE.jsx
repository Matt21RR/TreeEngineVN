import React from 'react';

import { Button1, IconButton, InputText, InputTextArea } from "../components/buttons";
import { ScriptInterpreter } from '../renderCore/ScriptInterpreter';
import { Window } from '../../windows/Window';

import Swal from 'sweetalert2'
import { GraphObject } from '../engineComponents/GraphObject';

class Files extends React.Component {
  constructor(props){
    super(props);
  }
  getFiles(){
    
  }

}
class ScriptE extends React.Component {
  constructor(props) {
    super(props);
    this.history = [];
    this.script = "scriptNotepad" in localStorage ? localStorage.getItem("scriptNotepad") : "";
    this.sceneIdWhereRun =  "sceneIdWhereRun" in localStorage ? localStorage.getItem("sceneIdWhereRun") : "";
    this.showSaves = false;
  }
  getSaves(){
    var saves = localStorage.getItem("saves");
    if(saves == null){localStorage.setItem("saves",JSON.stringify({}));}
    return saves != null ? JSON.parse(saves) : {};
  }
  saveScript(name,script){
    var saves = this.getSaves();
    Object.assign(saves,{[name] : script});
    localStorage.setItem("saves",JSON.stringify(saves));
  }
  removeScript(name){
    var saves = this.getSaves();
    delete saves[name];
    localStorage.setItem("saves",JSON.stringify(saves));
  }
  save(id,script){
    return(
      <div className='p-2 w-full h-14'>
        <div className='relative rounded-xl bg-sky-600 bg-opacity-60 flex'>
          <span className='my-auto'>{id}</span>
          <Button1 style="my-auto" text="Load" action={()=>{this.script = script; this.forceUpdate();}}/>
          <IconButton icon="trash" style="h-6 w-6 m-1 absolute top-0 right-0"
            action={()=>{
              Swal.fire({
                text: "Está seguro de que desea borrar el script: "+id,
                icon: "question",
                showDenyButton: true,
                showConfirmButton: false,
                showCancelButton: true,
                denyButtonText: "Borrar",
                cancelButtonText: "Cancelar"
              }).then((result) => {
                if (result.isDenied) {
                  this.removeScript(id);
                  this.forceUpdate();
                  Swal.fire("Script borrado", "", "success");
                }
              });
            }}/>
        </div>
      </div>

    )
  }
  savesContent(){
    const saves = this.getSaves();
      
    return(
      Object.keys(saves).map(saveId=>(
        <>
          {this.save(saveId,saves[saveId])}
        </>
      ))
    );
  }
  renderSaves(){
    if(this.showSaves){
      return(
        <div className='absolute h-full w-full flex flex-col'>
          <Window
            content={()=>this.savesContent()}
            clicked={()=>this.props.clicked()}
            title={"Scripts Saved"}
            exit={()=>{this.showSaves = false; this.forceUpdate();}}
          />
        </div>
      );
    }
  }
  runScript(){
    const engine = this.props.engine;
    const k = new ScriptInterpreter;
    engine.actualSceneId = this.sceneIdWhereRun;
    k.buildFromText(this.script,(error)=>{engine.consol(error)}).then((masterScript)=>{
      engine.loadGame(masterScript,()=>{
        this.props.reRender();
      });
    })
  }
  render(){
    return(
      <>
        <div className='relative h-full w-full flex flex-col'>
          <div className='relative h-full w-full text-white overflow-auto flex flex-row'>
            <div className='left-0 w-8 h-full bg-gray-700 flex flex-col relative border-b-2'>
                <IconButton icon="plus" style="h-6 w-6 m-1" action={()=>{
                  Swal.fire({
                    title: "Agregar elemento",
                    // text: "Seleccione el tipo de elemento que desea agregar en su script",
                    input: "select",
                    inputOptions: {
                      "Elemento compuesto": {
                        textureAnim:"TextureAnim",
                        graphObject:"GraphObject",
                        anim:"Animation",
                        trigger:"Trigger",
                        codedRoutine:"CodedRoutine"
                      },
                      "Lista plana": {
                        textures: "Set Textures",
                        sounds: "Set Sounds"
                      }
                    },
                    inputPlaceholder: "Tipo de elemento",
                    showCancelButton: true,
                    inputValidator: (value) => {
                      if (!value) {
                        return "Elige una de las opciones de la lista";
                      }
                    }
                  }).then(elementType=>{
                    // this.saveScript(saveName.value,this.script);
                  });
                }}/>
            </div>
            <div className='relative h-full w-full text-white font-[Consolas] code'>
              <InputTextArea 
                height={"h-full"} 
                defaultValue={this.script}
                onControl={{Enter:(e)=>{e.preventDefault(e);this.runScript();}}}
                changeValue={(value)=>{this.script = value;localStorage.setItem("scriptNotepad",value)}} />
            </div>
          </div>
          <div className='bottom-0 h-8 w-full bg-gray-700 flex flex-row-reverse relative'>
            <Button1 
              text="Run!!" 
              action={()=>{
                this.runScript();
              }}
              />
            <InputText defaultValue={this.sceneIdWhereRun} change={(value)=>{this.sceneIdWhereRun = value;localStorage.setItem("sceneIdWhereRun",value);}} style="pl-8 max-w-8"/>

            <div className='absolute left-0 top-0 h-full w-fit flex'>
              <IconButton icon="save" style="h-6 w-6 m-1" action={()=>{
                Swal.fire({
                  title: "Enter script name",
                  input: "text",
                  inputLabel: "Script Name",
                  showCancelButton: true,
                  inputValidator: (value) => {
                    if (!value) {
                      return "You need to write something!";
                    }
                    if(Object.keys(this.getSaves()).indexOf(value) != -1){
                      return "That name are already being used";
                    }
                  }
                }).then(saveName=>{
                  this.saveScript(saveName.value,this.script);
                });
              }}/>
              <Button1 text="Load" action={()=>{
                this.showSaves = true; 
                this.forceUpdate();}}/>
            </div>
          </div>
        </div>
        {this.renderSaves()}
      </>
    );
  }
}

export {ScriptE}