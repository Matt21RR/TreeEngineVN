class NodeGestor{
  static indexOfNodeFinder(script = new Array(),id = new String){
    var res = -1;
    for (let index = 0; index < script.length; index++) {
      
      if(script[index].id == id){
        res = index;
        break;
      }
    }
    return res;
  }
  static removeNode(script = new Array(),id = new String()){
    script.splice(this.indexOfNodeFinder(script,id),1);
  }
  static updateNode(script = new Array(),id = new String(), newInfo = newObject){
    
  }
}
export {NodeGestor}