import React from 'react';
import $ from "jquery";
import Draggable from 'react-draggable';
import { IconButton } from "../components/buttons";


class Window extends React.Component {
  constructor(props){
    super(props);
    this.id = "window" + String(window.performance.now()).replaceAll(".","");
    this.fullSized = false;
    this.unfullSizedData = {
      top:"",
      left:"",
      width:"",
      height:""
    }
    this.a = (border,e)=>{this.resize(border,e);}
  }
  renderWindowTop(){
    return(
      <div className='relative top-0 h-8 w-full flex flex-col'>
        <div className='relative h-full bg-gray-950 text-white flex flex-row-reverse border-b-[1px] border-gray-700'>
          <IconButton 
            icon="cross" 
            style={" hover:bg-red-600 w-11 h-8 min-w-[3rem]"} 
            iconStyle={"w-3 h-3 my-auto mx-auto"}
            action={()=>{this.props.exit();}}/>
          <IconButton 
            icon={this.fullSized?"squares":"square"}
            style={" hover:bg-gray-600 w-11 h-8 min-w-[3rem]"}
            iconStyle={"w-3 h-3 my-auto mx-auto"}
            action={()=>{if(this.fullSized){this.reduceSize();}else{this.fulSize();}}}
            />
          <IconButton 
            icon="minus" 
            style={" hover:bg-gray-600 w-11 h-8 min-w-[3rem]"}
            iconStyle={"w-3 h-3 my-auto mx-auto"}
            action={()=>{this.props.exit();}}/>
          <div 
            className='h-full w-[-webkit-fill-available] text-[14px] my-auto cursor-default select-none relative flex'
            id={this.id}
            >
            <span className='ml-3 h-fit my-auto'>
              {"title" in this.props? this.props.title : "Window title"}
            </span>
          </div>
        </div>
      </div>
    );
  }
  fulSize(){
    this.fullSized = true;
    this.forceUpdate();

    var w = document.getElementById("body"+this.id);
    const coords = w.style.transform.replace("translate(","").replace(")","").replaceAll("px","").split(",");

    this.unfullSizedData = {
      width:w.style.width,
      height:w.style.height,
      left:w.style.left,
      top:w.style.top
    }

    w.style.width = window.innerWidth+"px";
    w.style.height = window.innerHeight+"px";
    w.style.left = (coords[0]*-1)+"px";
    w.style.top = (coords[1].replace(" ","")*-1)+"px";
  }
  reduceSize(){
    this.fullSized = false;
    this.forceUpdate();

    var w = document.getElementById("body"+this.id);
    w.style.width = this.unfullSizedData.width;
    w.style.height = this.unfullSizedData.height;
    w.style.left = this.unfullSizedData.left;
    w.style.top = this.unfullSizedData.top;
  }
  resize(border,ev){
    const e = ev.originalEvent;
    var mov = {x:e.movementX, y:e.movementY}

    var window = document.getElementById("body"+this.id);
    var top = window.style.top;
    top = top = "" ? 0 : top.replace("px","")*1;
    var left = window.style.left;
    left = left = "" ? 0 : left.replace("px","")*1;
    var width = window.offsetWidth;
    var height = window.offsetHeight;
    switch (border) {
      case "top":
        window.style.height = (height-mov.y)+"px";
        window.style.top = (top+mov.y)+"px";
        break;
      case "right":
        window.style.width = (width+mov.x)+"px";
        break;
      case "bottom":
        window.style.height = (height+mov.y)+"px";
        break;
      case "left":
        window.style.width = (width-mov.x)+"px";
        window.style.left = (left+mov.x)+"px";
        break;

      case "topLeft":
        window.style.height = (height-mov.y)+"px";
        window.style.top = (top+mov.y)+"px";
        window.style.width = (width-mov.x)+"px";
        window.style.left = (left+mov.x)+"px";
        break;
      case "topRight":
        window.style.height = (height-mov.y)+"px";
        window.style.top = (top+mov.y)+"px";
        window.style.width = (width+mov.x)+"px";
        break;
      case "bottomLeft":
        window.style.height = (height+mov.y)+"px";
        window.style.width = (width-mov.x)+"px";
        window.style.left = (left+mov.x)+"px";
        break;
      case "bottomRight":
        window.style.height = (height+mov.y)+"px";
        window.style.width = (width+mov.x)+"px";
        break;
    }
  }
  renderResizeBorders(){
    if(!this.fullSized){
      return(<>
        <div 
          className="absolute -top-[3px] h-[6px] w-full cursor-n-resize" 
          id={"top"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.a("top",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
        <div 
          className="absolute -bottom-[3px] h-[6px] w-full cursor-n-resize"
          id={"bottom"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.a("bottom",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
        <div 
          className="absolute -left-[3px] h-full w-[6px] cursor-e-resize"
          id={"left"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.a("left",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
        <div 
          className="absolute -right-[3px] h-full w-[6px] cursor-e-resize"
          id={"right"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.a("right",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
  
  
        <div 
          className="absolute -top-2 -left-2 h-3 w-3 cursor-se-resize"
          id={"topLeft"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.a("topLeft",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
        <div 
          className="absolute -top-2 -right-2 h-3 w-3 cursor-ne-resize"
          id={"topRight"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.a("topRight",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
        <div 
          className="absolute -bottom-2 -right-2 h-3 w-3 cursor-se-resize"
          id={"bottomRight"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.a("bottomRight",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
        <div 
          className="absolute -bottom-2 -left-2 h-3 w-3 cursor-ne-resize"
          id={"bottomLeft"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.a("bottomLeft",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
      </>);
    }
  }
  render(){
    return(
      <Draggable
        onMouseDown={
          (e)=>{
            this.props.clicked();
          }
        }
        onStart={(e)=>{
          if(this.fullSized){
            console.log(this.unfullSizedData);
            var w = document.getElementById("body"+this.id);
            this.unfullSizedData.width = this.unfullSizedData.width == "" ? "400px" : this.unfullSizedData.width;
            this.unfullSizedData.height = "300px";

            const coords = w.style.transform.replace("translate(","").replace(")","").replaceAll("px","").split(",");


            this.unfullSizedData.left = (+e.clientX - (coords[0]*1) - (this.unfullSizedData.width.replace("px","")/2)) + "px";
            this.unfullSizedData.top = (-e.clientY - (coords[1]*1) + 20) +"px";
            console.log(this.unfullSizedData);

            this.reduceSize();
          }
        }}
        handle={"#"+this.id}
      >
        <div className='absolute w-[400px] h-[300px] top-0 left-0 flex flex-col pointer-events-auto' id={"body"+this.id}>
          <div className='flex flex-row w-full h-full'>
            <div className='relative w-full h-full border-[1px] border-gray-700 bg-[rgba(0,0,0,0.90)] flex flex-col'>
              {this.renderWindowTop()}
              {"content" in  this.props ? this.props.content() : <div className='text-white'>Content</div>}
            </div>

          </div>
          {this.renderResizeBorders()}
        </div>

      </Draggable>
    )
  }
}

export {Window}