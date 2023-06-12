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
export {generateRndRGBColor,random,removeCharAt}