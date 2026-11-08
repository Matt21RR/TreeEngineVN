import React, { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { NestedBlock, Statement, StatementKind, findLane, findScope, findStatementByKey } from "../../engine/interpretators/ScriptDocument.ts";
import InstructionPalette from "../components/inputs/InstructionPalette.tsx";
import { CardContext, StoryCardBody } from "./StoryCards.tsx";
import Inspector, { catalogEntryOf } from "./Inspector.tsx";
import { FloatingMenu, MenuItem, useGraph } from "./shared.tsx";
import { defaultSource, serializeFields, summaryOf } from "./instructionForms.ts";
import { deleteItem, deleteStatement, duplicateItem, duplicateStatement, insertInBlock, insertStatement, moveItem, moveStatement } from "./scriptPatches.ts";
import { ContainerCard, NestedApi, NestedApiContext } from "./NestedCards.tsx";
import { categories, kindVisuals, styleOfKind, VisualCategory } from "./visualTheme.ts";
import { sceneIdOf } from "./flowModel.ts";
import { ToolButton } from "./FlowView.tsx";

const PALETTE: Array<{ category: VisualCategory, kinds: Array<StatementKind> }> = [
  { category: "dialog", kinds: ["DialogInstruction", "NarrationInstruction", "SetSpeakerInstruction", "DecisionInstruction"] },
  { category: "actors", kinds: ["ArriveInstruction", "MoveActorInstruction", "EmotionChangeInstruction"] },
  { category: "flow", kinds: ["WaitInstruction", "ResumeInstruction", "JumpToInstruction", "RunInstruction", "IncludeInstruction"] },
  { category: "sound", kinds: ["SoundInstruction"] },
  { category: "objects", kinds: ["CreateInstruction", "SetInstruction", "DeleteInstruction"] },
  { category: "code", kinds: ["JavaScript"] }
];

const paletteLabel: Partial<Record<StatementKind, string>> = {
  DialogInstruction: "Diálogo", NarrationInstruction: "Narración", SetSpeakerInstruction: "Cambiar hablante", DecisionInstruction: "Pregunta / decisión",
  ArriveInstruction: "Entrar en escena", MoveActorInstruction: "Mover actor", EmotionChangeInstruction: "Cambiar emoción",
  WaitInstruction: "Esperar", ResumeInstruction: "Reanudar", JumpToInstruction: "Llamar a node", RunInstruction: "Ir a escena", IncludeInstruction: "Incluir module",
  SoundInstruction: "Sonido", CreateInstruction: "Crear objeto", SetInstruction: "Modificar objeto", DeleteInstruction: "Borrar objeto", JavaScript: "JavaScript"
};

const branchIcon: Record<string, string> = {
  Actor: "🧍", StageMark: "📍", GraphObject: "🖼", ModelObject: "🧊", Animation: "🎞", TextureAnim: "🎞",
  Trigger: "👆", KeyboardTrigger: "⌨", CodedRoutine: "⚙"
};

const DRAG_NEW = "application/x-sg-new";
const DRAG_MOVE = "application/x-sg-move";

const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];

