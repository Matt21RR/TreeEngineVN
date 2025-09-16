interface ComponentChildren{
  children?:React.JSX.Element | Array<React.JSX.Element>
}

interface ConnectedComponent <Extension = {}>{
  refAssigner: (ref: any) => void;
}

type Dictionary<T = any> = {
  [key:string]:T
}

declare global{
  interface Window{
    projectRoute:string;//CHAOS
    backendRoute:string;
  }
}

export {ComponentChildren, ConnectedComponent, Dictionary}