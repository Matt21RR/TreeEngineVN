import { colorToRGBA } from "../logic/Misc.ts";

/** Bits de la máscara de planos (prm.w del uniforme). */
export const GRID_PLANE_XZ = 1;
export const GRID_PLANE_XY = 2;
export const GRID_PLANE_YZ = 4;

export interface GridState {
  enabled: boolean;
  /** Planos a renderizar (checks independientes). Default: solo XZ. */
  showXZ: boolean;
  showXY: boolean;
  showYZ: boolean;
  /** Escala de referencia en unidades mundo (default 4). Con grid infinito,
   *  size/divisions definen el paso de celda, no el alcance. */
  size: number;
  /** Divisiones por unidad de `size` (default 16, clamp 2..64). */
  divisions: number;
  /** Color CSS de las líneas (default "#8a93a6"). */
  color: string;
  /** Opacidad 0..1 (default 0.5). */
  opacity: number;
  /** Ejes XYZ de colores (default true). */
  showAxes: boolean;
}

/** Snapshot mínimo de cámara + canvas para el grid infinito. */
export interface GridView {
  camX: number;
  camY: number;
  camZ: number;
  originX: number;
  originY: number;
  pitch: number;
  yaw: number;
  roll: number;
  fov?: number;
  maxZ: number;
  usePerspective: boolean;
  width: number;
  height: number;
}

export const DEFAULT_GRID_STATE: GridState = {
  enabled: false,
  showXZ: true,
  showXY: false,
  showYZ: false,
  size: 4,
  divisions: 16,
  color: "#8a93a6",
  opacity: 0.5,
  showAxes: true,
};

/** Buffer de sobra para los 3 ejes (6 vértices); el grid infinito no usa vértices. */
export const MAX_GRID_VERTICES = 64;
/** 8 floats por vértice: clipPos vec4 + color vec4 (rgb 0..1, a 0..1). */
export const GRID_FLOATS_PER_VERTEX = 8;

/**
 * Uniforme del grid infinito: 7 vec4 (112 B). Orden fijo, debe coincidir
 * con `GridU` en WebGPUCanvas.
 * [eye.xyz, focalPx] [right.xyz, canvasW] [up.xyz, canvasH]
 * [forward.xyz, originY] [spacing, fadeStart, fadeEnd, planeMask]
 * [near, invFar, usePerspective, showAxesFlag] [gridRgb, opacity]
 *
 * planeMask: bit 1 = XZ (y=0), bit 2 = XY (z=0), bit 4 = YZ (x=0).
 */
export const GRID_UNIFORM_FLOATS = 28;

/** Copia local de rotate3DJS (RenderingDimentions.ts) para evitar ciclos de import. */
function rotate3D(
  point: [number, number, number],
  roll: number, pitch: number, yaw: number
): [number, number, number] {
  const cr = Math.cos(roll),  sr = Math.sin(roll);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw),   sy = Math.sin(yaw);

  const x1 = point[0] * cy + point[2] * sy;
  const z1 = -point[0] * sy + point[2] * cy;
  const y1 = point[1];

  const y2 = y1 * cp - z1 * sp;
  const z2 = y1 * sp + z1 * cp;

  const x3 = x1 * cr - y2 * sr;
  const y3 = x1 * sr + y2 * cr;
  return [x3, y3, z2];
}

/**
 * Rotación inversa (R = Rz(roll)·Rx(pitch)·Ry(yaw) ⇒ R⁻¹ = Ry(-yaw)·Rx(-pitch)·Rz(-roll)).
 * Da la base cámara→mundo (right/up/forward) para el raycast del grid infinito.
 */
export function invRotate3D(
  point: [number, number, number],
  roll: number, pitch: number, yaw: number
): [number, number, number] {
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  //Rz(-roll)
  const x1 = point[0] * cr + point[1] * sr;
  const y1 = -point[0] * sr + point[1] * cr;
  const z1 = point[2];
  //Rx(-pitch)
  const y2 = y1 * cp + z1 * sp;
  const z2 = -y1 * sp + z1 * cp;
  const x2 = x1;
  //Ry(-yaw)
  const x3 = x2 * cy - z2 * sy;
  const z3 = x2 * sy + z2 * cy;
  return [x3, y2, z3];
}

export function sanitizeGridState(state: GridState): Required<GridState> {
  const size = Number.isFinite(state.size)
    ? Math.min(Math.max(state.size, 0.5), 100) : DEFAULT_GRID_STATE.size;
  const divisions = Number.isFinite(state.divisions)
    ? Math.min(Math.max(Math.round(state.divisions), 2), 64) : DEFAULT_GRID_STATE.divisions;
  const opacity = Number.isFinite(state.opacity)
    ? Math.min(Math.max(state.opacity, 0), 1) : DEFAULT_GRID_STATE.opacity;
  return {
    enabled: !!state.enabled,
    showXZ: state.showXZ !== false,
    showXY: !!state.showXY,
    showYZ: !!state.showYZ,
    size,
    divisions,
    color: typeof state.color === "string" ? state.color : DEFAULT_GRID_STATE.color,
    opacity,
    showAxes: state.showAxes !== false,
  };
}

