class ExtendedObjects{
  /**
   * Modifica un valor en un objeto usando una ruta hacia ese valor, separada por '/'
   * ej: Para cambiar el valor de hikari:
   *      Objeto = {alistar:{konasharp:{hikari:9}}}
   *      Ruta = "alistar/konasharp/hikari"
   * @param {string} route Ruta de acceso al valor a cambiar
   * @param {object} objRouteRef Objeto en el cual hacer el cambio
   * @param {*} newVar Valor nuevo
   */
  static setValueWithRoute(route,objRouteRef,newVar){
    const k = route.split("/"); 
    const key =k.shift();
    if(k.length>0){
      this.setValueWithRoute(k.join("/"),objRouteRef[key],newVar);
    }else{
      objRouteRef[key] = newVar;
    }
  }
  /**
   * Modifica los valores de un objeto a partir de otro que posee la misma estructura a los valores que se quiere alterar
   * @param {Object} Valores que se quieren cambiar
   * @param {Object} Objetivo
   */
  static modify(value:Object,target:Object){

    //Mapear value
    //preguntar key por key o  indice por indice, si existe en el objetivo
    //Si existe, descender
    //Sino, asignar
    const deepMap = (valueEl:any,targetEl:any)=>{

      Object.keys(valueEl).forEach(depthKey => {
        if(depthKey in targetEl && valueEl[depthKey] instanceof Object){
          deepMap(valueEl[depthKey], targetEl[depthKey]);
        }else{
          targetEl[depthKey] = structuredClone(valueEl[depthKey]);
        }
      });
      
      return;
    }

    deepMap(value,target);
  }

  /**
   * Construye un objeto nuevo a partir de otro, en el cual todos los valores quedan asignados 
   * a la ruta en la cual estaban en el objeto original
   * ej: Antes
   * {alistar:{konasharp:{hikari:9,scorn:12}}}
   * Despues
   * {alistar/konasharp/hikari:9,alistar/konasharp/hikari/scorn:12}
   * @param {object} Objeto original
   * @returns Objeto resultante
   */
  static buildObjectsWithRoutes(k){
    const internalFunction = (k,res,tail="")=>{
      if(typeof k == "object"){
        Object.keys(k).forEach((key)=>{
            if(tail!=""){
              internalFunction(k[key],res,tail+"/"+key)    
            }else{
              internalFunction(k[key],res,key)    
            }
                
        });
      }else{
          Object.assign(res,{[tail]:k});
      }
    }
    var result = {};
    internalFunction(k,result);
    return result;
  }
}
export{ExtendedObjects}