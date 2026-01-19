import Token from "./Token.ts";

class Instruction extends Array<Token | Instruction>{
  get(index:number){
    this.at(index);
  }
  get index():number{
    if(this.length != 0){
      const lastElementInList:Token|Instruction = (this.at(-1) as Token|Instruction);
      if(lastElementInList.constructor === Instruction){
        return (lastElementInList as Instruction).index;
      }else{
        return (lastElementInList as Token).index;
      }
    }else{
      return 0;
    }
  }
}

export default Instruction;