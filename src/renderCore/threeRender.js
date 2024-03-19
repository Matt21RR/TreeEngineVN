import * as THREE from 'three';
import mapa from "../res/gameRes/parsel1.png";
import { degToRad } from 'three/src/math/MathUtils';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';


function ap(texture,anisotropicFilter=4,antialias=false){
  const scene = new THREE.Scene(); // Creando el objeto escena, donde se añadirán los demás.
  scene.background = new THREE.Color("black");
  const camera = new THREE.PerspectiveCamera( 
    75, // Ángulo de "grabación" de abajo hacia arriba en grados.
    window.innerWidth / window.innerHeight, // Relación de aspecto de la ventana de la cámara(Ejemplo: 16:9).
    0.1, // Plano de recorte cercano (más cerca no se renderiza).
    1000 // Plano de recorte lejano  (más lejos no se renderiza).
  );
  var keyboardOptions = {
    KeyO:()=>{ //"orthographic" camera
          if(!orthographicMode){
            orthographicMode = true;
            scene.children.forEach((mesh)=>{mesh.position.z/=10000});
          }
        },
    KeyP:()=>{ //perspective camera
          if(orthographicMode){
            orthographicMode = false;
            scene.children.forEach((mesh)=>{mesh.position.z*=10000});
          }
        },
    KeyW:()=>{
      controls.moveForward(.1);
    },  
    KeyS:()=>{
      controls.moveForward(-.1);
    },  
    KeyD:()=>{
      controls.moveRight(.1);
    },  
    KeyA:()=>{
      controls.moveRight(-.1);
    },  
    Space:()=>{
      camera.position.y += 0.1;
    },  
    ShiftLeft:()=>{
      camera.position.y -= 0.1;
    }  
          
  }
  let orthographicMode = false;
  
  //*EJES
  const geometry1 = new THREE.PlaneGeometry( 100, 100 );
  const geometry2 = new THREE.PlaneGeometry( 101, 100 );
  const geometry3 = new THREE.PlaneGeometry( 102, 100 );
  const material1 = new THREE.MeshBasicMaterial( {color: 0xf2f200, side: THREE.DoubleSide, opacity:.08, transparent:true} );
  const material2 = new THREE.MeshBasicMaterial( {color: 0x0341fc, side: THREE.DoubleSide, opacity:.08, transparent:true} );
  const material3 = new THREE.MeshBasicMaterial( {color: 0x2c7a10, side: THREE.DoubleSide, opacity:.08, transparent:true} );
  const plane = new THREE.Mesh( geometry1, material1 );
  const plane2 = new THREE.Mesh( geometry2, material2 );
  const plane3 = new THREE.Mesh( geometry3, material3 );
  plane.rotateX(degToRad(90))
  plane2.rotateZ(degToRad(90))
  plane3.rotateY(degToRad(90))
  scene.add( plane );
  scene.add( plane2 );
  scene.add( plane3 );
  //*==========================
  
  const renderer = new THREE.WebGLRenderer({antialias:antialias,alpha:true}); // Utilizar el renderizador WebGL.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  console.log(renderer.capabilities.getMaxAnisotropy());
  renderer.setSize( window.innerWidth, window.innerHeight ); // Renderizador del tamaño de la ventana.
  document.getElementById("display").appendChild( renderer.domElement ); // Añadir el renderizador al elemento DOM body.
  
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropicFilter;

  const objectScale = 3;
  const objectHeightScale = texture.source.data.naturalHeight*objectScale/texture.source.data.naturalWidth;
  const material = new THREE.MeshBasicMaterial( { map: texture } ); // Crear el material para la

  const geometry = new THREE.BoxGeometry( objectScale, objectHeightScale, 0 ); // Crear geometría cúbica con dimensiones(x, y, z).
  const cube = new THREE.Mesh( geometry, material ); // Crear una malla que agrupará la geometría
  const cube2 = new THREE.Mesh( geometry, material ); // Crear una malla que agrupará la geometría
  const cube3 = new THREE.Mesh( geometry, material ); // Crear una malla que agrupará la geometría
  const cube4 = new THREE.Mesh( geometry, material ); // Crear una malla que agrupará la geometría
  const cube5 = new THREE.Mesh( geometry, material ); // Crear una malla que agrupará la geometría
  const cube6 = new THREE.Mesh( geometry, material ); // Crear una malla que agrupará la geometría
  const cube7 = new THREE.Mesh( geometry, material ); // Crear una malla que agrupará la geometría
  const cube8 = new THREE.Mesh( geometry, material ); // Crear una malla que agrupará la geometría
  
  cube.position.z = -0.1;
  cube2.position.z = -4;
  cube2.position.x = -1;

  scene.add( cube ); // Añadir la malla al objeto escena.
  scene.add( cube2 ); // Añadir la malla al objeto escena.
  scene.add( cube3 ); // Añadir la malla al objeto escena.
  scene.add( cube4 ); // Añadir la malla al objeto escena.
  scene.add( cube5 ); // Añadir la malla al objeto escena.
  scene.add( cube6 ); // Añadir la malla al objeto escena.
  scene.add( cube7 ); // Añadir la malla al objeto escena.
  scene.add( cube8 ); // Añadir la malla al objeto escena.

  //*PUNTERO
  const controls = new PointerLockControls( camera, renderer.domElement );
  
  document.getElementById("display").addEventListener("click", async () => {
    await document.getElementById("display").requestPointerLock();
    controls.pointerSpeed = 1.3;
    controls.connect();
    controls.lock();
  });

  //*TECLADO
  var keys = {};
  document.body.addEventListener("keydown",function(e){
    keys[e.code] = true;
  });
  document.body.addEventListener("keyup", function(e){
    delete keys[e.code];
  });
  
  window.setInterval(()=>{
    Object.keys(keys).forEach(key => {
      if(key in keyboardOptions){
        keyboardOptions[key]();
      }
    });
    renderer.render( scene, camera );
  },33.333333);
  //*REESCALADO DE VENTANA
  window.addEventListener("resize",()=>{
    renderer.setSize( window.innerWidth, window.innerHeight );
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  })

  return [renderer,scene,camera,controls,keyboardOptions];
}
async function qb(f){
  new THREE.TextureLoader().load( mapa,(texture)=>{
    f(ap(texture));
  },()=>{},(err)=>{});
}
export {qb}