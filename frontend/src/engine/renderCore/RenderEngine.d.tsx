export type CameraData = {
    id: string;
    maxZ: number;
    origin: { x: number; y: number };
    position: { x: number; y: number; z: number; angle: number; pitch?: number; yaw?: number; roll?: number };
    usePerspective: boolean;
    /** FOV vertical en radianes. undefined = focal historica (H^2/W). Ej: Math.PI/3 = 60deg. */
    fov?: number;
    globalBlur?: number; //radio en px del dual kawase blur fullscreen (0 = off)
    globalAnisotropy?: number; //0/1=off (mip 0, look original), 2/4/8/16=maxAnisotropy de texturas (default 2)
    globalRgbSplit?: {
      channels: { r?: { angle: number; mag: number }; g?: { angle: number; mag: number }; b?: { angle: number; mag: number } };
      maxMag: number; //magnitud maxima en px (angulo en grados, 0=derecha, 90=abajo por convencion Y-down)
    } | null; //default {channels:{},maxMag:0} = off (evita asignar null directo: el flatten interno de camara no tolera nulls)
  };