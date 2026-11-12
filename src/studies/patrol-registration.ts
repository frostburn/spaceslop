import { patrolInteriorIndex, patrolMirrorPoint, type createPatrolWarpCard, type PatrolAtlas, type PatrolPoint } from '../den/patrol-warp';

export type PatrolLocks = readonly ReadonlySet<number>[];
export const patrolSourceSpan = (atlas: PatrolAtlas) => atlas.width === atlas.height ? 336 : 570;

export function movePatrolPoint(
  atlas: PatrolAtlas, frame: number, interior: readonly PatrolPoint[], point: number, x: number, y: number,
): readonly PatrolPoint[] {
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

export function meshFoldsNear(card: ReturnType<typeof createPatrolWarpCard>, frame: number, last: number) {
  const { index, attributes: { position } } = card.root.geometry;
  // Changing one pose can also change the tangents of its neighbors.
  for (const sign of [-1, 1]) {
    for (let t = Math.max(0, frame - 2); t <= Math.min(last, frame + 2); t += .125) {
      card.pose(sign * t * (Math.PI / 2) / last);
      for (let i = 0; i < index!.count; i += 3) {
        const a = index!.getX(i), b = index!.getX(i + 1), c = index!.getX(i + 2);
        const ax = position.getX(a), ay = position.getY(a);
        if ((position.getX(b) - ax) * (position.getY(c) - ay) -
            (position.getY(b) - ay) * (position.getX(c) - ax) <= 0) return true;
      }
    }
  }
  return false;
}
