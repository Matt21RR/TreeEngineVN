import { RenderEngine } from "../renderCore/RenderEngine.tsx";

export type TextLine = {value:string,x:number,y:number};

function mobileCheck() {
  return 'ontouchstart' in window ;
};
// @description: wrapText wraps HTML canvas text onto a canvas of fixed width
// @param context del canvas principal
// @param text - el texto a probar
// @param x - coordenada horizontal de origen.
// @param y - coordenada vertical de origen.
// @param maxWidth - la medida del ancho maximo del lugar donde se quiere agregar el texto.
// @param lineHeight - altura entre linea y linea.
// @returns an array of [ lineText, x, y ] for all lines
function wrapText(
  ctx:CanvasRenderingContext2D, 
  text:string, 
  x:number, 
  y:number, 
  maxWidth:number, 
  maxHeight:number, 
  lineHeight:number,
  center = false, 
  verticalCenter = false): Array<TextLine> {
  // First, start by splitting all of our text into words, but splitting it into an array split by spaces
  let words = text.replaceAll('\n',()=>{return ' \n '}).split(' ');
  let line = ''; // This will store the text of the current line
  let testLine = ''; // This will store the text when we add a word, to test if it's too long
  let lineArray:Array<TextLine> = []; // This is an array of lines, which the function will return

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
  for(let n = 0; n < words.length; n++) {
    // Create a test line, and measure it..
    testLine += `${words[n]} `;
    let metrics = ctx.measureText(testLine);
    let testWidth = metrics.width;
    // If the width of this test line is more than the max width
    if ((testWidth > maxWidth && n > 0) || line.indexOf('\n') != -1) {
        // Then the line is finished, push the current line into "lineArray"
        lineArray.push({value:line,x: x+centering(), y});
        // Increase the line height, so a new line is started
        y += lineHeight;
        // Update line and test line to use this word as the first word on the next line
        line = `${words[n]} `;
        testLine = `${words[n]} `;
    }
    else {// If the test line is still less than the max width, then add the word to the current line
        line += `${words[n]} `;
    }
    // If we never reach the full max width, then there is only one line.. so push it into the lineArray so we return something
    if(n === words.length - 1) {
        lineArray.push({value:line,x: x+centering(), y});
        //TODO: Medir el ancho disponible y
    }
  }

  if(verticalCenter){
    const compensationMeasurement = (maxHeight - lineArray.length * lineHeight) / 2;
    for (let index = 0; index < lineArray.length; index++) {
      lineArray[index].y += compensationMeasurement;
    }
  }
  // Return the line array
  
  return lineArray;
}

/**
 * Detects if a string represents a lambda function of the form "(param) => { body }"
 * or "(param) => { body }", extracts the parameter name, and converts it to a callable function.
 * specific for RenderEngine, accepts lambda functions with zero or one parameters
 * @param {string|null} str - The string to check and convert.
 * @returns {string|function|null} - An object with the function and parameter name if valid; otherwise, null.
 */
function lambdaConverter(str:string|Function|null): string | Function | null {
  if(str == null){return null;}
  if(typeof str == "function"){return str;}
  // Regex to match lambda functions with a single parameter and a block body
  const lambdaPattern = /^\s*(\(?\s*([^()\s]*)\s*\)?)\s*=>\s*\{[\s\S]*\}\s*$/;
  let match
  try {
    match = str.match(lambdaPattern);
  } catch (error) {
    console.error(str, typeof str,error);
  }

  if (!match) {
      return str; // Not a valid lambda function, return the string expresion
  }

  try {
      const parameter = match[2] || null; // Extract parameter name or null if no parameter
      if (parameter && parameter.includes(",")) {
          // Break if more than one parameter
          console.warn(`Lambda function must have at most one parameter, ${((parameter.match(/,/g) || []).length+1)} given`)
          return str;
      }
      // Use the Function constructor to create the function
      let func;  
      func = new Function('engine',`return ${str};`)();
      if (typeof func === "function") {
          return func;
      }
  } catch (error) {
      console.error("Error creating function:", error);
  }
  return str; // Invalid string
}

