import React, { memo, useMemo, useState } from "react";
import { EdgeLabelRenderer, EdgeProps, Handle, NodeProps, Position, getBezierPath } from "reactflow";
import { Statement } from "../../engine/interpretators/ScriptDocument.ts";
import { FlowBox, FlowGroup, FlowLink, GhostBox, collectIds } from "./flowModel.ts";
import { categories, edgeStyles, kindVisuals, VisualCategory } from "./visualTheme.ts";
import { Avatar, InlineEdit, useGraph, validId } from "./shared.tsx";
import { renameScope, createMissingNode, addScope } from "./scriptPatches.ts";
import { summaryOf } from "./instructionForms.ts";
import { useTextureUrl } from "./projectAssets.ts";
import { BOX_WIDTH, eventGroupsOf } from "./flowLayout.ts";
import { hostTitleOf } from "./nestedEvents.ts";
import { walkStatements } from "../../engine/interpretators/ScriptDocument.ts";
import type { Exit } from "./flowModel.ts";

// ───────────────────────────── helpers ─────────────────────────────

type Preview = { speaker?: string, text: string, kind: "dialog" | "narration" | "other", icon: string };

const previewOf = (statements: Array<Statement>): Preview | null => {
  let speaker: string | undefined;
  for (const statement of statements) {
    if (statement.kind == "SetSpeakerInstruction") { speaker = statement.data.actor; }
    if (statement.kind == "DialogInstruction") { return { speaker, text: summaryOf(statement), kind: "dialog", icon: "💬" }; }
    if (statement.kind == "NarrationInstruction") { return { text: summaryOf(statement), kind: "narration", icon: "📜" }; }
  }
  const first = statements.find(s => s.kind != "SetSpeakerInstruction");
  return first ? { text: summaryOf(first), kind: "other", icon: kindVisuals[first.kind].icon } : null;
};

