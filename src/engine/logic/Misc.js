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
function mobileCheck() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hipy|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};
function halfRounder(numb){
  const floor = Math.floor(numb);
  return floor + (numb-floor >= .5 ? .5 : 0);
}
/**
 * Check if a value is numeric
 * @param {*} Value to check
 * @returns {bool}
 */
function isNumeric(data){
  return (!isNaN(parseFloat(data)));
}
/**
 * Closest number in an array of numbers
 * @param {*} ar 
 * @param {*} search 
 */
function closest(ar,search){ 
  //console.log(ar,search);
  return ar.reduce((a, b) => {
    return Math.abs(b - search) < Math.abs(a - search) ? b : a;
  });
}
// @description: wrapText wraps HTML canvas text onto a canvas of fixed width
// @param context del canvas principal
// @param text - el texto a probar
// @param x - coordenada horizontal de origen.
// @param y - coordenada vertical de origen.
// @param maxWidth - la medida del ancho maximo del lugar donde se quiere agregar el texto.
// @param lineHeight - altura entre linea y linea.
// @returns an array of [ lineText, x, y ] for all lines
function wrapText(ctx, text, x, y, maxWidth, lineHeight,center = false) {
  // First, start by splitting all of our text into words, but splitting it into an array split by spaces
  let words = text.replaceAll('\n',()=>{return ' \n \n '}).split(' ');
  let line = ''; // This will store the text of the current line
  let testLine = ''; // This will store the text when we add a word, to test if it's too long
  let lineArray = []; // This is an array of lines, which the function will return

  const centering = () => {
    if(center){
      let metricsF = ctx.measureText(line);
      let testWidthF = metricsF.width;
      return (maxWidth-testWidthF)/2;
    }else{
      return 0;
    }
      
  }
  // Lets iterate over each word
  for(var n = 0; n < words.length; n++) {
    // Create a test line, and measure it..
    testLine += `${words[n]} `;
    let metrics = ctx.measureText(testLine);
    let testWidth = metrics.width;
    // If the width of this test line is more than the max width
    //console.log(line)
    if ((testWidth > maxWidth && n > 0) || line.indexOf('\n') != -1) {
        // Then the line is finished, push the current line into "lineArray"
        lineArray.push([line, x+centering(), y]);
        // Increase the line height, so a new line is started
        y += lineHeight;
        // Update line and test line to use this word as the first word on the next line
        line = `${words[n]} `;
        testLine = `${words[n]} `;
    }
    else {
        // If the test line is still less than the max width, then add the word to the current line
        line += `${words[n]} `;
    }
    // If we never reach the full max width, then there is only one line.. so push it into the lineArray so we return something
    if(n === words.length - 1) {
        lineArray.push([line, x+centering(), y]);
        //TODO: Medir el ancho disponible y
    }
  }
  // Return the line array
  
  return lineArray;
}
export {generateRndRGBColor, random, removeCharAt, objectSetValue,objectAddElement,objectChangeKeyName,mobileCheck,halfRounder,isNumeric,closest,wrapText}