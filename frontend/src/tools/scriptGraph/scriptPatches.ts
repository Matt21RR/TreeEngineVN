import {
  NestedBlock, NestedItem, Scope, ScopeType, ScriptDocument, Span, Statement, allScopes, findLane, findScope, scopeKeyOf, walkStatements
} from "../../engine/interpretators/ScriptDocument.ts";
import { serializeFields, fieldsOf, OptionFields } from "./instructionForms.ts";

//*Pure, span-based text edits. Everything not touched (comments, formatting, unknown code) is kept verbatim.

export type Parser = (text: string) => ScriptDocument;

type Replacement = { span: Span, text: string };

export const applyReplacements = (text: string, replacements: Array<Replacement>) => {
  const sorted = [...replacements].sort((a, b) => b.span[0] - a.span[0]);
  let result = text;
  for (const replacement of sorted) {
    result = result.slice(0, replacement.span[0]) + replacement.text + result.slice(replacement.span[1]);
  }
  return result;
};

export const lineStartOf = (text: string, position: number) => text.lastIndexOf("\n", position - 1) + 1;

//*End of the line containing position, newline included
export const lineEndOf = (text: string, position: number) => {
  const index = text.indexOf("\n", position);
  return index == -1 ? text.length : index + 1;
};

export const indentAt = (text: string, position: number) => {
  const start = lineStartOf(text, position);
  return /^[ \t]*/.exec(text.slice(start))![0];
};

//*Full lines covered by a span, but only if nothing else shares them (otherwise just the span)
const ownLinesOf = (text: string, span: Span): Span => {
  const start = lineStartOf(text, span[0]);
  const end = lineEndOf(text, Math.max(span[0], span[1] - 1));
  const before = text.slice(start, span[0]);
  const after = text.slice(span[1], end).replace(/\/\/.*$/, "");
  if (before.trim() == "" && after.trim() == "") { return [start, end]; }
  return span;
};

const indentLines = (source: string, indent: string) =>
  source.split("\n").map(line => line == "" ? "" : indent + line).join("\n");

//*Removes the common indentation of a multi-line raw statement (first line has none, it starts at the span)
const dedentRaw = (raw: string, firstLineIndent: string) => raw.split("\n")
  .map((line, index) => index == 0 ? line : (line.startsWith(firstLineIndent) ? line.slice(firstLineIndent.length) : line.trimStart()))
  .join("\n");

const reindentContinuation = (source: string, indent: string) => source.split("\n")
  .map((line, index) => index == 0 || line == "" ? line : indent + line).join("\n");

//*Source of a statement without its own indentation (re-insertable anywhere)
//*Text of a span without the script indentation (the first line starts at the span, the rest keep
//*their absolute indent): what the views show and what can be re-inserted anywhere
export const spanSource = (text: string, span: Span) =>
  dedentRaw(text.slice(span[0], span[1]), indentAt(text, span[0]));

export const statementSource = (text: string, statement: Statement) => spanSource(text, statement.span);

export const statementAt = (doc: ScriptDocument, scopeKey: string, index: number): Statement | undefined =>
  findScope(doc, scopeKey)?.statements[index];

// ───────────────────────────── statements ─────────────────────────────

export const replaceStatement = (text: string, statement: Statement, newSource: string) => {
  const indent = indentAt(text, statement.span[0]);
  return applyReplacements(text, [{ span: statement.span, text: reindentContinuation(newSource, indent) }]);
};

//*Re-serializes a statement from form fields. Returns the text unchanged when the kind has no form.
export const updateStatementFields = (text: string, statement: Statement, fields: Record<string, any>) => {
  const indent = indentAt(text, statement.span[0]);
  const source = serializeFields(statement.kind, fields, "");
  if (source == null) { return text; }
  return applyReplacements(text, [{ span: statement.span, text: reindentContinuation(source, indent) }]);
};

export const deleteStatement = (text: string, statement: Statement) =>
  applyReplacements(text, [{ span: ownLinesOf(text, statement.span), text: "" }]);

const defaultBodyIndent = (text: string, scope: Scope) => {
  if (scope.headerSpan) { return indentAt(text, scope.headerSpan[0]) + "  "; }
  return "";
};

