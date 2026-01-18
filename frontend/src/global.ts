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
  }
}

export {ComponentChildren, ConnectedComponent, Dictionary}