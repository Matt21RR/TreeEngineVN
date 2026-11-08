import React, { useMemo, useState } from "react";
import Prism from "prismjs";
import { Statement, scopeKeyOf } from "../../engine/interpretators/ScriptDocument.ts";
import { Avatar, InlineEdit, useGraph } from "./shared.tsx";
import { dialogSegmentsOf, fieldsOf, quoteText, stripQuotes, summaryOf } from "./instructionForms.ts";
import { kindVisuals, styleOfKind } from "./visualTheme.ts";
import { playSoundPreview, stopSoundPreview } from "./projectAssets.ts";
import { replaceStatement, spanSource, updateStatementFields } from "./scriptPatches.ts";
import { TOP_LEVEL_JUMPTO_WARNING, findSceneById } from "./flowModel.ts";

//*One illustrated card per instruction kind: what it DOES on screen, not its syntax.

export type CardContext = {
  statement: Statement,
  index: number,
  scopeKey: string,
  sceneKey?: string,
  speaker?: string,           //active speaker before this statement
  continuesChat: boolean,     //previous card is a dialog of the same speaker
  unreachable: boolean,       //after a run: never executed
  nested?: boolean            //inside a Trigger/CodedRoutine/@ block: the speaker is whoever is active at that moment
};

const GoButton = ({ targetKey, label = "ir →" }: { targetKey?: string, label?: string }) => {
  const { actions, model } = useGraph();
  if (!targetKey || !model.boxes.some(box => box.key == targetKey)) { return null; }
  return (
    <button
      className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-neutral-100 shrink-0"
      onClick={(e) => { e.stopPropagation(); actions.openScope(targetKey); }}
    >
      {label}
    </button>
  );
};

// ───────────────────────────── dialog ─────────────────────────────

const configChips = (raw: string) => {
  const chips: Array<string> = [];
  for (const match of raw.matchAll(/(\w+)\s*:\s*([^,}]+)/g)) {
    const key = match[1], value = match[2].trim();
    const icon = key == "speed" ? "⚡" : key == "wait" || key == "pause" ? "⏳" : key == "color" ? "🎨" : "⚙";
    chips.push(`${icon} ${key} ${value}`);
  }
  return chips.length ? chips : [`⚙ ${raw}`];
};

const renderTextWithExpressions = (text: string) => text.split(/(\$\{[^}]*\})/g).map((piece, i) => piece.startsWith("${")
  ? <code key={i} className="px-1.5 mx-0.5 rounded-full bg-sky-700 text-white text-[11px] font-mono" title="Expresión JavaScript interpolada">{"{" + piece.slice(2, -1) + "}"}</code>
  : <React.Fragment key={i}>{piece}</React.Fragment>);

