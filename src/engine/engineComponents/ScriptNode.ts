import DialogInstruction from "../interpretators/builders/DialogInstruction"
import NarrationInstruction from "../interpretators/builders/NarrationInstruction"
import { RenderEngine } from "../renderCore/RenderEngine"
import Actor from "./Actor"

type Decision = {
  label:string,
  condition?:(engine:RenderEngine)=>null|null,
  out?:(engine:RenderEngine)=>null|null
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
  decisions?:Array<Decision>,
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

  start(engine:RenderEngine){
    if(this.#in){
      console.log(this.#in);
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
        RenderEngine.getInstance().callThisShitWhenDialogEnds = this.decide;
      }else{
        RenderEngine.getInstance().callThisShitWhenDialogEnds = this.end;
      }
    }
  }

  decide(engine:RenderEngine){
    //Decide must wait until narration or dialog ends
    //Show plausible decisions

    const id = `${Math.random()+window.performance.now()}`.replaceAll(".","");
    let res :Array<string> = [];
    res.push(`
      decisionsRef${id} = new GraphObject({
        enabled:true,
        x:0.875,
        y:0.5
      })

      const decisionsRef${id} = engine.graphArray.get("decisionsRef${id}");

      //The engine with hung-up here... maybe ;)
      //The reason: the engine will try to delete something that don't exist.



    `);

    for (let index = 0; index < this.#decisions.length; index++) {
      const decisionData = this.#decisions[index];
      if(decisionData.condition){
        if(!decisionData.condition(engine)){
          continue;
        }
      }
      res.push(`
        option${id+index} = new GraphObject({
          enabled:true,
          parent: "decideator${id}",
          widthScale: decisionsRef${id}.widthScale,
          text:${decisionData.label}
        })

        option${id+index}Trigger = new Trigger("option${id+index}",{
          onRelease:(engine)=>{
            engine.callThisShitWhenDecisionEnds(engine,${decisionData});
          }
        })
      `);
    }

  }

  end(engine:RenderEngine,decisionData:Decision = null){
    if(decisionData){
      this.#out = decisionData.out;
      this.#nextNode = decisionData.nextNode;
      
    }
    if(this.#actor){
      this.#actor.removeFocus();
    }
    if(this.#out){
      engine.routines.push(this.#out);
    }
    
  }

}