/** Máscara de bits de planos para el uniforme (0 = ningún plano). */
export function gridPlaneMask(state: GridState): number {
  const s = sanitizeGridState(state);
  return (s.showXZ ? GRID_PLANE_XZ : 0) | (s.showXY ? GRID_PLANE_XY : 0) | (s.showYZ ? GRID_PLANE_YZ : 0);
}

/** Paso de celda en unidades mundo (misma densidad local que el grid finito). */
export function gridSpacing(state: GridState): number {
  const s = sanitizeGridState(state);
  return Math.max(s.size / s.divisions, 1e-3);
}

function gridBaseColor(state: Required<GridState>): [number, number, number, number] {
  try {
    const rgba = colorToRGBA(state.color);
    return [rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, state.opacity];
  } catch {
    return [0.54, 0.58, 0.65, state.opacity];
  }
}

/**
 * Construye el uniforme del grid infinito. El ojo/pivote replica
 * RenderingDimentions y Canvas.tsx (perspectiva = ojo, orto = posición).
 * NOTA: el shader usa pinhole puro (invFar≈0); difiere de la proyección del
 * motor en ~Z/maxZ (0.1% a 10u, invisible en el rango con fade). Cerca del
 * origen la coincidencia es exacta a efectos prácticos.
 */
export function buildGridUniform(state: GridState, view: GridView): Float32Array {
  const s = sanitizeGridState(state);
  const W = view.width, H = view.height;
  const out = new Float32Array(GRID_UNIFORM_FLOATS);
  if (!(W > 0) || !(H > 0)) return out;

  const maxZ = view.maxZ > 0 ? view.maxZ : 10000;
  const usePersp = !!view.usePerspective;
  const originY = Number.isFinite(view.originY) ? view.originY : 0.5;
  const pitch = view.pitch ?? 0, yaw = view.yaw ?? 0, roll = view.roll ?? 0;

  let eyeX: number, eyeY: number, eyeZ: number;
  if (usePersp) {
    const camCenterX = -view.camX + 0.5;
    const camCenterY = -view.camY + 0.5;
    const camCenterZ = -view.camZ + 0.56;
    eyeX = -camCenterX + (W / H / 2);
    eyeY = -camCenterY + originY;
    eyeZ = -camCenterZ;
  } else {
    eyeX = view.camX; eyeY = view.camY; eyeZ = view.camZ;
  }

  const right = invRotate3D([1, 0, 0], roll, pitch, yaw);
  const up = invRotate3D([0, 1, 0], roll, pitch, yaw);
  const fwd = invRotate3D([0, 0, 1], roll, pitch, yaw);

  const legacyFov = 2 * Math.atan(W / (2 * H));
  const fovRaw = view.fov ?? legacyFov;
  const fov = Math.min(Math.max(fovRaw, 0.01), Math.PI - 0.01);
  const focalPx = (H * 0.5) / Math.tan(fov * 0.5);

  const spacing = gridSpacing(state);
  const fadeStart = s.size * 3;
  const fadeEnd = s.size * 10;
  const planeFlag = gridPlaneMask(state);
  const col = gridBaseColor(s);

  out[0] = eyeX; out[1] = eyeY; out[2] = eyeZ; out[3] = focalPx;
  out[4] = right[0]; out[5] = right[1]; out[6] = right[2]; out[7] = W;
  out[8] = up[0]; out[9] = up[1]; out[10] = up[2]; out[11] = H;
  out[12] = fwd[0]; out[13] = fwd[1]; out[14] = fwd[2]; out[15] = originY;
  out[16] = spacing; out[17] = fadeStart; out[18] = fadeEnd; out[19] = planeFlag;
  out[20] = 0.02; out[21] = 1 / maxZ; out[22] = usePersp ? 1 : 0; out[23] = s.showAxes ? 1 : 0;
  out[24] = col[0]; out[25] = col[1]; out[26] = col[2]; out[27] = col[3];
  return out;
}

