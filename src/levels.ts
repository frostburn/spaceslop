import {VENT_DURATION} from './vent-layout';
import { IO_DURATION } from './io-layout';
import { TITAN_DURATION } from './titan-layout';
import { ICE_DURATION } from './ice-layout';

export const levels = {
  vents: { name: 'Hadal · Hydrothermal vents', sector: 'HADAL', boss: 'RIM GUARDIAN · PROTOTYPE', duration: VENT_DURATION },
  io: { name: 'Io · Caldera', sector: 'IO', boss: 'CALDERA ENGINE', duration: IO_DURATION },
  titan: { name: 'Titan · Research station', sector: 'TITAN', boss: 'TITAN CICADA', duration: TITAN_DURATION },
  ice: { name: 'Frostwake · Ice field', sector: 'FROSTWAKE', boss: 'LEVIATHAN', duration: ICE_DURATION },
  preserve: { name: 'Overgrown preserve', sector: 'SECTOR 01', boss: 'INTERCEPTOR', duration: 14 },
  broodlock: { name: 'Broodlock · Ant hive', sector: 'BROODLOCK', boss: 'BROOD GUARDIAN', duration: 28 },
} as const;

export type LevelId = keyof typeof levels;

export function readLevel(value: string | null): LevelId {
  return value !== null && Object.hasOwn(levels, value) ? value as LevelId : 'ice';
}
