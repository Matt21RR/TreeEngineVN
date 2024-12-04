import React  from "react";
import { Button1, InputList, InputText, InputTextArea } from "./components/Buttons";
//Poder ver y editar los shorcuts del motor
//La visualizacion va a parte de la edición
class Shorcut extends React.Component{
  constructor(props){
    super(props);
    if(!("data" in this.props)){
      window.alert("Comprobar propiedades del shorcut: data");
      return;
    }
    const data = this.props.data;
    this.state = {
      edit: false,
      keys: "keys" in data ? data.keys : [],
      type: "type" in data ? data.type : "undefined",
      code: "code" in data ? data.code : ""
    }
  }
  key(key){
    return(
      <div className="bg-black text-center align-middle min-w-8 w-fit h-8 text-white p-2 rounded-md italic text-base">
        {key}
      </div>
    )
  }
  actionType(type="undefined"){
    const possibleActions = ["onPress","onHold","onRelease"];
    return(
      <div className="w-fit h-full items-center flex">
        <span className="px-2">type:</span>
        <InputList 
          contStyle="w-[160px]"
          eStyle="grow"
          options={possibleActions}
          selected={possibleActions.indexOf(type)}
        />
      </div>
    )
  }
  viewer(
    keys=this.state.keys,
    type=this.state.type,
    code=this.state.code){
    return(
      <div className="min-h-12 h-fit w-full bg-gray-400 flex content-center gap-3 items-center px-2 rounded-sm">
        {keys.map((key,idx)=>{return <> {(idx > 0 ? "+" : "")}{(this.key(key))}  </>})}
        <div className="w-fit h-full border-x-2 border-white items-center flex px-2">
          {type}
        </div>
        <Button1 text="Edit" action={()=>this.setState({edit:true})}/>
      </div>
    );
  }
  editor(
    keys=this.state.keys,
    type=this.state.type,
    code=this.state.code
  ){
    return (
      <div className="min-h-12 h-fit w-full bg-gray-400 content-center gap-3 items-center px-2 rounded-sm">
        <InputText value={keys} />
        <span className="italic px-2">Hint: Use comma for key chains</span>
        <hr />
        {this.actionType(type)}
        <hr />
        <InputTextArea value={keys} />
        <hr />
        <div className="flex w-fit h-fit gap-2 p-1 ml-auto">
          <Button1 text="Cancel" action={()=>this.setState({edit:false})}/>
          <Button1 text="Save" action={()=>this.setState({edit:false})}/>
        </div>
      </div>
    )
  }
  render(){
    if(this.state.edit){
      return this.editor()
    }else{
      return this.viewer()
    }
  }
}
class EditorKeys extends React.Component{
  constructor(props){
    super(props);
    
  }
  render(){
    return(
      <div className="p-4">
        <Shorcut data={{
          keys:["Ctrl","Shift","P"]
          }}/>
      </div>
    )
  }
}

export {EditorKeys,Shorcut}