import gsap from "gsap";
import React from "react";
import { charsFiles } from "../res/gameRes/characters/chars";
import { gameFiles } from "../res/gameRes/files";
class Characters extends React.Component {
  constructor(props) {
    super(props);
    this.state = ({
      characters:this.props.characters,
      triggerFadeOutAnimations:true,
      styleElements:new Object(),
    });
  }
  componentDidMount(){
    this.setState({characters:this.props.characters,styleElements:this.stylesBuilder()});
  }
  stylesBuilder(){
    let res = new Array();
    if(this.props.capaSuperior == undefined){
      this.props.characters.forEach(character => {
        res.push(
          structuredClone(Object.assign(
            {backgroundImage:"url('"+(character != null?charsFiles[character.charName][character.imagen]:'a')+"')"},
            {transform: "translate(-50%, -50%)"},
            character != null?character.estiloInicial:{}
            ))
        );
      });
    }else{
      this.props.characters.forEach(character => {
        res.push(
          structuredClone(Object.assign(
            {backgroundImage:"url('"+(character != null?gameFiles[character.imagen]:'a')+"')"},
            character != null?character.estiloInicial:{}
            ))
        );
      });
    }

    return(res);
  }
  componentDidUpdate(){
    if(!this.props.triggerFadeOutAnimations && this.state.triggerFadeOutAnimations){
      this.setState({triggerFadeOutAnimations:false,characters:this.props.characters,styleElements:this.stylesBuilder()},()=>{
        window.setTimeout(()=>{
          var elements = document.getElementsByClassName(this.props.capaSuperior != undefined ? "character" : "capaSuperior");
          for (let index = 0; index < elements.length; index++) {
            const charDraw = elements[index];
            if(this.state.characters[index].fadeIn != undefined){
              gsap.to(charDraw,this.state.characters[index].fadeIn.duration,this.state.characters[index].fadeIn);
            }
          }
        },0.5);
      });
    }else if(this.props.triggerFadeOutAnimations && !this.state.triggerFadeOutAnimations){
      this.setState({triggerFadeOutAnimations:true,characters:this.props.characters,styleElements:this.stylesBuilder()},()=>{
        window.setTimeout(()=>{
          var elements = document.getElementsByClassName(this.props.capaSuperior != undefined ? "character" : "capaSuperior");
          for (let index = 0; index < elements.length; index++) {
            const charDraw = elements[index];
            if(this.state.characters[index].fadeOut != undefined){
              gsap.to(charDraw,this.state.characters[index].fadeOut.duration,this.state.characters[index].fadeOut);
            }
          }
        },0.5);
      });
    }
  }
  drawCharacters() {
    return (
      this.state.characters.map((character,index) => (
        <div className="top-0 absolute h-full w-full overflow-hidden">
          <div className="relative h-full w-full">
            <div className={"absolute pointer-events-none "+(this.props.capaSuperior != undefined ? "character" : "capaSuperior")}
              style={Array.isArray(this.state.styleElements)?this.state.styleElements[index]:{}}
              layerzpos={"zPos" in character? character.zPos : null}
            />
          </div>
        </div>
      )));
  }
  render() {
      return (
        <>
          {this.drawCharacters()}
        </>
      )
  }
}
export { Characters }