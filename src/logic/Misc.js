function generateRndRGBColor(maxLumminosityLevel=255,minLumminosityLevel=1){
  const randChannelCodeGenerator = ()=>{
    return(Math.floor(Math.random() * maxLumminosityLevel) + minLumminosityLevel);
  }
  return ("rgb("+randChannelCodeGenerator()+","+randChannelCodeGenerator()+","+randChannelCodeGenerator()+")");
}
function random(maxValue,minValue=0){
  return(Math.floor(Math.random() * maxLumminosityLevel) + minLumminosityLevel);
}
export {generateRndRGBColor,random}