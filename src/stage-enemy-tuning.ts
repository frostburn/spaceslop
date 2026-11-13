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
  io:        { pace: 1.04, cadence: .92, shotSpeed: 1.02, spread: single },
  vents:     { pace: 1.08, cadence: .87, shotSpeed: 1.05, spread: single },
  titan:     { pace: 1.12, cadence: .80, shotSpeed: 1.07, spread: single, wingmanSpread: pair },
  heliostat: { pace: 1.16, cadence: .73, shotSpeed: 1.09, spread: pair },
  ice:       { pace: 1.20, cadence: .68, shotSpeed: 1.12, spread: pair },
  preserve:  { pace: 1.23, cadence: .65, shotSpeed: 1.14, spread: pair },
  summer:    { pace: 1.26, cadence: .61, shotSpeed: 1.16, spread: pair },
  boulevard: { pace: 1.30, cadence: .57, shotSpeed: 1.19, spread: pair, wingmanSpread: fan },
  biolume:   { pace: 1.34, cadence: .53, shotSpeed: 1.22, spread: pair },
  fleet:     { pace: 1.40, cadence: .46, shotSpeed: 1.25, spread: fan },
  den:       { pace: 1.50, cadence: .40, shotSpeed: 1.34, spread: fan },
} satisfies Record<Exclude<LevelId, 'wormhole'>, StageEnemyTuning>;
