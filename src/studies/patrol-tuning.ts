import * as T from 'three';
import { createPatrolWarpCard, patrolBandXs, type PatrolAtlas } from '../den/patrol-warp';
import { createPatrolDifference } from './patrol-difference';
import {
  bandHasLock, bandLimits, meshFoldsNear, pointLimits, preservePatrolSilhouette, replaceBandPoint, roundPatrolCoordinate,
  type PatrolBands, type PatrolLocks,
} from './patrol-registration';

type Target = { frame: number; band: number; point?: number };

export async function tunePatrolHandoff({
  renderer, camera, texture, atlas, initial, locks, first, selectedBand, wholeHandoff, signal, onProgress,
}: {
  renderer: T.WebGLRenderer;
  camera: T.Camera;
  texture: T.Texture;
  atlas: PatrolAtlas;
  initial: PatrolBands;
  locks: PatrolLocks;
  first: number;
  selectedBand: number;
  wholeHandoff: boolean;
  signal: AbortSignal;
  onProgress: (bands: PatrolBands, before: number, best: number, completed: number, total: number) => void;
}) {
  const { columns } = atlas.grid, center = Math.floor(columns / 2);
  const frames = [first, first + 1];
  const targets: Target[] = [];
  for (const frame of frames) {
    for (const [band] of initial[frame].entries()) {
      if (!wholeHandoff && Math.abs(band - selectedBand) > 2) continue;
      const end = frame === 0 ? center : columns;
      for (let point = 0; point < end; point++) {
        if (!locks[frame].has(band * columns + point)) targets.push({ frame, band, point });
      }
      if (band > 0 && band < initial[frame].length - 1 && !bandHasLock(locks[frame], columns, band)) {
        targets.push({ frame, band });
      }
    }
  }
  targets.sort((a, b) => Math.abs(a.band - selectedBand) - Math.abs(b.band - selectedBand));
  if (!targets.length) return;

  const image = texture.image as HTMLImageElement;
  const guards = frames.map(frame => preservePatrolSilhouette(image, atlas, frame, initial[frame]));
  const card = createPatrolWarpCard();
  const scene = new T.Scene();
  scene.add(card.root);
  const difference = createPatrolDifference(renderer, scene, camera, card.root, 2);
  const last = atlas.rows.length - 1;
  const angle = Math.PI / 2 / last;
  const headings = [-.67, -.33, .33, .67].map(t => Math.sign(t) * (first + Math.abs(t)) * angle);
  const steps = [3, 1, .4];
  const total = targets.length * steps.length;
  let bestBands = initial, completed = 0;
  let lastYield = performance.now();
  const measure = () => difference.measure(i => card.pose(headings[i]));

  function nudge({ frame, band, point }: Target, delta: number) {
    const rows = bestBands[frame], row = rows[band];
    const value = point === undefined ? row[0] : patrolBandXs(row, atlas.gutter)[point];
    const [min, max] = point === undefined ? bandLimits(atlas, rows, frame, band) : pointLimits(atlas, row, frame, band, point);
    const nextValue = T.MathUtils.clamp(roundPatrolCoordinate(value + delta), min, max);
    if (Math.abs(nextValue - value) < .001) return;
    const next = [...rows];
    const [, ...rest] = row;
    next[band] = point === undefined ? [nextValue, ...rest]
      : replaceBandPoint(atlas, row, frame, point, nextValue);
    if ((point === undefined || point === 0 || point === columns - 1) && !guards[frame - first](next, band)) return;
    const candidate = [...bestBands];
    candidate[frame] = next;
    try {
      card.setRegistration(atlas, candidate);
    } catch {
      // A proposal can move a hardpoint outside the mesh.
      return;
    }
    if (!meshFoldsNear(card, frame, last)) return candidate;
  }

  try {
    card.setArt(texture);
    card.setRegistration(atlas, initial);
    const before = await measure();
    if (before === undefined) throw new Error('No sprite pixels in this handoff');
    let best = before;
    if (signal.aborted) return;
    onProgress(bestBands, before, best, completed, total);
    for (const step of steps) {
      for (const target of targets) {
        let winner = bestBands, winningScore = best;
        for (const delta of [-step, step]) {
          if (signal.aborted) return;
          const candidate = nudge(target, delta);
          if (!candidate) continue;
          const score = await measure();
          if (signal.aborted) return;
          if (score !== undefined && score > winningScore + .001) {
            winner = candidate;
            winningScore = score;
          }
        }
        bestBands = winner;
        best = winningScore;
        onProgress(bestBands, before, best, ++completed, total);
        if (performance.now() - lastYield >= 16) {
          await new Promise(resolve => setTimeout(resolve, 0));
          lastYield = performance.now();
        }
      }
    }
  } finally {
    difference.dispose();
    card.root.geometry.dispose();
    card.root.material.dispose();
  }
}
