import React from "react";
import { Edge, Node } from "@reactflow/core";

export type FieldType = "string" | "number" | "boolean" | "textarea" | "json" | "array";

export type ScriptNodeDefinition = {
  type: string;
  label: string;
  fields: Array<{
    key: string;
    label: string;
    type: FieldType;
    defaultValue?: any;
    placeholder?: string;
    options?: string[];
  }>;
  build: (data: Record<string, any>) => string;
};

export type ScriptNodeData = {
  type: string;
  label: string;
  fields: Record<string, any>;
  onFieldChange?: (nodeId: string, fieldKey: string, value: any, fieldType: FieldType) => void;
};

export const QUOTED = [
  "id",
  "scene",
  "node",
  "module",
  "relatedTo",
  "branch",
  "actorId",
  "markId",
  "emotionId",
  "loadId",
  "type",
  "soundId",
  "action",
];

export const scriptNodeDefinitions: Record<string, ScriptNodeDefinition> = {
  scene: {
    type: "scene",
    label: "Scene",
    fields: [{ key: "id", label: "Scene id", type: "string", defaultValue: "main" }],
    build: (data) => `scene ${data.id}`,
  },
  module: {
    type: "module",
    label: "Module",
    fields: [{ key: "id", label: "Module id", type: "string", defaultValue: "moduleName" }],
    build: (data) => `module ${data.id}`,
  },
  nodeDefinition: {
    type: "nodeDefinition",
    label: "Node",
    fields: [{ key: "id", label: "Node id", type: "string", defaultValue: "nodeName" }],
    build: (data) => `node :${data.id}`,
  },
  structureEnd: {
    type: "structureEnd",
    label: "End",
    fields: [
      {
        key: "structure",
        label: "Structure",
        type: "string",
        defaultValue: "scene",
        placeholder: "scene/module/node",
      },
    ],
    build: (data) => `end ${data.structure}`,
  },
  include: {
    type: "include",
    label: "Include Module",
    fields: [{ key: "module", label: "Module name", type: "string", defaultValue: "moduleName" }],
    build: (data) => `include "${data.module}"`,
  },
  run: {
    type: "run",
    label: "Run",
    fields: [
      { key: "scene", label: "Scene", type: "string", defaultValue: "main" },
      { key: "node", label: "Node", type: "string", defaultValue: "", placeholder: "optional" },
    ],
    build: (data) => `run ${data.scene}${data.node ? ` -> ${data.node}` : ""}`,
  },
  wait: {
    type: "wait",
    label: "Wait",
    fields: [{ key: "time", label: "Time (ms)", type: "number", defaultValue: "" }],
    build: (data) => (data.time ? `wait ${data.time}` : "wait"),
  },
  resume: {
    type: "resume",
    label: "Resume",
    fields: [],
    build: () => "resume",
  },
  delete: {
    type: "delete",
    label: "Delete",
    fields: [
      {
        key: "targetType",
        label: "Type",
        type: "string",
        defaultValue: "GraphObject",
        placeholder: "GraphObject/Trigger/Animation...",
      },
      { key: "id", label: "Id", type: "string", defaultValue: "" },
      { key: "all", label: "All", type: "boolean", defaultValue: false },
    ],
    build: (data) => (data.all ? `delete all ${data.targetType}` : `delete ${data.targetType} ${data.id}`),
  },
  set: {
    type: "set",
    label: "Set",
    fields: [
      {
        key: "targetType",
        label: "Type",
        type: "string",
        defaultValue: "GraphObject",
        placeholder: "GraphObject/Trigger/Animation...",
      },
      { key: "id", label: "Id", type: "string", defaultValue: "" },
      { key: "properties", label: "Properties", type: "json", defaultValue: "{\n  enabled:true\n}" },
    ],
    build: (data) => `set ${data.targetType} ${data.id} ${data.properties}`,
  },
  sound: {
    type: "sound",
    label: "Sound",
    fields: [
      { key: "id", label: "Sound id", type: "string", defaultValue: "soundName" },
      { key: "action", label: "Action", type: "string", defaultValue: "" },
      { key: "config", label: "Config", type: "json", defaultValue: "{}" },
    ],
    build: (data) => `Sound ${data.id}${data.action ? ` ${data.action}` : ""}${data.config ? ` ${data.config}` : ""}`,
  },
  createGraphObject: {
    type: "createGraphObject",
    label: "Create GraphObject",
    fields: [
      { key: "id", label: "Id", type: "string", defaultValue: "background" },
      { key: "enabled", label: "Enabled", type: "boolean", defaultValue: true },
      {
        key: "props",
        label: "Properties",
        type: "json",
        defaultValue: "{\n  texture:\"background\",\n  x:0,\n  y:0\n}",
      },
    ],
    build: (data) => `${data.id} = new GraphObject(${data.props})`,
  },
  createTextureAnim: {
    type: "createTextureAnim",
    label: "Create TextureAnim",
    fields: [
      { key: "id", label: "Id", type: "string", defaultValue: "anim" },
      { key: "textures", label: "Textures", type: "array", defaultValue: `["frame1", "frame2"]` },
      {
        key: "props",
        label: "Properties",
        type: "json",
        defaultValue: "{\n  duration:500\n}",
      },
    ],
    build: (data) => `${data.id} = new TextureAnim(${data.textures}, ${data.props})`,
  },
  createTrigger: {
    type: "createTrigger",
    label: "Create Trigger",
    fields: [
      { key: "id", label: "Id", type: "string", defaultValue: "myTrigger" },
      { key: "relatedTo", label: "Related To", type: "string", defaultValue: "" },
      {
        key: "behaviors",
        label: "Behaviors",
        type: "json",
        defaultValue: "{\n  onRelease:()=>{ }\n}",
      },
    ],
    build: (data) => `${data.id} = new Trigger(${data.relatedTo ? `\"${data.relatedTo}\", ` : ""}${data.behaviors})`,
  },
  createKeyboardTrigger: {
    type: "createKeyboardTrigger",
    label: "Create KeyboardTrigger",
    fields: [
      { key: "keys", label: "Keys", type: "array", defaultValue: `["ShiftLeft", "KeyE"]` },
      {
        key: "behaviors",
        label: "Behaviors",
        type: "json",
        defaultValue: "{\n  onPress:(eng)=>{ },\n  onRelease:(eng)=>{ }\n}",
      },
    ],
    build: (data) => `new KeyboardTrigger(${data.keys}, ${data.behaviors})`,
  },
  createAnimation: {
    type: "createAnimation",
    label: "Create Animation",
    fields: [
      { key: "id", label: "Id", type: "string", defaultValue: "anim" },
      { key: "relatedTo", label: "Related To", type: "string", defaultValue: "background" },
      {
        key: "keyframes",
        label: "Keyframes",
        type: "json",
        defaultValue: "{\n  0:{blur:8},\n  500:{blur:0}\n}",
      },
      {
        key: "props",
        label: "Properties",
        type: "json",
        defaultValue: "{\n  enabled:true\n}",
      },
    ],
    build: (data) => `${data.id} = new Animation(\"${data.relatedTo}\", ${data.keyframes}, ${data.props})`,
  },
  createCodedRoutine: {
    type: "createCodedRoutine",
    label: "Create CodedRoutine",
    fields: [
      { key: "id", label: "Id", type: "string", defaultValue: "routine" },
      {
        key: "code",
        label: "Code",
        type: "textarea",
        defaultValue: `() => {\n  // Your code here\n}`,
      },
      { key: "continious", label: "Continious", type: "boolean", defaultValue: false },
    ],
    build: (data) => `${data.id} = new CodedRoutine({ code:${data.code}, continious:${data.continious} })`,
  },
  createActor: {
    type: "createActor",
    label: "Create Actor",
    fields: [
      { key: "id", label: "Id", type: "string", defaultValue: "actor" },
      { key: "name", label: "Name", type: "string", defaultValue: "" },
      { key: "active", label: "Active", type: "boolean", defaultValue: true },
      { key: "body", label: "Body", type: "string", defaultValue: "" },
      { key: "emotions", label: "Emotions", type: "json", defaultValue: "{}" },
    ],
    build: (data) => `${data.id} = new Actor({ id:\"${data.id}\", name:\"${data.name}\", active:${data.active}, body:\"${data.body}\", emotions:${data.emotions} })`,
  },
  createStageMark: {
    type: "createStageMark",
    label: "Create StageMark",
    fields: [
      { key: "id", label: "Id", type: "string", defaultValue: "mark" },
      { key: "x", label: "X", type: "number", defaultValue: 0 },
      { key: "y", label: "Y", type: "number", defaultValue: 0 },
      { key: "z", label: "Z", type: "number", defaultValue: 0 },
    ],
    build: (data) => `${data.id} = new StageMark({ x:${data.x}, y:${data.y}, z:${data.z} })`,
  },
  moveActor: {
    type: "moveActor",
    label: "Move Actor",
    fields: [
      { key: "actorId", label: "Actor id", type: "string", defaultValue: "actor" },
      { key: "markId", label: "Mark id", type: "string", defaultValue: "mark" },
      { key: "duration", label: "Duration", type: "number", defaultValue: 500 },
    ],
    build: (data) => `move ${data.actorId} to ${data.markId}${data.duration ? ` in ${data.duration}` : ""}`,
  },
  arrive: {
    type: "arrive",
    label: "Arrive",
    fields: [
      { key: "actorId", label: "Actor id", type: "string", defaultValue: "actor" },
      { key: "markId", label: "Mark id", type: "string", defaultValue: "mark" },
      { key: "duration", label: "Duration", type: "number", defaultValue: 500 },
    ],
    build: (data) => `${data.actorId} arrives to ${data.markId}${data.duration ? ` in ${data.duration}` : ""}`,
  },
  emotionChange: {
    type: "emotionChange",
    label: "Emotion Change",
    fields: [
      { key: "actorId", label: "Actor id", type: "string", defaultValue: "actor" },
      { key: "emotionId", label: "Emotion id", type: "string", defaultValue: "emotion" },
      { key: "duration", label: "Duration", type: "number", defaultValue: 500 },
    ],
    build: (data) => `${data.actorId} gets ${data.emotionId}${data.duration ? ` in ${data.duration}` : ""}`,
  },
  dialog: {
    type: "dialog",
    label: "Dialog",
    fields: [{ key: "text", label: "Text", type: "textarea", defaultValue: `\"Hello\"` }],
    build: (data) => `- ${data.text}`,
  },
  narration: {
    type: "narration",
    label: "Narration",
    fields: [{ key: "text", label: "Text", type: "textarea", defaultValue: `\"Narration line\"` }],
    build: (data) => `${data.text}`,
  },
  javascript: {
    type: "javascript",
    label: "JavaScript",
    fields: [{ key: "code", label: "Code", type: "textarea", defaultValue: `console.log(\"script code\");` }],
    build: (data) =>
      data.code
        .split("\n")
        .map((line: string) => `@ ${line}`)
        .join("\n"),
  },
};

