import { Dictionary } from "../../global.ts";
import { getAttribs } from "../logic/Misc.ts";
import Proxificator from "./EventProxy.ts";

type RenElement = {
  enabled:boolean,
  id:string,
  relatedTo:string,
  [key: string]: any
};
type UnrelatedRenElement = {
  enabled?:boolean,
  id:string,
  updateEnabled?:(id:string,enabled:boolean)=>void;
  [key: string]: any
};

class Dummy {
  type: string;
  keys: Array<string>;
  hasId: boolean;
  hasEnabled: boolean; //TODO: Check this
  hasRelatedTo: boolean;
  constructor(){
    this.type = '';
    this.keys = ["id"];
    this.hasId = true;
    this.hasEnabled = false; //TODO: Check this
    this.hasRelatedTo = false;
  }
}

class RenList <T extends RenElement|UnrelatedRenElement>{
  private dummy = new Dummy();
  objects:Array<T>;
  #_ids:Array<string> = [];
  #_enabledIds:Array<string> = [];
  #_relatedToIds: Dictionary<string> = {};
  #_reversedRelatedToLists: Dictionary<Array<string>> = {};
  #_unRelatedToIds: Array<string> = []; //*For elements with relatedTo field but aren't related to anything

  constructor() {
    this.objects = new Array<T>();
  }

  get length(){
    if(this.objects.length > 0){
      if(this.dummy.hasId){
        if(this.dummy.hasEnabled){
          return this.#_enabledIds.length;
        }
      }
    }
    return 0;
  }

  private setDummyInformation(element: T){
    const className = element.__proto__.constructor.name;

    this.dummy.type =  className;
    this.dummy.keys =  getAttribs(element);
    this.dummy.hasId = getAttribs(element).includes("id");
    this.dummy.hasEnabled = getAttribs(element).includes("enabled");
    this.dummy.hasRelatedTo = getAttribs(element).includes("relatedTo");
  }

  push(element:T){
    if(this.exist(element.id)){
      console.warn(`Element with ${element.id} id already exists`);
      return;
    }
    if(this.objects.length == 0){
      if(this.dummy.type == ""){
        this.setDummyInformation(element);
      }
    }

    if(this.dummy.hasEnabled){
      if(this.dummy.hasId){
        element.updateEnabled = (id:string,enabled:boolean) =>{
          if(enabled && !this.#_enabledIds.includes(id)){
            this.#_enabledIds.push(id);
          }else if(!enabled && this.#_enabledIds.includes(id)){
            this.#_enabledIds.splice(this.#_enabledIds.indexOf(id))
          }
        }
      }
    }

    if(this.dummy.hasRelatedTo){
      if(!element.relatedTo){
        this.#_unRelatedToIds.push(element.id);
      }else{
        this.#_relatedToIds[element.id] = element.relatedTo; 
        if(element.relatedTo in this.#_reversedRelatedToLists){
          this.#_reversedRelatedToLists[element.relatedTo].push(element.id);
        }else{
          this.#_reversedRelatedToLists[element.relatedTo] = [element.id];
        }
      }

      // element = Proxificator.proxify(element,[
      //   (_,property,value)=>{
      //     if(property == "relatedTo"){
      //       this.#_relatedToIds[element.id] = value; 
      //       // if(value in this.#_relatedToIds[element.id]){
      //       //   this.#_relatedToIds[element.id].splice(this.#_enabledIds.indexOf(value));
      //       // }
      //     }
      //   }
      // ]);
    }

    this.#_ids.push(element.id);
    this.objects.push(element);
  }
  remove(objectId:string){
    const numId = this.#_ids.indexOf(objectId);
    if(numId != -1){
      this.objects.splice(numId,1);
      this.#_ids.splice(numId,1);
    }
  }
  get(objectId:string){
    const numId = this.#_ids.indexOf(objectId);
    if(numId != -1){
      return this.objects[numId];
    }else{
      throw new Error(objectId +" don't exists in this list");
    }
  }
  exist(objectId: string){
    return this.#_ids.includes(objectId);
  }
  ids(includeDisabled = false){
    if(!this.dummy.hasEnabled || includeDisabled){
      return this.objects.map(e => {return e.id;});
    }else{
      return this.#_enabledIds;
    }
    
  }
  relatedToList(){
    return this.#_relatedToIds;
  }
  enabledList(){
    return this.#_enabledIds.map(id => this.get(id))
  }

  relatedToReversedList(this: RenList<T>): Dictionary<Array<string>>{
    return this.#_reversedRelatedToLists;
  }
  /**
   * 
   * @returns {Array} List of objects that are not related to any other object
   */
  relatedToNullList(this: RenList<T>): Array<string>{
    return this.#_unRelatedToIds;
  }
}

export default RenList