//*Where a new statement goes when appended at `index` of the scope main body
const insertionPoint = (text: string, scope: Scope, index: number): { position: number, indent: string } => {
  const statements = scope.statements;
  if (index < statements.length) {
    const target = statements[index];
    const position = lineStartOf(text, target.span[0]);
    return { position, indent: indentAt(text, target.span[0]) };
  }
  if (statements.length > 0) {
    const last = statements[statements.length - 1];
    let position = lineEndOf(text, Math.max(last.span[0], last.span[1] - 1));
    //A node body defined right after the last statement must stay after the new one only if it was after
    return { position, indent: indentAt(text, last.span[0]) };
  }
  if (scope.nodes.length > 0 && scope.nodes[0].headerSpan) {
    return { position: lineStartOf(text, scope.nodes[0].headerSpan[0]), indent: defaultBodyIndent(text, scope) };
  }
  if (scope.endSpan) {
    return { position: lineStartOf(text, scope.endSpan[0]), indent: defaultBodyIndent(text, scope) };
  }
  if (scope.headerSpan) {
    return { position: lineEndOf(text, scope.headerSpan[1] - 1), indent: defaultBodyIndent(text, scope) };
  }
  return { position: text.length, indent: "" };
};

const ensureTrailingNewline = (text: string, position: number) =>
  (position > 0 && position == text.length && !text.endsWith("\n")) ? "\n" : "";

export const insertStatement = (text: string, doc: ScriptDocument, scopeKey: string, index: number, source: string) => {
  const scope = findScope(doc, scopeKey);
  if (!scope) { return text; }
  const { position, indent } = insertionPoint(text, scope, index);
  const lead = ensureTrailingNewline(text, position);
  const block = lead + indentLines(source, indent) + "\n";
  return text.slice(0, position) + block + text.slice(position);
};

export const moveStatement = (text: string, parse: Parser, scopeKey: string, from: number, to: number) => {
  if (from == to) { return text; }
  const doc = parse(text);
  const statement = statementAt(doc, scopeKey, from);
  if (!statement) { return text; }
  const source = statementSource(text, statement);
  const withoutIt = deleteStatement(text, statement);
  const target = from < to ? to - 1 : to;
  return insertStatement(withoutIt, parse(withoutIt), scopeKey, target, source);
};

export const duplicateStatement = (text: string, parse: Parser, scopeKey: string, index: number) => {
  const doc = parse(text);
  const statement = statementAt(doc, scopeKey, index);
  if (!statement) { return text; }
  return insertStatement(text, doc, scopeKey, index + 1, statementSource(text, statement));
};

// ───────────────────────────── scopes ─────────────────────────────

const sceneOf = (doc: ScriptDocument, scope: Scope): Scope | undefined =>
  scope.type == "node" ? findScope(doc, scope.parentKey!) : scope;

export const scopeExists = (doc: ScriptDocument, type: ScopeType, id: string, parentKey?: string) =>
  findScope(doc, scopeKeyOf(type, id, parentKey)) != undefined;

export const addScope = (
  text: string, doc: ScriptDocument, type: "scene" | "module" | "node", id: string,
  body: Array<string> = [], parentKey?: string
) => {
  if (type == "node") {
    const parent = parentKey ? findScope(doc, parentKey) : undefined;
    if (!parent) { return text; }
    const baseIndent = parent.headerSpan ? indentAt(text, parent.headerSpan[0]) + "  " : "";
    const lines = [`${baseIndent}node: ${id}`, ...body.map(line => indentLines(line, baseIndent + "  ")), `${baseIndent}end node`];
    const position = parent.endSpan ? lineStartOf(text, parent.endSpan[0]) : text.length;
    const lead = ensureTrailingNewline(text, position);
    return text.slice(0, position) + lead + lines.join("\n") + "\n" + text.slice(position);
  }
  const lines = [`${type} ${id}`, ...body.map(line => indentLines(line, "  ")), `end ${type}`];
  const separator = text.length == 0 ? "" : (text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : "\n\n");
  return text + separator + lines.join("\n") + "\n";
};

export const scopeSpan = (text: string, scope: Scope): Span | null => {
  if (scope.type == "entry") {
    const first = scope.statements[0];
    const lastNode = scope.nodes.at(-1);
    const lastStatement = scope.statements.at(-1);
    const end = Math.max(scope.endSpan?.[1] ?? -1, lastNode?.endSpan?.[1] ?? lastNode?.headerSpan?.[1] ?? -1, lastStatement?.span[1] ?? -1);
    if (!first || end < 0) { return null; }
    return [lineStartOf(text, first.span[0]), lineEndOf(text, end - 1)];
  }
  if (!scope.headerSpan) { return null; }
  const end = scope.endSpan?.[1] ??
    Math.max(scope.headerSpan[1], scope.statements.at(-1)?.span[1] ?? -1, scope.nodes.at(-1)?.endSpan?.[1] ?? -1);
  return [lineStartOf(text, scope.headerSpan[0]), lineEndOf(text, end - 1)];
};

