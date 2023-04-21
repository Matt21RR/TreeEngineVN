import gsap from "gsap";
import React from "react";
import { Button1 } from "../components/buttons";
class ImageViewer extends React.Component{
  constructor(props){
    super(props);
    this.state = {
      imageFile : null,
      showing: false,
    }
    this.componentRef = React.createRef();
  }
  quickCheckURL(string){
    var pattern = /^((http|https|data):)/;
    if(!pattern.test(string)){
      //console.log("bad url: "+string);
      return false;
    }else{
      return true;
    }
  }
  getURLInput(urlInput) {
    if(urlInput.value == ""){
      //!reset to the default url input text value
    }else{
      this.showImageURL(urlInput.value);//show image
    }
  }
  checkImageFile(fileInput){
    console.log(fileInput)
    var fileName = fileInput.name.trim().toLowerCase();
    var typeRegex = new RegExp("\.(png|jpe?g|gif|bmp|webp)$");
    if(!(typeRegex.test(fileName))){
      //!bad filetype
      console.error("bad filetype");
    }else{
      //*good - clear the url input and submit if auto
      this.showImageFile(fileInput); //display new image and activate search button
    }
  }
  showImageURL(url){
    if(!this.quickCheckURL(url)){
      //!invalid image
      console.error("Imagen Invalida");
    }else{
      //*loadTheImageUrlInPreview
      //***************************** */
      this.setState({imageFile:url});
    }
  }
  showImageFile(fileInput){
    var self = this;
    var fr = new FileReader();
    fr.onload = function(){
      var dataURL = fr.result;
      self.showImageURL(dataURL);
    }
    fr.readAsDataURL(fileInput);
  }
  componentDidMount(){
    var self = this;
    document.onpaste = function(event){
      event.preventDefault();
      var clipboardData = (event.clipboardData || event.originalEvent.clipboardData);
      if(typeof clipboardData.files[0] == 'undefined'){//I think this is for when the image are in base64 string
        self.getURLInput({value : clipboardData.getData('Text')});
      }else{
        self.checkImageFile(clipboardData.files[0]);
      }
    }
    document.ondragover = document.ondragenter = function(event) {
      event.preventDefault();
    };
    document.ondrop = function(event){
      event.preventDefault();
      if(typeof event.dataTransfer.files[0] == 'undefined'){//I think this is for when the image are in base64 string
        self.getURLInput({value : event.dataTransfer.getData("text/uri-list")});
      }else{
        console.warn(event.dataTransfer.files);
        self.checkImageFile(event.dataTransfer.files[0]);
      }
    }
  }
  componentWillUnmount(){
    document.onpaste = null;
    document.ondragover = null;
    document.ondrop = null;
  }
  componentDidUpdate(){
    if(this.props.showing && !this.state.showing){
      this.setState({showing:true},()=>{
        gsap.to(this.componentRef.current,0.3,{opacity:1});
      });
    }else if(!this.props.showing && this.state.showing){
      gsap.to(this.componentRef.current,0.3,{opacity:0});
    }
  }

  imageRender(){
    if(this.state.imageFile != null){
      return(
        <div 
        className="absolute w-9/10 h-8/10"
        style={{
          backgroundImage:"url('"+this.state.imageFile+"')",
          backgroundSize:"contain",
          backgroundRepeat:"no-repeat",
          backgroundPosition:"center",
          left:"5%",
          top:"5%"
        }}>

        </div>
      );
    }
  }
  render(){
    return(
      <div className={"top-0 left-0 absolute h-full w-full opacity-0" + (this.state.showing? "" : " pointer-events-none")} ref={this.componentRef}>
        <div className="absolute w-full h-full bg-black opacity-50"></div>
        <div
          className="absolute w-144 h-144 bg-black left-1/2 top-1/2"
          style={{transform: "translate(-50%,-50%)"}}
        >
          {this.imageRender()}
          <input 
            onChange={(e)=>{console.log(e.target.value)}}
            className="absolute bottom-12 left-1/2" 
            type="text" 
            style={{transform: "translate(-50%,0%)"}}
            />
          <div className="absolute bottom-2 left-2">
            <Button1 text="Cancelar" />
          </div>
          <div className="absolute bottom-2 left-1/2"
            style={{transform: "translate(-50%,0%)"}}>
            <Button1 text="Cambiar" />
          </div>
          <div className="absolute bottom-2 right-2">
            <Button1 text="Confirmar" />
          </div>
        </div>
      </div>
    );
  }
}
export {ImageViewer}