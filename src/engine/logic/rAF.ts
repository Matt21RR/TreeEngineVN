declare global {
  interface Window {
    loopId: string;
    rAFLastTime?: number
  }
}
  class rAF{
    static modelThree(callback, interval = 16, prevCycleStartedAt,loopId){
      if(loopId != window.loopId){
        return;
      }
      if(window.rAFLastTime === undefined){
        window.rAFLastTime = 0;
      }
      var now = window.performance.now();

      // Time between the calls less the time it took to execute the engine cycle (running code and rendering)
			var nextTime = interval - (now - prevCycleStartedAt);

      window.rAFLastTime = nextTime

      if(nextTime < 0){
        window.rAFLastTime = now;
        return setTimeout(
          function() { 
            callback((now - prevCycleStartedAt),loopId);
          },1   
        );
      }else{
        return setTimeout(
          function() { 
            callback(interval,loopId); 
          }, 
          nextTime-1
        ); 
      }
    }
  }
  export {rAF}