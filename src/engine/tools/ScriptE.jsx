import React from 'react';

import { Button1, IconButton, InputText, InputTextArea } from "../components/buttons";
import { ScriptInterpreter } from '../renderCore/ScriptInterpreter';
import { Window } from '../components/Window';

import Swal from 'sweetalert2'

class ScriptE extends React.Component {
  constructor(props) {
    super(props);
    this.history = [];
    this.script = "";
    this.sceneIdWhereRun = "";
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
  save(id,script){
    return(
      <div className='p-2 w-full h-14'>
        <div className='rounded-xl bg-sky-600 bg-opacity-60 flex'>
          <span className='my-auto'>{id}</span>
          <Button1 style="my-auto" text="Load" action={()=>{this.script = script; console.log(script); this.forceUpdate();}}/>
          DeleteIcon
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
        <Window
          content={()=>this.savesContent()}
          clicked={()=>this.props.clicked()}
          title={"Scripts Saved"}
          exit={()=>{this.showSaves = false; this.forceUpdate();}}
        />
      );
    }
  }
  content(){
    return(
      <>
        <div className='relative h-full w-full text-white overflow-auto'>
            
          <div className='relative h-full w-full text-white font-[Consolas] code'>
            <InputTextArea 
              height={"h-full"} 
              value={this.script}
              changeValue={(value)=>{this.script = value;}} />
          </div>
        </div>
        <div className='bottom-0 h-8 w-full bg-gray-700 flex flex-row-reverse relative'>
          <Button1 
            text="Run!!" 
            action={()=>{
              console.log(this.script);
              const engine = this.props.engine;
              const k = new ScriptInterpreter;
              engine.actualSceneId = this.sceneIdWhereRun;
              k.buildFromText(this.script,(masterScript)=>{engine.loadGame(masterScript); this.props.toolsRef.editionKeys()},(error)=>{engine.consol(error)});
            }}
            />
          <InputText change={(value)=>{this.sceneIdWhereRun = value;}} style="pl-8 max-w-8"/>

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
            <Button1 text="Load" action={()=>{this.showSaves = true; this.forceUpdate();}}/>
          </div>
        </div>
      </>
    );
  }
  render() {
    return (
      <>
        <Window
          content={()=>this.content()}
          clicked={()=>this.props.clicked()}
          title={"Game Script"}
          exit={()=>this.props.exit()}
        />
        {this.renderSaves()}
      </>
    );
  }
}

export {ScriptE}