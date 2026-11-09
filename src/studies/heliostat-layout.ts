import * as T from 'three';

export const LANE_HALF_WIDTH = 3.8;
export const STUDY_DURATION = 18;
export const CAMERA_FOV = 42;

export function cameraPose(progress: number) {
  const t = T.MathUtils.smoothstep(progress, 0, 1);
  return {
    position: new T.Vector3(0, -13 - t * 10, 24 - t * 17),
    target: new T.Vector3(0, 1 + t * 9, -2 + t * 5),
    shipPitch: t * 1.05,
  };
}

/** During the study the hero bay passes the ship, then stops for the swing. */
export function bayTravel(time: number) {
  return -3.6 * T.MathUtils.smoothstep(time, 0, 7);
}

/** Insets stay inside their cell even when the owner downsamples the atlas. */
export function atlasRect(tile: number, columns = 3, rows = 2) {
  if (!Number.isInteger(tile) || tile < 0 || tile >= columns * rows)
    throw new RangeError('Atlas tile outside the declared grid');
  const inset = .008;
  return {
    u0: (tile % columns + inset) / columns,
    v0: (rows - 1 - Math.floor(tile / columns) + inset) / rows,
    u1: (tile % columns + 1 - inset) / columns,
    v1: (rows - Math.floor(tile / columns) - inset) / rows,
  };
}

export function applyAtlasUV(geometry: T.BufferGeometry, tile: number, columns = 3, rows = 2) {
  const rect = atlasRect(tile, columns, rows), uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, T.MathUtils.lerp(rect.u0, rect.u1, uv.getX(i)),
      T.MathUtils.lerp(rect.v0, rect.v1, uv.getY(i)));
  }
  return geometry;
}

export type SurfaceFace = 'front' | 'side' | 'top';
/** All faces belong to the same solid, rather than being camera-facing decals. */
export function panelFace(face: SurfaceFace, width: number, depth: number, height: number, tile: number) {
  const g = new T.PlaneGeometry(face === 'side' ? depth : width, face === 'top' ? depth : height);
  if (face === 'front') { g.rotateX(Math.PI / 2); g.translate(0, -depth / 2 - .006, 0); }
  if (face === 'side') { g.rotateY(Math.PI / 2); g.rotateX(Math.PI / 2); g.translate(width / 2 + .006, 0, 0); }
  if (face === 'top') g.translate(0, 0, height / 2 + .006);
  return applyAtlasUV(g, tile);
}

/** Presentation is deterministic: pause and scrub never need a wall clock. */
export function studyFrame(time: number) {
  const t = T.MathUtils.clamp(time, 0, STUDY_DURATION);
  return { time: t, progress: T.MathUtils.smoothstep(t, 5, 14) };
}
