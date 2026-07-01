//recibe un array de funciones que retornan promesas

import { Dictionary } from "../../global.ts";

export default function sequencedPromise<T>(promisesArray: Array<()=>Promise<T>>){
  return sequencedPromiseImpl(promisesArray);
}

function sequencedPromiseImpl<T>(promisesArray: Array<()=>Promise<T>>, resultsArray:Array<T> = [], rejectsArray:Array<{promise:()=>Promise<T>, details:any}> = []):Promise<{results:Array<T>, rejects:Array<{promise:()=>Promise<T>, details:any}>}>{
  return new Promise(finalResolve=>{
    const promise = promisesArray.shift();
    promise()
      .then((resolved:T)=>{
        resultsArray.push(resolved);
        if(promisesArray.length > 0){
          sequencedPromiseImpl(promisesArray, resultsArray, rejectsArray).then(()=>finalResolve({results: resultsArray, rejects: rejectsArray}));
        }else{
          finalResolve({results: resultsArray, rejects: rejectsArray});
        }
      })
      .catch((err)=>{
        rejectsArray.push({promise,details:err});
        if(promisesArray.length > 0){
          sequencedPromiseImpl(promisesArray, resultsArray, rejectsArray).then(()=>finalResolve({results: resultsArray, rejects: rejectsArray}));
        }else{
          finalResolve({results: resultsArray, rejects: rejectsArray});
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