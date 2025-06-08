import DialogInstruction from "../interpretators/builders/DialogInstruction"
import NarrationInstruction from "../interpretators/builders/NarrationInstruction"
import { RenderEngine } from "../renderCore/RenderEngine"
import Actor from "./Actor"

type Desicion = {
  label:string,
  condition?:Function|null,
  out?:Function|null
  nextNode:string
}

type ScriptNodeType = {
  actor?:Actor,
  position?:string,
  emotion?:string,
  in?:Function,
  out?:Function,
  say:string,
  nextNode?:string,
  desicions?:Array<Desicion>,
}
class ScriptNode {
  #actor:Actor|null
  #actorId:string|null
  #position:string|null
  #emotion:string|null
  #in:Function|null
  #out:Function|null
  #say:string
  #nextNode:string|null
  #desicions:Array<Desicion>|null

  constructor(data:ScriptNodeType){
    this.#actor = data.actor ?? null; //In the interpretation phase, replace the actor id with a reference to the actor
    this.#position = data.position ?? null;
    this.#emotion = data.emotion ?? "idle";
    this.#in = data.in ?? null;
    this.#out = data.out ?? null;
    this.#say = data.say;//In the interpretation phase, preserve the 'say' in text, unconverted information
    this.#nextNode = data.nextNode ?? null;
    this.#desicions = data.desicions ?? null;
  }

  start(engine:RenderEngine){
    if(this.#in){
      engine.routines.push(this.#in);
    }
    if(this.#actor){
      engine.routines.push((engine)=>{
        if(this.#position && this.#position in engine.scenicPositions){
          (this.#actor as Actor).body.parent = engine.scenicPositions[this.#position].id;
        }
        (this.#actor as Actor).body.enabled = true;
      });

      //TODO: check stablish actor mood
      if(this.#emotion){
        this.#actor.emotion = this.#emotion;
      }

      const dialInst = new DialogInstruction();
      const dialogFunctionText = dialInst.interpretate(false,{actor:this.#actor?.name,dialogs:this.#say});
      const dialogFunction = new Function("engine",dialogFunctionText);
      dialogFunction(engine);



    }else{//as narrator
      const narInst = new NarrationInstruction();
      const narrationFunctionText = narInst.interpretate(false,{value:this.#say});
      const narrationFunction = new Function("engine",narrationFunctionText);
      narrationFunction(engine);
    }
  }

  decide(){
    //Show plausible desicions
  }

  end(engine:RenderEngine){
    if(this.#actor){
      this.#actor.removeFocus();
    }
    
  }

}