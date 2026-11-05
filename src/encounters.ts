export const BOSS_MUZZLE_Z = 0.8;
export const BOSS_RECOIL_TIME = 0.24;
export const BOSS_VOLLEY_INTERVAL = 2;
export const BOSS_WINDUP_AT = 0.45;
export const BOSS_FIRE_AT = 1.18;

export const RAPTOR_FOLD_AT = 1.2;
export const RAPTOR_DIVE_AT = 1.72;
export const RAPTOR_FLARE_AT = 2.92;
export const RAPTOR_FLARE_END = 3.42;

export function raptorFlight(age: number) {
  if (age < RAPTOR_FOLD_AT) return { pose: 'glide', speed: 2.25, progress: age / RAPTOR_FOLD_AT } as const;
  if (age < RAPTOR_DIVE_AT) return {
    pose: 'fold', speed: 0.7, progress: (age - RAPTOR_FOLD_AT) / (RAPTOR_DIVE_AT - RAPTOR_FOLD_AT),
  } as const;
  if (age < RAPTOR_FLARE_AT) return {
    pose: 'dive', speed: 8.8, progress: (age - RAPTOR_DIVE_AT) / (RAPTOR_FLARE_AT - RAPTOR_DIVE_AT),
  } as const;
  return {
    pose: 'flare', speed: 3.6, progress: Math.min(1, (age - RAPTOR_FLARE_AT) / (RAPTOR_FLARE_END - RAPTOR_FLARE_AT)),
  } as const;
}
