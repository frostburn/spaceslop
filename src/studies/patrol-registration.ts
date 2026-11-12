import { patrolBandAngle, patrolBandXs, type createPatrolWarpCard, type PatrolAtlas, type PatrolBand } from '../den/patrol-warp';

export type PatrolBands = readonly (readonly PatrolBand[])[];
export type PatrolLocks = readonly ReadonlySet<number>[];
export const roundPatrolCoordinate = (value: number) => Math.round(value * 10) / 10;
export const patrolSourceSpan = (atlas: PatrolAtlas) => atlas.width === atlas.height ? 336 : 570;

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
    roundPatrolCoordinate(rows[band - 1] ? rows[band - 1][0] + .2 : original - 18),
    roundPatrolCoordinate(rows[band + 1] ? rows[band + 1][0] - .2 : original + 18),
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

// Each pose uses ordered bands. For a long drag, redistribute the bands between
// the nearest pinned rows and resample their columns at the new heights.
export function dragPatrolPoint(
  atlas: PatrolAtlas, rows: readonly PatrolBand[], locks: ReadonlySet<number>,
  frame: number, band: number, point: number, x: number, y: number,
): readonly PatrolBand[] {
  const { columns } = atlas.grid, last = rows.length - 1, gutter = atlas.gutter;
  if (locks.has(band * columns + point)) return rows;
  const next = [...rows];
  const height = rows[band][0];
  if (band > 0 && band < last && !bandHasLock(locks, columns, band) && roundPatrolCoordinate(y) !== height) {
    let top = band - 1, bottom = band + 1;
    while (top > 0 && !bandHasLock(locks, columns, top)) top--;
    while (bottom < last && !bandHasLock(locks, columns, bottom)) bottom++;
    const gap = .2;
    const lower = rows[top][0] + (band - top) * gap, upper = rows[bottom][0] - (bottom - band) * gap;
    const target = roundPatrolCoordinate(Math.max(lower, Math.min(upper, y)));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    let source = top;
    for (let i = top + 1; i < bottom; i++) {
      const anchor = i <= band ? top : bottom;
      const start = rows[anchor][0], distance = (i - anchor) * gap;
      const span = height - start - (band - anchor) * gap;
      const fraction = Math.abs(span) < .0001 ? (i - anchor) / (band - anchor) : (rows[i][0] - start - distance) / span;
      const newY = i === band ? target : roundPatrolCoordinate(lerp(start, target - (band - anchor) * gap, fraction) + distance);
      while (source + 1 < bottom && rows[source + 1][0] < newY) source++;
      const a = rows[source], b = rows[source + 1], t = (newY - a[0]) / (b[0] - a[0]);
      const interpolateX = (left: number, right: number) => {
        const value = lerp(left, right, t);
        return Math.sign(value) * roundPatrolCoordinate(Math.abs(value));
      };
      const row = [
        newY, lerp(a[1], b[1], t), interpolateX(a[2], b[2]), lerp(a[3], b[3], t),
        interpolateX(a[4] ?? a[1], b[4] ?? b[1]), interpolateX(a[5] ?? a[3], b[5] ?? b[3]),
      ] as const;
      next[i] = columns === 7 ? [...row, interpolateX(a[6]!, b[6]!), interpolateX(a[7]!, b[7]!)] : row;
    }

    // A straight segment between new rows can cut off a corner of the old
    // perimeter. Keep the original outline inside it, including at its bends.
    for (const [edge, direction] of [[1, -1], [3, 1]] as const) {
      const padding = new Float64Array(rows.length);
      let segment = top;
      for (let i = top + 1; i < bottom; i++) {
        while (next[segment + 1][0] < rows[i][0]) segment++;
        const a = next[segment], b = next[segment + 1];
        const t = (rows[i][0] - a[0]) / (b[0] - a[0]);
        const excess = (rows[i][edge] - lerp(a[edge], b[edge], t)) * direction;
        if (excess <= 0) continue;
        if (segment > top) padding[segment] = Math.max(padding[segment], excess / (segment + 1 === bottom ? 1 - t : 1));
        if (segment + 1 < bottom) padding[segment + 1] = Math.max(padding[segment + 1], excess / (segment === top ? t : 1));
      }
      for (let i = top + 1; i < bottom; i++) {
        const row = [...next[i]] as [...PatrolBand];
        // Round the rim outward to the usual editing grid.
        row[edge] = direction * Math.ceil((row[edge] * direction + padding[i]) * 10 - 1e-8) / 10;
        next[i] = row;
      }
    }
  }

  if (frame !== 0 || point !== Math.floor(columns / 2)) {
    const row = next[band], xs = patrolBandXs(row, gutter);
    // Clamp to the column order in the new row. The art bounds also keep
    // a margin within reach of the source canvas.
    const halfWidth = patrolSourceSpan(atlas) / 2;
    const min = Math.min(xs[point], Math.ceil(Math.max(-halfWidth, (xs[point - 1] ?? -Infinity) + .2) * 10) / 10);
    const max = Math.max(xs[point], Math.floor(Math.min(halfWidth, (xs[point + 1] ?? Infinity) - .2) * 10) / 10);
    const value = Math.max(min, Math.min(max, roundPatrolCoordinate(x)));
    if (Math.abs(value - xs[point]) > .0001) next[band] = replaceBandPoint(atlas, row, frame, point, value);
  }
  return next.every((row, i) => row === rows[i]) ? rows : next;
}
