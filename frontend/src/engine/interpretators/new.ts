

//recibe un array de funciones que retornan promesas
export default function secuencedPromise(promisesArray: Array<()=>Promise<any>>){
  return new Promise(finalResolve=>{
    const promise = promisesArray.shift();
    promise().then(()=>{
      if(promisesArray.length > 0){
        secuencedPromise(promisesArray).then(()=>finalResolve(null));
      }else{
        finalResolve(null);
      }
    });
  });
}

export function sequencedPromiseWithResult<T>(promisesArray: Array<()=>Promise<T>>):Promise<Array<T>>{
  return new Promise<Array<T>>(finalResolve=>{
    const results:Array<T> = [];
    const promise = promisesArray.shift();
    promise().then((res:T)=>{
      results.push(res);
      if(promisesArray.length > 0){
        sequencedPromiseWithResult(promisesArray).then((resArray:Array<T>)=>{
          results.push(...resArray);
          finalResolve(results);
        });
      }else{
        finalResolve(results);
      }
    });
  });
}