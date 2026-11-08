import { Dictionary } from "../../global.ts";
import { TokenType } from "./Token.ts";
import type { ScriptErrorSpan } from "./ChaosInterpreter.ts";

//*Structured (non-transpiled) view of a script, used by the visual node editor.
//*All spans are absolute char offsets [start, end) over the ORIGINAL script text.

export type Span = [number, number];

export type StatementPart =
  | { kind: "token", tokenType: TokenType, value: string, span: Span }
  | { kind: "block", bracket: string, raw: string, inner: string, span: Span };

export type DecisionOption = {
  label: string,          //raw text token, quotes included
  condition?: string,     //inner code of the if { … } block
  nextNode?: string,      //node id, quotes stripped
  raw: string,
  span: Span
};

export type StatementKind =
  | "CreateInstruction" | "DecisionInstruction" | "DialogInstruction" | "IncludeInstruction"
  | "ModuleDefinitionInstruction" | "NodeDefinitionInstruction" | "JumpToInstruction"
  | "SetSpeakerInstruction" | "StructureEndInstruction" | "NarrationInstruction"
  | "ResumeInstruction" | "RunInstruction" | "SceneDefinitionInstruction" | "SetInstruction"
  | "DeleteInstruction" | "WaitInstruction" | "MoveActorInstruction" | "EmotionChangeInstruction"
  | "ArriveInstruction" | "SoundInstruction"
  | "JavaScript" | "Unknown";

//*Engine instructions living inside code blocks (Trigger callbacks, CodedRoutine code, @ for/if/functions…)
export type NestedItem =
  | { type: "statement", statement: Statement }
  | { type: "code", raw: string, span: Span, warning?: string }
  | { type: "block", block: NestedBlock };

//*A "lane": the body of one {…} that contains engine instructions (directly or deeper)
export type NestedBlock = {
  key: string,
  label: string,      //cleaned context: "onRelease", "code", "for (let i = 0; i < 3; i++)", "const saludar"
  header: string,     //raw text before the bracket
  span: Span,         //bracket to bracket, both included
  items: Array<NestedItem>
};

export type Statement = {
  //*Stable address: "<scopeKey>#<index>" at top level, "<laneKey>/<itemIndex>" when nested
  key?: string,
  //*Lanes of engine instructions inside this statement's code blocks
  blocks?: Array<NestedBlock>,
  kind: StatementKind,
  data: Dictionary<any>,
  parts: Array<StatementPart>,
  raw: string,
  span: Span,
  //*Set when the statement is a structure definition/end that the interpreter ignores in this position
  warning?: string,
  options?: Array<DecisionOption>
};

export type ScopeType = "scene" | "module" | "node" | "entry";

export type Scope = {
  key: string,
  type: ScopeType,
  id: string,
  headerSpan?: Span,
  endSpan?: Span,
  //*Char offset where the body begins (after the header line); for "entry" the first statement start
  bodyStart: number,
  statements: Array<Statement>,
  nodes: Array<Scope>,
  parentKey?: string,
  warning?: string
};

export type ScriptDocument = {
  text: string,
  scopes: Array<Scope>,
  errors: Array<ScriptErrorSpan>
};

export const scopeKeyOf = (type: ScopeType, id: string, parentKey?: string) =>
  (parentKey ? parentKey + "/" : "") + type + ":" + id;

export function* allScopes(doc: ScriptDocument): Generator<Scope> {
  for (const scope of doc.scopes) {
    yield scope;
    for (const node of scope.nodes) { yield node; }
  }
}

export const findScope = (doc: ScriptDocument, key: string): Scope | undefined => {
  for (const scope of allScopes(doc)) {
    if (scope.key == key) { return scope; }
  }
  return undefined;
};

export type NestedVisit = {
  statement: Statement,
  host: Statement,                 //top-level statement that contains it (itself when top level)
  lanes: Array<NestedBlock>,       //lane path from the host down to the statement (empty at top level)
  scope: Scope
};

//*Every statement of a scope, top level and nested, in source order
export function* walkStatements(scope: Scope): Generator<NestedVisit> {
  function* visit(statement: Statement, host: Statement, lanes: Array<NestedBlock>): Generator<NestedVisit> {
    yield { statement, host, lanes, scope };
    for (const lane of statement.blocks ?? []) { yield* visitLane(lane, host, [...lanes, lane]); }
  }
  function* visitLane(lane: NestedBlock, host: Statement, lanes: Array<NestedBlock>): Generator<NestedVisit> {
    for (const item of lane.items) {
      if (item.type == "statement") { yield* visit(item.statement, host, lanes); }
      else if (item.type == "block") { yield* visitLane(item.block, host, [...lanes, item.block]); }
    }
  }
  for (const statement of scope.statements) { yield* visit(statement, statement, []); }
}

export function* walkLanes(statement: Statement): Generator<NestedBlock> {
  for (const lane of statement.blocks ?? []) {
    yield lane;
    for (const item of lane.items) {
      if (item.type == "statement") { yield* walkLanes(item.statement); }
      else if (item.type == "block") { yield* walkLanes({ blocks: [item.block] } as Statement); }
    }
  }
}

export const findLane = (doc: ScriptDocument, key: string): NestedBlock | undefined => {
  for (const scope of allScopes(doc)) {
    for (const statement of scope.statements) {
      for (const lane of walkLanes(statement)) { if (lane.key == key) { return lane; } }
    }
  }
  return undefined;
};

export const findStatementByKey = (doc: ScriptDocument, key: string): NestedVisit | undefined => {
  for (const scope of allScopes(doc)) {
    for (const visit of walkStatements(scope)) { if (visit.statement.key == key) { return visit; } }
  }
  return undefined;
};
