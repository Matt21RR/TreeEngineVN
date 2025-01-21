  class rAF{
    static modelThree(callback, interval = 16,loopId){
      if(loopId != window.loopId){
        return;
      }
      if(window.rAFLastTime === undefined){
        window.rAFLastTime = 0;
        window.registroLlamadas = {[loopId]:[0]}
      }
      var now = window.performance.now();
      window.registroLlamadas[loopId].push(now)
      if(Object.keys(window.registroLlamadas).length > 1)
        console.warn("COMPROBAR REGISTRO LLAMADAS!!")
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