export const deleteScope = (text: string, doc: ScriptDocument, scopeKey: string) => {
  const scope = findScope(doc, scopeKey);
  if (!scope) { return text; }
  const span = scopeSpan(text, scope);
  return span ? applyReplacements(text, [{ span, text: "" }]) : text;
};

export const duplicateScope = (text: string, doc: ScriptDocument, scopeKey: string, newId: string) => {
  const scope = findScope(doc, scopeKey);
  if (!scope || !scope.headerSpan) { return text; }
  const span = scopeSpan(text, scope);
  if (!span) { return text; }
  const header = doc.text.slice(scope.headerSpan[0], scope.headerSpan[1]);
  const newHeader = header.replace(new RegExp(`\\b${scope.id}\\b(?![\\s\\S]*\\b${scope.id}\\b)`), newId);
  const block = text.slice(span[0], span[1]).replace(header, newHeader);
  return text.slice(0, span[1]) + block + text.slice(span[1]);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

//*Renames a scope id in its header and every reference (jumpto, ask nextNode, run, include)
export const renameScope = (text: string, doc: ScriptDocument, scopeKey: string, newId: string) => {
  const scope = findScope(doc, scopeKey);
  if (!scope || !scope.headerSpan || !/^\w+$/.test(newId)) { return text; }
  const oldId = scope.id;
  const replacements: Array<Replacement> = [];
  const word = new RegExp(`\\b${escapeRegExp(oldId)}\\b`);

  //Header: the last occurrence of the id in the header line
  const headerText = text.slice(scope.headerSpan[0], scope.headerSpan[1]);
  const headerIndex = headerText.lastIndexOf(oldId);
  if (headerIndex >= 0) {
    replacements.push({ span: [scope.headerSpan[0] + headerIndex, scope.headerSpan[0] + headerIndex + oldId.length], text: newId });
  }

  const tokenSpanOf = (statement: Statement, partIndex: number): Span | null => {
    const part = statement.parts[partIndex];
    return part && part.kind == "token" ? part.span : null;
  };

  const ownScene = sceneOf(doc, scope);
  for (const owner of allScopes(doc)) {
    const ownerScene = sceneOf(doc, owner);
    for (const { statement } of walkStatements(owner)) {
      if (scope.type == "node") {
        if (ownerScene?.key == ownScene?.key) {
          if (statement.kind == "JumpToInstruction" && statement.data.label == oldId) {
            const span = tokenSpanOf(statement, 1);
            if (span) { replacements.push({ span, text: newId }); }
          }
          if (statement.kind == "DecisionInstruction") {
            for (const option of statement.options ?? []) {
              if (option.nextNode != oldId) { continue; }
              const match = new RegExp(`(nextNode\\s+)(["'\`]?)${escapeRegExp(oldId)}\\2`).exec(option.raw);
              if (match) {
                const start = option.span[0] + match.index + match[1].length;
                replacements.push({ span: [start, start + match[0].length - match[1].length], text: newId });
              }
            }
          }
        }
        if (statement.kind == "RunInstruction" && statement.data.node == oldId && statement.data.scene == ownScene?.id) {
          const span = tokenSpanOf(statement, 4);
          if (span) { replacements.push({ span, text: newId }); }
        }
      } else if (scope.type == "scene") {
        if (statement.kind == "RunInstruction" && statement.data.scene == oldId) {
          const span = tokenSpanOf(statement, 1);
          if (span) { replacements.push({ span, text: newId }); }
        }
      } else if (scope.type == "module") {
        if (statement.kind == "IncludeInstruction" && word.test(String(statement.data.loadId))) {
          const span = tokenSpanOf(statement, 1);
          if (span) { replacements.push({ span, text: `"${newId}"` }); }
        }
      }
    }
  }
  return applyReplacements(text, replacements);
};

// ───────────────────────────── connections ─────────────────────────────

export type ConnectionMode = "call" | "goto-reset";

//*Appends the instruction that makes `source` flow into `target`
export const connectScopes = (text: string, doc: ScriptDocument, sourceKey: string, targetKey: string, mode: ConnectionMode) => {
  const source = findScope(doc, sourceKey);
  const target = findScope(doc, targetKey);
  if (!source || !target) { return text; }
  let line: string;
  if (mode == "call") {
    if (target.type != "node") { return text; }
    line = `jumpto ${target.id}`;
  } else {
    const scene = target.type == "node" ? findScope(doc, target.parentKey!) : target;
    if (!scene) { return text; }
    line = target.type == "node" ? `run ${scene.id} -> ${target.id}` : `run ${scene.id}`;
  }
  return insertStatement(text, doc, sourceKey, source.statements.length, line);
};

export const setOptionTarget = (text: string, statement: Statement, optionIndex: number, nextNode: string) => {
  const fields = fieldsOf(statement);
  if (!fields || statement.kind != "DecisionInstruction") { return text; }
  const options = fields.options as Array<OptionFields>;
  if (!options[optionIndex]) { return text; }
  options[optionIndex] = { ...options[optionIndex], nextNode };
  return updateStatementFields(text, statement, fields);
};

//*Points every reference to a missing node (`missingId`) inside `sceneKey` to a newly created node: just creates it
export const createMissingNode = (text: string, doc: ScriptDocument, sceneKey: string, missingId: string) =>
  addScope(text, doc, "node", missingId, [`- "..."`], sceneKey);

// ───────────────────────────── nested lanes (Trigger callbacks, @ blocks…) ─────────────────────────────

export const itemSpanOf = (item: NestedItem): Span =>
  item.type == "statement" ? item.statement.span : item.type == "code" ? item.span : item.block.span;

const laneBodyIndent = (text: string, lane: NestedBlock) => {
  const first = lane.items.find(item => item.type != "block");
  if (first) { return indentAt(text, itemSpanOf(first)[0]); }
  return indentAt(text, lane.span[0]) + "  ";
};

//*Inserts a new line inside a lane. Always on its own line: the preParser only converts engine
//*instructions that have a line break before and after them inside the block.
export const insertInBlock = (text: string, lane: NestedBlock, itemIndex: number, source: string) => {
  const indent = laneBodyIndent(text, lane);
  const body = indentLines(source, indent);
  if (itemIndex < lane.items.length) {
    const start = itemSpanOf(lane.items[itemIndex])[0];
    const lineStart = lineStartOf(text, start);
    const insertAt = lane.items[itemIndex].type == "block" ? lineStart : start;
    if (text.slice(lineStart, insertAt).trim() == "" ) {
      return text.slice(0, lineStart) + body + "\n" + text.slice(lineStart);
    }
    return text.slice(0, insertAt) + "\n" + body + "\n" + indentAt(text, insertAt) + text.slice(insertAt);
  }
  const close = lane.span[1] - 1;
  const closeLineStart = lineStartOf(text, close);
  if (text.slice(closeLineStart, close).trim() == "") {
    return text.slice(0, closeLineStart) + body + "\n" + text.slice(closeLineStart);
  }
  //"{ … }" on one line: open it up
  return text.slice(0, close).replace(/[ \t]+$/, "") + "\n" + body + "\n" + indentAt(text, close) + text.slice(close);
};

const itemSource = (text: string, item: NestedItem) => {
  const span = itemSpanOf(item);
  return dedentRaw(text.slice(span[0], span[1]), indentAt(text, span[0]));
};

export const deleteItem = (text: string, item: NestedItem) =>
  applyReplacements(text, [{ span: ownLinesOf(text, itemSpanOf(item)), text: "" }]);

export const duplicateItem = (text: string, lane: NestedBlock, index: number) => {
  const item = lane.items[index];
  return item ? insertInBlock(text, lane, index + 1, itemSource(text, item)) : text;
};

export const moveItem = (text: string, parse: Parser, laneKey: string, from: number, to: number) => {
  if (from == to || from + 1 == to) { return text; }
  const lane = findLane(parse(text), laneKey);
  const item = lane?.items[from];
  if (!lane || !item) { return text; }
  const source = itemSource(text, item);
  const withoutIt = deleteItem(text, item);
  const newLane = findLane(parse(withoutIt), laneKey);
  if (!newLane) { return text; }
  return insertInBlock(withoutIt, newLane, from < to ? to - 1 : to, source);
};

//*Quick fix for an engine instruction written on the same line as "{" or "}": put it on its own line
export const splitToOwnLine = (text: string, item: NestedItem) => {
  const span = itemSpanOf(item);
  const indent = indentAt(text, span[0]);
  const source = text.slice(span[0], span[1]);
  return applyReplacements(text, [{ span, text: `\n${indent}  ${source}\n${indent}` }]);
};
