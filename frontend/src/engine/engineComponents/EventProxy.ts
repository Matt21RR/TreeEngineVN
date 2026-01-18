//TODO: Crear un generador de Proxies el cual permita agregar eventos de cambios de valores

//! El proxy interfiere con el acceso a los campos privados de los objetos
export default class Proxificator{
  private constructor(){}
  static proxify<T>(element:T,setEvents:Array<(target:T,property?:string|symbol, value?: any)=>void> = []){
    return new Proxy(element as object, {
      set: (target, property, value) => {
        setEvents.forEach(f=>{
          //@ts-ignore
          f(target,property,value);
        })
        target[property] = value; // Set the property
        return true; // Indicate success
      }
    }) as T;
  }
}