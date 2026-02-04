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
  #_elementsDict:Dictionary<T> = {};  //Dictionary of references
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
      if(!this.dummy.type){ //this.dummy.type == ""
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
    }

    this.#_ids.push(element.id);
    this.#_elementsDict[element.id] = element;
    this.objects.push(element);
  }
  remove(objectId:string){
    let element: T;
    if(!(element = this.#_elementsDict[objectId])){
      //*Nothing to remove
    }else{
      const numId = this.#_ids.indexOf(objectId);
      let unRelatedId = this.#_unRelatedToIds.indexOf(objectId);
      if(unRelatedId != -1){
        this.#_unRelatedToIds.splice( unRelatedId,1 );
      }
      let enabledId = this.#_enabledIds.indexOf(objectId);
      if(enabledId != -1){
        this.#_enabledIds.splice( enabledId,1 );
      }

      this.objects.splice(numId,1);
      this.#_ids.splice(numId,1);
      delete this.#_elementsDict[objectId];
    }
  }
  get(objectId:string): T|null{
    let element: T;
    if(!(element = this.#_elementsDict[objectId])){
      // throw new Error(objectId +" don't exists in this list");
      return null;
    }else{
      return element;
    }
  }
  fastGet(objectId:string):T {
    return this.#_elementsDict[objectId];
  }
  exist(objectId: string){
    return !!(this.#_elementsDict[objectId]);
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