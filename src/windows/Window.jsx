import React from 'react';
import $ from "jquery";
import Draggable from 'react-draggable';
import { IconButton } from "../engine/components/buttons";


class Window extends React.Component {
  constructor(props){
    super(props);
    this.id = "window" + String(window.performance.now()).replaceAll(".","");
    this.resizeBlocked = "resizeBlocked" in this.props ? this.props.resizeBlocked : false;
    this.onResize = "onResize" in this.props ? this.props.onResize : ()=>{console.log("Nada en window")};
    this.fullSized = false;
    this.unfullSizedData = {
      top:"",
      left:"",
      width:"",
      height:""
    };
    this.resizingFrom = "";
  }
  componentDidUpdate(){
    // console.log(this.id,this.props.minimized);
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
            action={()=>{this.props.minimize(); this.forceUpdate();}}/>
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
    
    this.onResize();
  }
  reduceSize(){
    this.fullSized = false;
    this.forceUpdate();

    var w = document.getElementById("body"+this.id);
    w.style.width = this.unfullSizedData.width;
    w.style.height = this.unfullSizedData.height;
    w.style.left = this.unfullSizedData.left;
    w.style.top = this.unfullSizedData.top;

    this.onResize();
  }
  resize(border,ev){
    if(this.resizeBlocked){return;}

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
    this.onResize();
  }
  renderResizeBorders(){
    if(!this.fullSized){
      return(<>
        <div 
          className="absolute -top-[3px] h-[6px] w-full cursor-n-resize" 
          id={"top"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.resize("top",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
        <div 
          className="absolute -bottom-[3px] h-[6px] w-full cursor-n-resize"
          id={"bottom"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.resize("bottom",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
        <div 
          className="absolute -left-[3px] top-0 h-full w-[6px] cursor-e-resize"
          id={"left"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.resize("left",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
        <div 
          className="absolute -right-[3px] top-0 h-full w-[6px] cursor-e-resize"
          id={"right"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.resize("right",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
  
  
        <div 
          className="absolute -top-2 -left-2 h-3 w-3 cursor-se-resize"
          id={"topLeft"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.resize("topLeft",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
        <div 
          className="absolute -top-2 -right-2 h-3 w-3 cursor-ne-resize"
          id={"topRight"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.resize("topRight",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
        <div 
          className="absolute -bottom-2 -right-2 h-3 w-3 cursor-se-resize"
          id={"bottomRight"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.resize("bottomRight",e);e.preventDefault();});
            $("body").on("mouseup",()=>{$("body").off("mousemove");});
          }}
          />
        <div 
          className="absolute -bottom-2 -left-2 h-3 w-3 cursor-ne-resize"
          id={"bottomLeft"+this.id}
          onMouseDown={(e)=>{
            e.preventDefault();
            $("body").on("mousemove",(e)=>{this.resize("bottomLeft",e);e.preventDefault();});
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
        onDrag={(e)=>{
          //Check if windowTop are outside the browserWindow
          if(e.clientY < 0){
            e.preventDefault();
            // this.props.minimize(); this.forceUpdate();
          }
        }}
        handle={"#"+this.id}
      >
        <div className={'absolute top-0 left-0 flex flex-col pointer-events-auto '}  
          style={{
            width: "minRes" in this.props ? this.props.minRes.width+"px" : "400px", 
            height: "minRes" in this.props ? this.props.minRes.height+"px" : "300px",
            pointerEvents: this.props.minimized ? "none":"auto",
            opacity: this.props.minimized ? (this.props.preview? .5 : 1) : 1, 
            display: this.props.minimized ? (this.props.preview? "inherit" : "none"):"inherit"
          }} 
          id={"body"+this.id}>
          <div className='flex flex-row w-full h-full'>
            <div className='relative w-full h-full min-w-full max-h-full border-[1px] border-gray-700 flex flex-col'>
              {this.renderWindowTop()}
              <div className='relative w-full h-full bg-[rgba(0,0,0,0.80)] flex flex-col overflow-y-auto'>
                {"content" in  this.props ? this.props.content() : <div className='text-white'>Content</div>}
              </div>
            </div>

          </div>
          {this.renderResizeBorders()}
        </div>

      </Draggable>
    )
  }
}

export {Window}