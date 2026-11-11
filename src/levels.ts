export const levels = {
  den: { name: 'Draconian Den · Cliffside', sector: 'DRACONIAN DEN', boss: 'THE GANTRY CHIEF', duration: 100 },
  biolume:{name:'Lantern Grove · Bioluminescence',sector:'LANTERN GROVE',boss:'LANTERN RAY',duration:100},
  summer:{name:'Summer Ice Age · Thaw',sector:'SUMMER THAW',boss:'LOTUS HYDRA',duration:100},
  heliostat: {name:'Uranus · Heliostat',sector:'HELIOSTAT',boss:'SUNSPOT REGULATOR',duration:100},
  boulevard: {name:'Synthwave · Boulevard',sector:'BOULEVARD',boss:'PURSUIT CRUISER',duration:100},
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
