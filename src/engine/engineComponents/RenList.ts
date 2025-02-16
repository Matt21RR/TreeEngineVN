import { getAttribs } from "../logic/Misc.ts";

type RenElement = {
  enabled:boolean,
  id:string,
  /**
   * it's optional, but throws a waring/error if is defined as optional :)
   */
  relatedTo:string,
  [key: string]: any
};


class RenList <T extends RenElement | RenElement>{
  #dummy:{type:string, keys:string[]}
  objects:Array<T>
  #_ids:Array<String>
  constructor(classRef?: new () => T) {
    console.log(classRef);
    if (!classRef) {
      console.warn("Class constructor wasn't provided to create the RenList.");
      console.warn("Assuming objects with id will be stored");
      this.#dummy = {
        type: '',
        keys: ["id"]
      };
    } else {
      this.#dummy = {
        type: classRef.name,
        keys: getAttribs(classRef)
      };
    }
    this.objects = new Array<T>();
    this.#_ids = [];
  }
  get length(){
    if(this.objects.length > 0){
      if(this.#dummy.keys.includes("id")){
        if(this.#dummy.keys.includes("enabled")){
          return this.objects.filter(e=>{return e.enabled}).length;
        }
      }
    }
    return this.objects.length;
  }

  push(element:T){
    try {
      if("id" in element){
        if(this.exist(element.id)){
          console.warn("Element with "+ element.id + " id already exists");
          return;
        }
        this.#_ids.push(element.id);
      }
      this.objects.push(element);
    } catch (error) {
      console.log(element);
      debugger;
    }
  }

  remove(objectId = new String()){
    const numId = this.#_ids.indexOf(objectId);
    if(numId != -1){
      this.objects.splice(numId,1);
      this.#_ids.splice(numId,1);
    }
  }
  get(objectId = new String()){
    const numId = this.#_ids.indexOf(objectId);
    if(numId != -1){
      return this.objects[numId];
    }else{
      throw new Error(objectId +" don't exists in this list");
    }
  }
  /**
   * Verify if exists a object with the provided id
   * @param {*} objectId 
   * @returns 
   */
  exist(objectId: string){
    return this.#_ids.includes(objectId);
  }
  ids(includeDisabled = false){
    if(!this.#dummy.keys.includes("enabled") || includeDisabled){
      return this.objects.map(e => {return e.id;});
    }else{
      return this.objects.filter(e => {return e.enabled;}).map(e => {return e.id;});
    }
    
  }
  relatedToList(){
    return this.objects.map(e => {return {[e.id]:e.relatedTo};});
  }
  #verifyKeyInClass(key:string="relatedTo"){
    if(this.#dummy)
    if(!(this.#dummy.keys.includes(key))){
      throw new Error (`Class ${this.#dummy.type} don't have the "${key}" attribute`);
    }
  }
  relatedToReversedList(){
    var list:{[key:string]:Array<string>} = {};
    if(this.objects.length == 0){
      return list;
    }

    this.#verifyKeyInClass();

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
  relatedToNullList(){
    var list:Array<string> = [];

    if(this.objects.length == 0){
      return list;
    }
    this.#verifyKeyInClass();

    this.objects.forEach(element => {
      if(element.relatedTo == null){
        list.push(element.id);
      }
    });
    return list;
  }
}

export default RenList