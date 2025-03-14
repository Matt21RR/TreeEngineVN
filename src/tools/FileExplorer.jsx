import React from 'react';
import $ from "jquery";
import { Button1, IconButton, InputTextArea, MenuButton } from './components/Buttons';
import Swal from 'sweetalert2';
import { Loading } from './components/alerts';
import byteSize from 'byte-size';
import { AudioPlayer } from './AudioPlayer';
import { Chaos } from '../engine/renderCore/ChaosInterpreter.ts';


class Multimedia extends React.Component{
  constructor(props){
    super(props);
    this.textSrc = "";
    this.activateSwitch = true;
    this.textContent = "";
    this.editorId = "multimediaTextEditor" + String(window.performance.now()).replaceAll(".","");
    this.mounted = false;
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      var mime = this.props.info.mime.split("/")[0];
      const src = this.props.info.src;
      mime = src.split(".").at(-1) == "json" ? "text" : mime;
      if(mime == "text"){
        fetch(src, {cache: "no-store"}).then(text=>{return text.text()}).then(res=>{
          const translator = new Chaos();
          translator.kreator(res);
          this.textContent = res;
          this.forceUpdate();
        });
      }

    }
  }
  updateTextContent(content){
    const route = this.props.info.route;
    console.warn(route);
    $.post(window.backendRoute + "/renderEngineBackend/index.php", {route: route, action: "update", content: content})
    .then((response) => {
      Swal.fire("Guardado", "", "success");
      return JSON.parse(response);
    });
  }
  text(src){
    const name = this.props.info.name;
    return(
      <>
        <InputTextArea 
          height={"h-full"} 
          // "w-full h-full resize-none outline-none align-top border-none bg-transparent p-2"
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
        <AudioPlayer src={src}></AudioPlayer>
      </div>
    );
  }
  video(src){
    return(
      <video src={src} controls={true} className='h-full mx-auto my-auto'></video>
    );
  }
  img(src){
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
  switcher(mime,src){
    if(this.props.show && this.activateSwitch==true){
      var type = mime.split("/")[0];
      type = src.split(".").at(-1) == "json" ? "text" : type;
      switch (type) {
        case "text":
          return (this.text(src));
        case "audio":
          return (this.audio(src));
        case "video":
          return (this.video(src));
        case "image":
          return (this.img(src));
      }
    }else{
      return(<></>)
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
    const mime = this.props.info.mime;
    const name = this.props.info.name;
    const src = this.props.info.src;
    const index = this.props.info.index;
    const actualContentLength = this.props.info.actualContentLength;
    return (
      <div className={"absolute bg-black bg-opacity-40 top-0 left-0 h-full w-full backdrop-blur-md flex" + ((!this.props.show) ? " hidden":"")}>
        {this.switcher(mime,src)}
        <div className='absolute top-0 px-2 text-xs py-1 backdrop-contrast-[.55] backdrop-blur-md -translate-x-1/2 left-1/2'>

          {name}
        </div>
        {this.closeBtn(index,actualContentLength-1)}
      </div>
    );
  }
}
class FileExplorer extends React.Component{
  constructor(props){
    super(props);
    this.mediaTypes={
      text:[".txt"],
      
    };
    this.gameContent=[];
    this.fileIndexList=[];
    this.fileIndexReverse={};
    this.numericalRoute = [];
    this.actualRoute = "./";
    this.actualContent = [];
    this.contextMenuData = {x:0,y:0,show:false,info:{}};
    this.mounted = false;
    this.selected = {name:"",route:"",mime:"",src:"",show:false,index:0,actualContentLength:0};
    this.uploadProgress = {percentage:100,inStack:0};
    this.id = "FileExplorer" + String(window.performance.now()).replaceAll(".","");
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      this.getHierarchy();
    }
  }
  getHierarchy(){
    $.post(window.backendRoute + "/renderEngineBackend/index.php", {action: "getHierarchy"})
    .then((response) => {
      return JSON.parse(response);})
    .then(res =>{
      this.gameContent = [res];
      this.setActualContent();
      this.forceUpdate();
    });
  }
  /**
   * 
   * @param {React.DragEvent} e
   * @returns 
   */
  upload(e){
    if(this.actualRoute == "./"){
      Swal.fire("Don't upload on root","","error");
    }

    const self = this;
    const uploadRequests = [];
    const uploader = ()=>{$.ajax({
        url : 'http://localhost/renderEngineBackend/index.php',
        type : 'POST',
        data : uploadRequests[0],
        processData: false,  // tell jQuery not to process the data
        contentType: false,  // tell jQuery not to set contentType
        xhr: function () {
          var xhr = new window.XMLHttpRequest();
          xhr.upload.addEventListener("progress",
              (e)=>{
                self.uploadProgress = {
                  percentage:((e.loaded/e.total)*100),
                  inStack:uploadRequests.length
                }; 
                self.forceUpdate();
                },
              false
          );
          return xhr;
      }
      })
      .then((res) => {
        uploadRequests.shift();
        console.log(res);
        if(uploadRequests.length > 0){
          uploader();
        }
        if(!res){
          Swal.fire("Error","Check input data","error");
        }
        this.getHierarchy();
      });
    }

    if (e.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      [...e.dataTransfer.items].forEach((item, i) => {
        // If dropped items aren't files, reject them
        if (item.webkitGetAsEntry().isFile) {
          let file;
          var formData = new FormData();
          

          file = item.getAsFile();
          formData.append('file', file);
          formData.append('dir', self.actualRoute);
          formData.append('action', 'upload');
          uploadRequests.push(formData);                 
        }else{
          Swal.fire("Only files","Folders aren't supported ('<b>"+item.webkitGetAsEntry().name+"</b>' was rejected for upload)","error");
        }
      });
    }
    if(uploadRequests.length > 0){
      uploader();
    }
  }
  rename(route,newName){
    var spl = route.split("/");
    spl.pop();
    const newRoute = spl.join("/") + "/" + newName;
    $.post(window.backendRoute + "/renderEngineBackend/index.php", {action: "rename", oldRoute:route, newRoute:newRoute})
    .then(() => {
      this.getHierarchy();
    });
  }
  delete(dir,type){
    $.post(window.backendRoute + "/renderEngineBackend/index.php", {action: "delete", dir:dir, type:type})
    .then((res) => {
      console.log(res);
      if(!res){
        Swal.fire("Error","Check input data","error");
      }
      this.getHierarchy();
    });
  }
  createFile(dir,filename){
    $.post(window.backendRoute + "/renderEngineBackend/index.php", {action: "createFile", dir:dir, filename:filename})
    .then((res) => {
      if(!res){
        Swal.fire("Error","Check input data","error");
      }
      this.getHierarchy();
    });
  }
  createDir(dir,folderName){
    $.post(window.backendRoute + "/renderEngineBackend/index.php", {action: "createDir", dir:dir, folderName:folderName})
    .then((res) => {
      if(!res){
        Swal.fire("Error","Check input data","error");
      }
      this.getHierarchy();
    });
  }
  setActualContent(){
    var res = this.gameContent;
    this.actualRoute = "./";
    for (let index = 0; index < this.numericalRoute.length; index++) {
      this.actualRoute = res[this.numericalRoute[index]].route;
      res = res[this.numericalRoute[index]].content;
    }
    this.actualContent = res;
    this.fileIndexList = [];
    this.fileIndexReverse = {};
    this.actualContent.filter(e=>{return e.type=="file"}).forEach((file,index)=>{
      this.fileIndexList.push(file.index);
      Object.assign(this.fileIndexReverse,{[file.index]:index});
    })
    this.forceUpdate();
  }
  upperControls(){
    return (
      <div className='flex flex-row'>
        <Button1 text="Reload" action={()=>{this.getHierarchy()}}/>
        <div className='mx-2 my-auto flex flex-row'>
          <div className='text-bold my-1 ml-2 mr-4 cursor-pointer' onClick={()=>{this.numericalRoute.pop();this.setActualContent();}}>{"<"}</div>
          <div className='border-2 border-gray-200 my-auto'>
            {this.actualRoute}
          </div>
        </div>
      </div>
    );
  }
  rightControls(){
    if(this.numericalRoute.length>0){
      const nDirs = this.actualContent.filter(e => {return e.type == "dir"}).length;
      const nFiles = this.actualContent.length - nDirs;
      return (
        <div className='w-64 h-full border-l-[1px] pl-3 ml-3'>
          {this.actualRoute.split("/").at(-1)}
          <div className='text-xs'>
            Content: {nDirs} folders, {nFiles} files
          </div>
          <MenuButton 
            text={"Create file"}
            action={()=>{
              Swal.fire({
                text: "File name: ",
                showDenyButton: false,
                showConfirmButton: true,
                confirmButtonColor:"green",
                showCancelButton: true,
                confirmButtonText: "Create",
                cancelButtonText: "Cancelar",
                input:"text"
              }).then((result) => {
                if (result.isConfirmed && result.value != "") {
                  this.createFile(this.actualRoute,result.value);
                }
              });
            }}/>
          <MenuButton 
            text={"Create dir"}
            action={()=>{
              Swal.fire({
                text: "Dir name: ",
                showDenyButton: false,
                showConfirmButton: true,
                confirmButtonColor:"green",
                showCancelButton: true,
                confirmButtonText: "Create",
                cancelButtonText: "Cancelar",
                input:"text"
              }).then((result) => {
                if (result.isConfirmed && result.value != "") {
                  this.createDir(this.actualRoute,result.value);
                }
              });
            }}/>
          <MenuButton 
            text={"Deep indexate dir"}
            action={()=>{
              $.post(window.backendRoute + "/RenderEngineBackend/index.php",{action:"indexate",dir:this.actualRoute}).then(()=>{Swal.fire("Dir indexated!!","","success")});
            }}/>
        </div>
      )
    }
  }
  setSelected(index){
    const info = this.actualContent[index];
    const src = info.route.replace("./",window.backendRoute + "/renderEngineBackend/");
    this.selected = {name:info.name,route:info.route,mime:info.mime,src:src,show:true,index:this.fileIndexReverse[index],actualContentLength:this.fileIndexList.length};
    this.forceUpdate();
  }
  contextMenu(){
    if(this.contextMenuData.show){
      const info = this.contextMenuData.info;
      return(
        <div className='h-full w-full absolute' onClick={()=>{this.contextMenuData.show = false; this.forceUpdate();}}>
          <div 
            className='absolute bg-black bg-opacity-75 border-[1px] p-1' 
            style={{height:"auto",width:"250px",left:this.contextMenuData.x+"px",top:this.contextMenuData.y+"px"}}>
            {/* <MenuButton 
              hide={info.type == "dir"}
              text={"Open"}
              action={()=>{
                
              }}
              /> */}
            <MenuButton 
              text={"Rename"} 
              action={()=>{
                Swal.fire({
                  text: "new name: ",
                  showDenyButton: false,
                  showConfirmButton: true,
                  confirmButtonColor:"green",
                  showCancelButton: true,
                  confirmButtonText: "Rename",
                  cancelButtonText: "Cancelar",
                  input:"text"
                }).then((result) => {
                  if (result.isConfirmed && result.value != "") {
                    this.rename(info.route,result.value)
                  }
                });
              }}/>
            <MenuButton text={"Copy"}/>
            <MenuButton text={"Cut"}/>
            <MenuButton text={"Delete"}
            action={()=>{
              Swal.fire({
                text: 'Are you sure you want to delete "'+info.name+'"?',
                showDenyButton: false,
                showConfirmButton: true,
                confirmButtonColor:"red",
                showCancelButton: true,
                confirmButtonText: "Yes, delete it!",
                cancelButtonText: "Cancel",
              }).then((result) => {
                if (result.isConfirmed) {
                  this.delete(info.route,info.type);
                }
              });
            }}/>
          </div>
        </div>
      );
    }
  }
  res(resInfo,index){
    const openContextMenu = (e)=>{
      e.preventDefault();
      var offset = $("#"+this.id).offset();
      this.contextMenuData.x = e.clientX -=offset.left;
      this.contextMenuData.y = e.clientY-=offset.top;
      this.contextMenuData.show = true;
      this.contextMenuData.info = resInfo;
      this.forceUpdate();
    }
    if(resInfo.type == "dir"){
      return (
        <div 
          className='flex flex-row border-2 my-2 mr-3 h-9 cursor-pointer' 
          onContextMenu={(e)=>{
            openContextMenu(e);
          }}
          onClick={(e)=>{
            this.numericalRoute.push(index);this.setActualContent();
            }}>
          <IconButton icon="folder" style="flex-none h-6 w-6 m-1"/>
          <div className='mx-2 my-auto'>{resInfo.name}</div>
        </div>
      )
    }
    if(resInfo.type == "file"){
      return( 
        <div 
          className='flex flex-row border-2 my-2 mr-3 h-9 cursor-pointer'
          onClick={()=>{this.setSelected(resInfo.index);}}
          onContextMenu={(e)=>{
            openContextMenu(e);
          }}
          >
          <IconButton icon="file" style="flex-none h-6 w-6 m-1"/>
          <div className='mx-2 my-auto truncate'>{resInfo.name}</div>
          <div className='mx-2 my-auto grow'></div>
          <div className='mx-2 my-auto flex-none'>{byteSize(resInfo.size).toString()}</div>
        </div>
      );
    }
    return "Nah"
  }
  renderMultimedia(){
    if(this.selected.show){
      return(
        <Multimedia 
          setSelected={(indexFiles)=>{
              this.selected.show = false;
              this.forceUpdate(()=>{
                this.setSelected(this.fileIndexList[indexFiles]);
                this.selected.show = true;
                this.forceUpdate();
              });
              
          }} 
          info={this.selected} 
          show={this.selected.show} 
          close={()=>{this.selected.show = false; this.forceUpdate()}}/>
      );
    }
  }
  render(){
    return(
      <div 
        className='text-white m-2 h-full flex flex-col relative overflow-hidden' 
        id={this.id}
        onDragOver={(e)=>{e.preventDefault();}}
        onDrop={(e)=>{
          e.preventDefault();
          this.upload(e);
          }}>
        {this.upperControls()}
        <div className='w-full h-1 border-t-[1px] pt-1 mt-1'/>
        <div className='relative w-full overflow-hidden h-full'>
          <div className='flex flex-row grow h-full'>
            <div className='grow h-full overflow-y-auto ml-3'>
              {this.actualContent.map((el,index)=>{return this.res(el,index)})}
            </div>
            {this.rightControls()}
          </div>
        </div>
        {this.contextMenu()}
        <Loading hide={this.uploadProgress.percentage == 100 && this.uploadProgress.inStack <=1} text={"Uploading progress: "+this.uploadProgress.percentage.toFixed(2)+"%, left "+this.uploadProgress.inStack}/>
        {this.renderMultimedia()}
      </div>
    );
  }
}
export {FileExplorer}