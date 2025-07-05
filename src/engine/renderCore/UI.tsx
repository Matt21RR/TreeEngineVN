import React from "react";

class UI extends React.Component{
  base:React.RefObject<HTMLDivElement>;
  constructor(props){
    super(props)

    this.base = React.createRef();
  }
  componentDidMount(): void {
      
      this.forceUpdate();
  }
  el(){
    const h = this.base.current?.clientHeight; 
    return <div className="border-2 h-full mx-auto" style={{width:`${h}px`}}>

    </div>
  }
  render(){
    return <div ref={this.base} className="absolute w-full h-full top-0 left-0">
      {this.el()}

    </div>
  }
}
export default UI;