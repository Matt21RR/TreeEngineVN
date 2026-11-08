import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RenderEngine } from "../../engine/renderCore/RenderEngine.tsx";
import { Chaos } from "../../engine/interpretators/ChaosInterpreter.ts";
import { ScriptDocument, Span, allScopes, findScope, walkStatements } from "../../engine/interpretators/ScriptDocument.ts";
import { buildFlowModel, sceneIdOf } from "./flowModel.ts";
import { scriptAssetsOf } from "./projectAssets.ts";
import { GraphLayout, emptyLayout, loadLayout, saveLayout } from "./layoutStore.ts";
import { GraphContext, GraphContextValue, Toast, Toasts } from "./shared.tsx";
import { summaryOf } from "./instructionForms.ts";
import FlowView, { ToolButton } from "./FlowView.tsx";
import ChainView from "./ChainView.tsx";

type Props = {
  text: string,
  onChange: (newText: string) => void,
  scriptRoute?: string,
  //Text <-> graph selection sync
  onSelectSpan?: (span: Span) => void,
  caret?: number | null,
  toolbarExtra?: React.ReactNode
};

let fallbackChaos: any = null;
const chaosInstance = (): any => {
  const engineChaos = RenderEngine.getInstance?.()?.chaosInstance;
  if (engineChaos) { return engineChaos; }
  if (!fallbackChaos) { fallbackChaos = new (Chaos as any)(); }
  return fallbackChaos;
};

const COALESCE_MS = 1500;
const HISTORY_LIMIT = 200;

