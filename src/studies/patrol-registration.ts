import { patrolBandAngle, patrolBandXs, patrolPointY, type createPatrolWarpCard, type PatrolAtlas, type PatrolBand } from '../den/patrol-warp';

export type PatrolBands = readonly (readonly PatrolBand[])[];
export type PatrolLocks = readonly ReadonlySet<number>[];
export const roundPatrolCoordinate = (value: number) => Math.round(value * 10) / 10;
export const patrolSourceSpan = (atlas: PatrolAtlas) => atlas.width === atlas.height ? 336 : 570;

export function pointLimits(atlas: PatrolAtlas, row: PatrolBand, point: number) {
  const x = patrolBandXs(row, atlas.gutter)[point], half = patrolSourceSpan(atlas) / 2;
  return [Math.min(x, -half), Math.max(x, half)] as const;
}

export function pointYLimits(atlas: PatrolAtlas, rows: readonly PatrolBand[], band: number, point: number) {
  const y = patrolPointY(rows[band], point), half = patrolSourceSpan(atlas) / 2;
  if (band === 0 || band === rows.length - 1) return [y, y] as const;
  if (point === 0 || point === atlas.grid.columns - 1) {
    return [roundPatrolCoordinate(patrolPointY(rows[band - 1], point) + .2),
      roundPatrolCoordinate(patrolPointY(rows[band + 1], point) - .2)] as const;
  }
  return [Math.min(y, -half), Math.max(y, half)] as const;
}

export function bandLimits(atlas: PatrolAtlas, rows: readonly PatrolBand[], frame: number, band: number) {
  const original = atlas.rows[frame][band][0], row = rows[band];
  const points = [0, atlas.grid.columns - 1];
  const lower = rows[band - 1], upper = rows[band + 1];
  const min = lower ? Math.max(lower[0], ...points.map(point => patrolPointY(lower, point) - (row[8]?.[point] ?? 0))) + .2 : original - 18;
  const max = upper ? Math.min(upper[0], ...points.map(point => patrolPointY(upper, point) - (row[8]?.[point] ?? 0))) - .2 : original + 18;
  return [roundPatrolCoordinate(Math.min(row[0], min)), roundPatrolCoordinate(Math.max(row[0], max))] as const;
}

function withPointOffsets(row: PatrolBand, offsets: readonly number[]): PatrolBand {
  if (!offsets.some(Boolean) && row[8] === undefined) return row;
  if (!offsets.some(Boolean)) {
    const [y, left, center, right, innerLeft, innerRight, detailLeft, detailRight] = row;
    const flat = [y, left, center, right, innerLeft, innerRight] as const;
    return detailLeft == null || detailRight == null ? flat : [...flat, detailLeft, detailRight];
  }
  const [y, left, center, right, innerLeft, innerRight, detailLeft, detailRight] = row;
  return [y, left, center, right, innerLeft, innerRight, detailLeft ?? null, detailRight ?? null, offsets];
}

export function replaceBandPoint(
  atlas: PatrolAtlas, row: PatrolBand, frame: number, point: number, x: number, y = patrolPointY(row, point),
): PatrolBand {
  const xs = patrolBandXs(row, atlas.gutter), { columns } = atlas.grid, center = Math.floor(columns / 2);
  const offsets = Array.from({ length: columns }, (_, i) => row[8]?.[i] ?? 0);
  offsets[point] = roundPatrolCoordinate(y - row[0]);
  xs[point] = frame === 0 && point === center ? 0 : x;
  if (frame === 0) {
    xs[columns - 1 - point] = -xs[point];
    offsets[columns - 1 - point] = offsets[point];
  }
  const next = [row[0], roundPatrolCoordinate(xs[0] + atlas.gutter), xs[center],
    roundPatrolCoordinate(xs[columns - 1] - atlas.gutter), xs[center - 1], xs[center + 1]] as const;
  return withPointOffsets(columns === 7 ? [...next, xs[1], xs[5]] : next, offsets);
}

