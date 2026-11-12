import * as T from 'three';
import {
  createPatrolWarpCard, PATROL_GRID_SIZE, PATROL_VERTEX_COUNT, patrolGridPoint, patrolInteriorIndex, patrolMirrorPoint,
  type PatrolAtlas, type PatrolGridPair, type PatrolRegistration,
} from '../den/patrol-warp';
import { createPatrolDifference } from './patrol-difference';
import { movePatrolPoint, patrolGridStrain, type PatrolLocks } from './patrol-registration';

type Target = { side: 0 | 1; point: number; axis: 0 | 1; distance: number };

export async function tunePatrolHandoff({
  renderer, camera, texture, atlas, initial, locks, handoff, selectedPoint, wholeHandoff, signal, onProgress,
}: {
  renderer: T.WebGLRenderer;
  camera: T.Camera;
  texture: T.Texture;
  atlas: PatrolAtlas;
  initial: PatrolRegistration;
  locks: PatrolLocks;
  handoff: number;
  selectedPoint: number;
  wholeHandoff: boolean;
  signal: AbortSignal;
  onProgress: (registration: PatrolRegistration, before: number, best: number, completed: number, total: number) => void;
}) {
  const targets: Target[] = [];
  const distanceFrom = (point: number) => Math.max(
    Math.abs(point % PATROL_GRID_SIZE - selectedPoint % PATROL_GRID_SIZE),
    Math.abs(Math.floor(point / PATROL_GRID_SIZE) - Math.floor(selectedPoint / PATROL_GRID_SIZE)),
  );
  for (const side of [0, 1] as const) {
    const frame = handoff + side;
    for (let point = 0; point < PATROL_VERTEX_COUNT; point++) {
      if (patrolInteriorIndex(point) < 0 || locks[side].has(point)) continue;
      const mirror = patrolMirrorPoint(point);
      if (frame === 0 && point > mirror) continue;
      const distance = frame === 0 ? Math.min(distanceFrom(point), distanceFrom(mirror)) : distanceFrom(point);
      if (wholeHandoff || distance <= 1) {
        targets.push({ side, point, axis: 0, distance }, { side, point, axis: 1, distance });
      }
    }
  }
  targets.sort((a, b) => a.distance - b.distance);
  if (!targets.length) return;

  const card = createPatrolWarpCard();
  const scene = new T.Scene();
  scene.add(card.root);
  const difference = createPatrolDifference(renderer, scene, camera, card.root, 2);
  const last = atlas.crops.length - 1;
  const angle = Math.PI / 2 / last;
  const headings = [-.67, -.33, .33, .67].map(t => Math.sign(t) * (handoff + Math.abs(t)) * angle);
  const steps = [3, 1, .4];
  const total = targets.length * steps.length;
  let bestRegistration = initial, completed = 0;
  let lastYield = performance.now();
  const measure = () => difference.measure(i => card.pose(headings[i]));

  // Score is in percentage points. Penalize stretching and shearing the
  // source grids, while still requiring an improvement in the visible match.
  const penalty = (grids: PatrolGridPair) => .8 * (
    patrolGridStrain(atlas, handoff, grids[0]) + patrolGridStrain(atlas, handoff + 1, grids[1])
  );

  function nudge({ side, point, axis }: Target, delta: number) {
    const frame = handoff + side, grids = bestRegistration[handoff], interior = grids[side];
    const [x, y] = patrolGridPoint(atlas.crops[frame], interior, point);
    const next = axis === 0 ? movePatrolPoint(atlas, frame, interior, point, x + delta, y)
      : movePatrolPoint(atlas, frame, interior, point, x, y + delta);
    if (next === interior) return;
    const candidate = [...bestRegistration];
    candidate[handoff] = side === 0 ? [next, grids[1]] : [grids[0], next];
    try {
      card.setRegistration(atlas, candidate);
      return candidate;
    } catch {
      // The proposal may fold a triangle during this handoff.
      return;
    }
  }

  try {
    card.setArt(texture);
    card.setRegistration(atlas, initial);
    const before = await measure();
    if (before === undefined) throw new Error('No sprite pixels in this handoff');
    let best = before, objective = before - penalty(initial[handoff]);
    if (signal.aborted) return;
    onProgress(bestRegistration, before, best, completed, total);
    for (const step of steps) {
      for (const target of targets) {
        let winner = bestRegistration, winningScore = best, winningObjective = objective;
        for (const delta of [-step, step]) {
          if (signal.aborted) return;
          const candidate = nudge(target, delta);
          if (!candidate) continue;
          const score = await measure();
          if (signal.aborted) return;
          if (score === undefined || score <= best + .001) continue;
          const adjusted = score - penalty(candidate[handoff]);
          if (adjusted > winningObjective + .001) {
            winner = candidate;
            winningScore = score;
            winningObjective = adjusted;
          }
        }
        bestRegistration = winner;
        best = winningScore;
        objective = winningObjective;
        onProgress(bestRegistration, before, best, ++completed, total);
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
