import React from 'react';
import $ from "jquery";
import Draggable from 'react-draggable';
import { IconButton } from "../components/buttons";


class Window extends React.Component {
  constructor(props){
    super(props);
    this.id = "window" + String(window.performance.now()).replaceAll(".","");
    this.holding = {
      top:false,
      bottom:false,
      left:false,
      right:false}
    this.a = (border,e)=>{this.resize(border,e);}
  }
  renderWindowTop(){
    return(
      <div className='relative top-0 h-8 w-full flex flex-col'>
        <div className=' bg-gray-950 text-white flex flex-row-reverse border-b-[1px] border-gray-700'>
          <IconButton icon="cross" style={" hover:bg-red-600 w-12 h-8 px-[17.5px] py-[10px]"} action={()=>{this.props.exit();}}/>
          <div 
            className='ml-3 w-full text-[14px] my-auto cursor-default select-none'
            id={this.id}
            >
            {"title" in this.props? this.props.title : "Window title"}
          </div>
        </div>
      </div>
    );
  }
  resize(border,ev){
    const e = ev.originalEvent;
    if(e.buttons == 0){
      this.holding[border] = false;
      return;
    }
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
  render(){
    return(
      <Draggable
        onMouseDown={()=>{this.props.clicked();}}
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