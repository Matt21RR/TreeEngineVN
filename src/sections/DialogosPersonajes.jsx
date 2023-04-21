import React from "react";
import gsap from "gsap";
class DialogosPersonajes extends React.Component{
  constructor(props){
    super(props);
    this.state = {
      componentMounted:false,
      actualDialog:0,
      allowTriggerNextDialog:true
    }
    this.dialogs = this.props.dialogs;
    this.target = React.createRef();
  }
  componentDidMount(){
    this.setState({componentMounted:true});
  }
  goNextDialog(){
    const fadeOut = "fadeOut" in this.dialogs[this.state.actualDialog] ? this.dialogs[this.state.actualDialog].fadeOut : {duration:0};
    const showNextDialog = this.dialogs.length > (this.state.actualDialog+1);
    var fadeIn = undefined;
    if(showNextDialog){
      fadeIn = "fadeIn" in this.dialogs[this.state.actualDialog+1] ? this.dialogs[this.state.actualDialog+1].fadeIn : {duration:0}
    }
    
    //do the fadeOut animation
    this.setState(
      {allowTriggerNextDialog:false},
      ()=>{
        gsap.to(
          this.target.current,
          fadeOut.duration,
          Object.assign(
            fadeOut,
            {onComplete:()=>{
              if(showNextDialog){
                this.setState(
                  {actualDialog:this.state.actualDialog+1},
                  ()=>{
                    gsap.to(
                      this.target.current,
                      fadeIn.duration,
                      Object.assign(
                        fadeIn,
                        {
                          onComplete:()=>{
                            this.setState({
                              allowTriggerNextDialog:true
                            });
                          }
                        }
                      )
                    );
                  }
                );
              }else{
                if(this.props.triggerNextPhase != undefined){
                  this.props.triggerNextPhase();
                }
              }
            }}
          )
        );
      }
    );
  }
  render(){
    if(this.state.componentMounted){
      return(
        <div className="absolute bottom-0 w-8/10 left-1/10" ref={this.target}>
          <div className="relative w-full h-full p-4">
            <div className="absolute -top-2 -left-[1px] w-fit px-2 py-1 border-2 rounded-md border-white bg-sky-800">{this.dialogs[this.state.actualDialog].nombrePersonaje}</div>
            <div className="w-full p-4 border-2 rounded-md border-white bg-sky-500">{this.dialogs[this.state.actualDialog].texto}</div>
            <div className={"absolute bottom-3 right-2 cursor-pointer px-2 py-1 border-2 rounded-md border-white bg-sky-800"+(this.state.allowTriggerNextDialog?"":"hidden")} onClick={()=>{this.goNextDialog()}}>Siguiente</div>
          </div>
        </div>
      )
    }
    return(<></>)
  }
}
export {DialogosPersonajes}