import React from "react";
class PredefinedElementsViewer extends React.Component{
  constructor(){
    super(props);
    this.state = {
      predefinedEscenarioElements: this.props.predefinedEscenarioElements,
      predefinedCharacters: this.props.predefinedCharacters,
      showing:false
    }
  }
  componentDidUpdate(){
    if(this.props.showing && !this.state.showing){
      this.setState({showing:true,predefinedEscenarioElements:this.props.predefinedEscenarioElements,predefinedCharacters: this.props.predefinedCharacters},()=>{
        //fadeInAnimation
        gsap.to(this.target.current,0.5,{opacity:1});
      });
    }else if(!this.props.showing && this.state.showing){
      this.setState({showing:false},()=>{
        //fadeOutAnimation
        gsap.to(this.target.current,0.5,{opacity:0});
      });
    }
  }
  renderElementInfo(element = new Image(),elementName = new String()){
    const elementInfo ={
      name:elementName,
      width:element.naturalWidth,
      height:element.naturalHeight
    }
    return(
      <div>
        {"Nombre del Elemento: "+elementInfo.name}
        <br />
        {"Ancho: "+elementInfo.width}
        <br />
        {"Alto: "+elementInfo.height}
      </div>
    )
  }
  renderPredefinedEscenarioElements(){
    return(
      Object.keys(this.state.predefinedEscenarioElements).map((elementName)=>(
        <div>
          {this.renderElementInfo(this.state.predefinedEscenarioElements(elementName),elementName)}
        </div>
      ))
    )
  }
  renderPredefinedCharacters(){
    return(
      Object.keys(this.state.predefinedCharacters).map((characterName)=>(
        <div>

        </div>
      ))
    )
  }
  render(){
    return(
      <div className="absolute w-full h-full">

      </div>
    );
  }
}
export {PredefinedElementsViewer}