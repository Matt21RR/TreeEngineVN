import { StatementKind } from "../../engine/interpretators/ScriptDocument.ts";
import { ScriptInstructionCategory } from "../components/inputs/scriptInstructionsCatalog.ts";
import type { EdgeKind } from "./flowModel.ts";

//*One visual language for text highlighter, flow boxes and storyboard cards.

export type CategoryStyle = {
  label: string,
  color: string,       //main accent (hex, used by SVG edges/minimap too)
  soft: string,        //translucent background
  text: string         //tailwind text class
};

export type VisualCategory = "flow" | "dialog" | "actors" | "objects" | "sound" | "code" | "error";

export const categories: Record<VisualCategory, CategoryStyle> = {
  flow:    { label: "Estructura y flujo", color: "#34d399", soft: "rgba(52,211,153,0.12)",  text: "text-emerald-300" },
  dialog:  { label: "Diálogo",            color: "#fbbf24", soft: "rgba(251,191,36,0.12)",  text: "text-amber-300" },
  actors:  { label: "Actores",            color: "#fb923c", soft: "rgba(251,146,60,0.12)",  text: "text-orange-300" },
  objects: { label: "Objetos",            color: "#60a5fa", soft: "rgba(96,165,250,0.12)",  text: "text-blue-300" },
  sound:   { label: "Sonido",             color: "#f472b6", soft: "rgba(244,114,182,0.12)", text: "text-pink-300" },
  code:    { label: "JavaScript",         color: "#a3a3a3", soft: "rgba(163,163,163,0.10)", text: "text-neutral-300" },
  error:   { label: "Desconocido",        color: "#f87171", soft: "rgba(248,113,113,0.14)", text: "text-red-300" }
};

export const catalogCategoryToVisual: Record<ScriptInstructionCategory, VisualCategory> = {
  "Structure and flow": "flow",
  "Dialog": "dialog",
  "Actors": "actors",
  "Objects": "objects",
  "Sound": "sound",
  "Javascript": "code"
};

type KindVisual = { icon: string, category: VisualCategory, name: string };

export const kindVisuals: Record<StatementKind, KindVisual> = {
  SceneDefinitionInstruction:  { icon: "🎬", category: "flow", name: "scene" },
  ModuleDefinitionInstruction: { icon: "🧩", category: "flow", name: "module" },
  NodeDefinitionInstruction:   { icon: "◆", category: "flow", name: "node" },
  StructureEndInstruction:     { icon: "⏹", category: "flow", name: "end" },
  IncludeInstruction:          { icon: "🧩", category: "flow", name: "include" },
  JumpToInstruction:           { icon: "↪", category: "flow", name: "jumpto" },
  RunInstruction:              { icon: "🎬", category: "flow", name: "run" },
  WaitInstruction:             { icon: "⏳", category: "flow", name: "wait" },
  ResumeInstruction:           { icon: "⏯", category: "flow", name: "resume" },
  DialogInstruction:           { icon: "💬", category: "dialog", name: "diálogo" },
  NarrationInstruction:        { icon: "📜", category: "dialog", name: "narración" },
  SetSpeakerInstruction:       { icon: "🗣", category: "dialog", name: "says" },
  DecisionInstruction:         { icon: "❓", category: "dialog", name: "ask" },
  MoveActorInstruction:        { icon: "🚶", category: "actors", name: "move" },
  ArriveInstruction:           { icon: "🧍", category: "actors", name: "arrives" },
  EmotionChangeInstruction:    { icon: "🎭", category: "actors", name: "gets" },
  CreateInstruction:           { icon: "✨", category: "objects", name: "new" },
  SetInstruction:              { icon: "🔧", category: "objects", name: "set" },
  DeleteInstruction:           { icon: "🗑", category: "objects", name: "delete" },
  SoundInstruction:            { icon: "🔊", category: "sound", name: "sound" },
  JavaScript:                  { icon: "{}", category: "code", name: "@ js" },
  Unknown:                     { icon: "⚠", category: "error", name: "desconocido" }
};

export const styleOfKind = (kind: StatementKind) => categories[kindVisuals[kind].category];

export const edgeStyles: Record<EdgeKind, { color: string, label: string, description: string }> = {
  "call": {
    color: "#fbbf24", label: "↪ Llamada",
    description: "jumpto / opción de ask: ejecuta el node y, al terminar, continúa donde estaba"
  },
  "goto-reset": {
    color: "#34d399", label: "🎬⟲ Cambio de escena",
    description: "run escena -> node: reinicia el estado y ejecuta solo ese node (sin su main). No vuelve"
  },
  "include": {
    color: "#c084fc", label: "🧩 Include",
    description: "include \"module\": pega el código del module en ese punto"
  }
};

//*Stable pastel color for ids (actors without texture, etc.)
export const hashColor = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) { hash = (hash * 31 + value.charCodeAt(i)) | 0; }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 65% 55%)`;
};

export const initialsOf = (value: string) => {
  const clean = value.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, " ").trim();
  const words = clean.split(/\s+|(?=[A-Z])/).filter(Boolean);
  if (words.length == 0) { return "?"; }
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
};
