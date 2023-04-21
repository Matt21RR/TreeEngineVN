import React from "react";
class fondoPreview extends React.Component{
  constructor(props){
    super(props);
    this.state = {
      triggerFadeInAnimation: false,
      triggerFadeOutAnimation:false,
      triggerInEdition:false
    }
  }
  componentDidUpdate(){

  }
 
  styleBuilder(){
    var file;
    if(this.props.fondo.imagen in gameFiles || this.props.fondo.imagen in this.props.gameFiles){
      file = this.props.fondo.imagen in gameFiles ? gameFiles[this.props.fondo.imagen] : this.props.gameFiles[this.props.fondo.imagen];
      return (
        structuredClone(Object.assign(
          {
            backgroundImage:"url('"+(this.props.fondo != null?file:'')+"')"
          },
        this.props.fondo != null?this.props.fondo.estiloInicial:{}
          )
      ));
    }else{
      file = "linear-gradient(#e66465, #9198e5)";
      return (
        structuredClone(Object.assign(
          {
            backgroundImage:file
          },
        this.props.fondo != null?this.props.fondo.estiloInicial:{}
          )
      ));
    }
  }
  render(){
    return(
      
    );
  }
}