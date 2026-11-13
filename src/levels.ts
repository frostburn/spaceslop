export const levels = {
  wormhole: { name: 'The Return Channel · Wormhole', sector: 'WORMHOLE', boss: 'FONS INVERSUS', duration: 7 },
  fleet: { name: 'The Broken Exchange', sector: 'FLEET CLASH', boss: 'GRAY COMMAND SAUCER', duration: 98 },
  den: { name: 'The Last Gantry · Sagittarius A*', sector: 'DRACONIAN DEN', boss: 'THE GANTRY CHIEF', duration: 100 },
  biolume: { name: 'Lantern Grove', sector: 'LANTERN GROVE', boss: 'LANTERN RAY', duration: 100 },
  summer: { name: 'Lotus Thaw', sector: 'LOTUS THAW', boss: 'LOTUS HYDRA', duration: 100 },
  heliostat: { name: 'Heliostat Gate · Uranus', sector: 'HELIOSTAT', boss: 'SUNSPOT REGULATOR', duration: 100 },
  boulevard: { name: 'Last Exit Boulevard', sector: 'BOULEVARD', boss: 'PURSUIT CRUISER', duration: 100 },
  vents: { name: 'Hadal Cable · Europa', sector: 'EUROPA', boss: 'BARNACLE SOVEREIGN', duration: 100 },
  io: { name: 'Sulfur Shift · Io', sector: 'IO', boss: 'CALDERA ENGINE', duration: 100 },
  titan: { name: 'Last Weather Report · Titan', sector: 'TITAN', boss: 'TITAN CICADA', duration: 84 },
  ice: { name: 'Frostwake Salvage', sector: 'FROSTWAKE', boss: 'LEVIATHAN', duration: 90 },
  preserve: { name: 'The Greenhouse Ark', sector: 'GREENHOUSE ARK', boss: 'THE GROUNDSKEEPER', duration: 100 },
  broodlock: { name: 'Broodlock Quarantine', sector: 'BROODLOCK', boss: 'BROOD GUARDIAN', duration: 28 },
} as const;

export type LevelId = keyof typeof levels;

export function readLevel(value: string | null): LevelId {
  return value !== null && Object.hasOwn(levels, value) ? value as LevelId : 'ice';
}