const categoryCounts = (statements: Array<Statement>) => {
  const counts: Partial<Record<VisualCategory, number>> = {};
  for (const statement of statements) {
    const category = kindVisuals[statement.kind].category;
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
};

const categoryIcon: Record<VisualCategory, string> = {
  flow: "⏩", dialog: "💬", actors: "🎭", objects: "✨", sound: "🔊", code: "{}", error: "⚠"
};

const handleStyle = (color: string): React.CSSProperties => ({
  width: 12, height: 12, background: color, border: "2px solid #0a0a0a", right: -7
});

function ExitRow({ exit, nested }: { exit: Exit, nested?: boolean }) {
  const style = edgeStyles[exit.kind];
  const color = exit.missing ? "#ef4444" : style.color;
  return (
    <div className={`relative flex items-center gap-1.5 pr-4 h-[26px] text-[11px] ${nested ? "pl-6" : "pl-3"}`} title={exit.warning ?? style.description}>
      {exit.via == "option"
        ? <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        : <span style={{ color }}>{exit.kind == "call" ? "↪" : exit.kind == "goto-reset" ? "🎬" : "🧩"}</span>}
      <span className={`truncate ${exit.missing ? "text-red-300 line-through decoration-red-400/60" : ""}`}>
        {exit.via == "option" ? `“${exit.label}”` : exit.label.replace(/^[^\s]+\s/, "")}
      </span>
      {exit.condition && <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-200 truncate max-w-24" title={`Solo aparece si: ${exit.condition}`}>⚑ if</span>}
      {exit.via == "option" && !exit.targetNode && <span className="text-[9px] text-neutral-500">continúa</span>}
      {exit.warning && !exit.missing && <span className="text-[10px] text-amber-400" title={exit.warning}>⚠</span>}
      {exit.kind == "call" && exit.targetNode && <span className="ml-auto text-[10px] text-neutral-500" title="Al terminar el node, el flujo vuelve aquí">↩</span>}
      {exit.kind == "goto-reset" && <span className="ml-auto text-[10px] text-emerald-400/70" title="Reinicia la escena: no vuelve">⟲</span>}
      <Handle type="source" position={Position.Right} id={exit.id} style={handleStyle(color)} />
    </div>
  );
}

// ───────────────────────────── scene group ─────────────────────────────

export const SceneGroupNode = memo(function SceneGroupNode({ data }: NodeProps<{ group: FlowGroup, width: number, height: number }>) {
  const { group, width, height } = data;
  const { text, doc, actions, assets } = useGraph();
  const [renaming, setRenaming] = useState(false);
  const background = useMemo(() => {
    for (const statement of group.scope.statements) {
      if (statement.kind == "CreateInstruction" && statement.data.branch == "GraphObject") {
        const id = String(statement.data.id ?? "").replace(/^["'`]|["'`]$/g, "");
        if (assets.graphTextures[id]) { return assets.graphTextures[id]; }
      }
    }
    return null;
  }, [group, assets]);
  const thumbnail = useTextureUrl(background);
  const isEntry = group.scope.type == "entry";
  const takenScenes = collectIds(doc).scenes;
  const takenNodes = group.scope.nodes.map(node => node.id);

  return (
    <div
      className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/15 shadow-inner shadow-black/40"
      style={{ width, height }}
    >
      <div className="flex items-center gap-2 px-3 h-12 rounded-t-2xl bg-gradient-to-r from-emerald-900/70 to-transparent border-b border-emerald-500/20">
        {thumbnail
          ? <div className="w-14 h-8 rounded bg-cover bg-center ring-1 ring-emerald-400/40" style={{ backgroundImage: `url("${thumbnail}")` }} title={`Fondo: ${background}`} />
          : <span className="text-xl">🎬</span>}
        {renaming && !isEntry
          ? <InlineEdit
              value={group.scope.id}
              validate={validId(takenScenes.filter(id => id != group.scope.id))}
              className="text-sm font-semibold"
              onCancel={() => setRenaming(false)}
              onCommit={(value) => { setRenaming(false); actions.commit(renameScope(text, doc, group.scope.key, value), group.key); }}
            />
          : <span
              className="text-sm font-semibold text-emerald-100 cursor-text"
              title={isEntry ? "Instrucciones fuera de cualquier scene: el motor las ejecuta como gameEntrypoint" : "Doble clic para renombrar (actualiza los run que apuntan aquí)"}
              onDoubleClick={() => !isEntry && setRenaming(true)}
            >
              {isEntry ? "gameEntrypoint" : `scene ${group.scope.id}`}
            </span>}
        {isEntry && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-800/60 text-emerald-200">implícita</span>}
        {group.scope.warning && <span className="text-amber-300 text-xs" title={group.scope.warning}>⚠</span>}
        <div className="flex-1" />
        <button
          className="nodrag text-[11px] px-2 py-1 rounded-md bg-emerald-800/50 hover:bg-emerald-700/70 text-emerald-100 border border-emerald-500/30"
          title="Añade un node a esta escena"
          onClick={() => {
            let index = takenNodes.length + 1;
            while (takenNodes.includes("node" + index)) { index++; }
            actions.commit(addScope(text, doc, "node", "node" + index, [`- "..."`], group.scope.key), `${group.scope.key}/node:node${index}`);
          }}
        >
          ＋ node
        </button>
      </div>
    </div>
  );
});

// ───────────────────────────── story box ─────────────────────────────

export const StoryBoxNode = memo(function StoryBoxNode({ data, selected }: NodeProps<{ box: FlowBox }>) {
  const { box } = data;
  const { text, doc, actions, assets, highlightKey, pulseKey, searchMatches } = useGraph();
  const [renaming, setRenaming] = useState(false);
  const preview = useMemo(() => previewOf(box.scope.statements), [box]);
  const counts = useMemo(() => categoryCounts(box.scope.statements), [box]);
  const directExits = box.exits.filter(exit => exit.via != "nested");
  const eventGroups = useMemo(() => eventGroupsOf(box).map(group => ({
    ...group, host: hostTitleOf(box.scope.statements[group.statementIndex]).title
  })), [box]);
  const nestedCount = useMemo(() => [...walkStatements(box.scope)].filter(visit => visit.lanes.length > 0).length, [box]);
  const accent = box.kind == "main" ? categories.flow.color : box.kind == "module" ? edgeStyles.include.color : categories.dialog.color;
  const unreachable = box.kind == "node" && !box.hasIncoming;
  const parentScene = box.scope.parentKey ? doc.scopes.find(scope => scope.key == box.scope.parentKey) : undefined;
  const takenIds = box.kind == "module" ? collectIds(doc).modules : (parentScene?.nodes.map(node => node.id) ?? []);

  const ring = highlightKey == box.key ? "ring-2 ring-sky-400" :
    searchMatches.has(box.key) ? "ring-2 ring-fuchsia-400" :
    selected ? "ring-2 ring-white/70" : "";

  return (
    <div
      className={`rounded-xl bg-neutral-900/95 border shadow-xl shadow-black/50 text-neutral-100 transition-opacity ${ring} ${pulseKey == box.key ? "animate-pulse" : ""} ${unreachable ? "opacity-70" : ""}`}
      style={{ width: BOX_WIDTH, borderColor: box.errors.length ? "#ef4444" : accent + "80" }}
      onDoubleClick={() => actions.openScope(box.key)}
    >
      <Handle type="target" position={Position.Left} id="in" style={{ width: 12, height: 12, background: accent, border: "2px solid #0a0a0a", left: -7 }} />

      {/* header */}
      <div className="flex items-center gap-1.5 px-3 h-10 rounded-t-xl border-b border-white/5" style={{ background: `linear-gradient(90deg, ${accent}33, transparent)` }}>
        <span className="text-base" style={{ color: accent }}>{box.kind == "main" ? "★" : box.kind == "module" ? "🧩" : "◆"}</span>
        {renaming
          ? <InlineEdit
              value={box.scope.id}
              validate={validId(takenIds.filter(id => id != box.scope.id))}
              className="text-sm font-semibold w-36"
              onCancel={() => setRenaming(false)}
              onCommit={(value) => {
                setRenaming(false);
                const newKey = box.scope.key.replace(/[^:]+$/, value);
                actions.commit(renameScope(text, doc, box.scope.key, value), newKey);
              }}
            />
          : <span
              className="text-sm font-semibold truncate cursor-text"
              title={box.kind == "main" ? "Punto de entrada de la escena" : "Doble clic para renombrar (actualiza jumpto, nextNode y run)"}
              onDoubleClick={(e) => { if (box.kind != "main") { e.stopPropagation(); setRenaming(true); } }}
            >
              {box.kind == "main" ? "main" : box.scope.id}
            </span>}
        {unreachable && <span className="text-[10px] px-1.5 rounded bg-neutral-700 text-neutral-300" title="Nada de este archivo salta a este node">sin entradas</span>}
        <div className="flex-1" />
        {box.errors.length > 0 &&
          <span className="text-[10px] px-1.5 rounded-full bg-red-600 text-white" title={box.errors.map(e => e.message).join("\n")}>✖ {box.errors.length}</span>}
        {box.warnings.length > 0 &&
          <span className="text-[10px] px-1.5 rounded-full bg-amber-500 text-black" title={box.warnings.join("\n")}>⚠ {box.warnings.length}</span>}
        <button
          className="nodrag text-[11px] px-1.5 py-0.5 rounded hover:bg-white/10 text-neutral-300"
          title="Abrir sus instrucciones (o doble clic en la caja)"
          onClick={() => actions.openScope(box.key)}
        >
          Abrir ▸
        </button>
      </div>

      {/* preview */}
      <div className="px-3 py-2 min-h-[52px] flex items-start gap-2 text-[12px]">
        {!preview && <span className="text-neutral-500 italic">Vacío: ábrelo para añadir instrucciones</span>}
        {preview?.kind == "dialog" && <>
          {preview.speaker ? <Avatar actorId={preview.speaker} actor={assets.actors[preview.speaker]} size={30} /> : <span className="text-lg">💬</span>}
          <div className="min-w-0">
            {preview.speaker && <div className="text-[10px] text-amber-300 font-semibold">{assets.actors[preview.speaker]?.name ?? preview.speaker}</div>}
            <div className="line-clamp-2 bg-white/5 rounded-lg rounded-tl-none px-2 py-1">{preview.text || "…"}</div>
          </div>
        </>}
        {preview?.kind == "narration" && <div className="italic text-neutral-300 line-clamp-2">📜 “{preview.text}”</div>}
        {preview?.kind == "other" && <div className="text-neutral-400 line-clamp-2">{preview.icon} {preview.text}</div>}
      </div>

      {/* category chips */}
      <div className="px-3 pb-2 flex flex-wrap gap-1">
        {(Object.keys(counts) as Array<VisualCategory>).map(category => (
          <span key={category} className="text-[10px] px-1.5 py-0.5 rounded-full border" title={categories[category].label}
            style={{ background: categories[category].soft, borderColor: categories[category].color + "55", color: categories[category].color }}>
            {categoryIcon[category]} {counts[category]}
          </span>
        ))}
        {nestedCount > 0 &&
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
            title="Instrucciones dentro de eventos (Triggers, rutinas, bloques @)">⚡ {nestedCount}</span>}
        <span className="text-[10px] text-neutral-500 ml-auto self-center">{box.scope.statements.length} instr.</span>
      </div>

      {/* exits */}
      {directExits.length > 0 &&
        <div className="border-t border-white/5 py-1">
          {directExits.map(exit => <ExitRow key={exit.id} exit={exit} />)}
        </div>}

      {/* events: exits of instructions nested in Triggers, CodedRoutines, @ blocks… */}
      {eventGroups.length > 0 &&
        <div className="border-t border-yellow-500/20 bg-yellow-500/[0.04] py-1">
          <div className="px-3 h-[20px] flex items-center text-[10px] uppercase tracking-wide text-yellow-300/70"
            title="Saltos que ocurren cuando se dispara un evento (clic, tecla, rutina…), no en el orden de la historia">
            ⚡ Eventos
          </div>
          {eventGroups.map(group => (
            <div key={group.key}>
              <div className="px-3 h-[20px] flex items-center gap-1 text-[10px] text-yellow-200/90 truncate" title={group.title}>
                <span className="truncate">{group.title}</span>
                {group.host && <span className="text-neutral-500 truncate">· {group.host}</span>}
              </div>
              {group.exits.map(exit => <ExitRow key={exit.id} exit={exit} nested />)}
            </div>
          ))}
        </div>}

      {/* new connection */}
      <div className="relative h-[22px] border-t border-white/5 flex items-center justify-center text-[10px] text-neutral-500 rounded-b-xl">
        arrastra ● para conectar
        <Handle
          type="source" position={Position.Bottom} id="new"
          title="Arrastra hasta otra caja (o al vacío para crear un node)"
          style={{ width: 14, height: 14, background: "#e5e5e5", border: "2px solid #0a0a0a", bottom: -8 }}
        />
      </div>
    </div>
  );
});

// ───────────────────────────── ghost ─────────────────────────────

export const GhostNode = memo(function GhostNode({ data }: NodeProps<{ ghost: GhostBox }>) {
  const { ghost } = data;
  const { text, doc, actions } = useGraph();
  return (
    <div className={`rounded-xl border-2 border-dashed px-3 py-2 w-56 text-[12px] bg-neutral-950/80 ${ghost.missing ? "border-red-500/70 text-red-200" : "border-neutral-500/70 text-neutral-300"}`}>
      <Handle type="target" position={Position.Left} id="in" style={{ background: ghost.missing ? "#ef4444" : "#737373", left: -6 }} />
      {ghost.missing
        ? <>
            <div className="font-semibold">⚠ node “{ghost.label}” no existe</div>
            <div className="text-[10px] text-red-300/70 mb-1.5">Algo salta aquí, pero el node no está definido en la escena.</div>
            <button
              className="nodrag w-full text-[11px] py-1 rounded-md bg-red-600/80 hover:bg-red-500 text-white"
              onClick={() => actions.commit(createMissingNode(text, doc, ghost.sceneKey!, ghost.createId!), `${ghost.sceneKey}/node:${ghost.createId}`)}
            >
              ＋ Crear node “{ghost.label}”
            </button>
          </>
        : <>
            <div className="font-semibold">{ghost.kind == "module" ? "🧩" : "🎬"} {ghost.label}</div>
            <div className="text-[10px] text-neutral-500">Definido en otro script del proyecto</div>
          </>}
    </div>
  );
});

// ───────────────────────────── edge ─────────────────────────────

export const FlowEdge = memo(function FlowEdge(props: EdgeProps<{ link: FlowLink }>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data, selected } = props;
  const link = data!.link;
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const color = link.missing ? "#ef4444" : edgeStyles[link.kind].color;
  const dash = link.kind == "goto-reset" ? "9 6" : link.kind == "include" ? "2 6" : link.nested ? "3 5" : undefined;
  const width = (link.kind == "goto-reset" ? 2.6 : 2) + (selected ? 1.2 : 0);
  const chip = link.label ? `“${link.label}”${link.condition ? " ⚑" : ""}` : link.kind == "goto-reset" ? "🎬⟲" : link.nested ? "⚡" : null;
  return (
    <>
      <path d={path} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={width + 6} />
      <path
        d={path} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} markerEnd={markerEnd}
        strokeOpacity={link.nested ? 0.7 : 1}
        className={link.kind == "call" && !link.nested ? "script-edge-flow" : ""}
      />
      {chip &&
        <EdgeLabelRenderer>
          <div
            className="absolute px-1.5 py-0.5 rounded-full text-[10px] font-medium border pointer-events-none whitespace-nowrap"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: "#0a0a0aee", borderColor: color, color
            }}
            title={link.condition ? `Solo si: ${link.condition}` : undefined}
          >
            {chip}
          </div>
        </EdgeLabelRenderer>}
    </>
  );
});
