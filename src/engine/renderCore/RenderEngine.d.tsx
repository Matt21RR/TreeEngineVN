type CalculationOrder = Array<{id:string,weight:number,z:number}>;
type CameraData = {
    id: string;
    maxZ: number;
    origin: { x: number; y: number };
    position: { x: number; y: number; z: number; angle: number };
    usePerspective: boolean;
  };