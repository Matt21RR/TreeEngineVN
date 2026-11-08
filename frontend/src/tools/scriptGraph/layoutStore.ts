import { FileExists, Request, RequestFile } from "../../../wailsjs/go/main/App.js";
import { decodeBase64Utf8 } from "../../engine/logic/Misc.ts";

//*Sidecar layout of the node editor: <script>.layout.json next to the script. The script stays canonical.

export type GraphLayout = {
  version: 1,
  positions: Record<string, { x: number, y: number }>,
  collapsed: Array<string>,
  viewport?: { x: number, y: number, zoom: number }
};

export const emptyLayout = (): GraphLayout => ({ version: 1, positions: {}, collapsed: [] });

export const layoutRouteOf = (scriptRoute: string) => scriptRoute.replace(/\.[^./\\]+$/, "") + ".layout.json";

export const loadLayout = async (scriptRoute?: string): Promise<GraphLayout> => {
  if (!scriptRoute) { return emptyLayout(); }
  const route = layoutRouteOf(scriptRoute);
  try {
    if (!(await FileExists(route))) { return emptyLayout(); }
    const parsed = JSON.parse(decodeBase64Utf8(await RequestFile(route)));
    if (parsed?.version != 1) { return emptyLayout(); }
    return { ...emptyLayout(), ...parsed };
  } catch (error) {
    console.warn("Layout couldn't be loaded, starting with an automatic one", error);
    return emptyLayout();
  }
};

export const saveLayout = async (scriptRoute: string | undefined, layout: GraphLayout): Promise<boolean> => {
  if (!scriptRoute) { return false; }
  try {
    return !!(await Request({ route: layoutRouteOf(scriptRoute), action: "update", content: JSON.stringify(layout, null, 2) }));
  } catch (error) {
    console.error("Layout couldn't be saved", error);
    return false;
  }
};