export default function ScriptGraphEditor({ text, onChange, scriptRoute, onSelectSpan, caret, toolbarExtra }: Props) {
  const parse = useCallback((source: string): ScriptDocument => chaosInstance().parseStructure(source), []);
  const checkErrors = useCallback((source: string) => chaosInstance().checkScriptForErrors(source), []);

  //Parsing is cheap, but keep the last good document if the parser throws on a half-written script
  const lastGood = useRef<ScriptDocument | null>(null);
  const doc = useMemo(() => {
    try {
      lastGood.current = parse(text);
    } catch (error) {
      console.error("parseStructure failed, showing the last valid structure", error);
    }
    return lastGood.current ?? { text, scopes: [], errors: [] };
  }, [text, parse]);
  const model = useMemo(() => buildFlowModel(doc), [doc]);
  const assets = useMemo(() => scriptAssetsOf(doc), [doc]);

  // ── navigation ──
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pulseKey, setPulseKey] = useState<string | null>(null);
  const pulse = (key?: string) => {
    if (!key) { return; }
    setPulseKey(key);
    window.setTimeout(() => setPulseKey(current => current == key ? null : current), 1200);
  };

  // ── undo / redo (own stack: the textarea is driven programmatically) ──
  const past = useRef<Array<string>>([]);
  const future = useRef<Array<string>>([]);
  const lastCommit = useRef<{ key?: string, time: number }>({ time: 0 });
  const [, forceRender] = useState(0);

  const commit = useCallback((newText: string, pulseKeyValue?: string, coalesceKey?: string) => {
    if (newText == text) { return; }
    const now = performance.now();
    const coalesce = coalesceKey && lastCommit.current.key == coalesceKey && now - lastCommit.current.time < COALESCE_MS;
    if (!coalesce) {
      past.current.push(text);
      if (past.current.length > HISTORY_LIMIT) { past.current.shift(); }
    }
    future.current = [];
    lastCommit.current = { key: coalesceKey, time: now };
    onChange(newText);
    pulse(pulseKeyValue);
    forceRender(n => n + 1);
  }, [text, onChange]);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (previous == undefined) { return; }
    future.current.push(text);
    lastCommit.current = { time: 0 };
    onChange(previous);
    forceRender(n => n + 1);
  }, [text, onChange]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next == undefined) { return; }
    past.current.push(text);
    lastCommit.current = { time: 0 };
    onChange(next);
    forceRender(n => n + 1);
  }, [text, onChange]);

  // ── layout: loaded once, autosaved (it only stores positions, never script content) ──
  const [layout, setLayout] = useState<GraphLayout>(emptyLayout);
  const [layoutReady, setLayoutReady] = useState(!scriptRoute);
  const saveTimer = useRef(-1);
  useEffect(() => {
    let alive = true;
    loadLayout(scriptRoute).then(loaded => { if (alive) { setLayout(loaded); setLayoutReady(true); } });
    return () => { alive = false; };
  }, [scriptRoute]);
  const onLayoutChange = useCallback((next: GraphLayout) => {
    setLayout(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { saveLayout(scriptRoute, next); }, 900);
  }, [scriptRoute]);
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  // ── toasts ──
  const [toasts, setToasts] = useState<Array<Toast>>([]);
  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = performance.now();
    setToasts(current => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id != id)), 3200);
  }, []);

  // ── test run in the engine ──
  const testRun = useCallback((scopeKey: string) => {
    const engine = RenderEngine.getInstance?.();
    const scope = findScope(doc, scopeKey);
    if (!engine || !scope) { notify("El motor no está disponible", "error"); return; }
    const scene = scope.type == "node" ? findScope(doc, scope.parentKey!)! : scope;
    if (scene.type == "module") { notify("Un module no se puede ejecutar solo: inclúyelo en una escena", "info"); return; }
    const sceneId = sceneIdOf(scene);
    notify(`▶ Ejecutando ${sceneId}${scope.type == "node" ? " › " + scope.id : ""}… (cierra el editor para verlo)`, "success");
    engine.chaosInstance.kreator(text)
      .then(() => engine.runScript(sceneId, scope.type == "node" ? scope.id : ""))
      .catch((error: any) => notify("No se pudo ejecutar: " + (error?.message ?? error), "error"));
  }, [doc, text, notify]);

  // ── search ──
  const [query, setQuery] = useState("");
  const searchMatches = useMemo(() => {
    const matches = new Set<string>();
    const needle = query.trim().toLowerCase();
    if (!needle) { return matches; }
    for (const box of model.boxes) {
      const haystack = [box.scope.id, ...[...walkStatements(box.scope)].map(visit => summaryOf(visit.statement))].join("\n").toLowerCase();
      if (haystack.includes(needle)) { matches.add(box.key); }
    }
    return matches;
  }, [query, model]);

  // ── caret (text side) -> highlighted box ──
  const highlightKey = useMemo(() => {
    if (caret == null) { return null; }
    let best: string | null = null;
    for (const scope of allScopes(doc)) {
      const inHeader = scope.headerSpan && caret >= scope.headerSpan[0] && caret <= scope.headerSpan[1];
      const inBody = scope.statements.some(statement => caret >= statement.span[0] && caret <= statement.span[1]);
      if (inHeader || inBody) { best = scope.key; }
    }
    return best;
  }, [caret, doc]);

  const selectSpan = useCallback((span: Span | null) => { if (span) { onSelectSpan?.(span); } }, [onSelectSpan]);

  const context: GraphContextValue = {
    text, doc, model, assets, parse, checkErrors,
    actions: { commit, openScope: (key) => setOpenKey(key), selectSpan, testRun, notify, search: setQuery },
    highlightKey, pulseKey, searchMatches
  };

  // ── keyboard: undo/redo + Esc back to the map ──
  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName == "INPUT" || target.tagName == "TEXTAREA" || target.tagName == "SELECT") { return; }
    if (e.ctrlKey && (e.key == "z" || e.key == "Z") && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (e.ctrlKey && (e.key == "y" || (e.key == "Z" && e.shiftKey))) { e.preventDefault(); redo(); }
    else if (e.key == "Escape" && openKey) { e.preventDefault(); setOpenKey(null); }
  };

  const history = (
    <>
      <ToolButton onClick={undo} title="Deshacer (Ctrl+Z)">↶</ToolButton>
      <ToolButton onClick={redo} title="Rehacer (Ctrl+Y)">↷</ToolButton>
    </>
  );

  return (
    <GraphContext.Provider value={context}>
      <div className="relative w-full h-full min-h-[24rem] outline-none" tabIndex={-1} onKeyDown={onKeyDown}>
        <style>{`
          .script-code .token.keyword { color: #c792ea } .script-code .token.string { color: #c3e88d }
          .script-code .token.number { color: #f78c6c } .script-code .token.function { color: #82aaff }
          .script-code .token.comment { color: #6272a4 } .script-code .token.punctuation { color: #89ddff }
          .script-code .token.operator { color: #ff5370 } .script-code .token.boolean { color: #ff9cac }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        `}</style>
        {openKey
          ? <div className="w-full h-full animate-[fadeIn_.18s_ease-out]">
              <ChainView scopeKey={openKey} onBack={() => setOpenKey(null)} toolbarExtra={<>{history}{toolbarExtra}</>} />
            </div>
          : layoutReady && <FlowView parse={parse} layout={layout} onLayoutChange={onLayoutChange} toolbarExtra={<>{history}{toolbarExtra}</>} />}
        <Toasts toasts={toasts} />
      </div>
    </GraphContext.Provider>
  );
}
