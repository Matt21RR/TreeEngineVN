import React from 'react';
import $ from "jquery";
import { Button1, IconButton, MenuButton } from './components/Buttons.jsx';
import Swal from 'sweetalert2';
import { Loading } from './components/alerts.jsx';
import byteSize from 'byte-size';
import { Multimedia } from './Multimedia.jsx';
import download from 'downloadjs';

type DirData = {
  index:number,
  name:string,
  type:string,
  route:string,
  content:Array<DirData|FileData>
}
type FileData = {
  index:number,
  name:string,
  type:string,
  mime:string,
  size:number,
  route:string,
}
type SelectedFileProperties = {
  index:number,
  name:string,
  route:string,
  mime:string,
  src:string,
  show:boolean,
  actualContentLength:number
}

class FileExplorer extends React.Component{
  gameContent
  fileIndexList
  fileIndexReverse
  numericalRoute: Array<number>
  actualRoute: string;
  actualContent
  contextMenuData
  mounted: boolean;
  selected: SelectedFileProperties;
  uploadProgress: {percentage:number, inStack:number}
  id: string;
  constructor(props){
    super(props);
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
  backendRequest(data){
    return new Promise((resolve,reject)=>{
      $.post(window.backendRoute + "/renderEngineBackend/index.php", data)
      .then((res) => {
        if(!res){
          Swal.fire("Error","Check input data","error");
          reject(res);
          return;
        }
        this.getHierarchy();
        resolve(res);
      });
    })

  }
  getHierarchy(){
    $.post(window.backendRoute + "/renderEngineBackend/index.php", {action: "getHierarchy"})
    .then((response) => {
      return JSON.parse(response);})
    .then(res =>{
      console.log(res);
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
      return;
    }

    const self = this;
    const uploadRequests = [];
    const uploader = (uploadRequest)=>{
      $.ajax({
        url : window.backendRoute+'/renderEngineBackend/index.php',
        type : 'POST',
        data : uploadRequest[0],
        processData: false,  // tell jQuery not to process the data
        contentType: false,  // tell jQuery not to set contentType
        xhr: function () {
          var xhr = new window.XMLHttpRequest();
          xhr.upload.addEventListener("progress",
            (e)=>{
              self.uploadProgress = {
                percentage:((e.loaded/e.total)*100),
                inStack:uploadRequest.length
              }; 
              self.forceUpdate();
            },
            false
          );
          return xhr;
      }
      })
      .then((res) => {
        uploadRequest.shift();
        if(uploadRequest.length > 0){
          uploader(uploadRequest);
        }
        if(!res){
          Swal.fire("Error","Check input data","error");
        }
        this.getHierarchy();
      });
    }

    if (e.dataTransfer.items) {
      //Use DataTransferItemList interface to access the file(s)
      [...e.dataTransfer.items].forEach((item, i) => {
        //If dropped items aren't files, reject them
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
      uploader(uploadRequests);
    }
  }
  rename(route:string, newName:string){
    var spl = route.split("/");
    spl.pop();
    const newRoute = spl.join("/") + "/" + newName;
    this.backendRequest({action: "rename", oldRoute:route, newRoute:newRoute})
  }
  delete(dir:string, type:string){
    this.backendRequest({action: "delete", dir:dir, type:type})
  }
  download(dir:string, type:string){
    this.backendRequest({action: "download", dir, type})
      .then((res:string)=>{
        download(JSON.parse(res).dataUrl,dir.split("/").at(-1));
      },(error)=>{
        console.error(error);
      });    
  }
  createFile(dir:string, filename:string){
    this.backendRequest({action: "createFile", dir:dir, filename:filename})
  }
  createDir(dir:string, folderName:string){
    this.backendRequest({action: "createDir", dir:dir, folderName:folderName})
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
        </div>
      )
    }
  }
  setSelected(index){
    const info = this.actualContent[index];
    const src = info.route.replace("./",window.backendRoute + "/renderEngineBackend/");
    this.selected = {
      name:info.name,
      route:info.route,
      mime:info.mime.split("/")[0],
      src:src,
      show:true,
      index:this.fileIndexReverse[index],
      actualContentLength:this.fileIndexList.length};
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
            <MenuButton text="Donwload"
              action={()=>{
                this.download(info.route,info.type);
              }}
            />
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
  openContextMenu(e,resInfo){
    e.preventDefault();
    var offset = $("#"+this.id).offset();
    this.contextMenuData.x = e.clientX -=offset.left;
    this.contextMenuData.y = e.clientY -=offset.top;
    this.contextMenuData.show = true;
    this.contextMenuData.info = resInfo;
    this.forceUpdate();
  }
  res(resInfo,index:number){
    if(resInfo.type == "dir"){
      return (
        <div 
          className='flex flex-row border-2 my-2 mr-3 h-9 cursor-pointer' 
          onContextMenu={(e)=>{
            this.openContextMenu(e,resInfo);
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
            this.openContextMenu(e,resInfo);
          }}
          >
          <IconButton icon="file" style="flex-none h-6 w-6 m-1"/>
          <div className='mx-2 my-auto truncate'>{resInfo.name}</div>
          <div className='mx-2 my-auto grow'/>
          <div className='mx-2 my-auto flex-none'>{byteSize(resInfo.size).toString()}</div>
        </div>
      );
    }
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
          close={()=>{this.selected.show = false; this.forceUpdate()}}
        />
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
              {this.actualContent.map((el,index: number)=>{return this.res(el,index)})}
            </div>
            {this.rightControls()}
          </div>
        </div>
        {this.contextMenu()}
        <Loading 
          hide={this.uploadProgress.percentage == 100 && this.uploadProgress.inStack <=1} 
          text={`Uploading progress: ${this.uploadProgress.percentage.toFixed(2)}%, left ${this.uploadProgress.inStack}`}/>
        {this.renderMultimedia()}
      </div>
    );
  }
}
export {FileExplorer}