function DialogCard({ ctx }: { ctx: CardContext }) {
  const { text, actions, assets } = useGraph();
  const [editing, setEditing] = useState(false);
  const segments = dialogSegmentsOf(ctx.statement);
  const onlyText = segments.length == 1 && segments[0].type == "text";
  const actor = ctx.speaker ? assets.actors[ctx.speaker] : undefined;
  return (
    <div className={`flex items-end gap-2 ${ctx.continuesChat ? "-mt-1" : ""}`}>
      <div className="w-9 shrink-0 flex justify-center">
        {!ctx.continuesChat && (ctx.speaker
          ? <Avatar actorId={ctx.speaker} actor={actor} size={36} />
          : <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${ctx.nested ? "bg-neutral-600/60 ring-2 ring-dashed ring-neutral-500" : "bg-neutral-700"}`}
              title={ctx.nested ? "Lo dice quien esté hablando cuando ocurra el evento" : "Sin hablante: usa says para asignarlo"}>{ctx.nested ? "🗣" : "💬"}</div>)}
      </div>
      <div className="min-w-0 flex-1">
        {!ctx.continuesChat &&
          <div className="text-[11px] font-semibold text-amber-300 mb-0.5 ml-1">{actor?.name ?? ctx.speaker ?? (ctx.nested ? "Hablante actual" : "Caja de diálogo")}</div>}
        <div
          className="relative inline-block max-w-full rounded-2xl rounded-bl-sm px-3 py-2 bg-gradient-to-br from-amber-100 to-amber-50 text-neutral-900 text-[13px] shadow-md shadow-black/40"
          onDoubleClick={(e) => { if (onlyText) { e.stopPropagation(); setEditing(true); } }}
          title={onlyText ? "Doble clic para editar" : "Edita los fragmentos en el panel derecho"}
        >
          {editing
            ? <InlineEdit
                value={(segments[0] as any).text} multiline className="w-80 text-neutral-100"
                onCancel={() => setEditing(false)}
                onCommit={(value) => {
                  setEditing(false);
                  actions.commit(updateStatementFields(text, ctx.statement, { segments: [{ type: "text", text: value }] }));
                }}
              />
            : segments.map((segment, i) => segment.type == "text"
              ? <span key={i}>{renderTextWithExpressions(segment.text)}</span>
              : configChips(segment.raw).map((chip, j) =>
                  <span key={`${i}-${j}`} className="inline-block mx-1 px-1.5 rounded-full bg-amber-600/20 text-amber-800 text-[10px] font-medium align-middle" title={`{${segment.raw}}`}>{chip}</span>))}
        </div>
      </div>
    </div>
  );
}

function NarrationCard({ ctx }: { ctx: CardContext }) {
  const { text, actions } = useGraph();
  const [editing, setEditing] = useState(false);
  const narration = stripQuotes(String(ctx.statement.data.narration));
  return (
    <div className="flex justify-center px-6" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }} title="Doble clic para editar">
      <div className="max-w-xl w-full text-center rounded-lg border border-amber-200/20 bg-gradient-to-b from-neutral-800/80 to-neutral-900/80 px-4 py-2.5 shadow-inner">
        <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200/50 mb-1">📜 narración</div>
        {editing
          ? <InlineEdit value={narration} multiline className="w-full text-center italic"
              onCancel={() => setEditing(false)}
              onCommit={(value) => { setEditing(false); actions.commit(replaceStatement(text, ctx.statement, quoteText(value))); }} />
          : <div className="italic text-neutral-200 font-serif text-[14px] leading-snug">{renderTextWithExpressions(narration)}</div>}
      </div>
    </div>
  );
}

function SpeakerCard({ ctx }: { ctx: CardContext }) {
  const { assets } = useGraph();
  const actorId = ctx.statement.data.actor;
  const actor = assets.actors[actorId];
  return (
    <div className="flex items-center gap-2 text-[12px] text-neutral-300 pl-1">
      <Avatar actorId={actorId} actor={actor} size={26} />
      <span>🗣 <b className="text-amber-200">{actor?.name ?? actorId}</b> toma la palabra</span>
      {ctx.speaker && ctx.speaker != actorId && <span className="text-[10px] text-neutral-500">(antes: {assets.actors[ctx.speaker]?.name ?? ctx.speaker}, que se atenúa)</span>}
      {!actor && <span className="text-[10px] text-amber-400" title="No se encontró un new Actor con este id en el script">⚠ actor no creado aquí</span>}
    </div>
  );
}

// ───────────────────────────── actors / stage ─────────────────────────────

function MiniStage({ actorId, markId, fromOffscreen }: { actorId: string, markId: string, fromOffscreen?: boolean }) {
  const { assets } = useGraph();
  const marks = Object.values(assets.marks);
  const xs = marks.map(mark => mark.x).filter((x): x is number => x != null);
  const min = Math.min(...xs, 0), max = Math.max(...xs, 1);
  const place = (x: number | null) => x == null ? 50 : 8 + ((x - min) / ((max - min) || 1)) * 84;
  const target = assets.marks[markId];
  const targetX = place(target?.x ?? null);
  return (
    <div className="relative h-14 w-full max-w-md rounded-lg bg-gradient-to-b from-sky-950/60 to-neutral-900 border border-white/10 overflow-hidden">
      <div className="absolute bottom-3 left-0 right-0 h-px bg-white/15" />
      {marks.map(mark => (
        <div key={mark.id} className="absolute bottom-1 -translate-x-1/2 text-[9px] text-neutral-500" style={{ left: place(mark.x) + "%" }}>
          <div className={`mx-auto w-1.5 h-1.5 rounded-full mb-0.5 ${mark.id == markId ? "bg-orange-400" : "bg-neutral-600"}`} />
          {mark.id}
        </div>
      ))}
      {fromOffscreen && <div className="absolute top-3 text-orange-300/70 text-[11px]" style={{ left: 2 + "%", width: targetX - 6 + "%" }}>┈┈┈┈┈┈▶</div>}
      <div className="absolute top-1 -translate-x-1/2" style={{ left: targetX + "%" }}>
        <Avatar actorId={actorId} actor={assets.actors[actorId]} size={26} />
      </div>
      {!target && <div className="absolute right-2 top-1 text-[10px] text-amber-400">⚠ marca “{markId}” no creada aquí</div>}
    </div>
  );
}

function StageDirectionCard({ ctx }: { ctx: CardContext }) {
  const { assets } = useGraph();
  const data = ctx.statement.data;
  const actorName = assets.actors[data.actorId]?.name ?? data.actorId;
  if (ctx.statement.kind == "EmotionChangeInstruction") {
    const actor = assets.actors[data.actorId];
    return (
      <div className="flex items-center gap-2 text-[12px] text-neutral-200">
        <Avatar actorId={data.actorId} actor={actor} size={30} />
        <span className="text-orange-300 text-lg">→</span>
        <Avatar actorId={data.actorId} actor={actor} emotion={data.emotionId} size={30} title={data.emotionId} />
        <span>🎭 <b>{actorName}</b> se pone <b className="text-orange-200">{data.emotionId}</b>{data.duration ? <span className="text-neutral-500"> · {data.duration} ms</span> : null}</span>
        {actor && !actor.emotions[data.emotionId] && <span className="text-[10px] text-amber-400" title={`Emociones conocidas: ${Object.keys(actor.emotions).join(", ") || "ninguna"}`}>⚠ emoción no definida</span>}
      </div>
    );
  }
  const arrive = ctx.statement.kind == "ArriveInstruction";
  return (
    <div className="space-y-1">
      <div className="text-[12px] text-neutral-200">
        {arrive ? "🧍 " : "🚶 "}<b>{actorName}</b> {arrive ? "entra en escena hasta" : "se mueve a"} <b className="text-orange-200">{data.markId}</b>
        <span className="text-neutral-500"> · {data.duration ? `${data.duration} ms` : arrive ? "500 ms + fundido" : "instantáneo"}</span>
      </div>
      <MiniStage actorId={data.actorId} markId={data.markId} fromOffscreen={arrive} />
    </div>
  );
}

// ───────────────────────────── flow ─────────────────────────────

function Separator({ children, color = "#737373", title }: { children: React.ReactNode, color?: string, title?: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] py-0.5" style={{ color }} title={title}>
      <div className="flex-1 border-t border-dashed" style={{ borderColor: color + "66" }} />
      <span className="shrink-0">{children}</span>
      <div className="flex-1 border-t border-dashed" style={{ borderColor: color + "66" }} />
    </div>
  );
}

function DecisionCard({ ctx }: { ctx: CardContext }) {
  const question = stripQuotes(String(ctx.statement.data.question ?? ""));
  const options = ctx.statement.options ?? [];
  return (
    <div className="rounded-xl border-2 border-amber-400/50 bg-amber-950/30 overflow-hidden">
      <div className="px-3 py-2 bg-amber-500/15 text-[13px] text-amber-100 font-medium">❓ {question}</div>
      <div className="divide-y divide-white/5">
        {options.length == 0 && <div className="px-3 py-1.5 text-[11px] text-neutral-500 italic">Sin opciones: añádelas en el panel derecho</div>}
        {options.map((option, i) => {
          const targetKey = option.nextNode && ctx.sceneKey ? scopeKeyOf("node", option.nextNode, ctx.sceneKey) : undefined;
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-neutral-100">“{stripQuotes(option.label)}”</span>
              {option.condition && <span className="text-[10px] px-1.5 rounded bg-amber-500/20 text-amber-200 truncate max-w-48" title={option.condition}>⚑ si {option.condition}</span>}
              <span className="flex-1" />
              {option.nextNode
                ? <><span className="text-amber-300/80">↪ ◆ {option.nextNode}</span><GoButton targetKey={targetKey} /></>
                : <span className="text-[10px] text-neutral-500">continúa abajo</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExitCard({ ctx }: { ctx: CardContext }) {
  const { doc } = useGraph();
  const statement = ctx.statement;
  if (statement.kind == "JumpToInstruction") {
    const targetKey = ctx.sceneKey ? scopeKeyOf("node", statement.data.label, ctx.sceneKey) : undefined;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-[12px] text-amber-100">
          ↪ Llama a <b>◆ {statement.data.label}</b><span className="flex-1" /><GoButton targetKey={targetKey} />
        </div>
        {!ctx.nested && ctx.index > 0 && <div className="text-[10px] text-amber-300/90 bg-amber-950/40 border border-amber-700/40 rounded-md px-2 py-1">⚠ {TOP_LEVEL_JUMPTO_WARNING}</div>}
        <Separator color="#a3a3a3" title="runNode inserta las rutinas del node y después sigue con las de aquí">↩ al terminar {statement.data.label}, continúa aquí</Separator>
      </div>
    );
  }
  if (statement.kind == "RunInstruction") {
    const scene = findSceneById(doc, statement.data.scene);
    const targetKey = scene ? (statement.data.node ? scopeKeyOf("node", statement.data.node, scene.key) : scene.key) : undefined;
    return (
      <div className="flex items-center gap-2 rounded-lg border-2 border-dashed border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-100">
        🎬⟲ Va a <b>{statement.data.scene}{statement.data.node ? ` › ${statement.data.node}` : ""}</b>
        <span className="text-[10px] text-emerald-300/70">reinicia la escena{statement.data.node ? " y ejecuta solo ese node" : ""} · no vuelve</span>
        <span className="flex-1" />
        {scene ? <GoButton targetKey={targetKey} /> : <span className="text-[10px] text-neutral-500">en otro script</span>}
      </div>
    );
  }
  if (statement.kind == "IncludeInstruction") {
    const module = stripQuotes(String(statement.data.loadId));
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dotted border-purple-400/60 bg-purple-500/10 px-3 py-1.5 text-[12px] text-purple-100">
        🧩 Pega aquí el module <b>{module}</b><span className="flex-1" /><GoButton targetKey={scopeKeyOf("module", module)} />
      </div>
    );
  }
  return null;
}

function SoundCard({ ctx }: { ctx: CardContext }) {
  const { actions } = useGraph();
  const fields = fieldsOf(ctx.statement)!;
  const [playing, setPlaying] = useState(false);
  const actionLabel: Record<string, string> = { play: "▶ reproduce", pause: "⏸ pausa", stop: "⏹ detiene" };
  return (
    <div className="flex items-center gap-2 rounded-full border border-pink-400/40 bg-pink-500/10 pl-3 pr-1 py-1 text-[12px] text-pink-100 w-fit">
      <span className="flex items-end gap-px h-4" aria-hidden>
        {[3, 7, 5, 9, 4, 8, 6].map((h, i) => <span key={i} className={`w-0.5 bg-pink-300/80 ${playing ? "animate-pulse" : ""}`} style={{ height: h * 1.6 }} />)}
      </span>
      <b>{fields.id}</b>
      <span className="text-pink-200/80">{fields.config ? `⚙ {${fields.config}}` : (actionLabel[fields.action] ?? fields.action)}</span>
      <button
        className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-pink-500/30 hover:bg-pink-500/50"
        onClick={async (e) => {
          e.stopPropagation();
          if (playing) { stopSoundPreview(); setPlaying(false); return; }
          const ok = await playSoundPreview(fields.id, () => setPlaying(false));
          if (ok) { setPlaying(true); } else { actions.notify(`No encuentro “${fields.id}” en sounds.json`, "error"); }
        }}
      >
        {playing ? "■ parar" : "▶ escuchar"}
      </button>
    </div>
  );
}

// ───────────────────────────── code ─────────────────────────────

function CodeCard({ ctx, collapsed, onToggle }: { ctx: CardContext, collapsed: boolean, onToggle: () => void }) {
  const { text } = useGraph();
  const raw = useMemo(() => spanSource(text, ctx.statement.span), [text, ctx.statement.span]);
  const highlighted = useMemo(() => {
    try { return Prism.highlight(raw, Prism.languages.javascript, "javascript"); } catch { return null; }
  }, [raw]);
  const visual = kindVisuals[ctx.statement.kind];
  const style = styleOfKind(ctx.statement.kind);
  const multiline = raw.includes("\n");
  return (
    <div className="rounded-lg border bg-neutral-950/80 overflow-hidden" style={{ borderColor: style.color + "55" }}>
      <button className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px]" style={{ background: style.soft }} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        <span style={{ color: style.color }}>{visual.icon}</span>
        <span className="text-neutral-100 truncate">{summaryOf(ctx.statement)}</span>
        <span className="flex-1" />
        {multiline && <span className="text-[10px] text-neutral-500">{raw.split("\n").length} líneas</span>}
        <span className="text-neutral-500 text-[10px]">{collapsed ? "▸ ver código" : "▾ ocultar"}</span>
      </button>
      {!collapsed &&
        <pre className="script-code px-3 py-2 text-[11px] leading-snug overflow-x-auto max-h-64 text-neutral-200">
          {highlighted ? <code dangerouslySetInnerHTML={{ __html: highlighted }} /> : <code>{raw}</code>}
        </pre>}
    </div>
  );
}

// ───────────────────────────── dispatcher ─────────────────────────────

export function StoryCardBody({ ctx, collapsed, onToggleCollapsed }: { ctx: CardContext, collapsed: boolean, onToggleCollapsed: () => void }) {
  switch (ctx.statement.kind) {
    case "DialogInstruction": return <DialogCard ctx={ctx} />;
    case "NarrationInstruction": return <NarrationCard ctx={ctx} />;
    case "SetSpeakerInstruction": return <SpeakerCard ctx={ctx} />;
    case "MoveActorInstruction":
    case "ArriveInstruction":
    case "EmotionChangeInstruction": return <StageDirectionCard ctx={ctx} />;
    case "WaitInstruction":
      return ctx.statement.data.waitTime
        ? <Separator color="#34d399">⏳ espera {ctx.statement.data.waitTime} ms</Separator>
        : <Separator color="#fbbf24" title="El flujo se detiene hasta que algo ejecute resume (p. ej. un Trigger)">⏸ pausa hasta un resume</Separator>;
    case "ResumeInstruction": return <Separator color="#34d399">⏯ reanuda el flujo</Separator>;
    case "DecisionInstruction": return <DecisionCard ctx={ctx} />;
    case "JumpToInstruction":
    case "RunInstruction":
    case "IncludeInstruction": return <ExitCard ctx={ctx} />;
    case "SoundInstruction": return <SoundCard ctx={ctx} />;
    default: return <CodeCard ctx={ctx} collapsed={collapsed} onToggle={onToggleCollapsed} />;
  }
}