export default function ChainView({ scopeKey, onBack, toolbarExtra }: { scopeKey: string, onBack: () => void, toolbarExtra?: React.ReactNode }) {
  const { text, doc, parse, actions, assets, pulseKey } = useGraph();
  const scope = findScope(doc, scopeKey);
  const [selected, setSelected] = useState<number | null>(null);
  //*Selected instruction INSIDE a code block (Trigger callback, @ block…): its statement key
  const [nestedKey, setNestedKey] = useState<string | null>(null);
  const [catalogLane, setCatalogLane] = useState<NestedBlock | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ x: number, y: number, items: Array<MenuItem>, title?: string } | null>(null);
  const [catalogAt, setCatalogAt] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sceneScope = scope?.type == "node" ? findScope(doc, scope.parentKey!) : scope;
  const sceneKey = sceneScope && sceneScope.type != "module" ? sceneScope.key : undefined;
  const sceneNodes = sceneScope?.nodes.map(node => node.id) ?? [];

  useEffect(() => { containerRef.current?.focus(); }, [scopeKey]);
  useEffect(() => {
    if (scope && selected != null && selected >= scope.statements.length) { setSelected(scope.statements.length ? scope.statements.length - 1 : null); }
  }, [scope?.statements.length]);

  const contexts = useMemo<Array<CardContext>>(() => {
    if (!scope) { return []; }
    let speaker: string | undefined;
    let afterRun = false;
    let previous: Statement | undefined;
    let previousSpeaker: string | undefined;
    return scope.statements.map((statement, index) => {
      const ctx: CardContext = {
        statement, index, scopeKey, sceneKey, speaker,
        continuesChat: statement.kind == "DialogInstruction" && previous?.kind == "DialogInstruction" && previousSpeaker == speaker,
        unreachable: afterRun
      };
      if (statement.kind == "SetSpeakerInstruction") { speaker = statement.data.actor; }
      if (statement.kind == "RunInstruction") { afterRun = true; }
      previous = statement;
      previousSpeaker = ctx.speaker;
      return ctx;
    });
  }, [scope, scopeKey, sceneKey]);

  if (!scope) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-neutral-400">
        <div>Esta caja ya no existe (¿se renombró o se borró?).</div>
        <ToolButton onClick={onBack}>‹ Volver al mapa</ToolButton>
      </div>
    );
  }

  // ── smart defaults: use what the script already knows ──
  const firstActor = Object.keys(assets.actors)[0];
  const lastSpeaker = contexts.at(-1)?.speaker ?? firstActor;
  const firstMark = Object.keys(assets.marks)[0];
  const smartSource = (kind: StatementKind) => {
    switch (kind) {
      case "SetSpeakerInstruction": return `${lastSpeaker ?? "actor"} says`;
      case "MoveActorInstruction": return serializeFields(kind, { actorId: lastSpeaker ?? "actor", markId: firstMark ?? "mark", duration: 500 })!;
      case "ArriveInstruction": return serializeFields(kind, { actorId: lastSpeaker ?? "actor", markId: firstMark ?? "mark", duration: 700 })!;
      case "EmotionChangeInstruction": {
        const emotion = Object.keys(assets.actors[lastSpeaker ?? ""]?.emotions ?? {})[0] ?? "happy";
        return serializeFields(kind, { actorId: lastSpeaker ?? "actor", emotionId: emotion, duration: 400 })!;
      }
      case "JumpToInstruction": return `jumpto ${sceneNodes.find(node => node != scope.id) ?? "nodo"}`;
      case "RunInstruction": return `run ${sceneScope ? sceneIdOf(sceneScope) : "escena"}`;
      case "DecisionInstruction": {
        const [a, b] = sceneNodes;
        return serializeFields(kind, {
          question: "¿Qué haces?",
          options: [{ label: "Sí", condition: "", nextNode: a ?? "" }, { label: "No", condition: "", nextNode: b ?? "" }]
        }, "")!;
      }
      default: return defaultSource(kind);
    }
  };

  const insertAt = (index: number, source: string) => {
    actions.commit(insertStatement(text, doc, scopeKey, index, source), scopeKey);
    setNestedKey(null);
    setSelected(index);
  };
  const insertNested = (lane: NestedBlock, index: number, source: string) => {
    actions.commit(insertInBlock(text, lane, index, source), scopeKey);
    setSelected(null);
    setNestedKey(`${lane.key}/${index}`);
  };
  const laneKeyOf = (key: string) => key.replace(/\/\d+$/, "");
  const itemIndexOf = (key: string) => Number(/\/(\d+)$/.exec(key)?.[1] ?? -1);
  const nestedApi: NestedApi = {
    scopeKey, sceneKey, selectedKey: nestedKey,
    select: (statement) => { setSelected(null); setNestedKey(statement.key ?? null); actions.selectSpan(statement.span); },
    insert: (lane, index, kind) => insertNested(lane, index, smartSource(kind)),
    quickAdd: (lane, index, x, y) => quickAddMenu(index, x, y, lane),
    move: (laneKey, from, to) => {
      actions.commit(moveItem(text, parse, laneKey, from, to));
      setNestedKey(`${laneKey}/${from < to ? to - 1 : to}`);
    },
    remove: (lane, index) => { actions.commit(deleteItem(text, lane.items[index])); setNestedKey(null); },
    duplicate: (lane, index) => { actions.commit(duplicateItem(text, lane, index)); setNestedKey(`${lane.key}/${index + 1}`); }
  };
  const removeAt = (index: number) => {
    actions.commit(deleteStatement(text, scope.statements[index]));
    setSelected(scope.statements.length > 1 ? Math.max(0, Math.min(index, scope.statements.length - 2)) : null);
  };
  const moveTo = (from: number, to: number) => {
    if (to < 0 || to > scope.statements.length) { return; }
    actions.commit(moveStatement(text, parse, scopeKey, from, to));
    setSelected(from < to ? to - 1 : to);
  };

  const quickAddMenu = (index: number, x: number, y: number, lane?: NestedBlock) => {
    const items: Array<MenuItem> = PALETTE.flatMap(group => group.kinds.map(kind => ({
      label: <span><span style={{ color: categories[group.category].color }}>{kindVisuals[kind].icon}</span> {paletteLabel[kind]}</span>,
      action: () => lane ? insertNested(lane, index, smartSource(kind)) : insertAt(index, smartSource(kind))
    })));
    items.push({ label: "📚 Buscar en el catálogo completo…", action: () => { setCatalogLane(lane ?? null); setCatalogAt(index); } });
    setMenu({ x, y, items, title: lane ? "Insertar dentro del evento" : "Insertar aquí" });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName == "INPUT" || target.tagName == "TEXTAREA" || target.tagName == "SELECT") { return; }
    if (nestedKey) {
      const lane = findLane(doc, laneKeyOf(nestedKey));
      const index = itemIndexOf(nestedKey);
      if (lane && e.key == "Delete") { e.preventDefault(); nestedApi.remove(lane, index); }
      else if (lane && e.key == "d" && e.ctrlKey) { e.preventDefault(); nestedApi.duplicate(lane, index); }
      return;
    }
    if (selected == null) { return; }
    if (e.key == "Delete") { e.preventDefault(); removeAt(selected); }
    else if (e.key == "d" && e.ctrlKey) { e.preventDefault(); actions.commit(duplicateStatement(text, parse, scopeKey, selected)); setSelected(selected + 1); }
    else if (e.key == "ArrowUp" && e.altKey) { e.preventDefault(); moveTo(selected, selected - 1); }
    else if (e.key == "ArrowDown" && e.altKey) { e.preventDefault(); moveTo(selected, selected + 2); }
    else if (e.key == "ArrowUp") { e.preventDefault(); setSelected(Math.max(0, selected - 1)); }
    else if (e.key == "ArrowDown") { e.preventDefault(); setSelected(Math.min(scope.statements.length - 1, selected + 1)); }
    else if (e.key == "Enter" && scope.statements[selected]?.kind == "DialogInstruction") {
      e.preventDefault(); insertAt(selected + 1, `- "..."`);
    }
  };

  const onDrop = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const kind = e.dataTransfer.getData(DRAG_NEW) as StatementKind;
    const from = e.dataTransfer.getData(DRAG_MOVE);
    if (kind) { insertAt(index, smartSource(kind)); }
    else if (from !== "") { moveTo(Number(from), index); }
  };

  const dropZone = (index: number, last?: boolean) => (
    <div
      key={`drop-${index}-${last ? "last" : ""}`}
      className={`group relative flex items-center justify-center transition-all ${dragOver == index ? "h-12" : last ? "h-14" : "h-3"}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(index); }}
      onDragLeave={() => setDragOver(current => current == index ? null : current)}
      onDrop={(e) => onDrop(index, e)}
    >
      <div className={`absolute left-12 right-4 border-t-2 ${dragOver == index ? "border-sky-400" : "border-transparent group-hover:border-neutral-700"}`} />
      <button
        className={`relative z-10 rounded-full text-[11px] leading-none transition-opacity ${last ? "opacity-100 px-3 py-1.5 bg-neutral-800 border border-neutral-600 text-neutral-200 hover:bg-neutral-700" : "opacity-0 group-hover:opacity-100 w-5 h-5 bg-sky-600 text-white"}`}
        title="Insertar una instrucción aquí"
        onClick={(e) => quickAddMenu(index, e.clientX, e.clientY)}
      >
        {last ? "＋ Añadir instrucción" : "＋"}
      </button>
      {dragOver == index && <span className="absolute right-6 text-[10px] text-sky-300">suelta aquí</span>}
    </div>
  );

  const renderCard = (ctx: CardContext, index: number) => {
    const statement = ctx.statement;
    const style = styleOfKind(statement.kind);
    const errors = doc.errors.filter(error => overlaps([error.charStart, Math.max(error.charEnd, error.charStart + 1)], statement.span));
    const isSelected = selected == index;
    const isStructural = ["SceneDefinitionInstruction", "ModuleDefinitionInstruction", "NodeDefinitionInstruction", "StructureEndInstruction", "Unknown"].includes(statement.kind);
    return (
                  <div
                    className={`group relative flex gap-2 rounded-xl pl-1 pr-2 py-1.5 transition-colors ${isSelected ? "bg-sky-500/10 ring-1 ring-sky-500/60" : "hover:bg-white/[0.03]"} ${ctx.unreachable ? "opacity-40" : ""} ${pulseKey == scopeKey && isSelected ? "animate-pulse" : ""}`}
                    onClick={(e) => { e.stopPropagation(); setNestedKey(null); setSelected(index); actions.selectSpan(statement.span); }}
                    title={ctx.unreachable ? "Nunca se ejecuta: un run anterior cambia de escena" : undefined}
                  >
                    {/* gutter: drag handle + category bar */}
                    <div
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData(DRAG_MOVE, String(index)); e.dataTransfer.effectAllowed = "move"; }}
                      className="w-6 shrink-0 flex flex-col items-center cursor-grab active:cursor-grabbing"
                      title="Arrastra para reordenar"
                    >
                      <span className="text-[13px] leading-none mt-1" style={{ color: style.color }}>{kindVisuals[statement.kind].icon}</span>
                      <span className="flex-1 w-0.5 rounded-full mt-1" style={{ background: style.color + "66" }} />
                      <span className="text-neutral-600 opacity-0 group-hover:opacity-100 text-[10px]">⠿</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {isStructural
                        ? <div className="rounded-lg border border-red-500/50 bg-red-950/30 px-3 py-1.5 text-[12px] text-red-200">
                            ⚠ <code>{statement.raw.split("\n")[0]}</code>
                            <div className="text-[10px] text-red-300/80">{statement.warning ?? "El intérprete no reconoce esta línea"}</div>
                          </div>
                        : statement.blocks
                        ? <ContainerCard statement={statement} />
                        : <StoryCardBody
                            ctx={ctx}
                            collapsed={!expanded.has(index)}
                            onToggleCollapsed={() => setExpanded(current => {
                              const next = new Set(current);
                              if (next.has(index)) { next.delete(index); } else { next.add(index); }
                              return next;
                            })}
                          />}
                      {errors.length > 0 && <div className="mt-1 text-[10px] text-red-300">✖ {errors.map(error => error.message).join(" · ")}</div>}
                    </div>
                    {/* hover tools */}
                    <div className="absolute right-1 top-1 hidden group-hover:flex gap-0.5">
                      <button className="text-[10px] px-1 rounded bg-neutral-800 hover:bg-neutral-700" title="Duplicar" onClick={(e) => { e.stopPropagation(); actions.commit(duplicateStatement(text, parse, scopeKey, index)); }}>⧉</button>
                      <button className="text-[10px] px-1 rounded bg-neutral-800 hover:bg-red-800" title="Borrar" onClick={(e) => { e.stopPropagation(); removeAt(index); }}>🗑</button>
                    </div>
                  </div>
    );
  };

  //*Runs of 3+ consecutive "new …" (scene setup) are shown as one compact block
  const segments: Array<{ type: "single", index: number } | { type: "group", start: number, end: number }> = [];
  for (let i = 0; i < contexts.length; i++) {
    let j = i;
    //Creations with event lanes (Triggers with engine instructions inside) stay visible as containers
    const plainCreate = (k: number) => contexts[k].statement.kind == "CreateInstruction" && !contexts[k].statement.blocks;
    while (j + 1 < contexts.length && plainCreate(j + 1) && plainCreate(i)) { j++; }
    if (plainCreate(i) && j - i >= 2) { segments.push({ type: "group", start: i, end: j }); i = j; }
    else { segments.push({ type: "single", index: i }); }
  }

  const title = scope.type == "entry" ? "gameEntrypoint" : scope.type == "node" ? scope.id : scope.type == "module" ? scope.id : "main";
  const icon = scope.type == "node" ? "◆" : scope.type == "module" ? "🧩" : "★";

  return (
    <NestedApiContext.Provider value={nestedApi}>
    <div className="relative h-full flex flex-col bg-neutral-950 text-neutral-200">
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800 bg-neutral-900">
        <ToolButton onClick={onBack} title="Volver al mapa de la historia (Esc)">‹ Mapa</ToolButton>
        <div className="text-[13px] flex items-center gap-1.5">
          {sceneScope && sceneScope.type != "module" && <>
            <span className="text-emerald-300 cursor-pointer hover:underline" onClick={() => actions.openScope(sceneScope.key)}>🎬 {sceneIdOf(sceneScope)}</span>
            <span className="text-neutral-600">›</span>
          </>}
          <span className="font-semibold">{icon} {title}</span>
          <span className="text-[11px] text-neutral-500">· {scope.statements.length} instrucciones</span>
        </div>
        {scope.warning && <span className="text-amber-300 text-[11px]" title={scope.warning}>⚠ {scope.warning}</span>}
        <span className="flex-1" />
        {scope.type != "module" && <ToolButton onClick={() => actions.testRun(scopeKey)} title="Carga el script en el motor y lo ejecuta desde aquí">▶ Probar desde aquí</ToolButton>}
        {toolbarExtra}
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* palette */}
        <div className="w-44 shrink-0 border-r border-neutral-800 overflow-y-auto py-2 bg-neutral-900/60">
          <div className="px-3 text-[10px] uppercase tracking-wide text-neutral-500 mb-1">Arrastra al guion</div>
          {PALETTE.map(group => (
            <div key={group.category} className="mb-2">
              <div className="px-3 text-[10px] font-semibold mb-0.5" style={{ color: categories[group.category].color }}>{categories[group.category].label}</div>
              {group.kinds.map(kind => (
                <div
                  key={kind}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData(DRAG_NEW, kind); e.dataTransfer.effectAllowed = "copy"; }}
                  onClick={() => {
                    const lane = nestedKey ? findLane(doc, laneKeyOf(nestedKey)) : undefined;
                    if (lane && nestedKey) { insertNested(lane, itemIndexOf(nestedKey) + 1, smartSource(kind)); }
                    else { insertAt(selected != null ? selected + 1 : scope.statements.length, smartSource(kind)); }
                  }}
                  title={(catalogEntryOf(kind)?.description ?? "") + "\n\nClic: insertar tras la seleccionada · Arrastra: elegir el sitio"}
                  className="mx-2 mb-0.5 px-2 py-1 rounded-md text-[12px] cursor-grab active:cursor-grabbing hover:bg-white/5 flex items-center gap-1.5 border border-transparent hover:border-neutral-700"
                >
                  <span className="w-5 text-center" style={{ color: categories[group.category].color }}>{kindVisuals[kind].icon}</span>
                  <span className="truncate">{paletteLabel[kind]}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="px-2">
            <button className="w-full text-[11px] px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700" onClick={() => setCatalogAt(selected != null ? selected + 1 : scope.statements.length)}>
              📚 Catálogo completo
            </button>
          </div>
        </div>

        {/* storyboard */}
        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-0 overflow-y-auto outline-none py-3"
          onClick={() => { setSelected(null); setNestedKey(null); }}
        >
          <div className="max-w-3xl mx-auto px-4">
            {scope.statements.length == 0 &&
              <div className="text-center text-neutral-500 text-[12px] py-8">
                <div className="text-3xl mb-2">📝</div>
                Vacío. Arrastra instrucciones desde la izquierda o pulsa ＋.
              </div>}
            {dropZone(0)}
            {segments.map(segment => {
              if (segment.type == "group") {
                const open = openGroups.has(segment.start);
                const indexes = Array.from({ length: segment.end - segment.start + 1 }, (_, i) => segment.start + i);
                return (
                  <React.Fragment key={"g" + segment.start}>
                    <div className="rounded-xl border border-blue-400/30 bg-blue-950/20 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="w-full flex items-center gap-2 text-left text-[12px] text-blue-100"
                        onClick={() => setOpenGroups(current => { const next = new Set(current); if (next.has(segment.start)) { next.delete(segment.start); } else { next.add(segment.start); } return next; })}
                      >
                        <span>✨</span>
                        <b>Preparación de escena</b>
                        <span className="text-blue-300/70">· crea {indexes.length} objetos</span>
                        <span className="flex-1" />
                        <span className="text-[10px] text-neutral-400">{open ? "▾ ocultar" : "▸ ver uno a uno"}</span>
                      </button>
                      {!open &&
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {indexes.map(index => {
                            const data = contexts[index].statement.data;
                            const id = String(data.id ?? "").replace(/^["'`]|["'`]$/g, "");
                            return (
                              <button
                                key={index}
                                onClick={() => { setSelected(index); actions.selectSpan(contexts[index].statement.span); }}
                                title={`${data.branch} ${id} · clic para editar`}
                                className={`text-[11px] px-2 py-0.5 rounded-full border ${selected == index ? "bg-sky-600/60 border-sky-400 text-white" : "bg-blue-900/30 border-blue-400/30 text-blue-100 hover:bg-blue-800/40"}`}
                              >
                                {branchIcon[data.branch] ?? "✨"} {id || data.branch}
                              </button>
                            );
                          })}
                        </div>}
                      {open && <div className="mt-1">{indexes.map(index => <React.Fragment key={index}>{renderCard(contexts[index], index)}</React.Fragment>)}</div>}
                    </div>
                    {dropZone(segment.end + 1, segment.end == contexts.length - 1)}
                  </React.Fragment>
                );
              }
              const index = segment.index;
              return (
                <React.Fragment key={index}>
                  {renderCard(contexts[index], index)}
                  {dropZone(index + 1, index == contexts.length - 1)}
                </React.Fragment>
              );
            })}
            {contexts.length == 0 && dropZone(0, true)}
            {scope.type == "node" && contexts.length > 0 && !contexts.some(ctx => ctx.statement.kind == "RunInstruction") &&
              <div className="text-center text-[11px] text-neutral-500 mt-2">
                ↩ fin del node: el flujo vuelve a quien lo llamó
              </div>}
          </div>
        </div>

        {/* inspector: nested selection */}
        {nestedKey && (() => {
          const visit = findStatementByKey(doc, nestedKey);
          const lane = findLane(doc, laneKeyOf(nestedKey));
          const index = itemIndexOf(nestedKey);
          if (!visit || !lane) { return null; }
          return (
            <div className="w-80 shrink-0">
              <Inspector
                key={nestedKey}
                statement={visit.statement}
                scopeKey={scopeKey}
                sceneId={sceneScope && sceneScope.type != "module" ? sceneIdOf(sceneScope) : undefined}
                onClose={() => setNestedKey(null)}
                onDelete={() => nestedApi.remove(lane, index)}
                onDuplicate={() => nestedApi.duplicate(lane, index)}
                onMove={(delta) => nestedApi.move(lane.key, index, delta < 0 ? index - 1 : index + 2)}
              />
            </div>
          );
        })()}

        {/* inspector */}
        {!nestedKey && selected != null && scope.statements[selected] &&
          <div className="w-80 shrink-0">
            <Inspector
              key={`${scopeKey}#${selected}`}
              statement={scope.statements[selected]}
              scopeKey={scopeKey}
              sceneId={sceneScope && sceneScope.type != "module" ? sceneIdOf(sceneScope) : undefined}
              onClose={() => setSelected(null)}
              onDelete={() => {
                const statement = scope.statements[selected];
                if (statement.kind == "DecisionInstruction" || statement.raw.length > 160) {
                  Swal.fire({
                    title: "¿Borrar esta instrucción?", text: summaryOf(statement), icon: "warning", showCancelButton: true,
                    confirmButtonText: "Borrar", confirmButtonColor: "#dc2626", cancelButtonText: "Cancelar", background: "#171717", color: "#e5e5e5"
                  }).then(result => result.isConfirmed && removeAt(selected));
                } else {
                  removeAt(selected);
                }
              }}
              onDuplicate={() => { actions.commit(duplicateStatement(text, parse, scopeKey, selected)); setSelected(selected + 1); }}
              onMove={(delta) => moveTo(selected, delta < 0 ? selected - 1 : selected + 2)}
            />
          </div>}
      </div>

      <InstructionPalette
        visible={catalogAt != null}
        onClose={() => setCatalogAt(null)}
        onInsert={(syntax) => {
          if (catalogAt != null) { if (catalogLane) { insertNested(catalogLane, catalogAt, syntax); } else { insertAt(catalogAt, syntax); } }
          setCatalogAt(null); setCatalogLane(null);
        }}
      />
      {menu && <FloatingMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
    </NestedApiContext.Provider>
  );
}
