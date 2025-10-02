import React from 'react';
import $ from "jquery";
import InputTextArea from "./components/inputs/InputTextArea.tsx";
import AudioPlayer from './AudioPlayer';
import { Button1, IconButton } from './components/Buttons.jsx';
import Swal from 'sweetalert2';

class Multimedia extends React.Component{
  constructor(props){
    super(props);
    this.textSrc = "";
    this.activateSwitch = true;
    this.textContent = "";
    this.editorId = "multimediaTextEditor" + String(window.performance.now()).replaceAll(".","");
    this.mime = "";
    this.mounted = false;
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      const src = this.props.info.src;
      const mime = this.mime = src.split(".").at(-1) == "json" ? "text" : this.props.info.mime;
      if(mime == "text"){
        fetch(src, {cache: "no-store"}).then(text=>{return text.text()}).then(res=>{
          this.textContent = res;
          this.forceUpdate();
        });
      }else{
        this.forceUpdate();
      }
    }
  }
  updateTextContent(content){
    const route = this.props.info.route;
    $.post(window.backendRoute + "/renderEngineBackend/index.php", {route: route, action: "update", content: content})
    .then((response) => {
      Swal.fire("Guardado", "", "success");
      this.textContent = content;
      return JSON.parse(response);
    });
  }
  text(){
    const name = this.props.info.name;
    return(
      <>
        <InputTextArea 
          height={"h-full"} 
          fatherStyle={"bg-black bg-opacity-70"}
          defaultValue={this.textContent}
          id={this.editorId}
          onControl={{Enter:(e)=>{e.preventDefault(e);this.runScript();}}}
          />
        <Button1 
          text="Save changes" 
          style="absolute bottom-2 right-2"
          action={()=>{
            Swal.fire({
              text: 'Are you sure want to save the changes done to "'+name+'"?',
              showDenyButton: false,
              showConfirmButton: true,
              confirmButtonColor:"green",
              showCancelButton: true,
              confirmButtonText: "Yes",
              cancelButtonText: "Cancel",
            }).then((result) => {
              if (result.isConfirmed) {
                const text = $("#"+this.editorId).val();
                this.updateTextContent(text);
              }
            });
          }}/>
      </>
    );
  }
  audio(src){
    return(
      <div className='mx-auto my-auto w-[30rem]'>
        <AudioPlayer src={src} />
      </div>
    );
  }
  video(src){
    return(
      <video src={src} controls={true} className='h-full mx-auto my-auto'/>
    );
  }
  image(src){
    return(
      <div className='absolute top-0 left-0 h-full w-full' 
        style={{
          backgroundImage: "url('" + src + "')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "contain"
        }}
      />
    );
  }
  switcher(src){
    if(this.props.show && this.mime != "" && this.mime != "application" && this.activateSwitch==true){
      return (this[this.mime](src));
    }
  }
  closeBtn(index,limit){
    return(
      <>
        <IconButton icon="cross" style="absolute top-0 right-0 h-7 w-7 m-1 p-1 backdrop-invert" action={()=>{this.props.close();}}/>
        <IconButton 
          icon="arrow" 
          hide={index<1} 
          style="absolute top-1/2 left-0 h-7 w-7 m-1 p-1 backdrop-invert" 
          action={()=>{
            this.activateSwitch=false;
            this.forceUpdate(
              ()=>{
                this.props.setSelected(index-1);
                this.activateSwitch=true;
                this.forceUpdate();
              }
            );}}/>
        <IconButton 
          icon="arrow" 
          hide={index>=(limit)}
          style="absolute top-1/2 right-0 h-7 w-7 m-1 p-1 backdrop-invert rotate-180" 
          action={()=>{
            this.activateSwitch=false;
            this.forceUpdate(
              ()=>{
                this.props.setSelected(index+1);
                this.activateSwitch=true;
                this.forceUpdate();
              }
            );}}/>
      </>
    );
  }
  render(){
    const name = this.props.info.name;
    const src = this.props.info.src;
    const index = this.props.info.index;
    const actualContentLength = this.props.info.actualContentLength;
    return (
      <div className={"absolute bg-black bg-opacity-40 top-0 left-0 h-full w-full backdrop-blur-md flex" + ((!this.props.show) ? " hidden":"")}>
        {this.switcher(src)}
        <div className='absolute top-0 px-2 text-xs py-1 backdrop-contrast-[.55] backdrop-blur-md -translate-x-1/2 left-1/2'>
          {name}
        </div>
        {this.closeBtn(index,actualContentLength-1)}
      </div>
    );
  }
}
export {Multimedia}