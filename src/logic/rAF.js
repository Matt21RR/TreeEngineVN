  class rAF{
    static modelOne(callback, element){
      if(window.rAFLastTime === undefined)
        window.rAFLastTime =0;
      var currTime = new Date().getTime();
      var timeToCall = Math.max(0, 16 - Math.abs(currTime - window.rAFLastTime));
      var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
        timeToCall);
      window.rAFLastTime = currTime + timeToCall;
      return id;
    }

    static modelTwo(callback, interval = 16){
      if(window.rAFLastTime === undefined)
        window.rAFLastTime = 0;
      var now = window.performance.now();
			var nextTime = Math.max(window.rAFLastTime + interval, now);
			return setTimeout(function() { callback(window.rAFLastTime = nextTime); }, nextTime - now);
    }
  }
  export {rAF}