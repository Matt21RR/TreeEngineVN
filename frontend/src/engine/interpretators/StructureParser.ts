import { arrayFlatter } from "../logic/Misc.ts";
import Token, { TokenType } from "./Token.ts";
import Instruction from "./Instruction.ts";
import supportedInstructions from "./SupportedInstructions.ts";
import type { ScriptErrorSpan } from "./ChaosInterpreter.ts";
import {
  DecisionOption, NestedBlock, NestedItem, Scope, ScopeType, ScriptDocument, Span, Statement, StatementKind, StatementPart, scopeKeyOf
} from "./ScriptDocument.ts";

//*Builds the structured ScriptDocument from the preParser output (abs). It mirrors the scope rules of
//*ChaosInterpreter.haveSceneOrModuleDefinition, but keeps statements + char spans instead of JS.

const tokenSpan = (token: Token): Span | null => {
  if (token.charIndex < 0) { return null; }
  if (token.charEnd >= 0) { return [token.charIndex, token.charEnd]; }
  return [token.charIndex, token.charIndex + String(token.value).length];
};

export const elementSpan = (element: Token | Instruction): Span | null => {
  if (element instanceof Token) { return tokenSpan(element); }
  let start = Infinity, end = -Infinity;
  for (const token of arrayFlatter(element as Array<any>)) {
    if (!(token instanceof Token)) { continue; }
    const span = tokenSpan(token);
    if (span == null) { continue; }
    if (span[0] < start) { start = span[0]; }
    if (span[1] > end) { end = span[1]; }
  }
  return start == Infinity ? null : [start, end];
};

const isSpace = (element: Token | Instruction) => element instanceof Token && element.type == TokenType.space;

const closingOf: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

const partsOf = (script: string, instruction: Array<Token | Instruction>): Array<StatementPart> => {
  const parts: Array<StatementPart> = [];
  for (const element of instruction) {
    if (isSpace(element)) { continue; }
    const span = elementSpan(element);
    if (span == null) { continue; }
    if (Array.isArray(element)) {
      const bracket = String((element[0] as Token)?.value ?? "");
      const raw = script.slice(span[0], span[1]);
      const closed = raw.endsWith(closingOf[bracket] ?? "\u0000");
      parts.push({ kind: "block", bracket, raw, inner: raw.slice(1, closed ? -1 : undefined), span });
    } else {
      parts.push({ kind: "token", tokenType: (element as Token).type, value: String((element as Token).value), span });
    }
  }
  return parts;
};

