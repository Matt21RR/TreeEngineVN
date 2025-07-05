import { getAttribs } from "../logic/Misc.ts";

type RenElement = {
  enabled:boolean,
  id:string,
  relatedTo:string,
  [key: string]: any
};
type UnrelatedRenElement = {
  enabled?:boolean,
  id:string,
  [key: string]: any
};

class RenList <T extends RenElement|UnrelatedRenElement>{
  #dummy:{type:string, keys:string[],hasId:boolean, hasEnabled:boolean, hasRelatedTo:boolean}
  objects:Array<T>
  #_ids:Array<String>
  constructor() {
    this.#dummy = {
      type: '',
      keys: ["id"],
      hasId:true,
      hasEnabled:false, //TODO: Check this
      hasRelatedTo:false
    };
    this.objects = new Array<T>();
    this.#_ids = [];
  }
  get length(){
    if(this.objects.length > 0){
      if(this.#dummy.hasId){
        if(this.#dummy.hasEnabled){
          return this.objects.filter(e=>{return e.enabled}).length;
        }
      }
    }
    return this.objects.length;
  }
  push(element:T){
    if(this.exist(element.id)){
      console.warn(`Element with ${element.id} id already exists`);
      return;
    }
    if(this.objects.length == 0){
      if(this.#dummy.type == ""){
        const classRef = element.__proto__.constructor;
        this.#dummy = {
          type: classRef.name,
          keys: getAttribs(classRef),
          hasId:getAttribs(classRef).includes("id"),
          hasEnabled:getAttribs(classRef).includes("enabled"),
          hasRelatedTo:getAttribs(classRef).includes("relatedTo"),
        };
      }
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
    if(!this.#dummy.hasEnabled || includeDisabled){
      return this.objects.map(e => {return e.id;});
    }else{
      return this.objects.filter(e => {return e.enabled;}).map(e => {return e.id;});
    }
    
  }
  relatedToList(){
    return this.objects.map(e => {return {[e.id]:e.relatedTo};});
  }
  enabledList(){
    return this.objects.filter(e =>{return e.enabled;})
  }

  #verifyRelatedToInClass(this: RenList<T>){
    if(this.#dummy.hasRelatedTo){
      return;
    }
    throw new Error (`Class ${this.#dummy.type} don't have the "relatedTo" attribute`);
}

  relatedToReversedList(this: RenList<T>){
    var list:{[key:string]:Array<string>} = {};
    if(this.objects.length == 0){
      return list;
    }

    this.#verifyRelatedToInClass();

    this.objects.forEach(element => {
      if(element.relatedTo in list){
        list[element.relatedTo].push(element.id);
      }else{
        Object.assign(list,{[element.relatedTo]:[element.id]});
      }
    });
    return list;
  }
  /**
   * 
   * @returns {Array} List of objects that are not related to any other object
   */
  relatedToNullList(this: RenList<T>){
    var list:Array<string> = [];

    if(this.objects.length == 0){
      return list;
    }

    this.#verifyRelatedToInClass();

    this.objects.forEach(element => {
      if(!element.relatedTo){
        list.push(element.id);
      }
    });
    return list;
  }
}

export default RenList