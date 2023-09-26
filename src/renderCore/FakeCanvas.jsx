import React from "react";

class FakeCanvas extends React.Component{
  constructor(props){
    super(props);
    this.element = React.createRef();
    this.resolution = {
      width:this.props.width,
      height:this.props.height,
    }
    this.state = {
      divsList : new Array(),
    }
  }
  componentDidUpdate(){
    if(this.state.divsList != this.props.divsList){
      this.setState({
        divsList: this.props.divsList,
      })
    }
  }
  renderDivs(){
    return(
      this.state.divsList.map((gObject)=>(
        <div
          style={{
            position:"absolute",
            width:(gObject.scale*gObject.scaleWidth*100) + "%",
            height:(gObject.scale*gObject.scaleHeight*100) + "%",
            filter:gObject.filterString
          }}
        >

        </div>
      ))
    )
  }
  render(){
    return(
      <div ref={this.element}>
        {this.renderDivs}
      </div>
    )
  }
}