function getStr(text:Function|string):string{
  try {
    if(typeof text == "function"){
      text = text(RenderEngine.getInstance());
    }
    if(typeof text != "string"){
      text = text.toString() as string;
    }
    if(text.includes("${")){
      text = new Function("engine", `return \`${text}\``)() as string;
    }
    return text; 
  } catch (error) {
    // console.warn("UNREADABLE STUFF DETECTED!!!!");
    // console.log(text);
    // console.error(error);
    return "UNREADABLE STUFF";
  }
}

function random(max:number,min=0){
    return (Math.random() * (max - min + 1)) + min;
}

function degToRad(deg:number){
  return (Math.PI*deg)/180;
}
function rad2Deg(rad:number){
  return (180*rad)/Math.PI;
}

/**
 * Generic method used to get the attribute names of a class
 * @param elConstructor T
 * @returns 
 */
function getAttribs<T>(element: T){
  //Todo: if the prototype have a prototype
  let proto = Object.getPrototypeOf(element);
  let attributesNames:Array<string> = [];
  //*Iterate the prototype and arent prototypes
  while(proto && proto !== Object.prototype){
    const propertyDescriptors = (Object.getOwnPropertyDescriptors(proto));
    for(const descriptorName in propertyDescriptors){
      const descriptor = propertyDescriptors[descriptorName];
      if("get" in descriptor){
        attributesNames.push(descriptorName);
      }
    }

    proto = Object.getPrototypeOf(proto);
  }

  return attributesNames;
}

function arrayFlatter(list:Array<any>){
  list = list.flat() as Array<any>;
  if(list.filter(e => Array.isArray(e)).length != 0){
      list = arrayFlatter(list);
  }
  return list;
}

function arrayChuncker<T>(list:Array<T>, condition:(element:T)=>boolean){
  let arrayOfArrays:Array<Array<T>> = [];
  let newArray: Array<T> = [];

  list.forEach((element:any)=>{
    if(!(condition(element))){
      newArray.push(element);
    }else{
      arrayOfArrays.push(newArray);
      newArray = [];
    }
  });

  if(newArray.length != 0){
    arrayOfArrays.push(newArray);
  }

  return arrayOfArrays
}

function sortByReference(arr:Array<any>, order:Array<any>) {
  return arr.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
function Mixin(...mixins: any[]) {
    return function (target: any) {
        Object.assign(target.prototype, ...mixins.map(m => m.prototype));
    };
}

function isTemplateLiteral(source:string):boolean{
 return source.startsWith("`") && source.endsWith("`");
}

function templateLiteralSplitter(source:string){
  if (!source.startsWith("`") || !source.endsWith("`")) {
    throw new Error("Not a template literal");
  }

  // Remove backticks
  source = source.slice(1, -1);

  let parts: Array<string> = [];
  let buffer = "";
  let i = 0;

  while (i < source.length) {
    if (source[i] === "$" && source[i + 1] === "{") {
      // Push current text
      if (buffer) {
        parts.push(buffer);
        buffer = "";
      }

      // Capture ${ ... } with nesting
      let depth = 0;
      let start = i;
      while (i < source.length) {
        if (source[i] === "$" && source[i + 1] === "{") {
          depth++;
          i += 2;
        } else if (source[i] === "}") {
          depth--;
          i++;
          if (depth === 0) break;
        } else {
          i++;
        }
      }

      // Push expression block
      parts.push(source.slice(start, i));
    } else {
      buffer += source[i++];
    }
  }

  if (buffer) parts.push(buffer);

  return parts;
}
export {mobileCheck,wrapText,random,lambdaConverter, getStr,degToRad,rad2Deg,getAttribs,arrayFlatter, sortByReference, Mixin, templateLiteralSplitter, isTemplateLiteral, arrayChuncker}