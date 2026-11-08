import { FlowBox, FlowModel } from "./flowModel.ts";
import { GraphLayout } from "./layoutStore.ts";

//*Layered auto layout (no deps). Saved positions always win; only unknown boxes get placed.

export const BOX_WIDTH = 300;
const COLUMN_GAP = 90;
const ROW_GAP = 36;
const GROUP_PADDING = { top: 64, side: 28, bottom: 28 };
const GROUP_GAP = 70;

//*Nested exits grouped by the event (lane) that fires them, in source order
export const eventGroupsOf = (box: FlowBox) => {
  const groups: Array<{ key: string, title: string, statementIndex: number, exits: FlowBox["exits"] }> = [];
  for (const exit of box.exits) {
    if (exit.via != "nested") { continue; }
    let group = groups.find(candidate => candidate.key == exit.eventKey);
    if (!group) {
      group = { key: exit.eventKey ?? exit.id, title: exit.event ?? "⚡ evento", statementIndex: exit.statementIndex, exits: [] };
      groups.push(group);
    }
    group.exits.push(exit);
  }
  return groups;
};

export const estimateBoxHeight = (box: FlowBox) => {
  const events = eventGroupsOf(box);
  return 40 /*header*/ + 52 /*preview*/ + 30 /*chips*/ + box.exits.length * 26 +
    (events.length ? 22 + events.length * 20 : 0) + 22 /*footer*/;
};

export type PlacedLayout = {
  positions: Record<string, { x: number, y: number }>,   //groups absolute, boxes relative to their group
  groupSizes: Record<string, { width: number, height: number }>
};

export const computeLayout = (model: FlowModel, layout: GraphLayout): PlacedLayout => {
  const positions: Record<string, { x: number, y: number }> = {};
  const groupSizes: Record<string, { width: number, height: number }> = {};
  const boxByKey = new Map(model.boxes.map(box => [box.key, box]));
  const ghostsByScene = new Map<string, Array<string>>();
  for (const ghost of model.ghosts) {
    if (ghost.sceneKey && ghost.missing) {
      const list = ghostsByScene.get(ghost.sceneKey) ?? [];
      list.push(ghost.key);
      ghostsByScene.set(ghost.sceneKey, list);
    }
  }

  let cursorY = 0;
  let maxRight = 0;

  for (const group of model.groups) {
    //Depth by BFS over links inside the group, starting at main
    const depth = new Map<string, number>();
    const members = new Set([...group.boxKeys, ...(ghostsByScene.get(group.scope.key) ?? [])]);
    const queue = [group.boxKeys[0]];
    depth.set(group.boxKeys[0], 0);
    while (queue.length) {
      const current = queue.shift()!;
      for (const link of model.links) {
        if (link.sourceKey != current || !members.has(link.targetKey) || depth.has(link.targetKey)) { continue; }
        depth.set(link.targetKey, depth.get(current)! + 1);
        queue.push(link.targetKey);
      }
    }
    const maxDepth = Math.max(0, ...depth.values());
    for (const key of members) { if (!depth.has(key)) { depth.set(key, maxDepth + 1); } }

    //Saved boxes first, so the automatic ones flow around them instead of on top of them
    const heightOf = (key: string) => { const box = boxByKey.get(key); return box ? estimateBoxHeight(box) : 110; };
    const placedRects: Array<{ x: number, y: number, height: number }> = [];
    const ordered = [...members].sort((a, b) => Number(!layout.positions[a]) - Number(!layout.positions[b]));
    const columnHeights: Array<number> = [];
    let right = 0, bottom = 0;
    for (const key of ordered) {
      const height = heightOf(key);
      let position = layout.positions[key];
      if (!position) {
        const column = depth.get(key)!;
        const x = GROUP_PADDING.side + column * (BOX_WIDTH + COLUMN_GAP);
        let y = columnHeights[column] ?? GROUP_PADDING.top;
        let moved = true;
        while (moved) {
          moved = false;
          for (const rect of placedRects) {
            const overlapX = x < rect.x + BOX_WIDTH && rect.x < x + BOX_WIDTH;
            const overlapY = y < rect.y + rect.height + ROW_GAP && rect.y < y + height + ROW_GAP;
            if (overlapX && overlapY) { y = rect.y + rect.height + ROW_GAP; moved = true; }
          }
        }
        position = { x, y };
        columnHeights[column] = y + height + ROW_GAP;
      }
      placedRects.push({ x: position.x, y: position.y, height });
      positions[key] = position;
      right = Math.max(right, position.x + BOX_WIDTH);
      bottom = Math.max(bottom, position.y + height);
    }
    const size = { width: right + GROUP_PADDING.side, height: bottom + GROUP_PADDING.bottom };
    groupSizes[group.key] = size;
    const groupPosition = layout.positions[group.key] ?? { x: 0, y: cursorY };
    positions[group.key] = groupPosition;
    cursorY = Math.max(cursorY, groupPosition.y + size.height + GROUP_GAP);
    maxRight = Math.max(maxRight, groupPosition.x + size.width);
  }

  //Modules and external targets in a column to the right
  let sideY = 0;
  const sideX = maxRight + COLUMN_GAP * 1.5;
  for (const box of model.boxes.filter(box => box.kind == "module")) {
    positions[box.key] = layout.positions[box.key] ?? { x: sideX, y: sideY };
    sideY = Math.max(sideY, positions[box.key].y + estimateBoxHeight(box) + ROW_GAP);
  }
  for (const ghost of model.ghosts.filter(ghost => !(ghost.sceneKey && ghost.missing))) {
    positions[ghost.key] = layout.positions[ghost.key] ?? { x: sideX + (ghost.kind == "scene" ? BOX_WIDTH + COLUMN_GAP : 0), y: sideY };
    sideY += 110;
  }
  return { positions, groupSizes };
};
