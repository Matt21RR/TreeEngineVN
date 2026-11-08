import React, { createContext, useContext, useMemo, useState } from "react";
import Prism from "prismjs";
import { NestedBlock, NestedItem, Statement, StatementKind } from "../../engine/interpretators/ScriptDocument.ts";
import { CardContext, StoryCardBody } from "./StoryCards.tsx";
import { useGraph } from "./shared.tsx";
import { eventOfLane, executionCopy, executionModeOf, hostTitleOf, toneColors } from "./nestedEvents.ts";
import { spanSource, splitToOwnLine } from "./scriptPatches.ts";
import { kindVisuals, styleOfKind } from "./visualTheme.ts";

//*Container cards: a statement whose code blocks hold engine instructions (Trigger callbacks, CodedRoutine,
//*@ for/if/functions…). Each block is drawn as a "lane" saying WHEN it runs, with the usual cards inside.

export type NestedApi = {
  scopeKey: string,
  sceneKey?: string,
  selectedKey: string | null,
  select: (statement: Statement) => void,
  insert: (lane: NestedBlock, index: number, kind: StatementKind) => void,
  quickAdd: (lane: NestedBlock, index: number, x: number, y: number) => void,
  move: (laneKey: string, from: number, to: number) => void,
  remove: (lane: NestedBlock, index: number) => void,
  duplicate: (lane: NestedBlock, index: number) => void
};

export const NestedApiContext = createContext<NestedApi | null>(null);
const useNested = () => useContext(NestedApiContext)!;

const DRAG_NEW = "application/x-sg-new";
const DRAG_NESTED = "application/x-sg-nested";

const laneDepthColors = ["#facc15", "#22d3ee", "#a78bfa", "#f472b6"];

function LaneDropZone({ lane, index, last }: { lane: NestedBlock, index: number, last?: boolean }) {
  const api = useNested();
  const [over, setOver] = useState(false);
  return (
    <div
      className={`group/drop relative flex items-center transition-all ${over ? "h-8" : last ? "h-6" : "h-2"}`}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setOver(false);
        const kind = e.dataTransfer.getData(DRAG_NEW) as StatementKind;
        const moving = e.dataTransfer.getData(DRAG_NESTED);
        if (kind) { api.insert(lane, index, kind); }
        else if (moving) {
          const [laneKey, from] = moving.split("|");
          if (laneKey == lane.key) { api.move(laneKey, Number(from), index); }
        }
      }}
    >
      <div className={`absolute left-2 right-2 border-t-2 ${over ? "border-sky-400" : "border-transparent group-hover/drop:border-neutral-700"}`} />
      <button
        title="Insertar una instrucción en este evento"
        onClick={(e) => { e.stopPropagation(); api.quickAdd(lane, index, e.clientX, e.clientY); }}
        className={`relative z-10 ml-2 rounded-full leading-none transition-opacity ${last
          ? "text-[10px] px-2 py-0.5 bg-neutral-800/80 border border-neutral-700 text-neutral-300 hover:bg-neutral-700 opacity-60 hover:opacity-100"
          : "w-4 h-4 text-[10px] bg-sky-600 text-white opacity-0 group-hover/drop:opacity-100"}`}
      >
        {last ? "＋ añadir aquí" : "＋"}
      </button>
    </div>
  );
}

function ExecutionBadge({ kind }: { kind: StatementKind }) {
  const mode = executionModeOf(kind);
  //Only the exception is marked: "al instante" is the normal case inside an event and was just noise
  if (mode == "immediate") { return null; }
  const copy = executionCopy[mode];
  return (
    <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full border whitespace-nowrap" title={copy.hint}
      style={{ color: copy.color, borderColor: copy.color + "55", background: copy.color + "14" }}>
      {copy.icon} {copy.label}
    </span>
  );
}

function NestedStatementRow({ lane, index, statement }: { lane: NestedBlock, index: number, statement: Statement }) {
  const api = useNested();
  const [collapsed, setCollapsed] = useState(true);
  const selected = api.selectedKey == statement.key;
  const ctx: CardContext = {
    statement, index, scopeKey: api.scopeKey, sceneKey: api.sceneKey,
    speaker: undefined, continuesChat: false, unreachable: false, nested: true
  };
  return (
    <div
      className={`group/row relative flex items-start gap-2 rounded-lg px-1.5 py-1 ${selected ? "bg-sky-500/10 ring-1 ring-sky-500/60" : "hover:bg-white/[0.03]"}`}
      onClick={(e) => { e.stopPropagation(); api.select(statement); }}
    >
      <span
        draggable
        onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData(DRAG_NESTED, `${lane.key}|${index}`); e.dataTransfer.effectAllowed = "move"; }}
        className="w-4 shrink-0 text-center text-[12px] cursor-grab mt-0.5"
        style={{ color: styleOfKind(statement.kind).color }}
        title="Arrastra para reordenar dentro de este evento"
      >
        {kindVisuals[statement.kind].icon}
      </span>
      <div className="flex-1 min-w-0">
        {statement.blocks
          ? <ContainerCard statement={statement} compact />
          : <StoryCardBody ctx={ctx} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} />}
      </div>
      <ExecutionBadge kind={statement.kind} />
      <div className="absolute right-1 -top-2 hidden group-hover/row:flex gap-0.5 z-10">
        <button className="text-[10px] px-1 rounded bg-neutral-800 hover:bg-neutral-700" title="Duplicar" onClick={(e) => { e.stopPropagation(); api.duplicate(lane, index); }}>⧉</button>
        <button className="text-[10px] px-1 rounded bg-neutral-800 hover:bg-red-800" title="Borrar" onClick={(e) => { e.stopPropagation(); api.remove(lane, index); }}>🗑</button>
      </div>
    </div>
  );
}

