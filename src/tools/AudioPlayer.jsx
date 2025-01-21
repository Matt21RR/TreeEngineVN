import React from 'react';
import {Howl} from 'howler';
import $ from "jquery";
import { IconButton } from './components/Buttons';

class AudioPlayer extends React.Component{
  constructor(props){
    super(props);
    this.mounted = false;
    this.stats = {
      loop:false,
      playing:false,
      info:[]
    }
    this.soundReady = false;
    this.src = "src" in this.props ? this.props.src : window.backendRoute + "/renderEngineBackend/game/egoismo.mp3"
    this.id = "progression" + String(window.performance.now()).replaceAll(".","");
  }
  timeConverter(sec){
    var toSeconds = (sec % 60);
    var toMinutes = (sec-toSeconds)/60;
    toSeconds = toSeconds.toFixed(0);
    toMinutes = toMinutes.toFixed(0);
    if(toSeconds<10){
      toSeconds = "0"+toSeconds;
    }
    if(toMinutes<10){
      toMinutes = "0"+toMinutes;
    }
    return toMinutes + ":" +toSeconds;
  }
  setStyle(constant){
      $("#"+this.id).width((constant * 100) + "%");
      $("#range"+this.id).val(constant);
      $("#time"+this.id).text(
        this.timeConverter(this.sound.seek())
        +
        " / "
        +
        this.timeConverter(this.sound.duration())
      );
  }
  componentWillUnmount(){
    if(this.soundReady){
      this.sound.unload();
    }
  }
  componentDidMount(){
    if(!this.mounted){
      this.mounted = true;
      this.sound = new Howl({
        src: this.src,
        onload:()=>{this.soundReady = true; this.forceUpdate(); console.warn(this.sound)},
        onend:()=>{
          if(!this.stats.loop){
            $("#"+this.id).width(0 + "%");
            $("#range"+this.id).val(0);
            $("#time"+this.id).text("00:00 / 00:00");
            this.stats.playing = false;
            this.forceUpdate();
          }
        },
        onstop:()=>{
          $("#"+this.id).width(0 + "%");
          $("#range"+this.id).val(0);
          $("#time"+this.id).text("00:00 / 00:00");
          this.stats.loop = false;
          this.sound.loop(false);
          this.stats.playing = false;
          this.forceUpdate();
        }
      }); 

      //progress tracking
      let updatedRaf;

      const onAnimationFrame = () => {
        if (this.sound.playing()) {
            const width = (this.sound.seek() / this.sound.duration());
            this.setStyle(width);
        }
        updatedRaf = requestAnimationFrame(onAnimationFrame);
      };

      updatedRaf = requestAnimationFrame(onAnimationFrame);
    }
  }
  progressBar(){
    return(
      <div className='relative w-full h-7 bg-gray-900 flex px-[3%]'>
        {this.controls()}
        <div id={"time"+this.id} className='my-auto w-auto h-auto ml-2 mr-3 text-white flex-none'>
          00:00 / 00:00
        </div>
        <div className='relative grow h-1 my-auto flex'>
          <div className='absolute w-full h-full px-2'>
            <div className='relative w-full h-full'>
              <div className='absolute w-full h-full bg-white '></div>
              <div id={this.id} className='relative w-0 h-full bg-gray-600 flex'>
                <div className='h-5 w-2 bg-slate-500 top-1/2 right-0 absolute -translate-y-1/2 translate-x-1/2'>

                </div>
              </div>
            </div>

          </div>

          <input 
            id={"range"+this.id} 
            className='w-full relative opacity-0' 
            type="range" 
            min={0} max={1} 
            defaultValue={0} 
            step={0.0001} 
            onChange={(e)=>{
              const value =e.target.value;
              this.sound.seek(value*this.sound.duration());
              this.setStyle(value);
            }}
            onMouseDown={()=>{
              if(this.stats.playing){this.sound.pause(); }
              // this.stats.playing=!this.stats.playing;
              // this.forceUpdate();
            }}
            onMouseUp={()=>{
              if(this.stats.playing){this.sound.play(); }
              // this.stats.playing=!this.stats.playing;
              // this.forceUpdate();
            }}/>
        </div>
      </div>
    );
  }
  controls(){
    if(this.soundReady){
      const stats = this.stats;
      const sound = this.sound;
      return(<>
        <IconButton
          icon={stats.playing ? "pause" : "play"} 
          style={" h-4 w-4 my-auto mx-1 flex-none"}
          action={()=>{
            stats.playing ? sound.pause() : sound.play(); 
            this.stats.playing=!this.stats.playing;
            this.forceUpdate();}}/>
        <IconButton
          icon="squareFull"
          style={" h-4 w-4 my-auto mx-1 flex-none"}
          action={()=>{
            this.sound.stop();
            stats.playing = false;
            this.forceUpdate();
            }}/>
        <IconButton
          icon="repeat" 
          style={stats.loop ? " h-5 w-5 my-auto mx-1 flex-none" : "opacity-50 h-5 w-5 my-auto mx-1 flex-none"}
          action={()=>{
            this.stats.loop = !this.stats.loop;
            this.sound.loop(this.stats.loop);
            this.forceUpdate();}}/>
      </>);
    }
  }
  render(){
    return(<>
      {this.progressBar()}
    </>);
  }
}

export {AudioPlayer}