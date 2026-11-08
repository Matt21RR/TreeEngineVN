import React, { useEffect, useMemo, useRef, useState } from "react";
import { Statement, StatementKind } from "../../engine/interpretators/ScriptDocument.ts";
import { scriptInstructionsCatalog } from "../components/inputs/scriptInstructionsCatalog.ts";
import { DialogSegment, FieldSpec, OptionFields, fieldsOf, formOf, hasStructuredForm, serializeFields } from "./instructionForms.ts";
import { replaceStatement, statementSource, updateStatementFields } from "./scriptPatches.ts";
import { kindVisuals, styleOfKind } from "./visualTheme.ts";
import { Avatar, useGraph } from "./shared.tsx";
import { collectIds } from "./flowModel.ts";
import { useProjectIndex } from "./projectAssets.ts";

const catalogNameOf: Partial<Record<StatementKind, string>> = {
  DialogInstruction: "- (dialog)", NarrationInstruction: "narration", SetSpeakerInstruction: "says", DecisionInstruction: "ask",
  MoveActorInstruction: "move", ArriveInstruction: "arrives", EmotionChangeInstruction: "gets", CreateInstruction: "new (creation)",
  SetInstruction: "set", DeleteInstruction: "delete", SoundInstruction: "sound", JavaScript: "@ (javascript)",
  JumpToInstruction: "jumpto", RunInstruction: "run", WaitInstruction: "wait", ResumeInstruction: "resume", IncludeInstruction: "include",
  SceneDefinitionInstruction: "scene", ModuleDefinitionInstruction: "module", NodeDefinitionInstruction: "node", StructureEndInstruction: "end"
};

export const catalogEntryOf = (kind: StatementKind) =>
  scriptInstructionsCatalog.find(entry => entry.name == catalogNameOf[kind]);

const inputClass = "w-full bg-neutral-950 border border-neutral-700 focus:border-sky-500 rounded-md px-2 py-1 text-[12px] text-neutral-100 outline-none";

type Props = {
  statement: Statement,
  scopeKey: string,
  sceneId?: string,
  onDelete: () => void,
  onDuplicate: () => void,
  onMove: (delta: number) => void,
  onClose: () => void
};

