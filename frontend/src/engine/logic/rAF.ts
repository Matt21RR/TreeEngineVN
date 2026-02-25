declare global {
  interface Window {
    loopId: string;
    rAFLastTime?: number
  }
}
  class rAF{
    static modelThree(callback: Function, interval = 16, prevCycleStartedAt:number,loopId:string){
      if(loopId != window.loopId){
        return;
      }

      const now = window.performance.now();

      // Time between the calls less the time it took to execute the engine cycle (running code and rendering)
			const nextTime = interval - (now - prevCycleStartedAt);

      if(nextTime < 0){
        const engDelta = now - prevCycleStartedAt;
        return callback(engDelta,loopId);
      }else{
        return setTimeout(
          function() { 
            const engDelta = window.performance.now() - prevCycleStartedAt;
            callback(engDelta,loopId); 
          }, 
          nextTime-1
        ); 
      }
    }

    static modelFour(callback:Function, interval = 16, prevCycleStartedAt:number, loopId:string){
      if(loopId != window.loopId){
        return;
      }

      const now = window.performance.now();
      const nextTime = interval - (now - prevCycleStartedAt);

      if(nextTime < 0){
        const engDelta = now - prevCycleStartedAt;
        return callback(engDelta,loopId);
      }else{
        requestAnimationFrame(
          function() { 
            const engDelta = window.performance.now() - prevCycleStartedAt;
            callback(engDelta,loopId);
          }
        )
      }
    }
  }
  export {rAF}