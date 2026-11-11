import { loadScrollPlate, plateSlice as slice, PLATE_GUTTER } from '../rendering/scroll-plate';
import { GROVE_SCREENS } from './route';

export { PLATE_GUTTER };
export function plateSlice(width: number, height: number, index: number) {
  return slice(width, height, index, GROVE_SCREENS);
}

export function loadGrovePlate(name: 'biolumeBackdrop' | 'biolumeForeground', signal: AbortSignal) {
  return loadScrollPlate(name, GROVE_SCREENS, signal);
}
