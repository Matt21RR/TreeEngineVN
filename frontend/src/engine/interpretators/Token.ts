export enum TokenType {
  lineBreak,
  text,
  operator,
  number,
  openBracket,
  closeBracket,
  separator,
  space,
  word,
  jsCode
} 

class Token{
  _value:any
  _type:TokenType
  _index:number
  _charIndex:number
  constructor(value:any,type:TokenType,index:number,charIndex?:number){
    this._value = value;
    this._type = type;
    this._index = index;
    this._charIndex = charIndex ?? -1;
  }
  get value(){return this._value;}
  set value(value){this._value = value;}
  //@ts-ignore
  get type() {return this._type;}
  set type(type){this._type = type;}
  get index(){return this._index;}
  set index(index){this._index = index;}
  get charIndex(){return this._charIndex;}
  set charIndex(charIndex){this._charIndex = charIndex;}
}

export default Token