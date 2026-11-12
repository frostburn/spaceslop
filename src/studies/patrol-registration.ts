import { patrolBandAngle, patrolBandXs, type createPatrolWarpCard, type PatrolAtlas, type PatrolBand } from '../den/patrol-warp';

export type PatrolBands = readonly (readonly PatrolBand[])[];
export type PatrolLocks = readonly ReadonlySet<number>[];
export const roundPatrolCoordinate = (value: number) => Math.round(value * 10) / 10;

export function pointLimits(atlas: PatrolAtlas, row: PatrolBand, frame: number, band: number, point: number) {
  const xs = patrolBandXs(row, atlas.gutter);
  const original = patrolBandXs(atlas.rows[frame][band], atlas.gutter)[point];
  return [
    roundPatrolCoordinate(Math.min(xs[point], Math.max(original - 28, (xs[point - 1] ?? -Infinity) + .2))),
    roundPatrolCoordinate(Math.max(xs[point], Math.min(original + 28, (xs[point + 1] ?? Infinity) - .2))),
  ] as const;
}

export function bandLimits(atlas: PatrolAtlas, rows: readonly PatrolBand[], frame: number, band: number) {
  const original = atlas.rows[frame][band][0];
  return [
    roundPatrolCoordinate(Math.max(original - 18, (rows[band - 1]?.[0] ?? -Infinity) + .2)),
    roundPatrolCoordinate(Math.min(original + 18, (rows[band + 1]?.[0] ?? Infinity) - .2)),
  ] as const;
}

export function replaceBandPoint(atlas: PatrolAtlas, row: PatrolBand, frame: number, point: number, x: number): PatrolBand {
  const xs = patrolBandXs(row, atlas.gutter);
  const { columns } = atlas.grid, center = Math.floor(columns / 2);
  xs[point] = x;
  if (frame === 0) xs[columns - 1 - point] = -x;
  const next = [row[0], roundPatrolCoordinate(xs[0] + atlas.gutter), xs[center],
    roundPatrolCoordinate(xs[columns - 1] - atlas.gutter), xs[center - 1], xs[center + 1]] as const;
  return columns === 7 ? [...next, xs[1], xs[5]] : next;
}

export function bandHasLock(locks: ReadonlySet<number>, columns: number, band: number) {
  for (let i = band * columns; i < (band + 1) * columns; i++) {
    if (locks.has(i)) return true;
  }
  return false;
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

export function preservePatrolSilhouette(
  image: HTMLImageElement, atlas: PatrolAtlas, frame: number, original: readonly PatrolBand[],
) {
  const [left, top, right, bottom, pivotX, pivotY] = atlas.crops[frame];
  const canvas = document.createElement('canvas');
  canvas.width = right - left;
  canvas.height = bottom - top;
  const context = canvas.getContext('2d')!;
  const u = image.width / atlas.width, v = image.height / atlas.height;
  context.drawImage(image, left * u, top * v, canvas.width * u, canvas.height * v, 0, 0, canvas.width, canvas.height);
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const angle = patrolBandAngle(atlas, frame), cos = Math.cos(angle), sin = Math.sin(angle);
  const samples: { x: number; y: number }[] = [];
  for (let i = 0; i < rgba.length / 4; i++) {
    if (rgba[i * 4 + 3] <= .27 * 255) continue;
    const dx = i % canvas.width + left + .5 - pivotX, dy = Math.floor(i / canvas.width) + top + .5 - pivotY;
    const x = cos * dx + sin * dy, y = -sin * dx + cos * dy;
    if (y < original[0][0] || y >= original[original.length - 1][0]) continue;
    samples.push({ x, y });
  }
  samples.sort((a, b) => a.y - b.y);
  let band = 0;
  const leftRoom = new Float32Array(samples.length), rightRoom = new Float32Array(samples.length);
  for (const [i, sample] of samples.entries()) {
    while (sample.y >= original[band + 1][0]) band++;
    const [leftEdge, rightEdge] = edges(original, band, sample.y);
    leftRoom[i] = Math.min(.35, sample.x - leftEdge);
    rightRoom[i] = Math.min(.35, rightEdge - sample.x);
  }

  function edges(rows: readonly PatrolBand[], band: number, y: number) {
    const a = rows[band], b = rows[band + 1];
    const t = (y - a[0]) / (b[0] - a[0]);
    return [a[1] + (b[1] - a[1]) * t - atlas.gutter, a[3] + (b[3] - a[3]) * t + atlas.gutter];
  }

  return (rows: readonly PatrolBand[], changedBand: number) => {
    // Only samples between the two neighboring bands can move relative to the rim.
    const first = rows[Math.max(0, changedBand - 1)][0];
    const last = rows[Math.min(rows.length - 1, changedBand + 1)][0];
    for (let i = 0; i < samples.length; i++) {
      const { x, y } = samples[i];
      if (y < first) continue;
      if (y >= last) break;
      const b = y >= rows[changedBand][0] ? changedBand : changedBand - 1;
      const [leftEdge, rightEdge] = edges(rows, b, y);
      if (x - leftEdge < leftRoom[i] - .0001 || rightEdge - x < rightRoom[i] - .0001) return false;
    }
    return true;
  };
}
