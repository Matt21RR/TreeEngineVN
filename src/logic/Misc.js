function generateRndRGBColor(maxLumminosityLevel=255,minLumminosityLevel=1){
  const randChannelCodeGenerator = ()=>{
    return(Math.floor(Math.random() * maxLumminosityLevel) + minLumminosityLevel);
  }
  return ("rgb("+randChannelCodeGenerator()+","+randChannelCodeGenerator()+","+randChannelCodeGenerator()+")");
}
export {generateRndRGBColor}