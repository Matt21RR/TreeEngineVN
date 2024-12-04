  class rAF{
    static modelTwo(callback, interval = 16,loopId){
      if(window.rAFLastTime === undefined)
        window.rAFLastTime = 0;
      var now = window.performance.now();
			var nextTime = Math.max(window.rAFLastTime + interval, now);
			return setTimeout(function() { callback(window.rAFLastTime = nextTime,loopId); }, nextTime - now);
    }
  }
  export {rAF}