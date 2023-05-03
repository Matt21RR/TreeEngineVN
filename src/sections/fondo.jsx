import gsap from "gsap";
import React from "react";
import { gameFiles } from "../res/gameRes/files";
class Fondo extends React.Component{
  constructor(props){
    super(props);
    this.state = ({
      fondo:this.props.fondo,
      triggerFadeOutAnimations:true,
      styleElements:new Object(),
    });
    this.target = React.createRef();
  }
  componentDidMount(){
    this.setState({fondo:this.props.fondo});
  }
  styleBuilder(){
    return (
      structuredClone(Object.assign(
        {backgroundImage:"url('"+(this.state.fondo != null?gameFiles[this.state.fondo.imagen]:'a')+"')"},
      this.state.fondo != null?this.state.fondo.estiloInicial:{}
        )
    ));
  }
  componentDidUpdate(){
      if(!this.props.triggerFadeOutAnimations && this.state.triggerFadeOutAnimations){
        this.setState({triggerFadeOutAnimations:false,fondo:this.props.fondo,styleElements:this.styleBuilder()},()=>{
          if(this.state.fondo.fadeIn != undefined){
            window.setTimeout(()=>{
              if(this.props.triggerNextPhase != undefined){
                this.props.triggerNextPhase();
              }
              gsap.to(this.target.current,this.state.fondo.fadeIn.duration,Object.assign(this.state.fondo.fadeIn,{onComplete:
                ()=>{

                }}));
            },0.5);
          }else if(this.props.triggerNextPhase != undefined){
            this.props.triggerNextPhase();
          }
        });
      }else if(this.props.triggerFadeOutAnimations && !this.state.triggerFadeOutAnimations){
        this.setState({triggerFadeOutAnimations:true,fondo:this.props.fondo,styleElements:this.styleBuilder()},()=>{
          if(this.state.fondo.fadeOut != undefined){
          window.setTimeout(()=>{
            gsap.to(this.target.current,this.state.fondo.fadeOut.duration,this.state.fondo.fadeOut);
          },0.5);
        }
      });
    }

  }
  render(){
    return(
      <div
       className={"absolute top-0 left-0 w-full h-full pointer-events-none fondo"} ref={this.target}
        style={
          this.state.styleElements
      }
      >

      </div>
    );
  }
}
export {Fondo}