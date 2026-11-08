import { RenderEngine } from "../renderCore/RenderEngine.tsx";
import { ColorTranslator } from 'colortranslator';

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
  const lineArray:Array<TextLine> = [];
  const width = (s:string) => ctx.measureText(s).width;

  const pushLine = (value:string, measured?:number) => {
    const offset = center ? (maxWidth - (measured ?? width(value)))/2 : 0;
    lineArray.push({value, x: x + offset, y});
    y += lineHeight;
  };

  //Explicit line breaks first, then word wrapping inside each paragraph
  const paragraphs = text.replaceAll('\r\n','\n').split('\n');
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/[ \t]+/).filter(w => w.length > 0);
    if(words.length === 0){
      pushLine('', 0);
      continue;
    }
    let line = '';
    let lineWidth = 0;
    for (let word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const candidateWidth = width(candidate);
      if(candidateWidth <= maxWidth || maxWidth <= 0){
        line = candidate;
        lineWidth = candidateWidth;
        continue;
      }
      //Doesn't fit: close the current line (if any)
      if(line){
        pushLine(line, lineWidth);
        line = '';
        lineWidth = 0;
      }
      //Word wider than the whole line: break it by characters
      let wordWidth = width(word);
      while(wordWidth > maxWidth && word.length > 1){
        const chars = Array.from(word);
        let cut = 1;
        while(cut < chars.length && width(chars.slice(0, cut+1).join('')) <= maxWidth) cut++;
        const piece = chars.slice(0, cut).join('');
        pushLine(piece);
        word = chars.slice(cut).join('');
        wordWidth = width(word);
      }
      line = word;
      lineWidth = wordWidth;
    }
    if(line) pushLine(line, lineWidth);
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

//Cache of compiled template literals: avoids compiling a new Function every frame
const templateCache = new Map<string, Function>();
const TEMPLATE_CACHE_LIMIT = 512;

function getStr(text:Function|string):string{
  try {
    if(typeof text == "function"){
      text = text(RenderEngine.getInstance());
    }
    if(typeof text != "string"){
      text = text.toString() as string;
    }
    if(text.includes("${")){
      let compiled = templateCache.get(text);
      if(!compiled){
        compiled = new Function("engine", `return \`${text}\``);
        if(templateCache.size >= TEMPLATE_CACHE_LIMIT) templateCache.clear();
        templateCache.set(text, compiled);
      }
      text = compiled(RenderEngine.getInstance()) as string;
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

//*El backend (RequestFile) devuelve los bytes crudos del archivo en base64.
//atob() solo produce una cadena "binaria" (un char por byte), asi que el texto
//UTF-8 (acentos, ñ, ¿) se debe decodificar explicitamente.
export function decodeBase64Utf8(base64: string): string{
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

export function colorToRGBA(colorCode: string) : [number, number, number, number]{
  if(colorCode == "transparent"){
    return [0,0,0,0];
  }
  try{
    const res = new ColorTranslator(colorCode);
    
    return [res.R, res.G, res.B, res.A*255] as [number, number, number, number];
  }catch(e){
    console.error("Error converting color code: ", colorCode, e);
    return [128,0,128,255]; // Magenta
  }
}

export function getClassAttribs<T>(classInstance:T, propertyNames: Array<string>){
  //Recorre la cadena de prototipos para no perder getters heredados
  //(necesario para subclases como ModelObject: solo el prototipo propio
  //no contiene los getters base y atribsNames quedaba vacio).
  const atributesNames = propertyNames.filter(key =>{
    let proto = Object.getPrototypeOf(classInstance);
    while(proto && proto !== Object.prototype){
      const descriptors = Object.getOwnPropertyDescriptors(proto);
      if(descriptors[key] && "get" in descriptors[key]) return true;
      proto = Object.getPrototypeOf(proto);
    }
    return false;
  });
  return atributesNames;
}
export {
  mobileCheck,
  wrapText,
  random,
  lambdaConverter,
  getStr,
  degToRad,
  rad2Deg,
  getAttribs,
  arrayFlatter,
  sortByReference,
  templateLiteralSplitter,
  isTemplateLiteral,
  arrayChuncker
}