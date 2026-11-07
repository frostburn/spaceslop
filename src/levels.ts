export const levels = {
  vents: { name: 'Hadal · Hydrothermal vents', sector: 'HADAL', boss: 'BARNACLE SOVEREIGN', duration: 100 },
  io: { name: 'Io · Caldera', sector: 'IO', boss: 'CALDERA ENGINE', duration: 100 },
  titan: { name: 'Titan · Research station', sector: 'TITAN', boss: 'TITAN CICADA', duration: 84 },
  ice: { name: 'Frostwake · Ice field', sector: 'FROSTWAKE', boss: 'LEVIATHAN', duration: 90 },
  preserve: { name: 'Orbital preserve', sector: 'SECTOR 01', boss: 'THE GROUNDSKEEPER', duration: 100 },
  broodlock: { name: 'Broodlock · Ant hive', sector: 'BROODLOCK', boss: 'BROOD GUARDIAN', duration: 28 },
} as const;

export type LevelId = keyof typeof levels;

export function readLevel(value: string | null): LevelId {
  return value !== null && Object.hasOwn(levels, value) ? value as LevelId : 'ice';
}
