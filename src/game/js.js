import Swal from "sweetalert2"
import { CodedRoutine } from "../engine/engineComponents/CodedRoutine"
import { GraphObject } from "../engine/engineComponents/GraphObject"
import { KeyboardTrigger } from "../engine/engineComponents/Trigger"
import { RenderEngine } from "../engine/renderCore/RenderEngine"
import arrow from "./resources/next8.png"

const game = (engine = new RenderEngine) => {
  engine.loadTexture(arrow,"arrow").then(()=>{
    //Poner la camara en modo perspectiva
    engine.camera.usePerspective = true;
    engine.camera.position.z = -1;
    //Añadir el directorio de enemigos
    engine.gameVars = {enemyDirectory:[]};

    const graphPlayer =  new GraphObject({id:"player",texture:"arrow",enabled:true})
    engine.graphArray.push(graphPlayer);
    const player = new Player(graphPlayer);

    const graphDistance = new GraphObject({
      id:"distance", 
      x:1.2, 
      y:1.35, 
      ignoreParallax:true, 
      enabled:true, 
      fontSize:"32px",  
      text:()=>{
        return "Distancia hasta la frontera: \n" + 
        (300 -Math.round(Math.sqrt(player.x**2 + player.y**2)*20)/10)
      }
    })
    engine.graphArray.push(graphDistance);

    //Controles del Jugador
    engine.keyboardTriggers.push(new KeyboardTrigger({keys:"KeyW", onRelease:()=>{player.movimiento = false;}, onHold:()=>{player.avanzar()}}));
    engine.keyboardTriggers.push(new KeyboardTrigger({keys:"KeyS", onRelease:()=>{player.movimiento = false;}, onHold:()=>{player.retroceder()}}));
    engine.keyboardTriggers.push(new KeyboardTrigger({keys:"KeyK", onHold:()=>{player.girarIzq()}}));
    engine.keyboardTriggers.push(new KeyboardTrigger({keys:"KeyL", onHold:()=>{player.girarDer()}}));

    engine.keyboardTriggers.push(new KeyboardTrigger({keys:"KeyY",onHold:()=>{
      if(engine.camera.position.z<0){
        engine.camera.position.z += .1;
      }
    }}));
    engine.keyboardTriggers.push(new KeyboardTrigger({keys:"KeyU",onHold:()=>{
      engine.camera.position.z -= .1;
    }}));

    //Camara que persigue al Jugador
    engine.codedRoutines.push(new CodedRoutine({id:"cameraFollowsPlayer",continious:true,enabled:true,code:()=>{
      const camera = engine.camera.position;
      const xFix = (window.innerWidth/window.innerHeight - 1)/2;
      const dist = Math.sqrt((player.x-(camera.x+xFix))**2 + (player.y-camera.y)**2);
      if((300 -Math.round(Math.sqrt(player.x**2 + player.y**2)*20)/10) < 0){
        if(!player.won){
          player.won = true;
          //Add auto Displacement
          setTimeout(()=>{
            Swal.fire("Fin del viaje","Reiniciar?","question").then(v=>{
              if(v.isConfirmed){
                window.location.reload();
              }
            })
          },1000);
        }
        player.movementType == "foward" ? player.avanzar() : player.retroceder();
      }else if(dist > 0.15){
        camera.x += ((player.x-(camera.x+xFix))**3)/6;
        camera.y += ((player.y-camera.y)**3)/3;
      }
    }}))

    const bulletCreator = (agreggator=0)=>{
      if(!player.vivo){return;}
      const newBulletId = "bul"+performance.now();
      const graphBullet =  new GraphObject({id:newBulletId,texture:"arrow",invert:1,scale:0.5,enabled:true})
      engine.graphArray.push(graphBullet);
      const bullet = new Bullet(graphBullet,player,agreggator);
      //Bullet Check
      engine.codedRoutines.push(new CodedRoutine({id:newBulletId,continious:true,enabled:true,code:()=>{
        if(bullet.displacement()){
          engine.codedRoutines.remove(newBulletId);
          engine.graphArray.remove(newBulletId);
        }

        const enemyDirectory = engine.gameVars.enemyDirectory;
        enemyDirectory.forEach((enemyId,idx)=>{
          const enemy = engine.getObject(enemyId);
          if(Math.abs(bullet.x-enemy.x)<0.05){
            if(Math.abs(bullet.y-enemy.y)<0.05){
              delete engine.gameVars.enemyDirectory.splice(idx,1);
              engine.graphArray.remove(enemyId);
              engine.codedRoutines.remove(newBulletId);
              engine.graphArray.remove(newBulletId);
            }
          }
        })
      }}))
    }
    engine.keyboardTriggers.push(new KeyboardTrigger({
      keys:"Space",
      onPress:()=>{
        bulletCreator();
      }
    }))

    // Poblar el mapa con maximo 15 enemigos
    engine.codedRoutines.push(new CodedRoutine({id:"poblateEnemies",continious:true,enabled:true,code:()=>{
      var len = engine.gameVars.enemyDirectory.length;

      while(len<45){
        enemyGenerator();
        len++;
      }
    }}))

    //Comprobar la cantidad de enemigos cercanos al jugador en el mapa
    engine.codedRoutines.push(new CodedRoutine({id:"checkEnemies",continious:true,enabled:true,code:()=>{
      const enemyDirectory = engine.gameVars.enemyDirectory;
      enemyDirectory.forEach((enemyId,idx)=>{
        var displacementConstant = .027;
        const enemy = engine.getObject(enemyId);
        const dist = Math.sqrt((player.x-enemy.x)**2 + (player.y-enemy.y)**2);
        //Si los enemigos están muy lejos eliminarlos
        if(dist > 2.7){
          //TODO: Implementar el borrado de loas instancias de la clase shader
          delete engine.gameVars.enemyDirectory.splice(idx,1);
          engine.graphArray.remove(enemyId);
        }
        //Hacer que los enemigos se muevan hacia el jugador
        else if (dist > 0.06){
          if(dist > 0.7){
            displacementConstant = .035
          }
          if(dist > 1.1){
            displacementConstant = .03
          }
          if(dist > 1.5){
            displacementConstant = .02
          }
          const angle = Math.acos((player.x-enemy.x)/dist);
          enemy.rotateRad = angle
          if(player.y-enemy.y >0){
            enemy.rotateRad = angle
            enemy.y += displacementConstant*Math.sin(angle);
          }else{
            enemy.rotateRad = -angle
            enemy.y -= displacementConstant*Math.sin(angle);
          }
          enemy.x += displacementConstant*Math.cos(angle);
        }else if(player.vivo){
          setTimeout(()=>{
            Swal.fire("Has muerto","Volver a intentarlo?","question").then(v=>{
              if(v.isConfirmed){
                window.location.reload();
              }
            })
          },500);
          player.vivo = false;
          player.graph.opacity = 0;
        }
      })
    }})) 

    const enemyGenerator = ()=>{
      let max = 2
      var min = 1
      var radius = (Math.random()*(max-min))+min
      const a = (Math.random()*radius)
      const b = Math.sqrt(radius**2 - a**2)
      var x = a*(Math.random() >= 0.5 ? -1 : 1)
      var y = b*(Math.random() >= 0.5 ? -1 : 1)
      if(player.movimiento){
        const playerAngle = Math.abs(player.graph.rotate % 360)
        switch (playerAngle) {
          case playerAngle<60 || playerAngle>300: //Si el jugador está apuntando hacia delante
            y*=0.35
            x = a*1.25+0.2
            break;
          case playerAngle>120 && playerAngle<240:
            y*=0.35
            x = (-a*1.25)-0.2
            break;
        }

      }
      const enemyId = "enemy"+performance.now()+Math.random();
      engine.gameVars.enemyDirectory.push(enemyId);
      const graphEnemy =  new GraphObject({id:enemyId,x:player.x+x,y:player.y+y,texture:"arrow",grayscale:1,scale:1.5,enabled:true});

      engine.graphArray.push(graphEnemy);
    }
  })
}


