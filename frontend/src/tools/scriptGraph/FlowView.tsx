import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, Background, BackgroundVariant, Connection, Controls, Edge, MarkerType, MiniMap, Node, NodeChange, Panel,
  ReactFlowProvider, applyNodeChanges, useReactFlow
} from "reactflow";
//@ts-ignore
import "reactflow/dist/style.css";
import Swal from "sweetalert2";
import { Scope, findScope, scopeKeyOf } from "../../engine/interpretators/ScriptDocument.ts";
import { FlowBox, collectIds } from "./flowModel.ts";
import { computeLayout } from "./flowLayout.ts";
import { GraphLayout } from "./layoutStore.ts";
import { FlowEdge, GhostNode, SceneGroupNode, StoryBoxNode } from "./FlowNodes.tsx";
import { FloatingMenu, MenuItem, useGraph, validId } from "./shared.tsx";
import {
  Parser, addScope, connectScopes, deleteScope, duplicateScope, insertStatement, renameScope, setOptionTarget,
  updateStatementFields
} from "./scriptPatches.ts";
import { fieldsOf } from "./instructionForms.ts";
import { categories, edgeStyles } from "./visualTheme.ts";

const nodeTypes = { sceneGroup: SceneGroupNode, storyBox: StoryBoxNode, ghost: GhostNode };
const edgeTypes = { flow: FlowEdge };

type FlowViewProps = {
  parse: Parser,
  layout: GraphLayout,
  onLayoutChange: (layout: GraphLayout) => void,
  toolbarExtra?: React.ReactNode
};

type MenuState = { x: number, y: number, title?: React.ReactNode, items: Array<MenuItem> } | null;

//Handle ids: "new" (generic), x<stmt> (jumpto/run/include), o<stmt>_<opt> (ask option), n<stmt>_<k> (nested in a block)
const isOptionHandle = (id: string) => /^o\d/.test(id);
const isExitHandle = (id: string) => /^x\d/.test(id);
const isNestedHandle = (id: string) => /^n\d/.test(id);

const uniqueId = (base: string, taken: Array<string>) => {
  if (!taken.includes(base)) { return base; }
  let index = 2;
  while (taken.includes(base + index)) { index++; }
  return base + index;
};

