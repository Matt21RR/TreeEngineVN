import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { ScriptDocument, Span } from "../../engine/interpretators/ScriptDocument.ts";
import { ActorInfo, ScriptAssets, useTextureUrl } from "./projectAssets.ts";
import { hashColor, initialsOf } from "./visualTheme.ts";
import type { FlowModel } from "./flowModel.ts";

// ───────────────────────────── editor context ─────────────────────────────

export type GraphActions = {
  //coalesceKey: consecutive commits with the same key within a short time share one undo step
  commit: (newText: string, pulseKey?: string, coalesceKey?: string) => void,
  openScope: (scopeKey: string) => void,
  selectSpan: (span: Span | null) => void,
  testRun: (scopeKey: string) => void,
  notify: (message: string, tone?: "info" | "error" | "success") => void,
  search: (query: string) => void
};

export type GraphContextValue = {
  text: string,
  parse: (text: string) => ScriptDocument,
  checkErrors: (source: string) => Array<{ message: string }>,
  doc: ScriptDocument,
  model: FlowModel,
  assets: ScriptAssets,
  actions: GraphActions,
  highlightKey: string | null,
  pulseKey: string | null,
  searchMatches: Set<string>
};

export const GraphContext = createContext<GraphContextValue | null>(null);

export const useGraph = () => {
  const value = useContext(GraphContext);
  if (!value) { throw new Error("useGraph outside GraphContext"); }
  return value;
};

// ───────────────────────────── avatar ─────────────────────────────

export function Avatar({ actorId, actor, size = 28, emotion, title }: {
  actorId: string, actor?: ActorInfo, size?: number, emotion?: string, title?: string
}) {
  const texture = (emotion && actor?.emotions[emotion]?.texture) || actor?.texture;
  const url = useTextureUrl(texture);
  const label = actor?.name ?? actorId;
  const color = hashColor(actorId);
  return (
    <div
      title={title ?? label}
      className="shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold text-black/80 ring-2 ring-black/40 select-none"
      style={{
        width: size, height: size, fontSize: size * 0.4, background: url ? `#111 url("${url}") center top / cover` : color
      }}
    >
      {!url && initialsOf(label)}
    </div>
  );
}

// ───────────────────────────── inline edit ─────────────────────────────

export function InlineEdit({ value, onCommit, className, validate, multiline, autoFocus = true, onCancel, placeholder }: {
  value: string, onCommit: (value: string) => void, className?: string, validate?: (value: string) => string | null,
  multiline?: boolean, autoFocus?: boolean, onCancel?: () => void, placeholder?: string
}) {
  const [draft, setDraft] = useState(value);
  const error = validate && draft != "" ? validate(draft) : null;
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFocus) { ref.current?.focus(); ref.current?.select(); } }, [autoFocus]);
  const commit = () => { if (!error && draft != "" && draft != value) { onCommit(draft); } else { onCancel?.(); } };
  const props = {
    ref,
    value: draft,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key == "Enter" && (!multiline || !e.shiftKey)) { e.preventDefault(); commit(); }
      if (e.key == "Escape") { e.preventDefault(); setDraft(value); onCancel?.(); }
    },
    className: `nodrag nowheel bg-black/60 outline-none border rounded px-1 ${error ? "border-red-500" : "border-sky-500"} ${className ?? ""}`,
    title: error ?? ""
  };
  return multiline ? <textarea rows={Math.min(6, Math.max(1, draft.split("\n").length))} {...props} /> : <input {...props} />;
}

export const validId = (taken: Array<string>) => (value: string) => {
  if (!/^\w+$/.test(value)) { return "Solo letras, números y _"; }
  if (taken.includes(value)) { return "Ya existe"; }
  return null;
};

// ───────────────────────────── floating menu ─────────────────────────────

export type MenuItem = {
  label: React.ReactNode,
  hint?: string,
  action?: () => void,
  danger?: boolean,
  disabled?: boolean,
  input?: { placeholder: string, validate?: (value: string) => string | null, onSubmit: (value: string) => void }
};

export function FloatingMenu({ x, y, title, items, onClose }: {
  x: number, y: number, title?: React.ReactNode, items: Array<MenuItem>, onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { onClose(); } };
    const escape = (e: KeyboardEvent) => { if (e.key == "Escape") { onClose(); } };
    setTimeout(() => document.addEventListener("mousedown", handle), 0);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", handle); document.removeEventListener("keydown", escape); };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-56 max-w-80 rounded-lg border border-neutral-600 bg-neutral-900/95 backdrop-blur shadow-2xl shadow-black/60 py-1 text-[12px] text-neutral-200"
      style={{ left: Math.min(x, window.innerWidth - 300), top: Math.min(y, window.innerHeight - 40 - items.length * 34) }}
      onContextMenu={e => e.preventDefault()}
    >
      {title && <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-neutral-500 border-b border-neutral-700 mb-1">{title}</div>}
      {items.map((item, index) => item.input
        ? <div key={index} className="px-3 py-1.5">
            <div className="mb-1">{item.label}</div>
            <InlineEdit
              value="" placeholder={item.input.placeholder} validate={item.input.validate}
              autoFocus={index == items.findIndex(candidate => candidate.input)}
              className="w-full py-1"
              onCommit={(value) => { item.input!.onSubmit(value); onClose(); }}
            />
          </div>
        : <button
            key={index}
            disabled={item.disabled}
            title={item.hint}
            className={`w-full text-left px-3 py-1.5 hover:bg-neutral-700/80 disabled:opacity-40 disabled:hover:bg-transparent flex flex-col ${item.danger ? "text-red-300" : ""}`}
            onClick={() => { item.action?.(); onClose(); }}
          >
            <span>{item.label}</span>
            {item.hint && <span className="text-[10px] text-neutral-500">{item.hint}</span>}
          </button>
      )}
    </div>
  );
}

// ───────────────────────────── toasts ─────────────────────────────

export type Toast = { id: number, message: string, tone: "info" | "error" | "success" };

export function Toasts({ toasts }: { toasts: Array<Toast> }) {
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-1 items-center pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-3 py-1.5 rounded-full text-[12px] shadow-lg shadow-black/50 border animate-[fadeIn_.2s_ease-out] ${
            toast.tone == "error" ? "bg-red-950 border-red-500 text-red-100" :
            toast.tone == "success" ? "bg-emerald-950 border-emerald-500 text-emerald-100" :
            "bg-neutral-900 border-neutral-600 text-neutral-100"}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
