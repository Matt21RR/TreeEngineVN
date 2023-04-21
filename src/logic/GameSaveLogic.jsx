import domtoimage from 'dom-to-image';
import localforage from 'localforage';
class GameSaveLogic{
  static takeScreenshot(onComplete,imageId){
    domtoimage.toJpeg(document.getElementById('gameCanvasScreenshotTarget'), { quality: 0.7,height: window.innerHeight, width:window.innerWidth })
    .then(function (dataBlob) {
      localforage.keys().then(function(keys) {
        if(keys.indexOf("thumbnails") != -1){
          localforage.getItem("thumbnails",(err,value)=>{
            localforage.setItem("thumbnails",Object.assign(value,{[imageId]:dataBlob}),(err)=>{
              if(onComplete != null){
                onComplete();
              }
            });
          });
        }else{
          localforage.setItem("thumbnails",{[imageId]:dataBlob},(err)=>{
            if(onComplete != null){
              onComplete();
            }
          });
        }
      });

    });
  }
  //*Use  localforage to storage the savegame thumbnail
  static getSavedGamesThumbnails(onComplete){
      localforage.keys().then(function(keys) {
        if(keys.indexOf("thumbnails") != -1){
          localforage.getItem("thumbnails",(err,res)=>{
            onComplete(res);
          });
        }else{
          onComplete(new Object());
        }
      }); 
  }
  static getSavedGames(){
    var savedGames = new Array();
    if("savedGames" in localStorage){
      savedGames = JSON.parse(localStorage.getItem("savedGames"));
    }
    return savedGames;
  }
  //*Use  localforage to storage the savegame thumbnail
  static saveGame(actualNode, overwrite = false, dataToSave = null, onComplete = null){
    if(!("savedGames" in localStorage)){
      localStorage.setItem("savedGames",JSON.stringify(new Array()));
    }
    var savedGames = this.getSavedGames();
    var gameDataToSave = structuredClone(Object.assign({},{node:actualNode,saveDate:Number(Date.now())},(dataToSave!=null?{storyVars:dataToSave}:{storyVars:new Object()})));
    if(!overwrite){
      savedGames.push(gameDataToSave);
    }else{
      savedGames[overwrite] = gameDataToSave;
    }
    localStorage.setItem("savedGames",JSON.stringify(savedGames));
    this.takeScreenshot(
      ()=>{
        if(onComplete != null){
          onComplete();
        }
      },
      gameDataToSave.saveDate
    );
  }
  static deleteSavedGame(index,onComplete = null){
    const savedGameToDeleteDate = this.getSavedGame(index).saveDate;
    //remove the image from
    this.getSavedGamesThumbnails((thumbnails)=>{
      var finalThumbsList = new Object();
      Object.keys(thumbnails).forEach(thumbId => {
        if(thumbId != savedGameToDeleteDate){
          Object.assign(finalThumbsList,{[thumbId]:thumbnails[thumbId]});
        }
      });
      localforage.setItem("thumbnails",finalThumbsList);
    });
    var finalSavedGames = this.getSavedGames();
    finalSavedGames.splice(index,1);
    localStorage.setItem("savedGames",JSON.stringify(finalSavedGames));
    if(onComplete != null){
      onComplete();
    }
  }
  static getSavedGame(slot){
    return this.getSavedGames()[slot];
  }
  static getLastSavedGame(){
    const savedGamesDateList = this.getSavedGames().map(e => e.saveDate);
    const lastSavedGame = structuredClone(Object.assign([],savedGamesDateList).sort(function(a, b){return a - b}).at(-1));
    return this.getSavedGames()[savedGamesDateList.indexOf(lastSavedGame)];
  }
}
export {GameSaveLogic}