export default function Inspector({ statement, scopeKey, sceneId, onDelete, onDuplicate, onMove, onClose }: Props) {
  const { text, doc, actions, assets, checkErrors } = useGraph();
  const structured = hasStructuredForm(statement.kind);
  const [fields, setFields] = useState<Record<string, any> | null>(() => fieldsOf(statement));
  const [raw, setRaw] = useState(() => statementSource(text, statement));
  const commitTimer = useRef<number>(-1);
  const sourceRef = useRef(statement.raw);

  //External change (undo, text editor, another card): reload the drafts
  useEffect(() => {
    if (statement.raw != sourceRef.current) {
      sourceRef.current = statement.raw;
      setFields(fieldsOf(statement));
      setRaw(statementSource(text, statement));
    }
  }, [statement.raw]);
  useEffect(() => () => window.clearTimeout(commitTimer.current), []);

  const scheduleCommit = (build: () => string) => {
    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      const next = build();
      if (next != text) { actions.commit(next, undefined, "inspector:" + scopeKey); }
    }, 350);
  };

  const updateField = (key: string, value: any) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    const source = serializeFields(statement.kind, next, "");
    if (source != null) { sourceRef.current = "(pending)"; }
    scheduleCommit(() => updateStatementFields(text, statement, next));
  };

  const updateRaw = (value: string) => {
    setRaw(value);
    sourceRef.current = "(pending)";
    scheduleCommit(() => replaceStatement(text, statement, value));
  };

  const ids = useMemo(() => collectIds(doc), [doc]);
  const sounds = useProjectIndex("sounds");
  const visual = kindVisuals[statement.kind];
  const style = styleOfKind(statement.kind);
  const entry = catalogEntryOf(statement.kind);
  const preview = structured && fields ? serializeFields(statement.kind, fields, "") : raw;
  const rawErrors = !structured ? checkErrors(raw) : [];

  const lists: Record<string, Array<string>> = {
    actor: Object.keys(assets.actors),
    mark: Object.keys(assets.marks),
    emotion: Object.keys(assets.actors[fields?.actorId]?.emotions ?? {}),
    sound: Object.keys(sounds),
    node: (statement.kind == "RunInstruction" && fields?.scene ? ids.nodesByScene[fields.scene] : ids.nodesByScene[sceneId ?? ""]) ?? [],
    scene: ids.scenes,
    module: ids.modules,
    soundAction: ["play", "pause", "stop"]
  };

  const renderField = (spec: FieldSpec) => {
    const value = fields?.[spec.key] ?? "";
    const listId = `sg-list-${spec.type}`;
    let control: React.ReactNode;
    if (spec.type == "longText") {
      control = <textarea rows={3} className={inputClass} value={value} onChange={e => updateField(spec.key, e.target.value)} />;
    } else if (spec.type == "code") {
      control = <textarea rows={2} className={inputClass + " font-mono"} value={value} placeholder={spec.placeholder} onChange={e => updateField(spec.key, e.target.value)} />;
    } else if (spec.type == "number") {
      control = <input type="number" className={inputClass} value={value} placeholder={spec.optional ? "(opcional)" : ""}
        onChange={e => updateField(spec.key, e.target.value === "" ? "" : e.target.valueAsNumber)} />;
    } else if (spec.type == "soundAction") {
      control = (
        <div className="flex gap-1">
          {["play", "pause", "stop"].map(action => (
            <button key={action} onClick={() => updateField(spec.key, action)}
              className={`flex-1 text-[11px] py-1 rounded-md border ${value == action ? "bg-pink-600/60 border-pink-400 text-white" : "bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800"}`}>
              {action == "play" ? "▶ play" : action == "pause" ? "⏸ pause" : "⏹ stop"}
            </button>
          ))}
        </div>
      );
    } else {
      const options = lists[spec.type] ?? [];
      control = (
        <div className="flex items-center gap-1.5">
          {spec.type == "actor" && value && <Avatar actorId={value} actor={assets.actors[value]} size={24} />}
          <input className={inputClass} value={value} list={options.length ? listId : undefined} placeholder={spec.optional ? "(opcional)" : ""}
            onChange={e => updateField(spec.key, e.target.value)} />
          {options.length > 0 && <datalist id={listId}>{options.map(option => <option key={option} value={option} />)}</datalist>}
        </div>
      );
      if (options.length > 0 && value && !options.includes(value) && spec.type != "text") {
        control = <>{control}<div className="text-[10px] text-amber-400 mt-0.5">⚠ “{value}” no aparece en este script/proyecto</div></>;
      }
    }
    return (
      <label key={spec.key} className="block mb-2.5">
        <div className="text-[11px] text-neutral-400 mb-0.5">{spec.label}</div>
        {control}
        {spec.hint && <div className="text-[10px] text-neutral-500 mt-0.5">{spec.hint}</div>}
      </label>
    );
  };

  return (
    <div className="h-full flex flex-col bg-neutral-900 border-l border-neutral-700 text-neutral-200" onKeyDown={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-700" style={{ background: style.soft }}>
        <span className="text-lg" style={{ color: style.color }}>{visual.icon}</span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold capitalize">{visual.name}</div>
          <div className="text-[10px] text-neutral-400">{style.label}</div>
        </div>
        <span className="flex-1" />
        <button className="text-neutral-400 hover:text-white px-1" title="Cerrar panel" onClick={onClose}>✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {entry && <div className="text-[11px] text-neutral-400 mb-3 leading-snug">{entry.description}</div>}
        {statement.warning && <div className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-700/50 rounded-md px-2 py-1 mb-3">⚠ {statement.warning}</div>}

        {structured && fields && statement.kind == "DialogInstruction" &&
          <DialogSegmentsEditor segments={fields.segments} onChange={segments => updateField("segments", segments)} />}
        {structured && fields && statement.kind == "DecisionInstruction" && <>
          {renderField({ key: "question", label: "Pregunta", type: "text" })}
          <OptionsEditor options={fields.options} nodes={lists.node} onChange={options => updateField("options", options)} />
        </>}
        {structured && fields && statement.kind != "DialogInstruction" && statement.kind != "DecisionInstruction" &&
          formOf(statement.kind)!.fields.map(renderField)}
        {structured && fields && formOf(statement.kind)!.fields.length == 0 && statement.kind == "ResumeInstruction" &&
          <div className="text-[11px] text-neutral-500">Sin opciones: reanuda el flujo pausado por un wait sin duración.</div>}

        {!structured && <>
          <div className="text-[11px] text-neutral-400 mb-1">Código</div>
          <textarea
            rows={Math.min(16, Math.max(3, raw.split("\n").length + 1))}
            className={inputClass + " font-mono leading-snug"}
            spellCheck={false}
            value={raw}
            onChange={e => updateRaw(e.target.value)}
          />
          {rawErrors.length > 0 && <div className="mt-1 space-y-0.5">{rawErrors.map((error, i) =>
            <div key={i} className="text-[10px] text-red-300">✖ {error.message}</div>)}</div>}
          {entry?.variants && <details className="mt-3">
            <summary className="text-[11px] text-sky-300 cursor-pointer">Ver sintaxis disponibles</summary>
            <div className="mt-1 space-y-1">{entry.variants.map((variant, i) => (
              <button key={i} className="block w-full text-left rounded-md bg-neutral-950 hover:bg-neutral-800 px-2 py-1" title="Usar esta forma" onClick={() => updateRaw(variant.syntax)}>
                <div className="text-[10px] text-neutral-400">{variant.subtitle}</div>
                <code className="text-[11px] text-neutral-200">{variant.syntax}</code>
              </button>
            ))}</div>
          </details>}
        </>}

        {structured &&
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">Así queda en el script</div>
            <pre className="text-[11px] bg-black/60 border border-neutral-800 rounded-md px-2 py-1.5 whitespace-pre-wrap break-all text-emerald-200">{preview}</pre>
          </div>}
      </div>

      <div className="flex items-center gap-1 px-3 py-2 border-t border-neutral-700">
        <button className="text-[11px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700" title="Subir (Alt+↑)" onClick={() => onMove(-1)}>↑</button>
        <button className="text-[11px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700" title="Bajar (Alt+↓)" onClick={() => onMove(1)}>↓</button>
        <button className="text-[11px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700" title="Duplicar (Ctrl+D)" onClick={onDuplicate}>⧉ Duplicar</button>
        <span className="flex-1" />
        <button className="text-[11px] px-2 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-100" title="Borrar (Supr)" onClick={onDelete}>🗑 Borrar</button>
      </div>
    </div>
  );
}

function DialogSegmentsEditor({ segments, onChange }: { segments: Array<DialogSegment>, onChange: (segments: Array<DialogSegment>) => void }) {
  const set = (index: number, segment: DialogSegment) => onChange(segments.map((s, i) => i == index ? segment : s));
  const remove = (index: number) => onChange(segments.filter((_, i) => i != index));
  return (
    <div className="mb-2">
      <div className="text-[11px] text-neutral-400 mb-1">Lo que se dice (en orden)</div>
      <div className="space-y-1.5">
        {segments.map((segment, i) => (
          <div key={i} className="flex items-start gap-1">
            {segment.type == "text"
              ? <textarea rows={2} className={inputClass + " bg-amber-50/5"} value={segment.text} placeholder="Texto del diálogo"
                  onChange={e => set(i, { type: "text", text: e.target.value })} />
              : <div className="flex-1">
                  <div className="text-[10px] text-amber-300 mb-0.5">⚡ ajuste en mitad de la frase</div>
                  <input className={inputClass + " font-mono"} value={segment.raw} placeholder="speed:0.4"
                    onChange={e => set(i, { type: "config", raw: e.target.value })} />
                </div>}
            {segments.length > 1 && <button className="text-neutral-500 hover:text-red-300 px-1 text-[12px]" title="Quitar fragmento" onClick={() => remove(i)}>✕</button>}
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1.5">
        <button className="text-[11px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700" onClick={() => onChange([...segments, { type: "text", text: "" }])}>＋ texto</button>
        <button className="text-[11px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700" title="Cambia la velocidad de escritura a partir de este punto"
          onClick={() => onChange([...segments, { type: "config", raw: "speed:0.4" }, { type: "text", text: "" }])}>＋ ⚡ velocidad</button>
      </div>
      <div className="text-[10px] text-neutral-500 mt-1">Usa {"${expresión}"} para insertar valores de JavaScript en el texto.</div>
    </div>
  );
}

function OptionsEditor({ options, nodes, onChange }: { options: Array<OptionFields>, nodes: Array<string>, onChange: (options: Array<OptionFields>) => void }) {
  const set = (index: number, patch: Partial<OptionFields>) => onChange(options.map((o, i) => i == index ? { ...o, ...patch } : o));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= options.length) { return; }
    const copy = [...options];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onChange(copy);
  };
  return (
    <div className="mb-2">
      <div className="text-[11px] text-neutral-400 mb-1">Opciones</div>
      <div className="space-y-2">
        {options.map((option, i) => (
          <div key={i} className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2 space-y-1">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <input className={inputClass} value={option.label} placeholder="Texto de la opción" onChange={e => set(i, { label: e.target.value })} />
              <button className="text-neutral-500 hover:text-white text-[11px] px-0.5" onClick={() => move(i, -1)} title="Subir">↑</button>
              <button className="text-neutral-500 hover:text-white text-[11px] px-0.5" onClick={() => move(i, 1)} title="Bajar">↓</button>
              <button className="text-neutral-500 hover:text-red-300 text-[11px] px-0.5" onClick={() => onChange(options.filter((_, j) => j != i))} title="Quitar">✕</button>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-neutral-400">
              <span className="w-12 shrink-0">↪ va a</span>
              <select className={inputClass} value={option.nextNode} onChange={e => set(i, { nextNode: e.target.value })}>
                <option value="">(continúa abajo)</option>
                {nodes.map(node => <option key={node} value={node}>◆ {node}</option>)}
                {option.nextNode && !nodes.includes(option.nextNode) && <option value={option.nextNode}>⚠ {option.nextNode} (no existe)</option>}
              </select>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-neutral-400">
              <span className="w-12 shrink-0">⚑ solo si</span>
              <input className={inputClass + " font-mono"} value={option.condition} placeholder="(siempre visible)" onChange={e => set(i, { condition: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
      <button className="mt-1.5 text-[11px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700" onClick={() => onChange([...options, { label: "Nueva opción", condition: "", nextNode: "" }])}>＋ opción</button>
    </div>
  );
}
