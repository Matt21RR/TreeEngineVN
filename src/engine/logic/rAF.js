  class rAF{
    static modelThree(callback, interval = 16,loopId){
      if(loopId != window.loopId){
        return;
      }
      if(window.rAFLastTime === undefined){
        window.rAFLastTime = 0;
      }
      var now = window.performance.now();
			var nextTime = window.rAFLastTime + interval;

      window.rAFLastTime = nextTime

			return setTimeout(
        function() { 
          callback(nextTime,loopId); 
        }, 
        nextTime - now
      ); 
    }
  }
  export {rAF}