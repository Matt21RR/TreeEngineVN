import {
  NestedBlock, Scope, ScriptDocument, Statement, allScopes, findScope, scopeKeyOf
} from "../../engine/interpretators/ScriptDocument.ts";
import { eventOfLane } from "./nestedEvents.ts";
import type { ScriptErrorSpan } from "../../engine/interpretators/ChaosInterpreter.ts";

//*Framework-agnostic flow model: boxes (scene main / nodes / modules), their exits and the resolved links.

export type EdgeKind = "call" | "goto-reset" | "include";

export type Exit = {
  id: string,                 //stable handle id inside the box
  kind: EdgeKind,
  via: "jumpto" | "option" | "run" | "include" | "nested",
  label: string,              //what the user reads on the handle
  statementIndex: number,
  optionIndex?: number,
  condition?: string,
  targetScene?: string,
  targetNode?: string,
  targetModule?: string,
  //Resolved
  targetKey?: string,         //box key in this document
  external?: boolean,         //target lives in another script file
  missing?: boolean,          //target doesn't exist
  warning?: string,
  //Nested exits (inside a Trigger, CodedRoutine, @ block…)
  event?: string,             //"👆 al soltar el clic"
  eventKey?: string,          //lane key, to group the rows of one event
  nestedKey?: string          //key of the nested statement
};

export type BoxKind = "main" | "node" | "module";

export type FlowBox = {
  key: string,                //main boxes use the scene scope key; nodes/modules their own
  kind: BoxKind,
  scope: Scope,
  sceneKey?: string,          //scene group the box belongs to
  title: string,
  exits: Array<Exit>,
  errors: Array<ScriptErrorSpan>,
  warnings: Array<string>,
  hasIncoming: boolean
};

export type FlowGroup = { key: string, scope: Scope, title: string, boxKeys: Array<string> };

export type FlowLink = {
  id: string,
  kind: EdgeKind,
  sourceKey: string,
  sourceHandle: string,
  targetKey: string,
  label?: string,
  nested?: boolean,
  missing?: boolean,
  external?: boolean,
  condition?: string
};

export type GhostBox = { key: string, label: string, sceneKey?: string, missing: boolean, kind: "node" | "scene" | "module", createId?: string };

export type FlowModel = {
  groups: Array<FlowGroup>,
  boxes: Array<FlowBox>,
  ghosts: Array<GhostBox>,
  links: Array<FlowLink>
};

const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];

export const TOP_LEVEL_JUMPTO_WARNING = "jumpto escrito directamente se ejecuta al cargar el bloque: el node se reproduce ANTES que las instrucciones de arriba. Dentro de un Trigger o CodedRoutine funciona como se espera";

