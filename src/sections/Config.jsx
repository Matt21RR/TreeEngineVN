import React from "react";
import { MenuButton } from "../components/buttons";

class Config extends React.Component{
  constructor(props){
    super(props);
  }
  aspectRatioList() {
    const aspectRatios = [
      "Automatico",
      "1:1",
      "4:3",
      "3:2",
      "16:9",
      "1.85:1",
      "21:9",
      "2.39:1"
    ];
    return (
      aspectRatios.map((aRatio,index) => (
        <div>
          <input type="radio" value={index != 0 ? aRatio : "unset"} name="aspectRatioOp" />{aRatio}
        </div>
      ))

    );
  }
  aspectRatioOptions() {
    return (
      <div className=" mx-1">
        <div className="">
          Relacion de aspecto
        </div>
        <div className="flex ml-3 mt-2">
          <div className="w-fit" onChange={(e) => { this.props.aspectRatioCalc(e.target.value) }}>
            {this.aspectRatioList()}
          </div>
        </div>
      </div>
    );
  }
  render() {
    return (
      <div className='absolute top-0 left-0 w-full h-full pt-20 pb-12'>
        <div className='absolute top-0 h-16 w-full flex flex-col'>
          <div className='my-auto mx-6 text-white'>
            <MenuButton text="Volver" action={() => this.props.changeSection(0)} />
          </div>
          <div className='absolute right-8 my-auto text-white top-1/2 text-lg' style={{transform:"translate(0%,-50%)"}}>AJUSTES</div>
          
        </div>
        <div className='relative h-full text-white overflow-auto'>
          <div className='relative h-full w-7/10 mx-auto text-white'>
          <MenuButton text="Pantalla completa" action={() => document.body.requestFullscreen()} />
          <MenuButton text="Ventana" action={() => document.exitFullscreen()} />
          {this.aspectRatioOptions()}
          </div>
        </div>
      </div>

    );
  }
}
export {Config}