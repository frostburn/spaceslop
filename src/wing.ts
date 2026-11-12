export const WING_FORMATION = { x: 1.22, y: 0.32 };
export const WING_FLASH_TIME = 0.14;

export const wingWeapons = {
  homing: { name: 'Homing Cannon', short: 'Homing', color: 0xc4ed74 },
  cannon: { name: 'Standard Cannon', short: 'Cannon', color: 0x77caff },
  laser: { name: 'Continuous Laser', short: 'Laser', color: 0xff86d6 },
  omega: { name: 'Omega Cannon', short: 'Omega', color: 0xffe687 },
} as const;

export type WingWeapon = keyof typeof wingWeapons;
export type WingProjectile = Exclude<WingWeapon, 'laser'>;
export type WingSide = -1 | 1;

export function readWingWeapon(value: string): WingWeapon | undefined {
  return Object.hasOwn(wingWeapons, value) ? value as WingWeapon : undefined;
}

export function wingRewardForWave(cycle: readonly [WingWeapon, ...WingWeapon[]], index: number) {
  // The opening four rewards can fill both wings, upgrade one, and unlock Towline.
  return cycle[index === 2 || index === 3 ? 0 : index % cycle.length];
}
