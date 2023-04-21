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
    this.target = React.createRef();
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
      // console.log(res);
    }else{
      this.props.characters.forEach(character => {
        res.push(
          structuredClone(Object.assign(
            {backgroundImage:"url('"+(character != null?gameFiles[character.imagen]:'a')+"')"},
            character != null?character.estiloInicial:{}
            ))
        );
      });
      // console.log(res);
    }

    return(res);
  }
  componentDidUpdate(){
    if(!this.props.triggerFadeOutAnimations && this.state.triggerFadeOutAnimations){
      this.setState({triggerFadeOutAnimations:false,characters:this.props.characters,styleElements:this.stylesBuilder()},()=>{
        window.setTimeout(()=>{
          this.target.current.childNodes.forEach((charDraw,index) => {
            if(this.state.characters[index].fadeIn != undefined){
            gsap.to(charDraw,this.state.characters[index].fadeIn.duration,this.state.characters[index].fadeIn);
            }
          });
        },0.5);
      });
    }else if(this.props.triggerFadeOutAnimations && !this.state.triggerFadeOutAnimations){
      this.setState({triggerFadeOutAnimations:true,characters:this.props.characters,styleElements:this.stylesBuilder()},()=>{
        window.setTimeout(()=>{
          this.target.current.childNodes.forEach((charDraw,index) => {
            if(this.state.characters[index].fadeOut != undefined){
            gsap.to(charDraw,this.state.characters[index].fadeOut.duration,this.state.characters[index].fadeOut);
            }
          });
        },0.5);
      });
    }
  }
  drawCharacters() {
    return (
      this.state.characters.map((character,index) => (
        <div className="absolute pointer-events-none"
          style={Array.isArray(this.state.styleElements)?this.state.styleElements[index]:{}}
        />
      )));
  }
  render() {
    if(this.props.capaSuperior == undefined){
      return (
        <div className='w-7/10 mx-auto my-4 text-white pointer-events-none' ref={this.target}>
          {this.drawCharacters()}
        </div>
      )
    }else{
      return (
        <div className='top-0 absolute h-full w-full overflow-hidden pointer-events-none' ref={this.target}>
          {this.drawCharacters()}
        </div>
      )
    }
    
  }
}
export { Characters }