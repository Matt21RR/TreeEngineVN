import { Howl } from "howler";
import { Shader } from "./Shaders.ts";
import { Dictionary } from "../../global.ts";



class ResourceLoader{
  static loadSound(indexPath:string){
    return new Promise(function (resolve, reject) {
      if(indexPath.indexOf(".")==0){
        indexPath = indexPath.substring(1);
      }
      fetch(indexPath)
        .then(res =>{return res.json()})
        .then(soundsList=>{
          if(Object.keys(soundsList).length > 0){
            Promise.all(Object.keys(soundsList).map(sndName=>
              new Promise(resolveFile=>{
                fetch(window.projectRoute + "snd/" + soundsList[sndName].replace("./",""))
                  .then(res => res.blob())
                  .then( blob => {
                    var reader = new FileReader() ;
                    reader.onload = function(){ 
                      const ans = {Base64:this.result,ext:soundsList[sndName].split('.').at(-1),id:sndName};
                      resolveFile(ans) 
                    };
                    reader.readAsDataURL(blob) ;
                });
              })
            )).then((sounds) => {
              let soundsListRes: Array<{sound:Howl,id:string}> = [];
              (sounds as Array<Dictionary>).forEach(snd => {
                var sound = new Howl({
                  src: [snd.Base64],
                  format: snd.ext
                });
                soundsListRes.push({sound:sound,id:snd.id})
              });
              resolve(soundsListRes);
            }).catch(reason =>{
              console.error("===============================");
              console.error("Error during sounds load phase:");
              console.error(reason);
              console.error("===============================");
            });
          }else{
            console.warn(`No sounds in this file: ${indexPath}`);
              resolve(null);
          }
        })
    })
  }

  static loadTexture(indexPath:string, textureId:string, clientSideResources:boolean, engineRegisteredTexturesList:Array<string>){
    if(clientSideResources){
      return new Promise(function (resolve, reject) {
        const image = new Image();
        image.crossOrigin = "Anonymous";
        image.src = indexPath;
        image.addEventListener('load',()=>{
          resolve([new Shader(image,textureId)]);
        });
      });
    }

    return new Promise(function (resolve, reject) {
      if(indexPath.indexOf(".")==0){
        indexPath = indexPath.substring(1);
      }
      fetch(indexPath, {cache: "no-store"})
        .then(res => res.json())
        .then(texturesData=>{
          Promise.all(Object.keys(texturesData).map(textureName=>{
            if(engineRegisteredTexturesList.includes(textureName)){
              return new Promise((resolveFile)=>{
                console.warn(textureName + " already in engine.texturesList");
                resolveFile(null);
              });
            }else{
              engineRegisteredTexturesList.push(textureName);
              return new Promise((resolveFile)=>{
                const image = new Image();
                image.crossOrigin = "Anonymous";
                image.src = window.projectRoute + "img/" + texturesData[textureName].replace("./","");
                image.addEventListener('load',()=>{
                  resolveFile(new Shader(image,textureName));
                });
              })
            }
          })).then((resolutionList) => {
            //* filter non-shader elements 
            resolutionList = resolutionList.filter((element)=>{return element != null});
            resolve(resolutionList);
          }).catch(reason =>{
            console.error("===============================");
            console.error("Error during textures load phase:");
            console.error(reason);
            console.error("===============================");
          });
        })
      })
  }
}

export default ResourceLoader