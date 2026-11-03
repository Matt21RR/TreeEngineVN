/** Luz puntual de escena (fase 1, sin sombras). Posicion en mundo engine,
 *  rango en unidades mundo (<=0 = apagada), color 0..1, intensidad >= 0. */
export interface PointLightData {
  x: number; y: number; z: number;
  range: number;
  r: number; g: number; b: number;
  intensity: number;
}
export type CameraData = {
    id: string;
    maxZ: number;
    /** Plano cercano en unidades mundo (default 0.005): lo mas cerca del ojo
     *  que se dibuja. Mas pequeno = se puede acercar mas la camara a la
     *  geometria sin que se recorte (a costa de precision de profundidad). */
    nearPlane?: number;
    origin: { x: number; y: number };
    position: { x: number; y: number; z: number; angle: number; pitch?: number; yaw?: number; roll?: number };
    usePerspective: boolean;
    /** FOV vertical en radianes. undefined = focal historica (H^2/W). Ej: Math.PI/3 = 60deg. */
    fov?: number;
    globalBlur?: number; //radio en px del dual kawase blur fullscreen (0 = off)
    globalAnisotropy?: number; //0/1=off (mip 0, look original), 2/4/8/16=maxAnisotropy de texturas (default 2)
    /** 0 = unlit (default, look actual), 1 = Lambert, 2 = Phong, 3 = PBR (GGX; solo mallas 3D). */
    globalLighting?: number;
    /** Luz direccional global (azim/elev rad, ambiente 0-1, shininess, spec;
     *  intensity = intensidad de la direccional en PBR, default 1). */
    globalLight?: { azim?: number; elev?: number; ambient?: number; shininess?: number; specStrength?: number; intensity?: number } | null;
    /** Tonemapping HDR -> pantalla, SOLO de mallas 3D (sprites/UI intactos).
     *  "none" (default, look actual) | "aces" | "agx" | "neutral". */
    globalToneMapping?: "none" | "aces" | "agx" | "neutral";
    /** Exposicion de mallas 3D (multiplica la luz antes del tonemap). Default 1. */
    globalExposure?: number;
    /** Bloom de mallas 3D: halo de lo que supera `threshold` (luz lineal tras
     *  la exposicion). Default { enabled: false, threshold: 1, intensity: 0.6, radius: 4 }. */
    globalBloom?: { enabled?: boolean; threshold?: number; intensity?: number; radius?: number };
    /** Oclusion ambiental (SSAO) de mallas 3D: oscurece el ambiente en rincones
     *  y contactos. radius en unidades mundo. Default { enabled: false, radius: 0.05,
     *  intensity: 1, bias: 0.02, power: 1.5, debug: false } (debug = ver solo el AO). */
    globalAO?: { enabled?: boolean; radius?: number; intensity?: number; bias?: number; power?: number; debug?: boolean };
    /** Puntuales de escena (max 4 en GPU, resto se ignora). Default [] = ninguna. */
    globalPointLights?: PointLightData[];
    globalRgbSplit?: {
      channels: { r?: { angle: number; mag: number }; g?: { angle: number; mag: number }; b?: { angle: number; mag: number } };
      maxMag: number; //magnitud maxima en px (angulo en grados, 0=derecha, 90=abajo por convencion Y-down)
    } | null; //default {channels:{},maxMag:0} = off (evita asignar null directo: el flatten interno de camara no tolera nulls)
    /** Grid 3D infinito de ayuda (WebGPU, anclado a mundo). Solo visual: no invalida layout/colisiones. */
    showGrid?: boolean; //default false
    showGridXZ?: boolean; //plano suelo y=0 (default true)
    showGridXY?: boolean; //plano frontal z=0 (default false)
    showGridYZ?: boolean; //plano lateral x=0 (default false)
    gridSize?: number; //escala de referencia en unidades mundo: paso = size/divisions, fade ~3x-10x (default 4)
    gridDivisions?: number; //celdas por unidad de size (default 16)
    gridColor?: string; //color CSS de lineas (default "#8a93a6")
    gridOpacity?: number; //0..1 (default 0.5)
    showAxes?: boolean; //ejes XYZ de colores (default true)
  };