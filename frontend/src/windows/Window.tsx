import React, { JSX } from 'react';
import $ from "jquery";
import Draggable from 'react-draggable';
import gsap from 'gsap';
import { IconButton } from '../tools/components/Buttons.tsx';

interface WindowProps{
  content:JSX.Element,
  minimize:Function,
  minimized:boolean,
  preview:boolean,
  title?:string,
  onResize?: ()=>void,
  minRes:{width:number,height:number},
  resizeBlocked?:boolean,
  clicked:Function,
  reRender:Function
}

class Window extends React.Component<WindowProps> {
  private id:string;
  private resizeBlocked:boolean;
  private onResize:Function;
  private fullSized:boolean;
  private unfullSizedData:{
      top:number,
      left:number,
      width:number,
      height:number
    };
  private nodeRef:React.RefObject<any>;
  constructor(props:WindowProps){
    super(props);
    this.id = "window" + String(window.performance.now()).replaceAll(".","");
    this.nodeRef = React.createRef();
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
  private renderWindowTop(){
    const props = this.props;
    return(
      <div className='relative top-0 h-8 w-full flex flex-col'>
        <div className='relative h-full bg-gray-900 text-white flex flex-row-reverse border-b border-gray-700'>
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
  private coordsExtractor(){
    var w = document.getElementById("body"+this.id) as HTMLDivElement;
    var coords = w.style.transform.replace(/[^0-9,-]/g,"").split(",").map(el=>parseFloat(el));
    if(coords.length == 0){
      coords = [0,0];
    }
    return coords;
  }

  private absoluteCoordsExtractor(){
    const w = document.getElementById("body"+this.id) as HTMLDivElement;
    let coords = [0,0];
    const transformCoords = w.style.transform.replace(/[^0-9,-]/g,"").split(",").map(el=>parseFloat(el));
    coords = [parseFloat(w.style.left) || 0,parseFloat(w.style.top) || 0];
    if(transformCoords.length == 2){
      coords[0] += transformCoords[0];
      coords[1] += transformCoords[1];
    }
    return coords;
  }
  private fulSize(){
    this.fullSized = true;
    this.forceUpdate();

    var w = document.getElementById("body"+this.id) as HTMLDivElement;
    const coords = this.coordsExtractor();

    this.unfullSizedData = {
      width: parseFloat(w.style.width) || 0,
      height: parseFloat(w.style.height) || 0,
      left: parseFloat(w.style.left) || 0,
      top: parseFloat(w.style.top) || 0
    }
    
    gsap.to("#body"+this.id, {
      duration:.15,
      ease:"linear",
      width:window.innerWidth, 
      height:window.innerHeight,
      left:-coords[0],
      top:-coords[1],
      onComplete:()=>{this.onResize();}
    }); 
  }
  private reduceSize(){
    this.fullSized = false;
    this.forceUpdate();

    gsap.to("#body"+this.id, {
      duration:.1, 
      ease:"linear",
      width:this.unfullSizedData.width,
      height:this.unfullSizedData.height,
      left:this.unfullSizedData.left,
      top:this.unfullSizedData.top,
      onComplete:()=>{this.onResize();}
    });
  }
  private resize(border:string,ev){
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

    if(parseFloat(window.style.width) <this.props.minRes.width){
      this.resizeBlocked = true;
      window.style.width = (this.props.minRes.width)+"px";
    }
    if(parseFloat(window.style.height) <this.props.minRes.height){
      this.resizeBlocked = true;
      window.style.height = (this.props.minRes.height)+"px";
    }
    this.onResize();
  }
  private compensateOutCoords(){
    const coords = this.absoluteCoordsExtractor();

    this.unfullSizedData.left -= coords[0] < 0 ? coords[0] : 0;
    this.unfullSizedData.top -= coords[1] < 0 ? coords[1] : 0;

    if(coords[0]+150>window.innerWidth){
      this.unfullSizedData.left += window.innerWidth - coords[0]-150;
    }

    if(coords[1]+35>window.innerHeight){
      this.unfullSizedData.top += window.innerHeight - coords[1]-35;
    }

    gsap.to("#body"+this.id,{
      duration:.1,
      ease:"linear",
      left:this.unfullSizedData.left,
      top:this.unfullSizedData.top
    });
  }

  renderResizeBorders(){
    const releaseMouseMove = ()=>{
      $("body").off("mousemove");
      this.resizeBlocked = false;
    };

    if(!this.fullSized){
      let laterals = {
        top: "-top-[3px] h-[6px] w-full cursor-n-resize",
        bottom: "-bottom-[3px] h-[6px] w-full cursor-n-resize",
        left: "-left-[3px] top-0 h-full w-[6px] cursor-e-resize",
        right: "-right-[3px] top-0 h-full w-[6px] cursor-e-resize",
      };

      let corners = {
        topLeft: "-top-2 -left-2 cursor-se-resize",
        topRight: "-top-2 -right-2 cursor-ne-resize",
        bottomRight:"-bottom-2 -right-2 cursor-se-resize",
        bottomLeft: "-bottom-2 -left-2 cursor-ne-resize",  
      };
      

      return(<>
        {
          Object.keys(laterals).map((key)=>{
            const classString = laterals[key];
            return  <div 
                      className={`absolute ${classString}`}
                      key={key+this.id}
                      id={key+this.id}
                      onMouseDown={(e)=>{
                        e.preventDefault();
                        $("body").on("mousemove",(e)=>{this.resize(key,e);e.preventDefault();});
                        $("body").on("mouseup",releaseMouseMove);
                      }}
                    />
          })
        }

        {
          Object.keys(corners).map((key)=>{
            const classString = corners[key];
            return  <div 
              className={`absolute h-3 w-3 ${classString}`}
              key={key+this.id}
              id={key+this.id}
              onMouseDown={(e)=>{
                e.preventDefault();
                $("body").on("mousemove",(e)=>{this.resize(key,e);e.preventDefault();});
                $("body").on("mouseup",releaseMouseMove);
              }}
            />
          })
        }
      </>);
    }
  }
  render(){
    return(
      <Draggable
      nodeRef={this.nodeRef}
        onMouseDown={
          ()=>{
            this.props.clicked();
          }
        }
        onStop={(e)=>{
          this.compensateOutCoords();
        }}
        onStart={(e)=>{
          const m = e as React.MouseEvent;
          if(this.fullSized){
            this.unfullSizedData.width = this.unfullSizedData.width == 0 ? 550 : this.unfullSizedData.width;
            this.unfullSizedData.height = 450;

            const coords = this.coordsExtractor();
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
          id={"body"+this.id}
          ref={this.nodeRef}>
          <div className='flex flex-row w-full h-full'>
            <div className='relative w-full h-full min-w-full max-h-full border border-gray-700 flex flex-col'>
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

export default Window;