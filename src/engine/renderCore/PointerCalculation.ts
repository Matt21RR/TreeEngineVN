import CollisionLayer from "../engineComponents/CollisionLayer";
import RenList from "../engineComponents/RenList";
import { Trigger } from "../engineComponents/Trigger";
import { sortByReference } from "../logic/Misc.ts";
import { RenderEngine } from "./RenderEngine.tsx";

class PointerCalculation{
  static calcMouseVirtualPosition(mouse:React.MouseEvent|React.TouchEvent,offset,action:string){

    let mX:number, mY:number, clientX:number, clientY:number;
    if(window.TouchEvent && mouse instanceof TouchEvent){
      if(action == "onHold"){
        clientX = mouse.touches[0].clientX;
        clientY = mouse.touches[0].clientY;
      }else{
        clientX = mouse.changedTouches[0].clientX;
        clientY = mouse.changedTouches[0].clientY;
      }
    }else{
      //@ts-ignore
      clientX = mouse.clientX;
      //@ts-ignore
      clientY = mouse.clientY;
    }
    clientX-=offset.left;
    clientY-=offset.top;

    //@ts-ignore
    mX = clientX/mouse.target.clientWidth;
    //@ts-ignore
    mY = clientY/mouse.target.clientHeight;

    return {mX,mY}
  }

  static triggersMouseCollisionManagement(
    collisionedTriggers:Array<string>,
    objectsWithTriggersList:{[key:string]:Array<string>},
    reversedRenderOrderList:Array<string>,
    triggers:RenList<Trigger>,
    action:string){
    
    for(const collisionedObjectId of sortByReference(collisionedTriggers,reversedRenderOrderList)){
      if(collisionedObjectId in objectsWithTriggersList){
        objectsWithTriggersList[collisionedObjectId].forEach(triggerId => {

          if(!RenderEngine.getInstance().enteredTriggers.includes(triggerId)){
            triggers.get(triggerId).check(RenderEngine.getInstance(),"onEnter");
            RenderEngine.getInstance().enteredTriggers.push(triggerId);
          }

          try {
            triggers.get(triggerId).check(RenderEngine.getInstance(),action);
          } catch (error) {
            console.log("Error on trigger execution:",error,triggers.get(triggerId))
          }
        });
      }
      break;
    }
  }

  static onLeaveTriggerCheck(
    collisionedTriggers:Array<string>,
    triggersIdList:Array<string>,
    triggers:RenList<Trigger>
  ){
    //onLeave part, activar el onLeave en todos aquellos triggers que no se activaron previamente
    triggersIdList.forEach(triggerId => {
      const trigger = triggers.get(triggerId);
      if(RenderEngine.getInstance().enteredTriggers.includes(triggerId) && !collisionedTriggers.includes(trigger.relatedTo as string)){
        const trigger = triggers.get(triggerId);
        if(trigger.relatedTo != null){
          trigger.check(RenderEngine.getInstance(),"onLeave");
        }
        RenderEngine.getInstance().enteredTriggers.splice(RenderEngine.getInstance().enteredTriggers.indexOf(triggerId));
      }
    });
}
}

export default PointerCalculation