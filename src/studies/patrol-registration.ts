import {
  PATROL_GRID_SIZE, PATROL_VERTEX_COUNT, patrolGridPoint, patrolInteriorIndex, patrolMirrorPoint,
  type PatrolAtlas, type PatrolGrid, type PatrolPoint,
} from '../den/patrol-warp';

export type PatrolLocks = readonly [outgoing: ReadonlySet<number>, incoming: ReadonlySet<number>];
export const patrolSourceSpan = (atlas: PatrolAtlas) => atlas.width === atlas.height ? 336 : 570;

export function movePatrolPoint(
  atlas: PatrolAtlas, frame: number, interior: PatrolGrid, point: number, x: number, y: number,
): PatrolGrid {
  const i = patrolInteriorIndex(point);
  if (i < 0) return interior;
  const [left, top, right, bottom] = atlas.crops[frame];
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(value * 10) / 10));
  const nextX = clamp(x, right - left), nextY = clamp(y, bottom - top);
  if (interior[i][0] === nextX && interior[i][1] === nextY) return interior;
  const next = [...interior];
  next[i] = [nextX, nextY];
  // The front view is shared by both directions of turn.
  if (frame === 0) next[patrolInteriorIndex(patrolMirrorPoint(point))] = [clamp(right - left - nextX, right - left), nextY];
  return next;
}

export function patrolGridStrain(atlas: PatrolAtlas, frame: number, grid: PatrolGrid) {
  const crop = atlas.crops[frame], edge = PATROL_GRID_SIZE - 1;
  const cellX = (crop[2] - crop[0]) / edge, cellY = (crop[3] - crop[1]) / edge;
  const offsets = Array.from({ length: PATROL_VERTEX_COUNT }, (_, point): PatrolPoint => {
    const [x, y] = patrolGridPoint(crop, grid, point);
    return [x / cellX - point % PATROL_GRID_SIZE, y / cellY - Math.floor(point / PATROL_GRID_SIZE)];
  });
  let strain = 0;
  for (const [i, [x, y]] of offsets.entries()) {
    strain += .23 * (x * x + y * y);
    for (const j of [i % PATROL_GRID_SIZE < edge ? i + 1 : PATROL_VERTEX_COUNT, i + PATROL_GRID_SIZE]) {
      if (j >= PATROL_VERTEX_COUNT) continue;
      strain += (x - offsets[j][0]) ** 2 + (y - offsets[j][1]) ** 2;
    }
  }
  return strain;
}
