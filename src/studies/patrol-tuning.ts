import * as T from 'three';
import {
  createPatrolWarpCard, PATROL_GRID_SIZE, PATROL_VERTEX_COUNT, patrolInteriorIndex, patrolMirrorPoint,
  type PatrolAtlas, type PatrolRegistration,
} from '../den/patrol-warp';
import { createPatrolDifference } from './patrol-difference';
import { meshFoldsNear, movePatrolPoint, type PatrolLocks } from './patrol-registration';

type Target = { frame: number; point: number; axis: 0 | 1; distance: number };

export async function tunePatrolHandoff({
  renderer, camera, texture, atlas, initial, locks, first, selectedPoint, wholeHandoff, signal, onProgress,
}: {
  renderer: T.WebGLRenderer;
  camera: T.Camera;
  texture: T.Texture;
  atlas: PatrolAtlas;
  initial: PatrolRegistration;
  locks: PatrolLocks;
  first: number;
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
  for (const frame of [first, first + 1]) {
    for (let point = 0; point < PATROL_VERTEX_COUNT; point++) {
      if (patrolInteriorIndex(point) < 0 || locks[frame].has(point)) continue;
      const mirror = patrolMirrorPoint(point);
      if (frame === 0 && point > mirror) continue;
      const distance = frame === 0 ? Math.min(distanceFrom(point), distanceFrom(mirror)) : distanceFrom(point);
      if (wholeHandoff || distance <= 1) {
        targets.push({ frame, point, axis: 0, distance }, { frame, point, axis: 1, distance });
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
  const headings = [-.67, -.33, .33, .67].map(t => Math.sign(t) * (first + Math.abs(t)) * angle);
  const steps = [3, 1, .4];
  const total = targets.length * steps.length;
  let bestRegistration = initial, completed = 0;
  let lastYield = performance.now();
  const measure = () => difference.measure(i => card.pose(headings[i]));

  function nudge({ frame, point, axis }: Target, delta: number) {
    const interior = bestRegistration[frame];
    const [x, y] = interior[patrolInteriorIndex(point)];
    const next = axis === 0 ? movePatrolPoint(atlas, frame, interior, point, x + delta, y)
      : movePatrolPoint(atlas, frame, interior, point, x, y + delta);
    if (next === interior) return;
    const candidate = [...bestRegistration];
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
    onProgress(bestRegistration, before, best, completed, total);
    for (const step of steps) {
      for (const target of targets) {
        let winner = bestRegistration, winningScore = best;
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
        bestRegistration = winner;
        best = winningScore;
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