export function dragPatrolPoint(
  atlas: PatrolAtlas, rows: readonly PatrolBand[], frame: number, band: number, point: number, x: number, y: number,
): readonly PatrolBand[] {
  const row = rows[band];
  const [minX, maxX] = pointLimits(atlas, row, point), [minY, maxY] = pointYLimits(atlas, rows, band, point);
  const nextX = frame === 0 && point === Math.floor(atlas.grid.columns / 2) ? 0 : Math.max(minX, Math.min(maxX, roundPatrolCoordinate(x)));
  const nextY = Math.max(minY, Math.min(maxY, roundPatrolCoordinate(y)));
  if (nextX === patrolBandXs(row, atlas.gutter)[point] && Math.abs(nextY - patrolPointY(row, point)) < .001) return rows;
  const next = [...rows];
  next[band] = replaceBandPoint(atlas, row, frame, point, nextX, nextY);
  return next;
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
  const rimColumns = [0, atlas.grid.columns - 1];
  const originalRims = rimColumns.map(point => patrolRim(atlas, original, point));
  const room = originalRims.map((rim, side) => Float32Array.from(samples, ({ x, y }) =>
    Math.min(.35, (x - rimXAt(rim, y)) * (side === 0 ? 1 : -1))));

  return (rows: readonly PatrolBand[], changedBand: number) => rimColumns.every((point, side) => {
    const rim = patrolRim(atlas, rows, point), sign = side === 0 ? 1 : -1;
    if (!rim.every((p, i) => i === 0 || p.y > rim[i - 1].y)) return false;
    const first = rim[Math.max(0, changedBand - 1)].y;
    const last = rim[Math.min(rows.length - 1, changedBand + 1)].y;
    for (let i = 0; i < samples.length; i++) {
      const { x, y } = samples[i];
      if (y < first) continue;
      if (y >= last) break;
      if ((x - rimXAt(rim, y)) * sign < room[side][i] - .0001) return false;
    }
    return true;
  });
}

function patrolRim(atlas: PatrolAtlas, rows: readonly PatrolBand[], point: number) {
  const left = point === 0;
  return rows.map(row => ({ x: left ? row[1] - atlas.gutter : row[3] + atlas.gutter, y: patrolPointY(row, point) }));
}

function rimXAt(rim: readonly { x: number; y: number }[], y: number) {
  let lo = 0, hi = rim.length - 1;
  while (hi - lo > 1) {
    const mid = (hi + lo) >> 1;
    if (rim[mid].y <= y) lo = mid;
    else hi = mid;
  }
  const a = rim[lo], b = rim[hi], t = (y - a.y) / (b.y - a.y);
  return a.x + (b.x - a.x) * t;
}

// Each pose uses ordered bands. For a long drag, redistribute the bands between
// the nearest pinned rows and resample their columns at the new heights.
export function dragPatrolBand(
  atlas: PatrolAtlas, rows: readonly PatrolBand[], locks: ReadonlySet<number>,
  frame: number, band: number, point: number, x: number, y: number,
): readonly PatrolBand[] {
  const { columns } = atlas.grid, last = rows.length - 1;
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

    function remapY(y: number) {
      let i = top;
      while (i + 1 < bottom && rows[i + 1][0] < y) i++;
      const t = (y - rows[i][0]) / (rows[i + 1][0] - rows[i][0]);
      return lerp(next[i][0], next[i + 1][0], t);
    }
    for (let i = top + 1; i < bottom; i++) {
      const offsets = rows[i][8];
      if (offsets) next[i] = withPointOffsets(next[i], offsets.map((_, point) =>
        roundPatrolCoordinate(remapY(patrolPointY(rows[i], point)) - next[i][0])));
    }

    // A straight segment between new rows can cut off a corner of the old
    // perimeter. Keep the original outline inside it, including at its bends.
    for (const [edge, direction] of [[1, -1], [3, 1]] as const) {
      const padding = new Float64Array(rows.length);
      const point = edge === 1 ? 0 : columns - 1;
      const rim = patrolRim(atlas, next, point);
      if (!rim.every((p, i) => i === 0 || p.y > rim[i - 1].y)) return rows;
      let segment = top;
      for (let i = top + 1; i < bottom; i++) {
        const y = patrolPointY(rows[i], point);
        while (rim[segment + 1].y < y) segment++;
        const a = rim[segment], b = rim[segment + 1];
        const t = (y - a.y) / (b.y - a.y);
        const excess = (rows[i][edge] - lerp(next[segment][edge], next[segment + 1][edge], t)) * direction;
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

  const moved = dragPatrolPoint(atlas, next, frame, band, point, x, patrolPointY(next[band], point));
  return moved.every((row, i) => row === rows[i]) ? rows : moved;
}