function FlowViewInner({ parse, layout, onLayoutChange, toolbarExtra }: FlowViewProps) {
  const { text, doc, model, actions, searchMatches } = useGraph();
  const flow = useReactFlow();
  const [menu, setMenu] = useState<MenuState>(null);
  const [legend, setLegend] = useState(false);
  const [search, setSearch] = useState("");
  const pointer = useRef({ x: 0, y: 0 });
  const connecting = useRef<{ nodeId: string, handleId: string } | null>(null);
  const connected = useRef(false);

  const boxByKey = useMemo(() => new Map(model.boxes.map(box => [box.key, box])), [model]);
  const ids = useMemo(() => collectIds(doc), [doc]);

  // ── nodes & edges from the model ──
  const placed = useMemo(() => computeLayout(model, layout), [model, layout]);
  const builtNodes = useMemo(() => {
    const nodes: Array<Node> = [];
    for (const group of model.groups) {
      const size = placed.groupSizes[group.key];
      nodes.push({
        id: group.key, type: "sceneGroup", position: placed.positions[group.key],
        data: { group, width: size.width, height: size.height },
        style: { width: size.width, height: size.height }, zIndex: -1, selectable: true
      });
    }
    for (const box of model.boxes) {
      nodes.push({
        id: box.key, type: "storyBox", position: placed.positions[box.key], data: { box },
        ...(box.sceneKey ? { parentNode: "group:" + box.sceneKey, expandParent: true } : {})
      });
    }
    for (const ghost of model.ghosts) {
      const inGroup = ghost.sceneKey && ghost.missing;
      nodes.push({
        id: ghost.key, type: "ghost", position: placed.positions[ghost.key], data: { ghost }, connectable: false,
        ...(inGroup ? { parentNode: "group:" + ghost.sceneKey, expandParent: true } : {})
      });
    }
    return nodes;
  }, [model, placed]);

  const [nodes, setNodes] = useState<Array<Node>>(builtNodes);
  useEffect(() => { setNodes(builtNodes); }, [builtNodes]);
  const onNodesChange = useCallback((changes: Array<NodeChange>) => setNodes(current => applyNodeChanges(changes, current)), []);

  const edges = useMemo<Array<Edge>>(() => model.links.map(link => {
    const color = link.missing ? "#ef4444" : edgeStyles[link.kind].color;
    return {
      id: link.id, source: link.sourceKey, sourceHandle: link.sourceHandle, target: link.targetKey, targetHandle: "in",
      type: "flow", data: { link }, zIndex: 5,
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 }
    };
  }), [model]);

  const fitAll = useCallback(() => flow.fitView({ padding: 0.12, duration: 350 }), [flow]);

  // ── search ──
  useEffect(() => {
    if (searchMatches.size == 0) { return; }
    const first = nodes.find(node => searchMatches.has(node.id));
    if (first) { flow.fitView({ nodes: [first], padding: 1.2, duration: 400, maxZoom: 1.1 }); }
  }, [searchMatches]);

  // ── connections ──
  const applyConnection = useCallback((source: FlowBox, handleId: string, targetKey: string) => {
    if (targetKey.startsWith("ghost:") || targetKey.startsWith("ext:")) { return; }
    const target = boxByKey.get(targetKey);
    if (!target) { return; }
    const sameScene = source.sceneKey && source.sceneKey == target.sceneKey;

    if (isOptionHandle(handleId)) {
      const [statementIndex, optionIndex] = handleId.slice(1).split("_").map(Number);
      if (target.kind != "node" || !(sameScene || source.kind == "module")) {
        actions.notify("Una opción de ask solo puede saltar a un node de la misma escena", "error");
        return;
      }
      actions.commit(setOptionTarget(text, source.scope.statements[statementIndex], optionIndex, target.scope.id), source.key);
      return;
    }
    if (isExitHandle(handleId)) {
      const statement = source.scope.statements[Number(handleId.slice(1))];
      const fields = fieldsOf(statement);
      if (!fields) { return; }
      if (statement.kind == "JumpToInstruction") {
        if (target.kind != "node" || !sameScene) { actions.notify("jumpto solo llega a nodes de la misma escena: usa run para cambiar de escena", "error"); return; }
        fields.label = target.scope.id;
      } else if (statement.kind == "RunInstruction") {
        const scene = target.kind == "node" ? findScope(doc, target.scope.parentKey!)! : target.scope;
        fields.scene = scene.type == "entry" ? "gameEntrypoint" : scene.id;
        fields.node = target.kind == "node" ? target.scope.id : "";
      } else if (statement.kind == "IncludeInstruction") {
        if (target.kind != "module") { return; }
        fields.module = target.scope.id;
      }
      actions.commit(updateStatementFields(text, statement, fields), source.key);
      return;
    }
    if (isNestedHandle(handleId)) {
      actions.notify("Este salto está dentro de un bloque de código: edítalo desde las instrucciones", "info");
      return;
    }

    // "new": offer the right instruction for the target
    const items: Array<MenuItem> = [];
    if (target.kind == "module") {
      items.push({
        label: <>🧩 Incluir <b>{target.scope.id}</b></>, hint: edgeStyles.include.description,
        action: () => actions.commit(insertStatement(text, doc, source.key, source.scope.statements.length, `include "${target.scope.id}"`), source.key)
      });
    } else {
      if (target.kind == "node" && (sameScene || source.kind == "module")) {
        items.push({
          label: <>↪ Llamar a <b>{target.scope.id}</b> (jumpto)</>, hint: "Ejecuta el node y luego continúa aquí",
          action: () => actions.commit(connectScopes(text, doc, source.key, target.key, "call"), source.key)
        });
      }
      const scene = target.kind == "node" ? findScope(doc, target.scope.parentKey!) : target.scope;
      const sceneName = scene?.type == "entry" ? "gameEntrypoint" : scene?.id;
      items.push({
        label: <>🎬⟲ Ir a <b>{sceneName}{target.kind == "node" ? ` › ${target.scope.id}` : ""}</b> (run)</>,
        hint: target.kind == "node" ? "Reinicia la escena y ejecuta solo ese node. No vuelve" : "Reinicia y ejecuta la escena desde su main. No vuelve",
        action: () => actions.commit(connectScopes(text, doc, source.key, target.key, "goto-reset"), source.key)
      });
    }
    setMenu({ x: pointer.current.x, y: pointer.current.y, title: "¿Cómo se conecta?", items });
  }, [boxByKey, text, doc, actions]);

  const onConnect = useCallback((connection: Connection) => {
    connected.current = true;
    const source = boxByKey.get(connection.source!);
    if (source && connection.target) { applyConnection(source, connection.sourceHandle ?? "new", connection.target); }
  }, [boxByKey, applyConnection]);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const start = connecting.current;
    connecting.current = null;
    if (connected.current || !start) { connected.current = false; return; }
    const target = event.target as HTMLElement;
    const source = boxByKey.get(start.nodeId);
    //*Dropped anywhere on a box (not only on its small input handle): connect to that box
    const droppedOn = target?.closest?.(".react-flow__node") as HTMLElement | null;
    const droppedKey = droppedOn?.getAttribute("data-id");
    if (droppedKey && source && droppedKey != source.key && boxByKey.has(droppedKey)) {
      applyConnection(source, start.handleId, droppedKey);
      return;
    }
    if (!target?.classList?.contains("react-flow__pane")) { return; }
    if (!source || !source.sceneKey) {
      if (source?.kind == "module") { actions.notify("Desde un module no se pueden crear nodes: arrastra hasta un node existente", "info"); }
      return;
    }
    if (isExitHandle(start.handleId) || isNestedHandle(start.handleId)) { return; }
    const point = "clientX" in event ? { x: event.clientX, y: event.clientY } : { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
    const flowPoint = flow.screenToFlowPosition(point);
    const scene = findScope(doc, source.sceneKey)!;
    const taken = scene.nodes.map(node => node.id);
    const isOption = isOptionHandle(start.handleId);
    setMenu({
      x: point.x, y: point.y, title: isOption ? "Esta opción lleva a…" : "Nuevo node conectado",
      items: [{
        label: "＋ Crear un node nuevo aquí",
        input: {
          placeholder: uniqueId("nuevoNode", taken), validate: validId(taken),
          onSubmit: (id) => {
            const newKey = scopeKeyOf("node", id, scene.key);
            const groupPosition = placed.positions["group:" + scene.key] ?? { x: 0, y: 0 };
            onLayoutChange({ ...layout, positions: { ...layout.positions, [newKey]: { x: flowPoint.x - groupPosition.x, y: flowPoint.y - groupPosition.y } } });
            const withNode = addScope(text, doc, "node", id, [`- "..."`], scene.key);
            const newDoc = parse(withNode);
            let result: string;
            if (isOption) {
              const [statementIndex, optionIndex] = start.handleId.slice(1).split("_").map(Number);
              const statement = findScope(newDoc, source.key)!.statements[statementIndex];
              result = setOptionTarget(withNode, statement, optionIndex, id);
            } else {
              result = connectScopes(withNode, newDoc, source.key, newKey, "call");
            }
            actions.commit(result, newKey);
          }
        }
      }]
    });
  }, [boxByKey, doc, text, layout, placed, flow, parse, actions, onLayoutChange, applyConnection]);

  // ── context menus ──
  const confirmDelete = (what: string) => Swal.fire({
    title: `¿Borrar ${what}?`, text: "Se eliminan sus instrucciones del script (puedes deshacer con Ctrl+Z).",
    icon: "warning", showCancelButton: true, confirmButtonText: "Borrar", confirmButtonColor: "#dc2626", cancelButtonText: "Cancelar",
    background: "#171717", color: "#e5e5e5"
  }).then(result => result.isConfirmed);

  const scopeMenu = (scope: Scope, x: number, y: number) => {
    const isNode = scope.type == "node";
    const isScene = scope.type == "scene" || scope.type == "entry";
    const takenSiblings = isNode ? (findScope(doc, scope.parentKey!)?.nodes.map(n => n.id) ?? []) : scope.type == "module" ? ids.modules : ids.scenes;
    const items: Array<MenuItem> = [
      { label: "📖 Abrir instrucciones", action: () => actions.openScope(scope.key) }
    ];
    if (isNode || scope.type == "scene" || scope.type == "module") {
      items.push({
        label: "✏️ Renombrar a…",
        input: {
          placeholder: scope.id, validate: validId(takenSiblings.filter(id => id != scope.id)),
          onSubmit: (id) => actions.commit(renameScope(text, doc, scope.key, id), scope.key.replace(/[^:]+$/, id))
        }
      });
      items.push({
        label: "⧉ Duplicar como…",
        input: {
          placeholder: uniqueId(scope.id + "Copia", takenSiblings), validate: validId(takenSiblings),
          onSubmit: (id) => actions.commit(duplicateScope(text, doc, scope.key, id), scope.key.replace(/[^:]+$/, id))
        }
      });
    }
    if (isScene || isNode) {
      items.push({ label: "▶ Probar desde aquí", hint: "Carga este script en el motor y lo ejecuta desde este punto", action: () => actions.testRun(scope.key) });
    }
    if (scope.type != "entry") {
      items.push({
        label: "🗑 Borrar", danger: true,
        action: () => { confirmDelete(`${scope.type} “${scope.id}”`).then(ok => ok && actions.commit(deleteScope(text, doc, scope.key))); }
      });
    }
    setMenu({ x, y, title: `${isNode ? "◆ node" : isScene ? "🎬 scene" : "🧩 module"} ${scope.type == "entry" ? "gameEntrypoint" : scope.id}`, items });
  };

  const addSceneOrModule = (type: "scene" | "module", at?: { x: number, y: number }) => {
    const taken = type == "scene" ? ids.scenes : ids.modules;
    const id = uniqueId(type == "scene" ? "escena" : "module", taken);
    const key = scopeKeyOf(type, id);
    if (at) {
      const position = flow.screenToFlowPosition(at);
      onLayoutChange({ ...layout, positions: { ...layout.positions, [type == "scene" ? "group:" + key : key]: position } });
    }
    const body = type == "scene" ? [`- "Nueva escena"`] : [`@ console.log("module ${id}")`];
    actions.commit(addScope(text, doc, type, id, body), type == "scene" ? "group:" + key : key);
  };

  const empty = doc.scopes.length == 0;

  return (
    <div className="relative w-full h-full flex flex-col" onMouseMove={(e) => { pointer.current = { x: e.clientX, y: e.clientY }; }}>
      <style>{`
        .script-edge-flow { stroke-dasharray: 12 5; animation: scriptEdgeFlow 1.1s linear infinite; }
        @keyframes scriptEdgeFlow { to { stroke-dashoffset: -17; } }
        .react-flow__node-sceneGroup { background: transparent; border: none; padding: 0; }
        .react-flow__node-sceneGroup.selected > div { border-color: rgba(52,211,153,0.9); }
        .react-flow__handle { transition: transform .12s; }
        .react-flow__handle:hover { transform: scale(1.4); }
        .react-flow__minimap { background: #0a0a0a; }
        .react-flow__controls button { background: #262626; border-color: #404040; fill: #e5e5e5; }
      `}</style>
      <div className="shrink-0 flex flex-wrap items-center gap-1 bg-neutral-900 border-b border-neutral-700 px-2 py-1.5 z-10">
        <ToolButton onClick={() => addSceneOrModule("scene")} title="Añadir una escena">＋ 🎬 Escena</ToolButton>
        <ToolButton onClick={() => addSceneOrModule("module")} title="Añadir un module reutilizable">＋ 🧩 Module</ToolButton>
        <ToolButton
          onClick={() => { onLayoutChange({ ...layout, positions: {} }); setTimeout(fitAll, 80); }}
          title="Recoloca todas las cajas automáticamente"
        >
          ⤢ Ordenar
        </ToolButton>
        <ToolButton onClick={fitAll} title="Encuadrar toda la historia">⛶ Ver todo</ToolButton>
        <div className="w-px h-5 bg-neutral-700 mx-1" />
        <SearchBox value={search} onChange={setSearch} />
        {search && <span className="text-[11px] text-fuchsia-300">{searchMatches.size} {searchMatches.size == 1 ? "caja" : "cajas"}</span>}
        <div className="w-px h-5 bg-neutral-700 mx-1" />
        <ToolButton onClick={() => setLegend(!legend)} title="Mostrar/ocultar la leyenda" active={legend}>🗺 Leyenda</ToolButton>
        <span className="flex-1" />
        {toolbarExtra}
      </div>
      <div className="relative flex-1 min-h-0">
      <ReactFlow
        fitView={!layout.viewport}
        fitViewOptions={{ padding: 0.12 }}
        defaultViewport={layout.viewport}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onConnectStart={(_: unknown, params: { nodeId: string | null, handleId: string | null }) => { connected.current = false; connecting.current = params.nodeId ? { nodeId: params.nodeId, handleId: params.handleId ?? "new" } : null; }}
        onConnectEnd={onConnectEnd}
        onNodeDragStop={(_, node) => {
          //A plain click also ends a "drag": only persist real moves
          const before = placed.positions[node.id];
          if (before && Math.abs(before.x - node.position.x) < 1 && Math.abs(before.y - node.position.y) < 1) { return; }
          onLayoutChange({ ...layout, positions: { ...layout.positions, [node.id]: node.position } });
        }}
        onMoveEnd={(_, viewport) => onLayoutChange({ ...layout, viewport })}
        onNodeClick={(_, node) => {
          const scope = findScope(doc, node.id.replace(/^group:/, ""));
          if (scope?.headerSpan) { actions.selectSpan(scope.headerSpan); }
          else if (scope?.statements[0]) { actions.selectSpan(scope.statements[0].span); }
        }}
        onEdgeClick={(_, edge) => {
          const link = (edge.data as any)?.link;
          const box = link && boxByKey.get(link.sourceKey);
          const exit = box?.exits.find(e => e.id == link.sourceHandle);
          if (box && exit) { actions.selectSpan(box.scope.statements[exit.statementIndex].span); }
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          const scope = findScope(doc, node.id.replace(/^group:/, ""));
          if (scope) { scopeMenu(scope, event.clientX, event.clientY); }
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          const at = { x: event.clientX, y: event.clientY };
          setMenu({
            x: at.x, y: at.y, title: "Añadir",
            items: [
              { label: "🎬 Nueva escena aquí", action: () => addSceneOrModule("scene", at) },
              { label: "🧩 Nuevo module aquí", hint: "Código reutilizable que se pega con include", action: () => addSceneOrModule("module", at) }
            ]
          });
        }}
        deleteKeyCode={null}
        connectionRadius={36}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-neutral-950"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#3f3f46" />
        <Controls position="bottom-right" showInteractive={false} style={{ marginBottom: 44 }} />
        <MiniMap
          position="top-right" pannable zoomable
          nodeColor={(node) => node.type == "sceneGroup" ? "#064e3b" : node.type == "ghost" ? "#7f1d1d" : node.id.startsWith("module:") ? "#6b21a8" : "#b45309"}
          maskColor="rgba(0,0,0,0.6)"
          style={{ width: 160, height: 110 }}
        />

        {legend &&
          <Panel position="bottom-left" className="bg-neutral-900/90 border border-neutral-700 rounded-lg px-3 py-2 text-[11px] text-neutral-300 shadow-lg shadow-black/50 max-w-72">
            <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">Conexiones</div>
            {(Object.keys(edgeStyles) as Array<keyof typeof edgeStyles>).map(kind => (
              <div key={kind} className="flex items-start gap-2 mb-1" title={edgeStyles[kind].description}>
                <svg width="34" height="10" className="mt-1 shrink-0">
                  <line x1="0" y1="5" x2="34" y2="5" stroke={edgeStyles[kind].color} strokeWidth="2.5"
                    strokeDasharray={kind == "goto-reset" ? "7 4" : kind == "include" ? "2 4" : undefined} />
                </svg>
                <div><b style={{ color: edgeStyles[kind].color }}>{edgeStyles[kind].label}</b><div className="text-neutral-500 text-[10px] leading-tight">{edgeStyles[kind].description}</div></div>
              </div>
            ))}
            <div className="flex items-center gap-2 mb-1"><span className="text-red-400">- - →</span><span className="text-neutral-500">destino que no existe</span></div>
            <div className="text-[10px] uppercase tracking-wide text-neutral-500 mt-2 mb-1">Instrucciones</div>
            <div className="flex flex-wrap gap-1">
              {Object.values(categories).filter(c => c.label != "Desconocido").map(category => (
                <span key={category.label} className="px-1.5 rounded-full border" style={{ color: category.color, borderColor: category.color + "55", background: category.soft }}>{category.label}</span>
              ))}
            </div>
            <div className="text-[10px] text-neutral-500 mt-2 leading-tight">Doble clic en una caja: abrir · Clic derecho: más opciones · Arrastra ● para conectar</div>
          </Panel>}
      </ReactFlow>
      </div>

      {empty &&
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto text-center bg-neutral-900/95 border border-neutral-700 rounded-2xl px-10 py-8 shadow-2xl shadow-black/60">
            <div className="text-5xl mb-3">🎬 💬 ❓</div>
            <div className="text-lg font-semibold text-neutral-100 mb-1">Tu historia empieza aquí</div>
            <div className="text-[12px] text-neutral-400 mb-4 max-w-72">Crea una escena, añade diálogos y conecta decisiones arrastrando entre cajas.</div>
            <button
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              onClick={() => actions.commit(addScope(text, doc, "scene", "main", [`"Había una vez..."`, `- "¡Hola!"`]), "group:scene:main")}
            >
              ＋ Crear mi primera escena
            </button>
          </div>
        </div>}

      {menu && <FloatingMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

export function ToolButton({ children, onClick, title, active }: { children: React.ReactNode, onClick: () => void, title?: string, active?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`text-[12px] px-2 py-1 rounded-md border transition-colors ${active ? "bg-sky-700/60 border-sky-500 text-white" : "bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700"}`}
    >
      {children}
    </button>
  );
}

function SearchBox({ value, onChange }: { value: string, onChange: (value: string) => void }) {
  const { actions } = useGraph();
  return (
    <div className="flex items-center gap-1 bg-neutral-800 border border-neutral-700 rounded-md px-1.5">
      <span className="text-[12px]">🔍</span>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); actions.search(e.target.value); }}
        onKeyDown={e => e.stopPropagation()}
        placeholder="Buscar diálogo, id…"
        className="bg-transparent outline-none text-[12px] text-neutral-100 w-36 py-1"
      />
      {value && <button className="text-neutral-400 hover:text-white text-[11px]" onClick={() => { onChange(""); actions.search(""); }}>✕</button>}
    </div>
  );
}

export default function FlowView(props: FlowViewProps) {
  return <ReactFlowProvider><FlowViewInner {...props} /></ReactFlowProvider>;
}

