import React, { useEffect } from "react";
import WebGPUCanvas from "./engine/renderCore/WebGPUCanvas.ts";
export default function WebGpuTest(){
  const Gpu = new WebGPUCanvas();
  useEffect(()=>{
    let prevTimestamp = 0;
    const gpuContext = (document.getElementById("hell") as HTMLCanvasElement).getContext("webgpu")!;
    Gpu.init(gpuContext).then(()=>{
      fetch("http://127.0.0.1/t/image.jpg",{mode:"cors"})
        .then((e)=>e.blob())
        .then(f=>createImageBitmap(f))
        .then(imageBitmap=>
          Gpu.preloadImage(imageBitmap,"image")
        ).then(_=>{
          Gpu.setResolution(500,500);
          const draw = ()=>{
            const ine = performance.now();

            let i = 0;
            while(i<10){
              i++;
              Gpu.queueImage({id:"image",x:0,y:0,width:300,height:300,rotation:0})
            }
            Gpu.render();
            console.log(`Elapsed: ${performance.now()-ine}`);
            requestAnimationFrame(draw)
          }
          requestAnimationFrame(draw)
        })
    })
  },[])
  return <div className="w-full h-full absolute">
    <canvas id="hell" style={{backgroundColor:"orange"}}></canvas>
  </div>
}