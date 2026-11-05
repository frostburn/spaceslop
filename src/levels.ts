export const levels = {
  preserve: { name: 'Overgrown preserve', sector: 'SECTOR 01', boss: 'INTERCEPTOR', duration: 14 },
  broodlock: { name: 'Broodlock · Ant hive', sector: 'BROODLOCK', boss: 'BROOD GUARDIAN', duration: 28 },
} as const;

export type LevelId = keyof typeof levels;

export function readLevel(value: string | null): LevelId {
  return value === 'preserve' ? 'preserve' : 'broodlock';
}
