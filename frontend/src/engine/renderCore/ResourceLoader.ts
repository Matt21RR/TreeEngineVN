import { Howl } from "howler";
import Shader from "./Shaders.ts";
import { Dictionary } from "../../global.ts";
import { RequestFile, RequestFileWithMime } from "../../../wailsjs/go/main/App.js";



class ResourceLoader{
  static loadSound(indexPath:string){
    return new Promise(function (resolve, reject) {
      RequestFile(indexPath)
        .then(res => atob(res))
        .then(res => JSON.parse(res))
        .then(soundsList=>{
          if(Object.keys(soundsList).length > 0){
            Promise.all(Object.keys(soundsList).map(sndName=>
              new Promise(resolveFile=>{
                RequestFileWithMime(window.projectRoute + "sounds/" + soundsList[sndName].replace("./",""))
                  .then( res => {
                    const ans = {Base64:res ,ext:soundsList[sndName].split('.').at(-1), id:sndName};
                    resolveFile(ans) 
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
          (new Shader())
            .instanceIt(image,textureId)
            .then((shader)=>{
              resolve([shader]);
            })
        });
      });
    }

    return new Promise(function (resolve, reject) {
      RequestFile( indexPath )
        .then(res => atob(res))
        .then(res => JSON.parse(res))
        .then(texturesData=>{
          Promise.all(Object.keys(texturesData)
            .map(textureName=>{
            if(engineRegisteredTexturesList.includes(textureName)){
              return new Promise((resolveFile)=>{
                console.warn(textureName + " already in engine.texturesList");
                resolveFile(null);
              });
            }else{
              engineRegisteredTexturesList.push(textureName);
              return new Promise((resolveFile)=>{
                RequestFileWithMime(window.projectRoute + "textures/" + texturesData[textureName].replace("./",""))
                  .then(resK=>{
                    const image = new Image();
                    image.crossOrigin = "Anonymous";
                    image.src = resK;
                    image.addEventListener('load',()=>{
                      (new Shader())
                        .instanceIt(image,textureName)
                        .then((shader)=>{
                          resolveFile(shader);
                        });
                    });
                  })
              })
            }
          }))
          .then((resolutionList) => {
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