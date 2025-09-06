interface ComponentChildren{
  children?:React.JSX.Element | Array<React.JSX.Element>
}

interface ConnectedComponent {
  refAssigner: (ref: any) => void;
}

declare global{
  interface Window{
    projectRoute:string;//CHAOS
  }
}

export {ComponentChildren, ConnectedComponent}