/** smoothstep CPU (misma curva que el shader) para el fade de ejes. */
function smoothstepJs(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * Ejes XYZ extendidos al infinito (hasta el rango del fade, donde se
 * disuelven como el grid) proyectados con la matemática EXACTA de
 * RenderingDimentions (rotación sobre el ojo + pinhole con c0). El alpha por
 * vértice lleva el fade por distancia (interpolación con corrección de
 * perspectiva vía w=Z). Se dibujan como line-list sobre el grid infinito.
 */
export function buildAxesVertices(state: GridState, view: GridView): Float32Array {
  const s = sanitizeGridState(state);
  const W = view.width, H = view.height;
  if (!s.enabled || !s.showAxes || !(W > 0) || !(H > 0)) return new Float32Array(0);

  const maxZ = view.maxZ > 0 ? view.maxZ : 10000;
  const NEAR = 0.02;
  const usePersp = !!view.usePerspective;
  const originX = Number.isFinite(view.originX) ? view.originX : 0.5;
  const originY = Number.isFinite(view.originY) ? view.originY : 0.5;
  const pitch = view.pitch ?? 0, yaw = view.yaw ?? 0, roll = view.roll ?? 0;
  const axesAlpha = Math.min(1, s.opacity + 0.4);
  //*Alcance = fin del fade del grid (ahi el alpha llega a 0: infinito visual).
  const F = s.size * 10;
  const fadeStart = s.size * 3;

  type Seg = { a: [number, number, number]; b: [number, number, number]; c: [number, number, number] };
  const segs: Seg[] = [
    { a: [-F, 0, 0], b: [F, 0, 0], c: [1, 0.33, 0.33] },
    { a: [0, -F, 0], b: [0, F, 0], c: [0.33, 1, 0.33] },
    { a: [0, 0, -F], b: [0, 0, F], c: [0.33, 0.4, 1] },
  ];
  const fadeOf = (dist: number) => axesAlpha * (1 - smoothstepJs(fadeStart, F, dist));

  const out = new Float32Array(segs.length * 2 * GRID_FLOATS_PER_VERTEX);
  let v = 0;

  if (!usePersp) {
    const px = view.camX, py = view.camY, pz = view.camZ;
    const ox = (originX - 0.5) * W, oy = (originY - 0.5) * H;
    const push = (p: [number, number, number], c: [number, number, number]) => {
      const r = rotate3D([p[0] - px, p[1] - py, p[2] - pz], roll, pitch, yaw);
      const sx = (r[0] + px) * H + ox;
      const sy = (r[1] + py) * H + oy;
      const o = v * GRID_FLOATS_PER_VERTEX;
      out[o] = (sx / W) * 2 - 1; out[o + 1] = 1 - (sy / H) * 2;
      out[o + 2] = 0; out[o + 3] = 1;
      out[o + 4] = c[0]; out[o + 5] = c[1]; out[o + 6] = c[2];
      out[o + 7] = fadeOf(Math.hypot(r[0], r[1], r[2]));
      v++;
    };
    for (const sg of segs) { push(sg.a, sg.c); push(sg.b, sg.c); }
    return out.slice(0, v * GRID_FLOATS_PER_VERTEX);
  }

  const camCenterX = -view.camX + 0.5;
  const camCenterY = -view.camY + 0.5;
  const camCenterZ = -view.camZ + 0.56;
  const halfAspect = W / H / 2;
  const eyeX = -camCenterX + halfAspect;
  const eyeY = -camCenterY + originY;
  const eyeZ = -camCenterZ;
  const c0x = W * 0.5, c0y = H * originY;

  const legacyFov = 2 * Math.atan(W / (2 * H));
  const fovRaw = view.fov ?? legacyFov;
  const fov = Math.min(Math.max(fovRaw, 0.01), Math.PI - 0.01);
  const focalPx = (H * 0.5) / Math.tan(fov * 0.5);
  const invFar = 1 / maxZ;
  const perspHelper = invFar - 1;
  const invNear = 1 / NEAR;

  const pushProj = (d: [number, number, number], c: [number, number, number]) => {
    const Z = d[2];
    const perspDiff = 1 - ((1 / Z) - 1) / perspHelper;
    const layer = focalPx * perspDiff;
    const sx = d[0] * layer + c0x;
    const sy = d[1] * layer + c0y;
    const nx = (sx / W) * 2 - 1;
    const ny = 1 - (sy / H) * 2;
    const zClip = Math.min(Math.max(1 - ((1 / Z) - invFar) / (invNear - invFar), 0), 1);
    const o = v * GRID_FLOATS_PER_VERTEX;
    out[o] = nx * Z; out[o + 1] = ny * Z; out[o + 2] = zClip * Z; out[o + 3] = Z;
    out[o + 4] = c[0]; out[o + 5] = c[1]; out[o + 6] = c[2];
    out[o + 7] = fadeOf(Math.hypot(d[0], d[1], d[2]));
    v++;
  };

  for (const sg of segs) {
    let d0 = rotate3D([sg.a[0] - eyeX, sg.a[1] - eyeY, sg.a[2] - eyeZ], roll, pitch, yaw);
    let d1 = rotate3D([sg.b[0] - eyeX, sg.b[1] - eyeY, sg.b[2] - eyeZ], roll, pitch, yaw);
    const z0 = d0[2], z1 = d1[2];
    if (z0 < NEAR && z1 < NEAR) continue;
    if (z0 < NEAR || z1 < NEAR) {
      const t = (NEAR - z0) / (z1 - z0);
      const mid: [number, number, number] = [
        d0[0] + (d1[0] - d0[0]) * t,
        d0[1] + (d1[1] - d0[1]) * t,
        NEAR,
      ];
      if (z0 < NEAR) d0 = mid; else d1 = mid;
    }
    pushProj(d0, sg.c);
    pushProj(d1, sg.c);
  }
  return out.slice(0, v * GRID_FLOATS_PER_VERTEX);
}
