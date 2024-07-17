class RenList{
  constructor(){
    this.objects = new Array();
    this.enabled = new Object();
  }
  get length(){return this.objects.length;}
  push(GraphObject = new Object()){
    this.objects.push(GraphObject);
  }
  remove( objectId = new String()){
    const graphIds = this.objects.map(e=>e.id);

    if(graphIds.indexOf(objectId) != -1)
    this.objects.splice(graphIds.indexOf(objectId),1);
  }
  get(objectId = new String()){
    const graphIds = this.objects.map(e=>e.id);
    if(graphIds.indexOf(objectId) != -1)
      if(Object.keys(this.objects[graphIds.indexOf(objectId)]).indexOf("get") != -1){
        return this.objects[graphIds.indexOf(objectId)].get();
      }else{
        return this.objects[graphIds.indexOf(objectId)];
      }
  }
  /**
   * Verify if exists a object with the provided id
   * @param {*} objectId 
   * @returns 
   */
  exist(objectId =  new String()){
    const graphIds = this.objects.map(e=>e.id);
    return graphIds.indexOf(objectId) != -1;
  }
  ids(){
    return this.objects.map(e => {return e.id;});
  }
  relatedToList(){
    return this.objects.map(e => {return {[e.id]:e.relatedTo};});
  }
  relatedToReversedList(){
    var list = {};
    this.objects.forEach(element => {
      if(element.relatedTo in list){
        list[element.relatedTo].push(element.id);
      }else{
        Object.assign(list,{[element.relatedTo]:[element.id]});
      }
    });
    return list;
  }
  enable(objectId = new String(),bool = new Boolean()){
    if(objectId in this.enabled){
      this.enabled[objectId] = bool;
    }else{
      Object.assign(this.enabled,{[objectId]:bool});
    }
  }
  enabledList(){
    var res = Object.assign({},this.enabled);
    this.ids().forEach(id => {
      if(!(id in res)){
        Object.assign(res,{[id]:false})
      }
    });
    return res;
  }
}

export {RenList}