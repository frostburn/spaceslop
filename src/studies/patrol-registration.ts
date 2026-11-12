import {
  PATROL_GRID_SIZE, PATROL_VERTEX_COUNT, expandPatrolGrid, patrolGridPadding, patrolGridPoint, patrolMirrorPoint, patrolRestPoint,
  type PatrolAtlas, type PatrolGrid, type PatrolPoint,
} from '../den/patrol-warp';

export type PatrolLocks = readonly [outgoing: ReadonlySet<number>, incoming: ReadonlySet<number>];
export const patrolSourceSpan = (atlas: PatrolAtlas) => atlas.width === atlas.height ? 368 : 640;

export function patrolPointLimits(atlas: PatrolAtlas, frame: number, grid: PatrolGrid, point: number) {
  const crop = atlas.crops[frame], edge = PATROL_GRID_SIZE - 1;
  const width = crop[2] - crop[0], height = crop[3] - crop[1], limit = 2 * patrolGridPadding(crop);
  const column = point % PATROL_GRID_SIZE, row = Math.floor(point / PATROL_GRID_SIZE);
  const horizontal = row === 0 || row === edge, vertical = column === 0 || column === edge;
  const x = column === 0 ? [-limit, 0] : column === edge ? [width, width + limit] : horizontal ? [
    Math.max(0, patrolGridPoint(crop, grid, point - 1)[0] + .2),
    Math.min(width, patrolGridPoint(crop, grid, point + 1)[0] - .2),
  ] : [-limit, width + limit];
  const y = row === 0 ? [-limit, 0] : row === edge ? [height, height + limit] : vertical ? [
    Math.max(0, patrolGridPoint(crop, grid, point - PATROL_GRID_SIZE)[1] + .2),
    Math.min(height, patrolGridPoint(crop, grid, point + PATROL_GRID_SIZE)[1] - .2),
  ] : [-limit, height + limit];
  return { x, y };
}

export function movePatrolPoint(
  atlas: PatrolAtlas, frame: number, grid: PatrolGrid, point: number, x: number, y: number,
): PatrolGrid {
  const crop = atlas.crops[frame], limits = patrolPointLimits(atlas, frame, grid, point);
  const clamp = (value: number, [min, max]: number[]) =>
    Math.min(Math.floor(max * 10 + 1e-8) / 10, Math.max(Math.ceil(min * 10 - 1e-8) / 10, Math.round(value * 10) / 10));
  const [oldX, oldY] = patrolGridPoint(crop, grid, point);
  const nextX = x === oldX ? x : clamp(x, limits.x), nextY = y === oldY ? y : clamp(y, limits.y);
  if (oldX === nextX && oldY === nextY) return grid;
  const next = [...expandPatrolGrid(crop, grid)];
  next[point] = [nextX, nextY];
  // The front view is shared by both directions of turn.
  if (frame === 0) next[patrolMirrorPoint(point)] = [crop[2] - crop[0] - nextX, nextY];
  return next;
}

export function patrolGridStrain(atlas: PatrolAtlas, frame: number, grid: PatrolGrid) {
  const crop = atlas.crops[frame], edge = PATROL_GRID_SIZE - 1;
  const cellX = (crop[2] - crop[0]) / edge, cellY = (crop[3] - crop[1]) / edge;
  const offsets = Array.from({ length: PATROL_VERTEX_COUNT }, (_, point): PatrolPoint => {
    const [x, y] = patrolGridPoint(crop, grid, point);
    const [restX, restY] = patrolRestPoint(crop, point);
    return [(x - restX) / cellX, (y - restY) / cellY];
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
