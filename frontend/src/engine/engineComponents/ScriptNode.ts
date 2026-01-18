import DialogInstruction from "../interpretators/builders/DialogInstruction.ts"
import NarrationInstruction from "../interpretators/builders/NarrationInstruction"
import { RenderEngine } from "../renderCore/RenderEngine"
import UI from "../renderCore/UI"
import Actor from "./Actor"

export type Decision = {
  label:string,
  condition?:((engine:RenderEngine)=>boolean)|null,
  out?:((engine:RenderEngine)=>void)|null
  nextNode?:string
}

export type ScriptNodeType = {
  actor?:Actor,
  position?:string,
  emotion?:string,
  in?:(engine:RenderEngine)=>void,
  out?:(engine:RenderEngine)=>void,
  say:string,
  nextNode?:string,
  decisions?:Array<Decision>,
}

class ScriptNode {
  #id:string
  #actor:Actor|null
  #actorId:string|null
  #position:string|null
  #emotion:string|null
  #in:((engine: RenderEngine) => void )| null
  #out:((engine: RenderEngine) => void) | null
  #say:string
  #nextNode:string|null
  #decisions:Array<Decision>|null

  constructor(data:ScriptNodeType){
    this.#actor = data.actor ?? null; //In the interpretation phase, replace the actor id with a reference to the actor
    this.#position = data.position ?? null;
    this.#emotion = data.emotion ?? "idle";
    this.#in = data.in ?? null;
    this.#out = data.out ?? null;
    this.#say = data.say;//In the interpretation phase, preserve the 'say' in text, unconverted information
    this.#nextNode = data.nextNode ?? null;
    this.#decisions = data.decisions ?? null;
  }
  
  public get id() : string {
    return this.#id
  }
  public set id(x){
    this.#id = x;
  }

  start(engine:RenderEngine){
    if(this.#in){
      engine.routines.push(this.#in);
    }
    if(this.#actor){
      engine.routines.push((engine:RenderEngine)=>{
        if(this.#position && this.#position in engine.scenicPositions){
          (this.#actor as Actor).body.parent = engine.scenicPositions[this.#position].id;
        }
        (this.#actor as Actor).body.enabled = true;
      });

      //TODO: check stablish actor mood
      if(this.#emotion){
        this.#actor.emotion = this.#emotion;
      }
    }

    if(this.#say){
      if(this.#actor){//*As dialog
        const dialInst = new DialogInstruction();
        const dialogFunctionText = dialInst.interpretate(false,{actor:this.#actor?.name,dialogs:this.#say});
        const dialogFunction = new Function("engine",dialogFunctionText);
        dialogFunction(engine);
      }else{//*As narration
        const narInst = new NarrationInstruction();
        const narrationFunctionText = narInst.interpretate(false,{value:this.#say});
        const narrationFunction = new Function("engine",narrationFunctionText);
        narrationFunction(engine);
      }
      if(this.#decisions){
        engine.callThisShitWhenDialogEnds = this.decide;
      }else{
        engine.callThisShitWhenDialogEnds = this.end;
      }
    }
  }

  decide(engine:RenderEngine){
    if(!this.#decisions){
      return;
    }
    //Decide must wait until narration or dialog ends
    //Show plausible decisions
    UI.getInstance().loadDecisions(this.#decisions);
  }

  end(engine:RenderEngine,decisionData:Decision|null = null){
    if(decisionData){
      this.#out = decisionData.out as ((engine: RenderEngine) => void) | null;
      this.#nextNode = decisionData.nextNode ?? this.#nextNode;
      if(this.#nextNode == null){
        console.warn("nextNode no defined");
        console.warn(decisionData);
      }
    }
    if(this.#actor){
      this.#actor.removeFocus();
    }
    if(this.#out){
      engine.routines.push(this.#out);
    }
    if(this.#nextNode){
      engine.scriptNodes.get(this.#nextNode).start(engine);
    }
    
  }

}

export default ScriptNode;