function CodeLine({ item }: { item: Extract<NestedItem, { type: "code" }> }) {
  const { text, actions } = useGraph();
  const source = useMemo(() => spanSource(text, item.span), [text, item.span]);
  const highlighted = useMemo(() => {
    try { return Prism.highlight(source, Prism.languages.javascript, "javascript"); } catch { return null; }
  }, [source]);
  if (item.warning) {
    return (
      <div className="rounded-md border border-red-500/60 bg-red-950/40 px-2 py-1 text-[11px]">
        <div className="flex items-center gap-2">
          <code className="text-red-200 whitespace-pre">{source}</code>
          <span className="flex-1" />
          <button className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/80 hover:bg-red-500 text-white"
            onClick={(e) => { e.stopPropagation(); actions.commit(splitToOwnLine(text, item)); }}
            title="La pone en su propia línea para que el intérprete la reconozca">
            ↵ partir en su propia línea
          </button>
        </div>
        <div className="text-[10px] text-red-300/80 mt-0.5">⚠ {item.warning}</div>
      </div>
    );
  }
  return (
    <pre className="script-code text-[11px] leading-snug px-2 py-1 rounded-md bg-neutral-900/80 border border-neutral-800 text-neutral-400 overflow-x-auto whitespace-pre" title="Código JavaScript (se ejecuta tal cual)">
      {highlighted ? <code dangerouslySetInnerHTML={{ __html: highlighted }} /> : <code>{source}</code>}
    </pre>
  );
}

function LaneView({ lane, host, depth }: { lane: NestedBlock, host: Statement, depth: number }) {
  const [open, setOpen] = useState(true);
  const event = eventOfLane(lane, host);
  const color = depth == 0 ? toneColors[event.tone] : laneDepthColors[depth % laneDepthColors.length];
  const engineCount = lane.items.filter(item => item.type == "statement").length;
  return (
    <div className="mt-1.5">
      <button
        className="flex items-center gap-1.5 text-[11px] font-medium rounded-md px-1.5 py-0.5 hover:bg-white/5 max-w-full"
        style={{ color }}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title={lane.header ? `Código: ${lane.header}` : undefined}
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>{event.icon}</span>
        <span className="truncate">{event.title}</span>
        {event.detail && <span className="text-[10px] px-1.5 rounded-full border truncate max-w-56" style={{ borderColor: color + "55" }}>{event.detail}</span>}
        {!open && <span className="text-[10px] text-neutral-500">· {engineCount} instrucciones</span>}
      </button>
      {open &&
        <div className="ml-2 pl-2.5 border-l-2 border-dashed" style={{ borderColor: color + "88" }}>
          <LaneDropZone lane={lane} index={0} />
          {lane.items.map((item, index) => (
            <React.Fragment key={index}>
              {item.type == "statement" && <NestedStatementRow lane={lane} index={index} statement={item.statement} />}
              {item.type == "code" && <CodeLine item={item} />}
              {item.type == "block" && <LaneView lane={item.block} host={host} depth={depth + 1} />}
              <LaneDropZone lane={lane} index={index + 1} last={index == lane.items.length - 1} />
            </React.Fragment>
          ))}
        </div>}
    </div>
  );
}

//*Card for a statement that owns lanes. `host` is the top-level statement (gives Trigger/Keyboard context).
export function ContainerCard({ statement, compact }: { statement: Statement, compact?: boolean }) {
  const { text } = useGraph();
  const [showCode, setShowCode] = useState(false);
  const source = useMemo(() => spanSource(text, statement.span), [text, statement.span]);
  const title = hostTitleOf(statement);
  const highlighted = useMemo(() => {
    if (!showCode) { return null; }
    try { return Prism.highlight(source, Prism.languages.javascript, "javascript"); } catch { return null; }
  }, [showCode, source]);
  const lanes = statement.blocks ?? [];
  return (
    <div className={`rounded-xl border bg-gradient-to-b from-neutral-900 to-neutral-950 ${compact ? "border-neutral-700" : "border-yellow-500/30 shadow-md shadow-black/40"}`}>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 text-[12px]">
        <span className="text-base">{title.icon}</span>
        <b className="text-neutral-100 truncate">{title.title}</b>
        {title.detail && <span className="text-[10px] text-neutral-400 truncate">{title.detail}</span>}
        <span className="text-[10px] text-yellow-300/70">· {lanes.length} {lanes.length == 1 ? "evento" : "eventos"}</span>
        <span className="flex-1" />
        <button className="text-[10px] text-neutral-500 hover:text-neutral-200" onClick={(e) => { e.stopPropagation(); setShowCode(!showCode); }}>
          {showCode ? "▾ ocultar código" : "▸ ver código"}
        </button>
      </div>
      {showCode &&
        <pre className="script-code mx-3 mt-2 px-2 py-1.5 text-[11px] leading-snug rounded-md bg-black/60 border border-neutral-800 overflow-x-auto max-h-64 text-neutral-200">
          {highlighted ? <code dangerouslySetInnerHTML={{ __html: highlighted }} /> : <code>{source}</code>}
        </pre>}
      <div className="px-2 pb-2">
        {lanes.map((lane, index) => <LaneView key={index} lane={lane} host={statement} depth={0} />)}
      </div>
    </div>
  );
}