export const nodeDefinitions = Object.values(scriptNodeDefinitions);

export function renderFieldInput(
  field: ScriptNodeDefinition["fields"][number],
  value: any,
  onChange: (value: any) => void
) {
  if (field.type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        className="mr-2"
      />
    );
  }

  if (field.type === "textarea" || field.type === "json") {
    return (
      <textarea
        rows={4}
        value={value}
        placeholder={field.placeholder ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border rounded bg-slate-900 text-white"
      />
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      value={value}
      placeholder={field.placeholder ?? ""}
      onChange={(e) => onChange(field.type === "number" ? e.target.valueAsNumber : e.target.value)}
      className="w-full p-2 border rounded bg-slate-900 text-white"
    />
  );
}

export const normalizeValue = (value: any, type: FieldType) => {
  if (type === "boolean") {
    return Boolean(value);
  }
  if (type === "number") {
    return value === "" || value === undefined || value === null ? "" : Number(value);
  }
  return value;
};

export const createNode = (
  definition: ScriptNodeDefinition,
  position = { x: 0, y: 0 },
  onFieldChange?: (nodeId: string, fieldKey: string, value: any, fieldType: FieldType) => void
): Node<ScriptNodeData> => {
  const dataFields: Record<string, any> = {};
  definition.fields.forEach((field) => {
    dataFields[field.key] = field.defaultValue ?? "";
  });

  return {
    id: `${definition.type}-${performance.now().toString().replaceAll(".", "")}`,
    type: "default",
    position,
    data: {
      type: definition.type,
      label: definition.label,
      fields: dataFields,
      onFieldChange,
    },
    style: {
      padding: 10,
      border: "1px solid #777",
      borderRadius: 8,
      minWidth: 260,
      background: "#0f172a",
      color: "white",
    },
  } as Node<ScriptNodeData>;
};

const parseJsonLiteral = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed;
  }
};

