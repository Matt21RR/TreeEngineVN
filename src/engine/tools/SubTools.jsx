import React from 'react';

import { MenuButton, Button1, ListCheckedBox, InputText, InputList } from "../components/buttons";
import { GraphObject } from "../engineComponents/GraphObject";
import { Window } from '../../windows/Window';

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
  editObject(){
    if(this.selectedObject != ""){
      const engine = this.props.engine;
      let info = engine.graphArray.get(this.selectedObject).dump();
      let keys = Object.keys(info);
      return(
        <div className='flex'>
          <InputList
            options={keys}
            action={(e)=>{this.key = keys[e];}}
            value={0}
          />
          <InputText
            action={(e)=>{
              this.value = e;
              console.log(e);
            }}
          />
          <Button1 text={"Set"} action={()=>{
            const type = typeof engine.graphArray.get(this.selectedObject)[this.key];
            console.log(type,this.value);
            if(type == "number"){
              this.value *= 1;
            }
            console.log(type,this.value);
            // TODO: implement NaN check
            engine.graphArray.get(this.selectedObject)[this.key] = this.value;
            this.props.reRender();
          }}/>
        </div>
      );
    }
  }
  listProperties(){
    const engine = this.props.engine;
    if(this.selectedObject != ""){
      try {
        const objInfo = (engine.graphArray.get(this.selectedObject).dump());
        return(
          Object.keys(objInfo).map(key=>(
            <div>
              {key+" : "+objInfo[key]}
            </div>
            ))
        );
      } catch (error) {
        return(<></>);
      }

    }
  }
  states(){
    const engine = this.props.engine;

    if(this.selectedObject != "" && this.showStates){
      const states = engine.graphArray.get(this.selectedObject).states;
      if(states != undefined){
        return(
          <StatesE 
            states={states}
            exit={()=>{this.showStates = false;this.forceUpdate();}}
            engine={engine}/>
        )
      }
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
              {this.editObject()}
            </div>
          </div>
          {this.states()}
        </div>
      )
  }
}
class StatesE extends React.Component {
  constructor(props) {super(props);}
  list() {
    const engine = this.props.engine;
    let statesObject = this.props.states;
    var states = [];
    Object.keys(statesObject).forEach(key => {
      states.push({
        id:key,
        beforeChange:statesObject[key].beforeChange,
        data:statesObject[key].data,
        afterChange:statesObject[key].afterChange})
    });
    return (
      states.map((state) => (
        <div className={'border-4 flex flex-col relative my-1 h-auto'}>
            {"id: " + state.id}
            <ListCheckedBox list={[
              {text:"beforeChange", check:typeof state.beforeChange == "function", actionName:"Test",action:()=>{state.beforeChange(engine)}},
              {text:"data", check:true},
              {text:"afterChange", check:typeof state.afterChange == "function", actionName:"Test",action:()=>{state.afterChange(engine)}},
            ]} />

        </div>
      )
      )
    );
  }
  renderContent() {
    return (
      <div className='w-full h-full pt-5 pb-16'>

        <div className='relative h-full text-white overflow-auto'>
          <div className='relative h-full w-full px-8 text-white'>
            {this.list()}
          </div>
        </div>
        <div className='absolute bottom-0 h-8 w-full flex flex-col '>
          <div className='relative w-fit my-auto mx-auto text-white text-sm'>
            The states are
          </div>
        </div>
      </div>

    );
  }
  render() {
    return (
      <Window
        content={()=>this.renderContent()}
        clicked={()=>this.props.clicked()}
        title={"Object States"}
        exit={()=>this.props.exit()}
      />
    );
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
export { StatesE, SoundsE, TriggersE, ObjectsE }