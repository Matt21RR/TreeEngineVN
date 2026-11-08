import { Statement, StatementKind, StatementPart } from "../../engine/interpretators/ScriptDocument.ts";
import { TokenType } from "../../engine/interpretators/Token.ts";

//*Per-instruction form model: statement -> editable fields -> script line(s) honoring the builders grammar.

export type FieldType =
  | "text" | "longText" | "number" | "code"
  | "actor" | "emotion" | "mark" | "sound" | "node" | "scene" | "module" | "soundAction";

export type FieldSpec = {
  key: string,
  label: string,
  type: FieldType,
  optional?: boolean,
  placeholder?: string,
  hint?: string
};

export type DialogSegment = { type: "text", text: string } | { type: "config", raw: string };
export type OptionFields = { label: string, condition: string, nextNode: string };

export type FormFields = Record<string, any>;

type KindForm = {
  fields: Array<FieldSpec>,
  fromStatement: (statement: Statement) => FormFields,
  serialize: (fields: FormFields, indent: string) => string,
  defaults: () => FormFields
};

export const stripQuotes = (value: string) => value.replace(/^(["'`])([\s\S]*)\1$/, "$2");

//*The lexer has no escapes: pick a delimiter that isn't inside the text
export const quoteText = (text: string) => {
  const clean = text.replace(/\r?\n/g, " ");
  if (clean.includes("${") && !clean.includes("`")) { return "`" + clean + "`"; }
  if (!clean.includes("\"")) { return "\"" + clean + "\""; }
  if (!clean.includes("'")) { return "'" + clean + "'"; }
  if (!clean.includes("`")) { return "`" + clean + "`"; }
  return "\"" + clean.replaceAll("\"", "'") + "\"";
};

const isIdentifier = (value: string) => /^\w+$/.test(value);
//*Ids that are words stay bare, anything else goes quoted (the builders accept word|text)
const idToken = (value: string) => isIdentifier(value) ? value : quoteText(value);

const tokenValue = (part: StatementPart | undefined) => part?.kind == "token" ? part.value : (part?.raw ?? "");

const withDuration = (base: string, duration: any) =>
  (duration !== "" && duration != null && !Number.isNaN(Number(duration))) ? `${base} in ${Number(duration)}` : base;

export const dialogSegmentsOf = (statement: Statement): Array<DialogSegment> => {
  return statement.parts.slice(1).map(part => {
    if (part.kind == "block") { return { type: "config", raw: part.inner.trim() } as DialogSegment; }
    return { type: "text", text: stripQuotes(part.value) } as DialogSegment;
  });
};

const forms: Partial<Record<StatementKind, KindForm>> = {
  DialogInstruction: {
    fields: [],
    fromStatement: (statement) => ({ segments: dialogSegmentsOf(statement) }),
    serialize: (fields) => "- " + (fields.segments as Array<DialogSegment>)
      .filter(segment => segment.type == "config" ? segment.raw.trim() != "" : true)
      .map(segment => segment.type == "text" ? quoteText(segment.text) : `{${segment.raw}}`)
      .join(" "),
    defaults: () => ({ segments: [{ type: "text", text: "..." }] })
  },
  NarrationInstruction: {
    fields: [{ key: "text", label: "Narración", type: "longText" }],
    fromStatement: (statement) => ({ text: stripQuotes(String(statement.data.narration)) }),
    serialize: (fields) => quoteText(fields.text),
    defaults: () => ({ text: "Y así empezó todo..." })
  },
  SetSpeakerInstruction: {
    fields: [{ key: "actor", label: "Actor que habla", type: "actor" }],
    fromStatement: (statement) => ({ actor: statement.data.actor }),
    serialize: (fields) => `${fields.actor} says`,
    defaults: () => ({ actor: "actor" })
  },
  JumpToInstruction: {
    fields: [{ key: "label", label: "Node destino", type: "node", hint: "Llama al node y, al terminar, continúa aquí" }],
    fromStatement: (statement) => ({ label: statement.data.label }),
    serialize: (fields) => `jumpto ${fields.label}`,
    defaults: () => ({ label: "node" })
  },
  WaitInstruction: {
    fields: [{ key: "time", label: "Duración (ms)", type: "number", optional: true, hint: "Vacío = pausa hasta un resume" }],
    fromStatement: (statement) => ({ time: statement.data.waitTime ?? "" }),
    serialize: (fields) => (fields.time !== "" && fields.time != null) ? `wait ${Number(fields.time)}` : "wait",
    defaults: () => ({ time: 1000 })
  },
  ResumeInstruction: {
    fields: [],
    fromStatement: () => ({}),
    serialize: () => "resume",
    defaults: () => ({})
  },
  MoveActorInstruction: {
    fields: [
      { key: "actorId", label: "Actor", type: "actor" },
      { key: "markId", label: "Hasta la marca", type: "mark" },
      { key: "duration", label: "Duración (ms)", type: "number", optional: true, hint: "Vacío = teletransporte" }
    ],
    fromStatement: (statement) => ({ actorId: statement.data.actorId, markId: statement.data.markId, duration: statement.data.duration ?? "" }),
    serialize: (fields) => withDuration(`move ${fields.actorId} to ${fields.markId}`, fields.duration),
    defaults: () => ({ actorId: "actor", markId: "mark", duration: 500 })
  },
  ArriveInstruction: {
    fields: [
      { key: "actorId", label: "Actor", type: "actor" },
      { key: "markId", label: "Llega a la marca", type: "mark" },
      { key: "duration", label: "Duración (ms)", type: "number", optional: true, hint: "Por defecto 500ms andando, 1000ms de fundido" }
    ],
    fromStatement: (statement) => ({ actorId: statement.data.actorId, markId: statement.data.markId, duration: statement.data.duration ?? "" }),
    serialize: (fields) => withDuration(`${fields.actorId} arrives to ${fields.markId}`, fields.duration),
    defaults: () => ({ actorId: "actor", markId: "mark", duration: 700 })
  },
  EmotionChangeInstruction: {
    fields: [
      { key: "actorId", label: "Actor", type: "actor" },
      { key: "emotionId", label: "Emoción", type: "emotion" },
      { key: "duration", label: "Duración (ms)", type: "number", optional: true }
    ],
    fromStatement: (statement) => ({ actorId: statement.data.actorId, emotionId: statement.data.emotionId, duration: statement.data.duration ?? "" }),
    serialize: (fields) => withDuration(`${fields.actorId} gets ${fields.emotionId}`, fields.duration),
    defaults: () => ({ actorId: "actor", emotionId: "happy", duration: 400 })
  },
  SoundInstruction: {
    fields: [
      { key: "id", label: "Sonido", type: "sound" },
      { key: "action", label: "Acción", type: "soundAction", optional: true },
      { key: "config", label: "Configuración {…}", type: "code", optional: true, placeholder: "loop:true, volume:0.5", hint: "Se usa en lugar de la acción" }
    ],
    fromStatement: (statement) => {
      const target = statement.parts[1];
      const third = statement.parts[2];
      return {
        id: target?.kind == "token" ? stripQuotes(target.value) : "",
        action: third?.kind == "token" ? third.value : "",
        config: third?.kind == "block" ? third.inner.trim() : ""
      };
    },
    serialize: (fields) => {
      const base = `sound ${idToken(fields.id)}`;
      if (fields.config && String(fields.config).trim() != "") { return `${base} {${String(fields.config).trim()}}`; }
      return `${base} ${fields.action || "play"}`;
    },
    defaults: () => ({ id: "sound", action: "play", config: "" })
  },
  RunInstruction: {
    fields: [
      { key: "scene", label: "Escena", type: "scene" },
      { key: "node", label: "Node (opcional)", type: "node", optional: true, hint: "Reinicia la escena y ejecuta solo ese node (sin su main)" }
    ],
    fromStatement: (statement) => ({ scene: statement.data.scene, node: statement.data.node ?? "" }),
    serialize: (fields) => fields.node ? `run ${fields.scene} -> ${fields.node}` : `run ${fields.scene}`,
    defaults: () => ({ scene: "scene", node: "" })
  },
  IncludeInstruction: {
    fields: [{ key: "module", label: "Module", type: "module" }],
    fromStatement: (statement) => ({ module: stripQuotes(String(statement.data.loadId)) }),
    serialize: (fields) => `include "${fields.module}"`,
    defaults: () => ({ module: "module" })
  },
  DecisionInstruction: {
    fields: [{ key: "question", label: "Pregunta", type: "text" }],
    fromStatement: (statement) => ({
      question: stripQuotes(String(statement.data.question ?? "")),
      options: (statement.options ?? []).map(option => ({
        label: stripQuotes(option.label),
        condition: option.condition ?? "",
        nextNode: option.nextNode ?? ""
      }))
    }),
    serialize: (fields, indent) => {
      const lines = (fields.options as Array<OptionFields>).map(option => {
        let line = `${indent}  * ${quoteText(option.label)}`;
        if (option.condition && option.condition.trim() != "") { line += ` if { ${option.condition.trim()} }`; }
        if (option.nextNode && option.nextNode.trim() != "") { line += ` nextNode ${option.nextNode.trim()}`; }
        return line;
      });
      return [`ask ${quoteText(fields.question)} {`, ...lines, `${indent}}`].join("\n");
    },
    defaults: () => ({ question: "¿Qué haces?", options: [{ label: "Sí", condition: "", nextNode: "" }, { label: "No", condition: "", nextNode: "" }] })
  }
};

export const formOf = (kind: StatementKind): KindForm | undefined => forms[kind];

export const hasStructuredForm = (kind: StatementKind) => forms[kind] != undefined;

export const fieldsOf = (statement: Statement): FormFields | null => {
  const form = forms[statement.kind];
  return form ? form.fromStatement(statement) : null;
};

export const serializeFields = (kind: StatementKind, fields: FormFields, indent = ""): string | null => {
  const form = forms[kind];
  return form ? form.serialize(fields, indent) : null;
};

export const defaultSource = (kind: StatementKind, indent = ""): string => {
  const form = forms[kind];
  if (form) { return form.serialize(form.defaults(), indent); }
  switch (kind) {
    case "CreateInstruction": return "fondo = new GraphObject({texture:\"background\", enabled:true})";
    case "SetInstruction": return "set GraphObject fondo {opacity:1}";
    case "DeleteInstruction": return "delete GraphObject fondo";
    case "JavaScript": return "@ console.log(\"hola\")";
    default: return "";
  }
};

//*Short human summary of a statement, used in boxes, cards titles and search
export const summaryOf = (statement: Statement): string => {
  const data = statement.data;
  switch (statement.kind) {
    case "DialogInstruction": return dialogSegmentsOf(statement).filter(s => s.type == "text").map(s => (s as any).text).join("");
    case "NarrationInstruction": return stripQuotes(String(data.narration));
    case "SetSpeakerInstruction": return `${data.actor} toma la palabra`;
    case "JumpToInstruction": return `llama a ${data.label}`;
    case "WaitInstruction": return data.waitTime ? `espera ${data.waitTime} ms` : "pausa hasta resume";
    case "ResumeInstruction": return "reanuda";
    case "MoveActorInstruction": return `${data.actorId} → ${data.markId}${data.duration ? ` (${data.duration}ms)` : ""}`;
    case "ArriveInstruction": return `${data.actorId} llega a ${data.markId}`;
    case "EmotionChangeInstruction": return `${data.actorId} → ${data.emotionId}`;
    case "SoundInstruction": {
      const fields = forms.SoundInstruction!.fromStatement(statement);
      return `${fields.id} ${fields.config ? "{…}" : fields.action}`;
    }
    case "RunInstruction": return `ir a ${data.scene}${data.node ? " › " + data.node : ""}`;
    case "IncludeInstruction": return `incluye ${stripQuotes(String(data.loadId))}`;
    case "DecisionInstruction": return stripQuotes(String(data.question ?? ""));
    case "CreateInstruction": return `crea ${data.branch} ${data.id ? stripQuotes(String(data.id)) : ""}`.trim();
    case "SetInstruction": return `modifica ${data.branch} ${stripQuotes(String(data.id))}${data.property ? "." + data.property : ""}`;
    case "DeleteInstruction": return data.all ? `borra todos los ${data.branch}` : `borra ${data.branch} ${stripQuotes(String(data.id))}`;
    case "JavaScript": return String(data.code ?? "").split("\n")[0];
    case "SceneDefinitionInstruction": return `scene ${data.sceneId}`;
    case "ModuleDefinitionInstruction": return `module ${data.moduleId}`;
    case "NodeDefinitionInstruction": return `node ${data.nodeId}`;
    case "StructureEndInstruction": return `end ${data.end}`;
    default: return statement.raw.split("\n")[0];
  }
};

//*Value of the first text token, used e.g. for decision labels
export const firstText = (statement: Statement) => {
  const part = statement.parts.find(p => p.kind == "token" && p.tokenType == TokenType.text);
  return part ? stripQuotes(tokenValue(part)) : "";
};
