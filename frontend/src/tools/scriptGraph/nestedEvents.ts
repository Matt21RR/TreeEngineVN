import { NestedBlock, Statement, StatementKind } from "../../engine/interpretators/ScriptDocument.ts";

//*Human meaning of a nested lane ("when does this run?") and of a nested instruction ("how does it run?").

export type EventTone = "event" | "loop" | "cond" | "func" | "code";

export type EventInfo = {
  icon: string,
  title: string,        //"al soltar el clic"
  detail?: string,      //"sobre «fondo»"
  tone: EventTone
};

export const toneColors: Record<EventTone, string> = {
  event: "#facc15", loop: "#22d3ee", cond: "#a78bfa", func: "#f472b6", code: "#a3a3a3"
};

const pointerCallbacks: Record<string, string> = {
  onRelease: "al soltar el clic", onHold: "mientras se mantiene pulsado", onEnter: "al pasar el ratón por encima",
  onLeave: "al salir el ratón", onWheel: "al girar la rueda", onMouseMove: "al mover el ratón", onPress: "al pulsar"
};

const keyboardCallbacks: Record<string, string> = {
  onPress: "al pulsar", onRelease: "al soltar", onHold: "mientras se mantiene pulsado"
};

const prettyKey = (code: string) => code
  .replace(/^Key/, "").replace(/^Digit/, "").replace(/(Left|Right)$/, "")
  .replace(/^Control$/, "Ctrl").replace(/^Space$/, "Espacio").replace(/^Escape$/, "Esc")
  .replace(/^ArrowUp$/, "↑").replace(/^ArrowDown$/, "↓").replace(/^ArrowLeft$/, "←").replace(/^ArrowRight$/, "→");

export const triggerTargetOf = (host: Statement) =>
  /^\[\s*(["'`])([^"'`]+)\1\s*,/.exec(String(host.data.value ?? ""))?.[2];

export const keyboardKeysOf = (host: Statement) => {
  const list = /^\[\s*\[([^\]]*)\]/.exec(String(host.data.value ?? ""))?.[1];
  if (!list) { return undefined; }
  return [...list.matchAll(/["'`]([^"'`]+)["'`]/g)].map(match => prettyKey(match[1])).join("+");
};

export const eventOfLane = (lane: NestedBlock, host: Statement): EventInfo => {
  const label = lane.label;
  const branch = host.kind == "CreateInstruction" ? String(host.data.branch) : "";

  if (branch == "Trigger" && pointerCallbacks[label]) {
    const target = triggerTargetOf(host);
    return { icon: "👆", title: pointerCallbacks[label], detail: target ? `sobre «${target}»` : undefined, tone: "event" };
  }
  if (branch == "KeyboardTrigger" && keyboardCallbacks[label]) {
    const keys = keyboardKeysOf(host);
    return { icon: "⌨", title: `${keyboardCallbacks[label]}${keys ? " " + keys : " las teclas"}`, tone: "event" };
  }
  if (branch == "CodedRoutine" && label == "code") {
    const continuous = /continious\s*:\s*true/.test(String(host.data.value ?? ""));
    return { icon: "⚙", title: continuous ? "en cada frame" : "al ejecutarse la rutina", detail: continuous ? "continious: true" : undefined, tone: "event" };
  }
  const keyframe = /^(\d+(?:\.\d+)?)\.onComplete$/.exec(label);
  if (keyframe) {
    return { icon: "🎞", title: `al terminar el keyframe de ${keyframe[1]} ms`, detail: "si es el último, justo antes del onComplete de la animación", tone: "event" };
  }
  if (label == "onComplete") { return { icon: "🎞", title: "al terminar la animación", tone: "event" }; }
  if (/^on[A-Z]\w*$/.test(label)) { return { icon: "⚡", title: `cuando ocurra ${label}`, tone: "event" }; }

  if (/^(for|while)\b/.test(label)) { return { icon: "🔁", title: "repite", detail: label, tone: "loop" }; }
  if (/^if\b/.test(label)) { return { icon: "❓", title: "si se cumple", detail: label.replace(/^if\s*/, ""), tone: "cond" }; }
  if (/^else\s+if\b/.test(label)) { return { icon: "❓", title: "si no, si", detail: label.replace(/^else\s+if\s*/, ""), tone: "cond" }; }
  if (/^else\b/.test(label)) { return { icon: "↳", title: "si no", tone: "cond" }; }
  const fn = /^(?:const|let|var|function)\s+(\w+)/.exec(label) ?? /^(\w+)$/.exec(label);
  if (fn && /^(const|let|var|function)/.test(label)) { return { icon: "ƒ", title: `al llamar a ${fn[1]}()`, tone: "func" }; }
  if (fn) { return { icon: "⚡", title: `en ${fn[1]}`, tone: "event" }; }
  return { icon: "{}", title: label ? `dentro de ${label}` : "dentro de código", tone: "code" };
};

//*Inside a block isInRoutineMode is false: only these builders still push into engine.routines
const QUEUED: Array<StatementKind> = ["DialogInstruction", "NarrationInstruction", "DecisionInstruction", "RunInstruction"];

export type ExecutionMode = "queued" | "immediate";

export const executionModeOf = (kind: StatementKind): ExecutionMode => QUEUED.includes(kind) ? "queued" : "immediate";

export const executionCopy: Record<ExecutionMode, { icon: string, label: string, hint: string, color: string }> = {
  queued: {
    icon: "⏱", label: "se encola", color: "#60a5fa",
    hint: "Se añade al final de la cola de la historia: se verá cuando termine lo que ya estaba en marcha"
  },
  immediate: {
    icon: "⚡", label: "al instante", color: "#facc15",
    hint: "Ocurre justo en el momento del evento, sin esperar a la cola de la historia"
  }
};

//*Short title of a host statement that owns lanes: "👆 Trigger btn", "⌨ Shift+E", "🔁 for (…)"
export const hostTitleOf = (host: Statement): { icon: string, title: string, detail?: string } => {
  if (host.kind == "CreateInstruction") {
    const id = String(host.data.id ?? "").replace(/^["'`]|["'`]$/g, "");
    switch (host.data.branch) {
      case "Trigger": {
        const target = triggerTargetOf(host);
        return { icon: "👆", title: `Trigger ${id}`, detail: target ? `zona: «${target}»` : "sin forma asociada" };
      }
      case "KeyboardTrigger": return { icon: "⌨", title: `Teclas ${keyboardKeysOf(host) ?? ""}`.trim(), detail: id && id != "null" ? id : undefined };
      case "CodedRoutine": return { icon: "⚙", title: `Rutina ${id}` };
      case "Animation": return { icon: "🎞", title: `Animación ${id}` };
      default: return { icon: "✨", title: `${host.data.branch} ${id}` };
    }
  }
  if (host.kind == "JavaScript") {
    const firstLine = String(host.data.code ?? "").split("\n")[0].replace(/\{\s*$/, "").trim();
    return { icon: "{}", title: firstLine || "código" };
  }
  return { icon: "{}", title: host.raw.split("\n")[0] };
};
