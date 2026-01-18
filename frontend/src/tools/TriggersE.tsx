import React from 'react';

import { MenuButton, Button1 } from "./components/Buttons.jsx";
import { RenderEngine } from '../engine/renderCore/RenderEngine.tsx';
import { ObjectsE } from './SubTools.tsx';
import ListCheckedBox from './components/inputs/ListCheckedBox.tsx';

interface TriggersEProps {
  engine:RenderEngine,
  objectsERef:ObjectsE,
  reRender:()=>void
}

class TriggersE extends React.Component<TriggersEProps> {
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
                  engine.objectsToDebug.clear();
                  engine.objectsToDebug.add(trigger.relatedTo);
                  reRender();
                }}
                enter={()=>{
                  objectsERef.hoveredObject = trigger.relatedTo;
                  engine.objectsToDebug.clear();
                  engine.objectsToDebug.add(objectsERef.selectedObject);
                  engine.objectsToDebug.add(trigger.relatedTo);
                  reRender();
                }}
                leave={()=>{
                  objectsERef.hoveredObject = "";
                  engine.objectsToDebug.clear();
                  engine.objectsToDebug.add(objectsERef.selectedObject);
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

export { TriggersE }