const extractArrayLiteral = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed;
  }
};

const buildJsonObjectLiteral = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "{}";
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed;
  }
};

export const parseScriptToGraph = (
  script: string,
  onFieldChange?: (nodeId: string, fieldKey: string, value: any, fieldType: FieldType) => void
): { nodes: Node<ScriptNodeData>[]; edges: Edge[] } => {
  const lines = script.split(/\r?\n/);
  const nodes: Node<ScriptNodeData>[] = [];
  const edges: Edge[] = [];
  let previousNodeId: string | null = null;
  let positionY = 20;

  const pushNode = (definition: ScriptNodeDefinition, fields: Record<string, any>) => {
    const node = createNode(definition, { x: 20 + nodes.length * 20, y: positionY }, onFieldChange);
    node.data.fields = { ...node.data.fields, ...fields };
    nodes.push(node);
    if (previousNodeId) {
      edges.push({
        id: `e-${previousNodeId}-${node.id}`,
        source: previousNodeId,
        target: node.id,
        animated: false,
        style: { stroke: "#888" },
      });
    }
    previousNodeId = node.id;
    positionY += 120;
  };

  const buildJsonChunk = (raw: string) => {
    const chunk = raw.trim();
    if (!chunk) return "{}";
    return buildJsonObjectLiteral(chunk);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const sceneMatch = line.match(/^scene\s+(\w+)$/i);
    const moduleMatch = line.match(/^module\s+(\w+)$/i);
    const nodeMatch = line.match(/^node\s*:(\w+)$/i);
    const endMatch = line.match(/^end\s+(scene|module|node)$/i);
    const includeMatch = line.match(/^include\s+"([^"]+)"$/i);
    const runMatch = line.match(/^run\s+(\w+)(?:\s*->\s*(\w+))?$/i);
    const waitMatch = line.match(/^wait(?:\s+(\d+))?$/i);
    const deleteMatch = line.match(/^delete\s+(all\s+)?(\w+)(?:\s+(\w+))?$/i);
    const setMatch = line.match(/^set\s+(\w+)\s+(\w+)\s+(.+)$/i);
    const soundMatch = line.match(/^Sound\s+(\w+)(?:\s+(\w+))?(?:\s+(.+))?$/i);
    const createMatch = line.match(/^(\w+)\s*=\s*new\s+(GraphObject|TextureAnim|Trigger|KeyboardTrigger|Animation|CodedRoutine|Actor|StageMark)\s*\((.+)\)$/i);
    const moveMatch = line.match(/^(\w+)\s+to\s+(\w+)(?:\s+in\s+(\d+))?$/i);
    const arriveMatch = line.match(/^(\w+)\s+arrives\s+to\s+(\w+)(?:\s+in\s+(\d+))?$/i);
    const emotionMatch = line.match(/^(\w+)\s+gets\s+(\w+)(?:\s+in\s+(\d+))?$/i);
    const dialogMatch = line.match(/^\-\s+(.+)$/);
    const javascriptMatch = line.match(/^@\s*(.*)$/);

    if (sceneMatch) {
      pushNode(scriptNodeDefinitions.scene, { id: sceneMatch[1] });
      continue;
    }
    if (moduleMatch) {
      pushNode(scriptNodeDefinitions.module, { id: moduleMatch[1] });
      continue;
    }
    if (nodeMatch) {
      pushNode(scriptNodeDefinitions.nodeDefinition, { id: nodeMatch[1] });
      continue;
    }
    if (endMatch) {
      pushNode(scriptNodeDefinitions.structureEnd, { structure: endMatch[1] });
      continue;
    }
    if (includeMatch) {
      pushNode(scriptNodeDefinitions.include, { module: includeMatch[1] });
      continue;
    }
    if (runMatch) {
      pushNode(scriptNodeDefinitions.run, { scene: runMatch[1], node: runMatch[2] || "" });
      continue;
    }
    if (waitMatch) {
      pushNode(scriptNodeDefinitions.wait, { time: waitMatch[1] ?? "" });
      continue;
    }
    if (line.toLowerCase() === "resume") {
      pushNode(scriptNodeDefinitions.resume, {});
      continue;
    }
    if (deleteMatch) {
      pushNode(scriptNodeDefinitions.delete, {
        targetType: deleteMatch[2],
        id: deleteMatch[3] || "",
        all: Boolean(deleteMatch[1]),
      });
      continue;
    }
    if (setMatch) {
      pushNode(scriptNodeDefinitions.set, {
        targetType: setMatch[1],
        id: setMatch[2],
        properties: buildJsonChunk(setMatch[3]),
      });
      continue;
    }
    if (soundMatch) {
      pushNode(scriptNodeDefinitions.sound, {
        id: soundMatch[1],
        action: soundMatch[2] || "",
        config: soundMatch[3] ? buildJsonChunk(soundMatch[3]) : "{}",
      });
      continue;
    }
    if (createMatch) {
      const [, id, type, rawArgs] = createMatch;
      const method = `create${type}` as keyof typeof scriptNodeDefinitions;
      if (scriptNodeDefinitions[method]) {
        const definition = scriptNodeDefinitions[method];
        const fields: Record<string, any> = { id };
        if (type === "GraphObject") {
          fields.enabled = true;
          fields.props = buildJsonChunk(rawArgs);
        } else if (type === "TextureAnim") {
          const listMatch = rawArgs.match(/^\s*\[(.*)\]\s*,\s*(\{[\s\S]*\})\s*$/);
          fields.textures = listMatch ? `[${listMatch[1]}]` : "[]";
          fields.props = listMatch ? buildJsonChunk(listMatch[2]) : "{}";
        } else if (type === "Trigger" || type === "KeyboardTrigger") {
          if (type === "Trigger") {
            const parameterMatch = rawArgs.match(/^(?:"([^"]+)"\s*,\s*)?(\{[\s\S]*\})$/);
            fields.id = id;
            fields.relatedTo = parameterMatch?.[1] ?? "";
            fields.behaviors = buildJsonChunk(parameterMatch?.[2] ?? "{}");
          } else {
            const parameterMatch = rawArgs.match(/^(\[[\s\S]*\])\s*,\s*(\{[\s\S]*\})$/);
            fields.keys = parameterMatch?.[1] ?? "[]";
            fields.behaviors = buildJsonChunk(parameterMatch?.[2] ?? "{}");
          }
        } else if (type === "Animation") {
          const parameterMatch = rawArgs.match(/^"([^"]+)"\s*,\s*(\{[\s\S]*\})\s*,\s*(\{[\s\S]*\})$/);
          fields.id = id;
          fields.relatedTo = parameterMatch?.[1] ?? "";
          fields.keyframes = buildJsonChunk(parameterMatch?.[2] ?? "{}");
          fields.props = buildJsonChunk(parameterMatch?.[3] ?? "{}");
        } else if (type === "CodedRoutine") {
          const parameterMatch = rawArgs.match(/^\{[\s\S]*\}$/);
          fields.id = id;
          fields.code = parameterMatch ? rawArgs : rawArgs;
          fields.continious = false;
        } else if (type === "Actor") {
          fields.name = "";
          fields.active = true;
          fields.body = "";
          fields.emotions = "{}";
          fields.id = id;
          fields.props = rawArgs;
        } else if (type === "StageMark") {
          const parameterMatch = rawArgs.match(/^\{[\s\S]*\}$/);
          fields.id = id;
          fields.x = 0;
          fields.y = 0;
          fields.z = 0;
        }
        pushNode(definition, fields);
        continue;
      }
    }
    if (arriveMatch) {
      pushNode(scriptNodeDefinitions.arrive, {
        actorId: arriveMatch[1],
        markId: arriveMatch[2],
        duration: arriveMatch[3] ? Number(arriveMatch[3]) : 0,
      });
      continue;
    }
    if (moveMatch) {
      pushNode(scriptNodeDefinitions.moveActor, {
        actorId: moveMatch[1],
        markId: moveMatch[2],
        duration: moveMatch[3] ? Number(moveMatch[3]) : 0,
      });
      continue;
    }
    if (emotionMatch) {
      pushNode(scriptNodeDefinitions.emotionChange, {
        actorId: emotionMatch[1],
        emotionId: emotionMatch[2],
        duration: emotionMatch[3] ? Number(emotionMatch[3]) : 0,
      });
      continue;
    }
    if (dialogMatch) {
      pushNode(scriptNodeDefinitions.dialog, { text: dialogMatch[1] });
      continue;
    }
    if (javascriptMatch) {
      pushNode(scriptNodeDefinitions.javascript, { code: javascriptMatch[1] });
      continue;
    }
    pushNode(scriptNodeDefinitions.narration, { text: line });
  }

  return { nodes, edges };
};