//*Exits of the engine instructions nested inside a statement's code blocks
const nestedExitsOf = (host: Statement, statementIndex: number): Array<Exit> => {
  const exits: Array<Exit> = [];
  let counter = 0;
  const visitLane = (lane: NestedBlock, eventLabels: Array<string>) => {
    const event = eventOfLane(lane, host);
    const labels = [...eventLabels, `${event.icon} ${event.title}`];
    const eventText = labels.join(" › ");
    for (const item of lane.items) {
      if (item.type == "block") { visitLane(item.block, labels); continue; }
      if (item.type != "statement") { continue; }
      const statement = item.statement;
      const base = { via: "nested" as const, statementIndex, event: eventText, eventKey: lane.key, nestedKey: statement.key };
      if (statement.kind == "JumpToInstruction") {
        exits.push({ ...base, id: `n${statementIndex}_${counter++}`, kind: "call", label: `↪ ${statement.data.label}`, targetNode: statement.data.label });
      } else if (statement.kind == "RunInstruction") {
        exits.push({
          ...base, id: `n${statementIndex}_${counter++}`, kind: "goto-reset",
          label: `🎬 ${statement.data.scene}${statement.data.node ? " › " + statement.data.node : ""}`,
          targetScene: statement.data.scene, targetNode: statement.data.node
        });
      } else if (statement.kind == "IncludeInstruction") {
        const module = String(statement.data.loadId).replace(/^["'`]|["'`]$/g, "");
        exits.push({ ...base, id: `n${statementIndex}_${counter++}`, kind: "include", label: `🧩 ${module}`, targetModule: module });
      } else if (statement.kind == "DecisionInstruction") {
        for (const option of statement.options ?? []) {
          if (!option.nextNode) { continue; }
          exits.push({
            ...base, id: `n${statementIndex}_${counter++}`, kind: "call",
            label: `“${option.label.replace(/^["'`]|["'`]$/g, "")}” ↪ ${option.nextNode}`, condition: option.condition, targetNode: option.nextNode
          });
        }
      }
      for (const lane of statement.blocks ?? []) { visitLane(lane, labels); }
    }
  };
  for (const lane of host.blocks ?? []) { visitLane(lane, []); }
  return exits;
};

const exitsOf = (statements: Array<Statement>): Array<Exit> => {
  const exits: Array<Exit> = [];
  statements.forEach((statement, statementIndex) => {
    switch (statement.kind) {
      case "JumpToInstruction":
        exits.push({
          id: `x${statementIndex}`, kind: "call", via: "jumpto", label: `↪ ${statement.data.label}`, statementIndex,
          targetNode: statement.data.label,
          //*JumpToInstruction isn't wrapped in engine.routines.push: it runs while the block is being loaded
          warning: statementIndex > 0 ? TOP_LEVEL_JUMPTO_WARNING : undefined
        });
        break;
      case "RunInstruction":
        exits.push({
          id: `x${statementIndex}`, kind: "goto-reset", via: "run",
          label: `🎬 ${statement.data.scene}${statement.data.node ? " › " + statement.data.node : ""}`, statementIndex,
          targetScene: statement.data.scene, targetNode: statement.data.node
        });
        break;
      case "IncludeInstruction": {
        const module = String(statement.data.loadId).replace(/^["'`]|["'`]$/g, "");
        exits.push({ id: `x${statementIndex}`, kind: "include", via: "include", label: `🧩 ${module}`, statementIndex, targetModule: module });
        break;
      }
      case "DecisionInstruction":
        (statement.options ?? []).forEach((option, optionIndex) => {
          exits.push({
            id: `o${statementIndex}_${optionIndex}`, kind: "call", via: "option",
            label: option.label.replace(/^["'`]|["'`]$/g, ""), statementIndex, optionIndex,
            condition: option.condition, targetNode: option.nextNode
          });
        });
        break;
    }
    if (statement.blocks) { exits.push(...nestedExitsOf(statement, statementIndex)); }
  });
  return exits;
};

export const sceneIdOf = (scope: Scope) => scope.type == "entry" ? "gameEntrypoint" : scope.id;

export const findSceneById = (doc: ScriptDocument, sceneId: string): Scope | undefined => {
  if (sceneId == "gameEntrypoint") {
    return doc.scopes.find(scope => scope.type == "entry") ?? findScope(doc, scopeKeyOf("scene", sceneId));
  }
  return findScope(doc, scopeKeyOf("scene", sceneId));
};

export const buildFlowModel = (doc: ScriptDocument): FlowModel => {
  const groups: Array<FlowGroup> = [];
  const boxes: Array<FlowBox> = [];
  const ghosts = new Map<string, GhostBox>();
  const links: Array<FlowLink> = [];

  const errorsFor = (scope: Scope, includeHeader = true) => doc.errors.filter(error => {
    const span: [number, number] = [error.charStart, Math.max(error.charEnd, error.charStart + 1)];
    if (includeHeader && scope.headerSpan && overlaps(span, scope.headerSpan)) { return true; }
    return scope.statements.some(statement => overlaps(span, statement.span));
  });

  const boxOf = (scope: Scope, kind: BoxKind, sceneKey?: string): FlowBox => {
    const warnings = [scope.warning, ...scope.statements.map(s => s.warning)].filter(Boolean) as Array<string>;
    return {
      key: scope.key, kind, scope, sceneKey,
      title: kind == "main" ? "main" : scope.id,
      exits: exitsOf(scope.statements),
      errors: errorsFor(scope),
      warnings,
      hasIncoming: false
    };
  };

  for (const scope of doc.scopes) {
    if (scope.type == "module") {
      boxes.push(boxOf(scope, "module"));
      continue;
    }
    const group: FlowGroup = {
      key: "group:" + scope.key, scope,
      title: scope.type == "entry" ? "gameEntrypoint" : scope.id,
      boxKeys: []
    };
    const main = boxOf(scope, "main", scope.key);
    boxes.push(main);
    group.boxKeys.push(main.key);
    for (const node of scope.nodes) {
      const box = boxOf(node, "node", scope.key);
      boxes.push(box);
      group.boxKeys.push(box.key);
    }
    groups.push(group);
  }

  const boxByKey = new Map(boxes.map(box => [box.key, box]));
  const addGhost = (ghost: GhostBox) => { if (!ghosts.has(ghost.key)) { ghosts.set(ghost.key, ghost); } };

  for (const box of boxes) {
    for (const exit of box.exits) {
      if (exit.kind == "call") {
        if (!exit.targetNode) { continue; } //option without nextNode: just continues the flow
        if (box.kind == "module") {
          exit.warning = "Depende de la escena que incluya el module";
          continue;
        }
        const targetKey = scopeKeyOf("node", exit.targetNode, box.sceneKey);
        if (boxByKey.has(targetKey)) {
          exit.targetKey = targetKey;
          if (exit.warning) { box.warnings.push(exit.warning); }
        } else {
          exit.missing = true;
          exit.targetKey = "ghost:" + targetKey;
          exit.warning = `El node "${exit.targetNode}" no existe en esta escena (jumpto/nextNode solo ven nodes de la escena activa)`;
          addGhost({ key: exit.targetKey, label: exit.targetNode, sceneKey: box.sceneKey, missing: true, kind: "node", createId: exit.targetNode });
        }
      } else if (exit.kind == "goto-reset") {
        const scene = findSceneById(doc, exit.targetScene!);
        if (!scene) {
          exit.external = true;
          exit.targetKey = `ext:scene:${exit.targetScene}${exit.targetNode ? "/" + exit.targetNode : ""}`;
          addGhost({
            key: exit.targetKey, label: `${exit.targetScene}${exit.targetNode ? " › " + exit.targetNode : ""}`,
            missing: false, kind: "scene"
          });
        } else if (exit.targetNode) {
          const targetKey = scopeKeyOf("node", exit.targetNode, scene.key);
          if (boxByKey.has(targetKey)) {
            exit.targetKey = targetKey;
          } else {
            exit.missing = true;
            exit.targetKey = "ghost:" + targetKey;
            exit.warning = `La escena "${exit.targetScene}" no tiene el node "${exit.targetNode}"`;
            addGhost({ key: exit.targetKey, label: exit.targetNode, sceneKey: scene.key, missing: true, kind: "node", createId: exit.targetNode });
          }
        } else {
          exit.targetKey = scene.key; //its main box
        }
      } else {
        const targetKey = scopeKeyOf("module", exit.targetModule!);
        if (boxByKey.has(targetKey)) {
          exit.targetKey = targetKey;
        } else {
          exit.external = true;
          exit.targetKey = "ext:" + targetKey;
          addGhost({ key: exit.targetKey, label: exit.targetModule!, missing: false, kind: "module" });
        }
      }
      if (!exit.targetKey) { continue; }
      const target = boxByKey.get(exit.targetKey);
      if (target && target.key != box.key) { target.hasIncoming = true; }
      links.push({
        id: `${box.key}::${exit.id}`,
        kind: exit.kind,
        sourceKey: box.key,
        sourceHandle: exit.id,
        targetKey: exit.targetKey,
        label: exit.via == "option" ? exit.label : undefined,
        nested: exit.via == "nested",
        missing: exit.missing,
        external: exit.external,
        condition: exit.condition
      });
    }
  }

  return { groups, boxes, ghosts: [...ghosts.values()], links };
};

//*All ids of a kind present in the document, for autocompletion
export const collectIds = (doc: ScriptDocument) => {
  const scenes: Array<string> = [];
  const modules: Array<string> = [];
  const nodesByScene: Record<string, Array<string>> = {};
  for (const scope of allScopes(doc)) {
    if (scope.type == "scene" || scope.type == "entry") {
      scenes.push(sceneIdOf(scope));
      nodesByScene[sceneIdOf(scope)] = scope.nodes.map(node => node.id);
    }
    if (scope.type == "module") { modules.push(scope.id); }
  }
  return { scenes, modules, nodesByScene };
};
