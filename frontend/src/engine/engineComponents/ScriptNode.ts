import { RenderEngine } from "../renderCore/RenderEngine.tsx"
import UI from "../renderCore/UI.tsx"

export type Decision = {
  label:string,
  condition?:((engine:RenderEngine)=>boolean)|null,
  out?:((engine:RenderEngine)=>void)|null
  nextNode?:string
}

export type ScriptNodeType = {
  out?:(engine:RenderEngine)=>void,
  say:string,
  nextNode?:string,
  decisions?:Array<Decision>,
}

class ScriptNode {
  #id:string
  #out:((engine: RenderEngine) => void) | null
  #say:string
  #nextNode:string|null
  #decisions:Array<Decision>|null

  constructor(data:ScriptNodeType){
    this.#out = data.out ?? null;
    this.#say = data.say;//In the interpretation phase, preserve the 'say' in text, unconverted information
    this.#decisions = data.decisions ?? null;
  }
  
  public get id() : string {
    return this.#id
  }
  public set id(x){
    this.#id = x;
  }

  start(engine:RenderEngine){
    if(this.#decisions){
      engine.callThisShitWhenDialogEnds = this.decide;
    }else{
      engine.callThisShitWhenDialogEnds = this.end;
    }
  }

  decide(){
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
  }
}

export default ScriptNode;