export const buildScriptFromGraph = (nodes: Node<ScriptNodeData>[], edges: Edge[]) => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Set<string>();
  const childrenMap = new Map<string, string[]>();
  edges.forEach((edge) => {
    incoming.add(edge.target);
    const list = childrenMap.get(edge.source) ?? [];
    list.push(edge.target);
    childrenMap.set(edge.source, list);
  });

  const rootNodes = nodes.filter((node) => !incoming.has(node.id));
  const sceneRoots = rootNodes.filter((node) => ["scene", "module"].includes(node.data.type));
  const validNodes = new Set<string>();
  const stack = sceneRoots.map((node) => node.id);
  while (stack.length) {
    const current = stack.pop();
    if (!current || validNodes.has(current)) continue;
    validNodes.add(current);
    const children = childrenMap.get(current) ?? [];
    stack.push(...children);
  }

  const visited = new Set<string>();
  const scriptLines: string[] = [];

  const addNodeLines = (node: Node<ScriptNodeData>) => {
    const definition = scriptNodeDefinitions[node.data.type];
    if (!definition) return [""];
    return definition.build(node.data.fields).split("\n");
  };

  const traverse = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node) return;
    addNodeLines(node).forEach((line) => scriptLines.push(line));
    const children = (childrenMap.get(nodeId) ?? []).sort();
    children.forEach((childId) => traverse(childId));
  };

  sceneRoots.forEach((root) => traverse(root.id));

  const disconnected = nodes.filter((node) => !validNodes.has(node.id));
  if (disconnected.length > 0) {
    scriptLines.push("\n// Disconnected nodes (commented)");
    disconnected.forEach((node) => {
      addNodeLines(node).forEach((line) => {
        if (!line.trim()) return;
        scriptLines.push(`// ${line}`);
      });
    });
  }

  return scriptLines.join("\n");
};
