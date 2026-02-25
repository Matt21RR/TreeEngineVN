import React, { useEffect, useState } from 'react';
import {Howl} from 'howler';
import $ from "jquery";
import { IconButton } from './components/Buttons.tsx';

interface AudioPlayerProps{
  src:string;
  ext:string;
}

export default function AudioPlayer(props:AudioPlayerProps){
  const [id, setId] = useState("");
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);

  const [soundReady, setSoundReady] = useState(false);
  const [src, setSrc] = useState("");

  const [sound, setSound] = useState<Howl>();

  useEffect(()=>{
    setSrc(props.src);
    const idNew = "progression" + String(window.performance.now()).replaceAll(".","");
    setId(idNew);

    setSound( 
      new Howl({
        src: [props.src],
        format: [props.ext],
        onload:()=>{
          setSoundReady(true); 
        },
        onend:()=>{
          if(!loop){
            $("#"+idNew).width(0 + "%");
            $("#range"+idNew).val(0);
            $("#time"+idNew).text("00:00 / 00:00");
            setPlaying(false);
          }
        },
        onstop:()=>{
          $("#"+idNew).width(0 + "%");
          $("#range"+idNew).val(0);
          $("#time"+idNew).text("00:00 / 00:00");
          setLoop(false);
          sound.loop(false);
          setPlaying(false);
        }
      })
    );

    return ()=>{
      console.error("UNLOADING");
      console.log(soundReady,sound);
      if(soundReady && sound){
        sound.stop();
        sound.unload();
      }
    }
  },[]);

  useEffect(()=>{
    if(sound){
      console.log("fired");
      sound.on("play",()=>{
          const onAnimationFrame = () => {
            if (sound.playing()) {
                const width = (sound.seek() / sound.duration());
                setStyle(width);
                requestAnimationFrame(onAnimationFrame);
            }
          };

          requestAnimationFrame(onAnimationFrame);
      });
    }
  },[sound])

  const timeConverter = (sec: number)=>{
    const addZero = (number:string)=>{return number.length == 1 ? `0${number}` : number };
    const secsNumeric = (sec % 60);
    let toSeconds = secsNumeric.toFixed(0);
    let toMinutes = ((sec-secsNumeric)/60).toFixed(0);
    toSeconds = addZero(toSeconds);
    toMinutes = addZero(toMinutes);
    return toMinutes + ":" +toSeconds;
  }
  const setStyle = (constant: number) => {
      $("#"+id).width((constant * 100) + "%");
      $("#range"+id).val(constant);
      $("#time"+id).text(
        `${timeConverter(sound.seek())} / ${timeConverter(sound.duration())}`
      );
  }

  const progressBar = () => {
    return(
      <div className='relative w-full h-7 bg-gray-900 flex px-[3%]' key={id}>
        {controls()}
        <div id={"time"+id} className='my-auto w-auto h-auto ml-2 mr-3 text-white flex-none'>
          00:00 / 00:00
        </div>
        <div className='relative grow h-1 my-auto flex'>
          <div className='absolute w-full h-full px-2'>
            <div className='relative w-full h-full'>
              <div className='absolute w-full h-full bg-white '/>
              <div id={id} className='relative w-0 h-full bg-gray-600 flex'>
                <div className='h-5 w-2 bg-slate-500 top-1/2 right-0 absolute -translate-y-1/2 translate-x-1/2' />
              </div>
            </div>
          </div>

          <input 
            id={"range"+id} 
            className='w-full relative opacity-0' 
            type="range" 
            min={0} max={1} 
            defaultValue={0} 
            step={0.0001} 
            onChange={(e)=>{
              const value = parseFloat(e.target.value);
              sound.seek(value*sound.duration());
              setStyle(value);
            }}
            onMouseDown={()=>{
              if(playing){
                sound.pause(); 
              }
            }}
            onMouseUp={()=>{
              if(playing){
                sound.play(); 
              }
            }}/>
        </div>
      </div>
    );
  }
  const controls = () => {
    if(soundReady){
      return(<>
        <IconButton
          icon={playing ? "pause" : "play"} 
          style={" h-4 w-4 my-auto mx-1 flex-none"}
          action={()=>{
            playing ? sound.pause() : sound.play(); 
            setPlaying(!playing);
          }}/>
        <IconButton
          icon="squareFull"
          style={" h-4 w-4 my-auto mx-1 flex-none"}
          action={()=>{
            sound.stop();
            setPlaying(false);
          }}/>
        <IconButton
          icon="repeat" 
          style={loop ? " h-5 w-5 my-auto mx-1 flex-none" : "opacity-50 h-5 w-5 my-auto mx-1 flex-none"}
          action={()=>{
            setLoop(!loop);
            sound.loop(loop);
          }}/>
      </>);
    }
  }

  if(soundReady && id != ""){
    return(<>
      {progressBar()}
    </>);
  } 

  return null
}