import $ from "jquery";
import Swal, { SweetAlertInput } from "sweetalert2";
function isUndef( val: any){
  return val === undefined;
}

const backendRoute = "http://192.168.137.191:10000/api/";//TODO: CAMBIAR CUANDO SE TENGA
function request(url:string,method:"get"|"post"|"put"|"delete",body:{[key:string]:any} = {}){
  return new Promise((resolve,reject)=>{
    $.ajax({
      url: backendRoute + url,
      type: method,
      data : JSON.stringify(body),
      crossDomain:true,
      processData: false,  // tell jQuery not to process the data
      contentType: "application/json", 
      success: function(result) {
        console.log(result);
        resolve(result);
      },
      error: (failure)=>{
        console.error(failure);
        reject(failure.responseText);
      }
    });
  })
}
function requestMultipart(url:string,method:"get"|"post"|"put"|"delete",body:{[key:string]:any} = {}){
  return new Promise((resolve,reject)=>{
    var formData = new FormData();
    Object.keys(body).forEach((key)=>{
      formData.append(key, body[key]);
    })

    $.ajax({
      url: backendRoute + url,
      type: method,
      data : formData,
      crossDomain:true,
      processData: false,  // tell jQuery not to process the data
      contentType: false, 
      success: function(result) {
        console.log(result);
        resolve(result);
      },
      error: (failure)=>{
        console.error(failure);
        console.error(body);
        reject(failure.responseText);
      }
    });
  })
}
function requestInputValue(label:string,type:SweetAlertInput="text"):Promise<any>{
  return new Promise((resolve)=>{
    Swal.fire({
      text: label,
      showDenyButton: false,
      showConfirmButton: true,
      confirmButtonColor:"green", 
      showCancelButton: true,
      confirmButtonText: "Create",
      cancelButtonText: "Cancelar",
      input:type
    }).then((result) => {
      if (result.isConfirmed && result.value != "") {
        resolve(result.value);
      }else if(result.value == ""){
        Swal.fire("Error","El campo no puede estar vacio","error");
      }
    });
  })
}
function requestInputSelect(label:string,options:{[key:string]:string}):Promise<any>{
  return new Promise((resolve)=>{
    Swal.fire({
      title: label,
      input: "select",
      inputOptions: options,
      inputPlaceholder: "Seleccione...",
      showCancelButton: true,
      inputValidator: (value) => {
        // return new Promise((resolve) => {
          if (value) {
            resolve(value);
          } else {
            resolve("You need to select something :)");
          }
        // });
      }
    });
  })
}
function requestInputFile(){
  return new Promise((resolve)=>{
    Swal.fire({
      title: "Select image",
      input: "file",
      inputAttributes: {
        "accept": "image/*",
        "aria-label": "Upload your profile picture"
      }
      }).then((file) => {
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          //@ts-ignore
          Swal.fire({
            title: "Your uploaded picture",
            //@ts-ignore
            imageUrl: e.target.result,
            imageAlt: "The uploaded picture"
          });
        };
        //@ts-ignore
        reader.readAsDataURL(file.value);
        resolve(file.value);
      }
    });
  })
}

function requestConfirmation(label:string):Promise<null>{
  return new Promise((resolve,reject)=>{
    setTimeout(()=>{
      Swal.fire({
        title:"Confirmar",
        text:label,
        icon:"question",
        confirmButtonText:"Confirmar",
        showCancelButton:true,
        cancelButtonText:"Cancelar"}).then(v=>{
        if(v.isConfirmed){
          resolve(null);
        }else{
          // reject(null);
        }
      }).catch(()=>{
        reject(null);
      })
    },1000);
  })
}
function setSessionValue(key:string,value:any):void{
  sessionStorage.removeItem(key);
  sessionStorage.setItem(key,typeof value == "object" ? JSON.stringify(value) : value.toString());
}

function getSessionValue(key:string){
  const value = sessionStorage.getItem(key);
  if(typeof value != "string"){
    // throw new Error(`${key} don't exist in sessionStorage`);
    return undefined
  }
  // if(!Number.isNaN(value)){
  //   return parseFloat(value);
  // }
  return value;
}

function getGeocoord(){
  return new Promise((resolve,reject)=>{
    navigator.geolocation.getCurrentPosition((coord)=>{
      const coords = [coord.coords.latitude,coord.coords.longitude];
      resolve(coords);
    }, ()=>{
      Swal.fire("Error","No se logró obtener su posición actual","error");
      resolve(null);
    });
  });

}
export {isUndef,request,requestInputValue,requestConfirmation,setSessionValue,getSessionValue,getGeocoord,requestInputFile,requestInputSelect,requestMultipart}