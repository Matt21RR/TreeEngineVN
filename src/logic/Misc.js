function generateRndRGBColor(maxLumminosityLevel=255,minLumminosityLevel=1){
  const randChannelCodeGenerator = ()=>{
    return(Math.floor(Math.random() * maxLumminosityLevel) + minLumminosityLevel);
  }
  return ("rgb("+randChannelCodeGenerator()+","+randChannelCodeGenerator()+","+randChannelCodeGenerator()+")");
}
function random(maxValue,minValue=0){
  if(maxValue<=1){
    return(Math.floor(Math.random() * maxValue*100) + minValue+100)/100;
  }else{
    return(Math.floor(Math.random() * maxValue) + minValue);
  }
}
function removeCharAt(text = new String(),i= new Number()) {
  var tmp = text.split('');
  i = i<0?text.length+i:i; // for negative index
  tmp.splice(i , 1);
  return tmp.join('');
}
function objectSetValue(object,routeToValue=new String(),value){
  var routeArr = routeToValue.split("/");

  recursiveSetValue(object,routeArr, value);
}
function recursiveSetValue(array,routeArray = new Array(),value){
  const r = routeArray[0];
  if(routeArray.length > 1){
    routeArray.shift();
    recursiveSetValue(array[r],routeArray,value);
  }else{
    array[r] = value;
  }
}
function objectAddElement(object,routeToAdd=new String(),element,key=null){
  var routeArr = routeToAdd.split("/");
  if(Array.isArray(object)){
    recursiveArrayAddElement(object,routeArr,element);
  }else{
    recursiveObjectAddElement(object, routeArr, key, element);
  }
}
//pushmode
function recursiveArrayAddElement(array = new Array(),routeArray = new Array(),element){
  const r = routeArray[0];
  if(routeArray.length > 1){
    routeArray.shift();
    recursiveArrayAddElement(array[r],routeArray,element);
  }else{
    array[r].push(element);
  }
}
function recursiveObjectAddElement(object,routeArray = new Array(),key,element){
  const r = routeArray[0];
  if(routeArray.length > 1){
    routeArray.shift();
    recursiveObjectAddElement(object[r],routeArray,key,element);
  }else{
    Object.assign(object[r],{[key]:element});
  }
}

function objectChangeKeyName(object = new Object(), routeToChange = new Array(),oldKey = new String(),newKey = new String()){
  var routeArr = routeToChange.split("/");
  recursiveObjectChangeKeyName(object,routeArr,oldKey,newKey);

}
function recursiveObjectChangeKeyName(object,routeArray,oldKey,newKey){
  const r = routeArray[0];
  if(routeArray.length > 1){
    routeArray.shift();
    recursiveObjectChangeKeyName(object[r],routeArray,oldKey,newKey);
  }else{
    if (oldKey !== newKey) {
      Object.defineProperty(object, newKey,
          Object.getOwnPropertyDescriptor(object, oldKey));
        delete object[oldKey];
    }
  }
  
}
function complementAngle(a){
  let halfPi = Math.PI/2;
  return ((a%halfPi)/Math.abs(a%halfPi))*(halfPi-Math.abs(a%halfPi));
}
export {generateRndRGBColor, random, removeCharAt, objectSetValue,objectAddElement,objectChangeKeyName,complementAngle}