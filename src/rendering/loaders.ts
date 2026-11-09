import type { LevelId } from '../levels';
import type { LevelFactory } from './level';
export const levelLoaders: Record<LevelId, () => Promise<{
  createLevel: LevelFactory;
}>> = {
  boulevard: () => import('./levels/boulevard'),
  preserve: () => import('./levels/preserve'),
  broodlock: () => import('./levels/broodlock'),
  ice: () => import('./levels/ice'),
  titan: () => import('./levels/titan'),
  io: () => import('./levels/io'),
  vents: () => import('./levels/vents'),
};
