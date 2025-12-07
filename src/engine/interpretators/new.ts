

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