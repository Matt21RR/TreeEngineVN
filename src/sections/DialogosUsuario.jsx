import React from "react";
class DialogosUsuario extends React.Component {
  costructor() {
    this.state = {
      actualDialog: 0,
      allowTriggerNextDialog: true
    }
    this.dialogs = this.props.dialogs;
    this.target = React.createRef();
  }
  addAStoryVar(index){
    if("variableDeHistoria" in this.dialogs[index]){
      if("valorVariableDeHistoria" in this.dialogs[index]){
        this.props.addAStoryVar(this.dialogs[index].variableDeHistoria,this.dialogs[index].valorVariableDeHistoria);
      }
    }
    this.props.triggerNextPhase(this.dialogs[index].nodoSiguiente);
  }
  dialogOptions() {
    return (
      this.dialogs.map((dialog,index) => (
        <div className='m-2 border-4 w-full relative'
          onClick={() => {this.props.addAStoryVar(index)}}
        >
          <div className='mx-4'>{dialog}</div>
        </div>
      )
      )
    );
  }
  render() {
    return (
      <div className='w-7/10 mx-auto my-4 text-white'>
        {this.dialogOptions()}
      </div>
    )
  }
}
export { DialogosUsuario }