const stripQuotes = (value: string) => value.replace(/^(["'`])([\s\S]*)\1$/, "$2");

//*Splits the {…} block of an ask into its "* label [if {…}] [nextNode x]" options
const decisionOptionsOf = (script: string, block: Instruction): Array<DecisionOption> => {
  const options: Array<DecisionOption> = [];
  let chunk: Array<Token | Instruction> = [];
  const flush = () => {
    const parts = partsOf(script, chunk);
    chunk = [];
    if (parts.length < 2) { return; }
    const [star, label] = parts;
    if (star.kind != "token" || star.value != "*" || label.kind != "token" || label.tokenType != TokenType.text) { return; }
    const option: DecisionOption = {
      label: label.value,
      raw: script.slice(star.span[0], parts.at(-1)!.span[1]),
      span: [star.span[0], parts.at(-1)!.span[1]]
    };
    for (let i = 2; i < parts.length - 1; i++) {
      const keyword = parts[i];
      const value = parts[i + 1];
      if (keyword.kind != "token") { continue; }
      if (keyword.value == "if" && value.kind == "block") { option.condition = value.inner.trim(); i++; }
      else if (keyword.value == "nextNode") {
        option.nextNode = value.kind == "token" ? stripQuotes(value.value) : value.inner.trim();
        i++;
      }
    }
    options.push(option);
  };
  //Skip the opening and closing bracket tokens of the block
  for (const element of block.slice(1, -1)) {
    if (element instanceof Token && element.type == TokenType.lineBreak) { flush(); continue; }
    chunk.push(element);
  }
  flush();
  return options;
};

const sanitizeData = (data: Record<string, any>) => {
  const clean: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    if (key == "match" || key == "chaosReference" || key == "tokArray") { continue; }
    clean[key] = data[key];
  }
  return clean;
};

export function buildStatement(script: string, entry: Token | Instruction): Statement | null {
  //*Spaces are excluded: a trailing space (e.g. before a // comment) must not belong to the statement
  const span = elementSpan(entry instanceof Token ? entry : (entry.filter(element => !isSpace(element)) as Instruction));
  if (span == null) { return null; }
  const raw = script.slice(span[0], span[1]);

  if (entry instanceof Token) {
    if (entry.type != TokenType.jsCode) { return null; }
    const statement: Statement = { kind: "JavaScript", data: { code: raw.replace(/^@\s?/, "") }, parts: [], raw, span };
    if (entry.source) { attachLanes(script, statement, entry.source as Array<Token | Instruction>, span[0] + 1); }
    return statement;
  }

  const instruction = (entry as Instruction).filter(element => !isSpace(element)) as Instruction;
  if (instruction.length == 0) { return null; }
  //*Snapshot before extract(): DialogInstruction/DecisionInstruction mutate tokens in their result()
  const snapshot = instruction.map(element => Array.isArray(element) ? element.slice() : element) as Array<Token | Instruction>;
  const parts = partsOf(script, snapshot);

  for (const supportedInstruction of supportedInstructions) {
    const working = snapshot.map(element => Array.isArray(element) ? (element.slice() as Instruction) : element) as Instruction;
    Object.setPrototypeOf(working, Instruction.prototype);
    const res = supportedInstruction.extract(working);
    if (!res.match) { continue; }
    const kind = supportedInstruction.constructor.name as StatementKind;
    const statement: Statement = { kind, data: sanitizeData(res.data), parts, raw, span };
    if (kind == "DecisionInstruction" && Array.isArray(snapshot[2])) {
      statement.options = decisionOptionsOf(script, snapshot[2] as Instruction);
      statement.data.question = (snapshot[1] as Token).value;
    } else {
      attachLanes(script, statement, snapshot, span[0]);
    }
    return statement;
  }
  return { kind: "Unknown", data: {}, parts, raw, span };
}

// ───────────────────────────── nested lanes ─────────────────────────────
//*Inside a {…} the preParser turns every engine instruction that sits on its own line into a jsCode token,
//*now carrying its original tokens in `source`. Here those blocks become "lanes" the editor can draw.

const isLineBreak = (element: Token | Instruction) => element instanceof Token && element.type == TokenType.lineBreak;

//*"onRelease:()=>" -> "onRelease", "code:(engine)=>" -> "code", "@ for (…)" -> "for (…)", "const fn = () =>" -> "const fn"
export const cleanLaneLabel = (header: string) => {
  let label = header.replace(/^\s*@\s*/, "").trim();
  let previous = "";
  while (previous != label) {
    previous = label;
    const wasArrow = /=>\s*$/.test(label);
    label = label.replace(/(=>|[,:=])\s*$/, "").trim();
    if (wasArrow) { label = label.replace(/\([^()]*\)\s*$/, "").trim(); }
  }
  return label;
};

//*Does an unconverted code line look like an engine instruction? (the interpreter left it as JS)
const looksLikeEngine = (script: string, line: Array<Token | Instruction>): boolean => {
  if (line.length == 0 || line.some(element => element instanceof Token && element.type == TokenType.jsCode)) { return false; }
  const statement = buildStatement(script, line as Instruction);
  return !!statement && statement.kind != "Unknown" && statement.kind != "NarrationInstruction" && statement.kind != "JavaScript";
};

export const UNCONVERTED_WARNING = "Esta instrucción de motor no se interpreta: debe ir en su propia línea dentro del bloque";

const isClosed = (block: Instruction) => {
  const last = block.at(-1);
  return last instanceof Token && last.type == TokenType.closeBracket;
};

const interesting = (items: Array<NestedItem>): boolean => items.some(item =>
  item.type == "statement" || (item.type == "code" && !!item.warning) || item.type == "block");

//*Items of a block body (between its brackets)
const laneItems = (script: string, block: Instruction): Array<NestedItem> => {
  const body = block.slice(1, isClosed(block) ? -1 : undefined) as Array<Token | Instruction>;
  const lines: Array<Array<Token | Instruction>> = [[]];
  for (const element of body) {
    if (isLineBreak(element)) { lines.push([]); continue; }
    if (!isSpace(element)) { lines.at(-1)!.push(element); }
  }
  const items: Array<NestedItem> = [];
  const pushCode = (span: Span, warning?: string) => {
    const last = items.at(-1);
    if (!warning && last?.type == "code" && !last.warning) {
      last.span = [last.span[0], span[1]];
      last.raw = script.slice(last.span[0], last.span[1]);
    } else {
      items.push({ type: "code", raw: script.slice(span[0], span[1]), span, warning });
    }
  };
  for (const line of lines) {
    if (line.length == 0) { continue; }
    const only = line.length == 1 ? line[0] : null;
    if (only instanceof Token && only.type == TokenType.jsCode && only.source) {
      const statement = buildStatement(script, only.source as Instruction);
      if (statement) { items.push({ type: "statement", statement }); continue; }
    }
    const span = elementSpan(line as Instruction);
    if (!span) { continue; }
    const lanes = lanesOfElements(script, line, span[0]);
    if (lanes.length > 0) {
      for (const lane of lanes) { items.push({ type: "block", block: lane }); }
      continue;
    }
    pushCode(span, looksLikeEngine(script, line) ? UNCONVERTED_WARNING : undefined);
  }
  return items;
};

//*Last segment of a header at bracket depth 0: "enabled:true, onComplete:(engine)=>" -> " onComplete:(engine)=>"
//*(the ";" of "for (let i = 0; i < 3; i++)" are inside parentheses, so they don't cut)
const lastHeaderSegment = (header: string) => {
  let depth = 0;
  for (let i = header.length - 1; i >= 0; i--) {
    const char = header[i];
    if (char == ")" || char == "]") { depth++; }
    else if (char == "(" || char == "[") { depth--; }
    else if (depth == 0 && (char == "," || char == ";" || char == "{")) { return header.slice(i + 1); }
  }
  return header;
};

//*A label that names something (an event, a loop, a function…), not just quoted values or punctuation
const isMeaningful = (label: string) => /[A-Za-z_$]/.test(label.replace(/(["'`])(?:(?!\1)[\s\S])*\1/g, ""));
const isKeyframeLabel = (label: string) => /^\d+(\.\d+)?$/.test(label);

//*Lanes found in a list of elements (a statement or one line of a block). Anonymous wrappers such as the
//*argument list "( … )" or an object literal "{ onRelease: …, onHold: … }" are flattened away; named
//*bodies (onRelease, for (…), const fn…) always stay, even if they only contain other blocks.
const lanesOfElements = (script: string, elements: Array<Token | Instruction>, start: number): Array<NestedBlock> => {
  const lanes: Array<NestedBlock> = [];
  let boundary = start;
  for (const element of elements) {
    if (!Array.isArray(element)) { continue; }
    const span = elementSpan(element as Instruction);
    if (!span) { continue; }
    const items = laneItems(script, element as Instruction);
    if (!interesting(items)) { continue; }
    //Header = text since the previous lane (or the line start): "onRelease:()=>", "for (let i = 0; i < 3; i++)"
    const header = lastHeaderSegment(script.slice(boundary, span[0]));
    boundary = span[1];
    const label = cleanLaneLabel(header);
    const bracket = String((element[0] as Token)?.value ?? "");
    const hasStatements = items.some(item => item.type == "statement" || (item.type == "code" && !!item.warning));
    const childLanes = () => items.filter(item => item.type == "block").map(item => (item as { block: NestedBlock }).block);
    if (!hasStatements && (bracket != "{" || !isMeaningful(label))) {
      if (isKeyframeLabel(label)) {
        //Animation keyframe "5000:{ …, onComplete }": keep the time in the child label -> "5000.onComplete"
        lanes.push(...childLanes().map(lane => ({ ...lane, label: `${label}.${lane.label}` })));
      } else {
        lanes.push(...childLanes());
      }
      continue;
    }
    lanes.push({ key: "", label, header: header.trim(), span, items });
  }
  return lanes;
};

const attachLanes = (script: string, statement: Statement, elements: Array<Token | Instruction>, start: number) => {
  const lanes = lanesOfElements(script, elements, start);
  if (lanes.length > 0) { statement.blocks = lanes; }
};

//*Stable keys once the statement position in its scope is known
const assignKeys = (statement: Statement, key: string) => {
  statement.key = key;
  (statement.blocks ?? []).forEach((lane, laneIndex) => assignLaneKeys(lane, `${key}/b${laneIndex}`));
};
const assignLaneKeys = (lane: NestedBlock, key: string) => {
  lane.key = key;
  lane.items.forEach((item, index) => {
    if (item.type == "statement") { assignKeys(item.statement, `${key}/${index}`); }
    else if (item.type == "block") { assignLaneKeys(item.block, `${key}/${index}`); }
  });
};

const DEFINITION_KINDS: Partial<Record<StatementKind, {type: ScopeType, idKey: string}>> = {
  SceneDefinitionInstruction: { type: "scene", idKey: "sceneId" },
  ModuleDefinitionInstruction: { type: "module", idKey: "moduleId" },
  NodeDefinitionInstruction: { type: "node", idKey: "nodeId" }
};

export function buildScriptDocument(script: string, abs: Array<Token | Instruction>, errors: Array<ScriptErrorSpan>): ScriptDocument {
  const statements: Array<Statement> = [];
  for (const entry of abs) {
    const statement = buildStatement(script, entry);
    if (statement) { statements.push(statement); }
  }

  const scopes: Array<Scope> = [];
  const usedKeys = new Map<string, number>();
  const uniqueKey = (base: string, scope: Scope) => {
    const count = usedKeys.get(base) ?? 0;
    usedKeys.set(base, count + 1);
    if (count > 0) {
      scope.warning = `Duplicated id "${scope.id}": the interpreter keeps only the last definition`;
      return `${base}~${count + 1}`;
    }
    return base;
  };

  const entry: Scope = {
    key: "entry:gameEntrypoint", type: "entry", id: "gameEntrypoint", bodyStart: 0, statements: [], nodes: []
  };
  let current: Scope | null = null; //scene or module being filled
  let currentNode: Scope | null = null;
  let fillingEntry = false;
  let tagEmpty = false; //after closing a scene/module, loose statements make the interpreter abort

  const activeScope = () => currentNode ?? current ?? (fillingEntry ? entry : null);
  const attach = (statement: Statement) => {
    let target = activeScope();
    if (target == null) {
      if (tagEmpty) {
        statement.warning = statement.warning ??
          "Outside any scene/module: the interpreter aborts the script (\"Script with no bounds\")";
        target = entry;
      } else {
        fillingEntry = true;
        target = entry;
      }
    }
    if (target.statements.length == 0 && target.type == "entry") { target.bodyStart = statement.span[0]; }
    target.statements.push(statement);
  };

  for (const statement of statements) {
    const definition = DEFINITION_KINDS[statement.kind];
    if (definition) {
      const id = String(statement.data[definition.idKey]);
      const nothingOpen = !current && !currentNode && !fillingEntry;
      if ((definition.type == "scene" || definition.type == "module") && nothingOpen) {
        const scope: Scope = {
          key: "", type: definition.type, id, headerSpan: statement.span, bodyStart: statement.span[1],
          statements: [], nodes: []
        };
        scope.key = uniqueKey(scopeKeyOf(definition.type, id), scope);
        scopes.push(scope);
        current = scope;
        tagEmpty = false;
        continue;
      }
      const sceneOpen = (current?.type == "scene" || fillingEntry) && current?.type != "module";
      if (definition.type == "node" && sceneOpen && !currentNode) {
        const parent = current ?? entry;
        const scope: Scope = {
          key: "", type: "node", id, headerSpan: statement.span, bodyStart: statement.span[1],
          statements: [], nodes: [], parentKey: parent.key
        };
        scope.key = uniqueKey(scopeKeyOf("node", id, parent.key), scope);
        parent.nodes.push(scope);
        currentNode = scope;
        continue;
      }
      statement.warning = `"${definition.type} ${id}" is ignored here: close the current structure first`;
      attach(statement);
      continue;
    }

    if (statement.kind == "StructureEndInstruction") {
      const end = String(statement.data.end);
      if (end == "node" && currentNode) {
        currentNode.endSpan = statement.span;
        currentNode = null;
        continue;
      }
      if (end == "module" && current?.type == "module" && !currentNode) {
        current.endSpan = statement.span;
        current = null;
        tagEmpty = true;
        continue;
      }
      if (end == "scene" && !currentNode && (current?.type == "scene" || fillingEntry)) {
        (current ?? entry).endSpan = statement.span;
        current = null;
        fillingEntry = false;
        tagEmpty = true;
        continue;
      }
      statement.warning = `"end ${end}" doesn't close anything here`;
      attach(statement);
      continue;
    }

    attach(statement);
  }

  if (entry.statements.length > 0 || entry.nodes.length > 0) {
    scopes.unshift(entry);
  }
  for (const scope of scopes) {
    scope.statements.forEach((statement, index) => assignKeys(statement, `${scope.key}#${index}`));
    for (const node of scope.nodes) { node.statements.forEach((statement, index) => assignKeys(statement, `${node.key}#${index}`)); }
  }
  for (const scope of scopes) {
    if (scope.type != "entry" && !scope.endSpan) {
      scope.warning = scope.warning ?? `"${scope.type} ${scope.id}" is never closed with "end ${scope.type}"`;
    }
    for (const node of scope.nodes) {
      if (!node.endSpan) { node.warning = node.warning ?? `"node ${node.id}" is never closed with "end node"`; }
    }
  }

  return { text: script, scopes, errors };
}
