import { useEffect, useState } from "react";
import { Howl } from "howler";
import { RequestFile, RequestFileWithMime } from "../../../wailsjs/go/main/App.js";
import { decodeBase64Utf8 } from "../../engine/logic/Misc.ts";
import { ScriptDocument, allScopes, walkStatements } from "../../engine/interpretators/ScriptDocument.ts";
import { stripQuotes } from "./instructionForms.ts";

//*Project-level knowledge for illustration and autocompletion: actors, stage marks, textures, sounds.

export type ActorInfo = {
  id: string,
  name: string,
  bodyId?: string,
  texture?: string,
  emotions: Record<string, { maskId: string, texture?: string }>
};

export type StageMarkInfo = { id: string, x: number | null, y: number | null };

export type ScriptAssets = {
  actors: Record<string, ActorInfo>,
  marks: Record<string, StageMarkInfo>,
  graphTextures: Record<string, string>   //GraphObject id -> texture id
};

const stringProp = (source: string, key: string) =>
  new RegExp(`\\b${key}\\s*:\\s*(["'\`])([^"'\`]*)\\1`).exec(source)?.[2];

const numberProp = (source: string, key: string) => {
  const match = new RegExp(`\\b${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(source);
  return match ? Number(match[1]) : null;
};

const dictProp = (source: string, key: string): Record<string, string> => {
  const body = new RegExp(`\\b${key}\\s*:\\s*\\{([^}]*)\\}`).exec(source)?.[1];
  const result: Record<string, string> = {};
  if (!body) { return result; }
  for (const match of body.matchAll(/(["'`]?)(\w+)\1\s*:\s*(["'`])([^"'`]*)\3/g)) {
    result[match[2]] = match[4];
  }
  return result;
};

export const scriptAssetsOf = (doc: ScriptDocument): ScriptAssets => {
  const actors: Record<string, ActorInfo> = {};
  const marks: Record<string, StageMarkInfo> = {};
  const graphTextures: Record<string, string> = {};
  const pendingActors: Array<{ id: string, value: string }> = [];

  for (const scope of allScopes(doc)) {
    //Nested too: actors/marks are often created inside "@" blocks. Dynamic ids (`estrella${i}`) are skipped
    for (const { statement } of walkStatements(scope)) {
      if (statement.kind != "CreateInstruction") { continue; }
      const id = stripQuotes(String(statement.data.id ?? ""));
      if (id.includes("${")) { continue; }
      const value = String(statement.data.value ?? "");
      switch (statement.data.branch) {
        case "GraphObject":
        case "ModelObject": {
          const texture = stringProp(value, "texture") ?? stringProp(value, "textureName");
          if (texture) { graphTextures[id] = texture; }
          break;
        }
        case "StageMark":
          marks[id] = { id, x: numberProp(value, "x"), y: numberProp(value, "y") };
          break;
        case "Actor":
          pendingActors.push({ id, value });
          break;
      }
    }
  }
  for (const { id, value } of pendingActors) {
    const bodyId = stringProp(value, "body");
    const emotions: ActorInfo["emotions"] = {};
    for (const [emotion, maskId] of Object.entries(dictProp(value, "emotions"))) {
      emotions[emotion] = { maskId, texture: graphTextures[maskId] };
    }
    actors[id] = {
      id,
      name: stringProp(value, "name") || id,
      bodyId,
      texture: bodyId ? graphTextures[bodyId] : undefined,
      emotions
    };
  }
  return { actors, marks, graphTextures };
};

// ───────────────────────────── project indexes ─────────────────────────────

const indexCache: Record<string, Promise<Record<string, string>>> = {};

export const projectIndex = (kind: "textures" | "sounds" | "models"): Promise<Record<string, string>> => {
  if (!indexCache[kind]) {
    indexCache[kind] = RequestFile(window.projectRoute + `${kind}/${kind}.json`)
      .then(res => JSON.parse(decodeBase64Utf8(res)))
      .catch(() => ({}));
  }
  return indexCache[kind];
};

export const useProjectIndex = (kind: "textures" | "sounds") => {
  const [index, setIndex] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    projectIndex(kind).then(result => { if (alive) { setIndex(result); } });
    return () => { alive = false; };
  }, [kind]);
  return index;
};

const textureUrlCache: Record<string, Promise<string | null>> = {};

export const textureUrl = (textureId: string): Promise<string | null> => {
  if (!textureUrlCache[textureId]) {
    textureUrlCache[textureId] = projectIndex("textures").then(index => {
      const file = index[textureId];
      if (!file) { return null; }
      return RequestFileWithMime(window.projectRoute + "textures/" + file.replace("./", "")).catch(() => null);
    });
  }
  return textureUrlCache[textureId];
};

export const useTextureUrl = (textureId?: string | null) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!textureId) { setUrl(null); return; }
    let alive = true;
    textureUrl(textureId).then(result => { if (alive) { setUrl(result); } });
    return () => { alive = false; };
  }, [textureId]);
  return url;
};

// ───────────────────────────── sound preview ─────────────────────────────

let currentPreview: { id: string, howl: Howl } | null = null;

export const stopSoundPreview = () => {
  currentPreview?.howl.stop();
  currentPreview?.howl.unload();
  currentPreview = null;
};

//*Plays a project sound independently of the engine state. Resolves false when the sound doesn't exist.
export const playSoundPreview = async (soundId: string, onEnd?: () => void): Promise<boolean> => {
  stopSoundPreview();
  const index = await projectIndex("sounds");
  const file = index[soundId];
  if (!file) { return false; }
  const data = await RequestFileWithMime(window.projectRoute + "sounds/" + file.replace("./", "")).catch(() => null);
  if (!data) { return false; }
  const howl = new Howl({ src: [data], format: [file.split(".").at(-1) ?? "mp3"], onend: () => { onEnd?.(); } });
  currentPreview = { id: soundId, howl };
  howl.play();
  return true;
};

export const previewingSound = () => currentPreview?.id ?? null;
