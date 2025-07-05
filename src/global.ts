interface ComponentChildren{
  children?:React.JSX.Element | Array<React.JSX.Element>
}

interface ConnectedComponent {
  refAssigner: (ref: any) => void;
}

export {ComponentChildren, ConnectedComponent}