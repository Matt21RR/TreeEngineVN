import { Howl } from "howler";
import EngTexture from "./EngTexture.ts";
import { Dictionary } from "../../global.ts";
import { Request, RequestFile, RequestFileWithMime } from "../../../wailsjs/go/main/App.js";
import RenderMiscWebGPU from "./RenderMiscWebGPU.ts";
import { base64ToBytesAsync } from "./GlbParser.ts";
const RenderMisc = RenderMiscWebGPU;

/** Carpetas de caches generadas de los modelos: `_lod` (LOD) y `_tex` (BC7). */
export type ModelCacheDir = "_lod" | "_tex";

/** Almacen de una cache de modelos (`models/_lod/`, `models/_tex/`). Por
 *  defecto usa el backend Wails; los entornos sin backend (harness de
 *  desarrollo) inyectan otro en `window.__CACHE_STORE__(dir)`. list() = null
 *  si no hay almacen disponible. */
export interface CacheStore {
  list(): Promise<string[] | null>;
  write(name: string, bytes: Uint8Array): Promise<boolean>;
  remove(name: string): Promise<boolean>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  }
  return btoa(bin);
}

//*Backend Wails (backend/Request/Request.go): getHierarchy / createDir /
//upload (base64) / delete. Rutas relativas al ejecutable: ./game/models/<dir>.
const wailsCacheStore = (dir: ModelCacheDir): CacheStore => ({
  async list() {
    try {
      const root: any = await Request({ action: "getHierarchy" });
      const models = root?.content?.find((e: any) => e.type === "dir" && e.name === "models");
      const cacheDir = models?.content?.find((e: any) => e.type === "dir" && e.name === dir);
      if (!models) return null;
      return (cacheDir?.content ?? []).filter((e: any) => e.type === "file").map((e: any) => e.name as string);
    } catch {
      return null;
    }
  },
  async write(name, bytes) {
    try {
      await Request({ action: "createDir", dir: "./game/models", folderName: dir }).catch(() => null);
      const res = await Request({ action: "upload", dir: "./game/models/" + dir, filename: name, file: bytesToBase64(bytes) });
      return res == null;
    } catch {
      return false;
    }
  },
  async remove(name) {
    try {
      return !!(await Request({ action: "delete", dir: "./game/models/" + dir + "/" + name, type: "file" }));
    } catch {
      return false;
    }
  },
});

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
                const sound = new Howl({
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

  static loadTexture(indexPath:string, textureId:string, engineRegisteredTexturesList:Array<string>){
    return new Promise(function (resolve, reject) {
      RequestFile( indexPath )
        .then(res => atob(res))
        .then(res => JSON.parse(res))
        .then(texturesData=>{
          Promise.all(
            Object.keys(texturesData)
            .map(textureName=>{
            if(engineRegisteredTexturesList.includes(textureName)){
              return new Promise((resolveFile)=>{
                console.warn(textureName + " already in engine.textureManager.texturesList");
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
                      (new EngTexture())
                      .instanceIt(image,textureName)
                      .then((shader)=>{
                          RenderMisc.getInstance().preloadImage(shader.getTexture(), textureName).then(()=>{
                            resolveFile(shader);
                          });
                        });
                    });
                  })
                  .catch(err=>{
                    console.warn(err);
                    resolveFile(null);
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
            //sin resolver, la cadena de arranque de la escena quedaria colgada
            resolve([]);
          });
        })
      })
  }

  //*URL base del servidor local de ./game (backend Go). Cacheada: el primer
  //llamado arranca el servidor (puerto efimero en 127.0.0.1). Si no hay
  //backend (vite puro) o falla, se rechaza y cada llamador usa su fallback.
  private static assetBaseURL: Promise<string> | null = null;
  static getAssetBaseURL(): Promise<string>{
    if(!ResourceLoader.assetBaseURL){
      ResourceLoader.assetBaseURL = (async () => {
        const mod: any = await import("../../../wailsjs/go/main/App.js");
        if(typeof mod.GetAssetBaseURL !== "function") throw new Error("sin servidor de assets");
        return await mod.GetAssetBaseURL();
      })();
    }
    return ResourceLoader.assetBaseURL;
  }

  //*Descarga binaria directa (sin base64): path tipo ./game/models/x.glb se
  //resuelve contra el servidor local. Falla si no hay backend.
  static async fetchAssetBytes(path:string): Promise<Uint8Array>{
    const base = await ResourceLoader.getAssetBaseURL();
    const rel = path.replace(/^\.\/game\//, "").replace(/^\.\//, "");
    const t0 = performance.now();
    //*no-cache: siempre revalidar (304 barato en loopback). Sin esto el
    //navegador reutiliza por heuristica (Last-Modified) un .tex/.lod que el
    //motor acaba de regenerar, o un asset reemplazado con la app abierta.
    const r = await fetch(base + "/" + rel, { cache: "no-cache" });
    if(!r.ok) throw new Error(`asset server ${r.status} para ${rel}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    console.info(`Asset '${rel}': ${(bytes.length / 1048576).toFixed(2)} MB por HTTP local en ${Math.round(performance.now() - t0)} ms (sin base64).`);
    return bytes;
  }

  //*Indice de modelos (models.json): { id: "./archivo.glb" }. Claves con "_"
  //son comentarios/metadatos. null si no existe (proyectos anteriores al
  //soporte 3D). Fallback fetch para entornos sin backend Wails (vite puro).
  static async readModelsIndex(indexPath:string): Promise<Record<string, string> | null>{
    try {
      const text = await RequestFile(indexPath)
        .then(res => atob(res))
        .catch(() => fetch(indexPath).then(r => {
          if(!r.ok) throw new Error(`fetch ${indexPath}: ${r.status}`);
          return r.text();
        }));
      const index = JSON.parse(text) as Record<string, string>;
      const out: Record<string, string> = {};
      for (const id of Object.keys(index)) {
        if (!id.startsWith("_")) out[id] = index[id];
      }
      return out;
    } catch {
      return null;
    }
  }

  //*Ruta de proyecto de un archivo listado en models.json.
  static modelPath(file:string): string{
    return window.projectRoute + "models/" + file.replace("./","");
  }

  //*Cache de LOD: `models/_lod/<archivo.glb>.lod`.
  static lodName(modelPath:string): string{
    return modelPath.split("/").pop()! + ".lod";
  }
  static lodPath(modelPath:string): string{
    return window.projectRoute + "models/_lod/" + ResourceLoader.lodName(modelPath);
  }
  static lodStore(): CacheStore{
    return ResourceLoader.cacheStore("_lod");
  }
  //*Cache de texturas BC7: `models/_tex/<archivo.glb>.tex`.
  static texName(modelPath:string): string{
    return modelPath.split("/").pop()! + ".tex";
  }
  static texPath(modelPath:string): string{
    return window.projectRoute + "models/_tex/" + ResourceLoader.texName(modelPath);
  }
  static texStore(): CacheStore{
    return ResourceLoader.cacheStore("_tex");
  }
  static cacheStore(dir: ModelCacheDir): CacheStore{
    const injected = (window as any).__CACHE_STORE__;
    return (typeof injected === "function" ? injected(dir) : null) ?? wailsCacheStore(dir);
  }

  //*Bytes de un asset opcional (null si no existe). Solo via servidor local o
  //fetch directo: sin el fallback base64 (un .lod ausente es lo normal).
  static async fetchOptional(path:string): Promise<Uint8Array | null>{
    try {
      return await ResourceLoader.fetchAssetBytes(path);
    } catch {
      try {
        const r = await fetch(path);
        return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
      } catch {
        return null;
      }
    }
  }

  //*Bytes de un asset binario: servidor HTTP local (sin base64) -> binding
  //Wails en base64 (decodificado por bloques con yields) -> fetch directo.
  static fetchBinary(path:string): Promise<Uint8Array>{
    return ResourceLoader.fetchAssetBytes(path).catch(() =>
      RequestFile(path)
        .then(resK => base64ToBytesAsync(resK))
        .catch(() => fetch(path).then(async r => {
          if(!r.ok) throw new Error(`fetch ${path}: ${r.status}`);
          return new Uint8Array(await r.arrayBuffer());
        })));
  }
}

export default ResourceLoader
