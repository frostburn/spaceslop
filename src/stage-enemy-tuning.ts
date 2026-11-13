import type { LevelId } from './levels';

const single = [0];
const pair = [-.12, .12];
const fan = [-.18, 0, .18];

type StageEnemyTuning = {
  pace: number;
  cadence: number;
  shotSpeed: number;
  spread: readonly number[];
  wingmanSpread?: readonly number[];
};

// Values belong to the level, so Campaign and Free Flight use the same encounters.
// Cadence multiplies the time between volleys. Mobile patrols run on their own
// faster clock, while set pieces and scenery stay registered to mission time.
export const stageEnemyTuning = {
  broodlock: { pace: 1, cadence: 1, shotSpeed: 1, spread: single },
  io:        { pace: 1.03, cadence: .94, shotSpeed: 1.02, spread: single },
  vents:     { pace: 1.06, cadence: .90, shotSpeed: 1.04, spread: single },
  titan:     { pace: 1.10, cadence: .84, shotSpeed: 1.06, spread: single, wingmanSpread: pair },
  heliostat: { pace: 1.13, cadence: .78, shotSpeed: 1.07, spread: pair },
  ice:       { pace: 1.16, cadence: .74, shotSpeed: 1.10, spread: pair },
  preserve:  { pace: 1.18, cadence: .72, shotSpeed: 1.11, spread: pair },
  summer:    { pace: 1.21, cadence: .69, shotSpeed: 1.13, spread: pair },
  boulevard: { pace: 1.24, cadence: .66, shotSpeed: 1.15, spread: pair, wingmanSpread: fan },
  biolume:   { pace: 1.27, cadence: .62, shotSpeed: 1.18, spread: pair },
  fleet:     { pace: 1.32, cadence: .57, shotSpeed: 1.20, spread: fan },
  den:       { pace: 1.40, cadence: .52, shotSpeed: 1.27, spread: fan },
} satisfies Record<Exclude<LevelId, 'wormhole'>, StageEnemyTuning>;
