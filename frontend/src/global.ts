import { AnimationsEngineLambdas } from "./engine/interpreteCodAlgo/game.ts";// TODO: This is a temporal solution, the AnimationsEngineLambdas type should be imported only in the game.ts file, but this way I avoid circular dependencies for now
import { GameMap } from "./engine/interpreteCodAlgo/interpreter.ts";  //TODO: This is a temporal solution, the GameMap type should be imported only in the game.ts file, but this way I avoid circular dependencies for now

interface ComponentChildren{
  children?:React.JSX.Element | Array<React.JSX.Element>
}

interface ConnectedComponent {
  refAssigner: (ref: any) => void;
}

type Dictionary<T = any, K extends readonly string[] = string[]> = {
  //K will probable be unused
  [key in K[number]]:T
}

declare global{
  interface Window{
    projectRoute:string;//CHAOS
    workRoute:string;
    backendRoute:string;
    zetas: Set<number>;
    debugContext: CanvasRenderingContext2D | null;
    ejecutarNivelBloxorz: (
      code: string, 
      mapa: GameMap, 
      spawnX: number, 
      spawnY: number, 
      animationsEngineLambdas: AnimationsEngineLambdas, 
      resetLevel: () => void,
      onLevelComplete: () => void
    ) => void;//todo: This is a temporal solution, this function should be only declared in the game.ts file, but this way I avoid circular dependencies for now,
  }
}

export {ComponentChildren, ConnectedComponent, Dictionary}