class Player{
  constructor(grafRef = new GraphObject){
    this.graph = grafRef
    this.vivo = true;
    this.won = false;
    this.x = this.graph.x = 0.5
    this.y = this.graph.y = 0.5
    this.direccion = this.graph.rotate = 0;
    this.movimiento = false;
    this.movementType = "foward"
  }
  avanzar(){
    if(this.vivo && !this.won){
      this.movimiento = true;
      this.movementType = "foward"
      this.graph.x = this.x += 0.05*Math.cos(this.graph.rotateRad)
      this.graph.y = this.y += 0.05*Math.sin(this.graph.rotateRad)
    }
  }
  retroceder(){
    if(this.vivo && !this.won){
      this.movimiento = true;
      this.movementType = "backward"
      this.graph.x = this.x -= 0.05*Math.cos(this.graph.rotateRad)
      this.graph.y = this.y -= 0.05*Math.sin(this.graph.rotateRad)
    }
  }
  girarIzq(){
    if(!this.won){
      this.graph.rotate -= 10;
      this.direccion = this.graph.rotate;
    }
  }
  girarDer(){
    if(!this.won){
      this.graph.rotate += 10;
      this.direccion = this.graph.rotate;
    }
  }
}

class Bullet{
  constructor(grafRef = new GraphObject, player = new Player, agreggator = 0){
    this.graph = grafRef
    this.x = this.graph.x = player.x + agreggator*Math.cos(player.graph.rotateRad)
    this.y = this.graph.y = player.y + agreggator*Math.sin(player.graph.rotateRad)
    this.timer = 75;
    this.direccion = this.graph.rotate = player.direccion
  }
  displacement(){
    this.graph.x = this.x += 0.085*Math.cos(this.graph.rotateRad)
    this.graph.y = this.y += 0.085*Math.sin(this.graph.rotateRad)
    this.timer -= 1;

    return this.timer < 0;
  }
}

export {game}