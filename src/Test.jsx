import React from 'react';
import {qb} from "./engine/renderCore/threeRender"
import { Tools } from './engine/renderCore/Tools';

class Test extends React.Component {
  constructor(props){
    super(props);
    this.mounted = false;
    this.state = {
      threeRef : null
    };
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      let self = this;
      qb((response)=>{
        let [renderer,scene,camera,controls,keyboardOptions] = response;
        console.log(self);
        self.setState({
          threeRef:{
            renderer : renderer,
            scene : scene,
            camera : camera,
            controls : controls,
            keyboardOptions: keyboardOptions
          }
        })
      });
    }
  }
  render(){
    return(
      <>
        <div className="w-full h-full absolute" id="GUI">
          <Tools threeRef={this.state.threeRef}/>
        </div>
        <div className='w-full h-full absolute' id="display"/>
      </>
    );
  }
}
export {Test}