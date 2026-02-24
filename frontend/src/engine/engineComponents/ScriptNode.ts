import { RenderEngine } from "../renderCore/RenderEngine.tsx"

export type Decision = {
  label:string,
  condition?:((engine:RenderEngine)=>boolean)|null,
  nextNode?:string
}