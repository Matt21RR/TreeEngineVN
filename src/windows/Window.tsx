import React from 'react';
import $ from "jquery";
import Draggable from 'react-draggable';
import { IconButton } from "../tools/components/Buttons";
import gsap from 'gsap';

interface WindowProps{
  content:JSX.Element,
  minimize:Function,
  minimized:boolean,
  preview:boolean,
  title?:string,
  onResize?:Function,
  minRes:{width:number,height:number},
  resizeBlocked?:boolean,
  clicked:Function,
  reRender:Function
}

class Window extends React.Component<WindowProps> {
  id:string;
  resizeBlocked:boolean;
  onResize:Function;
  fullSized:boolean;
  unfullSizedData:{
      top:number,
      left:number,
      width:number,
      height:number
    };
  constructor(props){
    super(props);
    this.id = "window" + String(window.performance.now()).replaceAll(".","");
    this.resizeBlocked = props.resizeBlocked ?? false;
    this.onResize = props.onResize ?? ( ()=>{ } );
    this.fullSized = false;
    this.unfullSizedData = {
      top:0,
      left:0,
      width:0,
      height:0
    };
  }
  renderWindowTop(){
    const props = this.props;
    return(
      <div className='relative top-0 h-8 w-full flex flex-col'>
        <div className='relative h-full bg-gray-900 text-white flex flex-row-reverse border-b-[1px] border-gray-700'>
          <IconButton 
            icon="cross" 
            style={" hover:bg-red-600 w-11 h-8 min-w-[3rem]"} 
            iconStyle={"w-3 h-3 my-auto mx-auto"}
            // action={()=>{props.exit();}}
            />
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
            action={()=>{props.minimize(); this.forceUpdate();}}/>
          <div 
            className='h-full grow text-[14px] my-auto cursor-default select-none relative flex'
            id={this.id}>
            <span className='ml-3 h-fit my-auto'>
              {props.title ?? "Window title"}
            </span>
          </div>
        </div>
      </div>
    );
  }
  #coordsExtractor(){
    var w = document.getElementById("body"+this.id) as HTMLDivElement;
    var coords = w.style.transform.replace("translate(","").replace(")","").replaceAll("px","").split(",").map(el=>parseFloat(el)*-1);
    if(coords.length == 0){
      coords = [0,0];
    }
    return coords;
  }
  fulSize(){
    this.fullSized = true;
    this.forceUpdate();

    var w = document.getElementById("body"+this.id) as HTMLDivElement;
    const coords = this.#coordsExtractor();

    this.unfullSizedData = {
      width: parseFloat(w.style.width) || 0,
      height: parseFloat(w.style.height) || 0,
      left: parseFloat(w.style.left) || 0,
      top: parseFloat(w.style.top) || 0
    }
    
    gsap.to("#body"+this.id,{duration:.15,width:window.innerWidth,ease:"linear",
      height:window.innerHeight,
      left:coords[0],
      top:coords[1],
      onComplete:()=>{this.onResize();}
    }); 
  }
  reduceSize(){
    this.fullSized = false;
    this.forceUpdate();

    gsap.to("#body"+this.id,{duration:.15,ease:"linear",
      width:this.unfullSizedData.width,
      height:this.unfullSizedData.height,
      left:this.unfullSizedData.left,
      top:this.unfullSizedData.top,
      onComplete:()=>{this.onResize();}
    });
  }
  resize(border,ev){
    if(this.resizeBlocked){return;}

    const e = ev.originalEvent;
    var mov = {x:e.movementX, y:e.movementY}

    var window = document.getElementById("body"+this.id) as HTMLDivElement;
    var top = parseFloat(window.style.top) || 0;
    var left = parseFloat(window.style.left) || 0;
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
          const m = e as React.MouseEvent;
          if(this.fullSized){
            this.unfullSizedData.width = this.unfullSizedData.width == 0 ? 550 : this.unfullSizedData.width;
            this.unfullSizedData.height = 450;

            const coords = this.#coordsExtractor();
            this.unfullSizedData.left = (+m.clientX - (coords[0]*1) - (this.unfullSizedData.width/2));
            this.unfullSizedData.top = (-m.clientY - (coords[1]*1) + 20);

            this.reduceSize();
          }
        }}
        onDrag={(e)=>{
          const m = e as React.MouseEvent;
          //Check if windowTop are outside the browserWindow
          if(m.clientY < 0){
            e.preventDefault();
          }
        }}
        handle={"#"+this.id}
      >
        <div className={'absolute top-0 left-0 flex flex-col pointer-events-auto '}  
          style={{
            width: "minRes" in this.props ? this.props.minRes.width+"px" : "600px", 
            height: "minRes" in this.props ? this.props.minRes.height+"px" : "450px",
            pointerEvents: this.props.minimized ? "none":"auto",
            opacity: this.props.minimized ? (this.props.preview? .5 : 1) : 1, 
            display: this.props.minimized ? (this.props.preview? "inherit" : "none"):"inherit"
          }} 
          id={"body"+this.id}>
          <div className='flex flex-row w-full h-full'>
            <div className='relative w-full h-full min-w-full max-h-full border-[1px] border-gray-700 flex flex-col'>
              {this.renderWindowTop()}
              <div className='relative w-full h-full bg-[rgba(0,0,0,0.80)] flex flex-col overflow-y-auto text-base'>
                {this.props.content ?? <div className='text-white'>Content</div>}
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