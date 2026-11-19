import type { LevelId } from '../levels';
import type { FlightMode } from './challenges';

const sessionBests = new Map<string, number>();
const keyFor = (level: LevelId, mode: FlightMode) => `spaceslop.sector-best.${mode}.${level}`;
export const formatScore = (score: number) => String(score).padStart(6, '0');

export function sectorBest(level: LevelId, mode: FlightMode) {
  const key = keyFor(level, mode);
  let best = sessionBests.get(key);
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null && /^\d+$/.test(raw)) {
      const saved = Number(raw);
      if (Number.isSafeInteger(saved) && (best === undefined || saved > best)) {
        best = saved;
        sessionBests.set(key, saved);
      }
    }
  } catch { /* Records still work for this tab when storage is unavailable. */ }
  return best;
}

/** Return the score this clear was competing against, including clears in other tabs. */
export async function recordSectorClear(level: LevelId, mode: FlightMode, score: number) {
  const key = keyFor(level, mode);
  function save() {
    const previous = sectorBest(level, mode);
    const best = Math.max(previous ?? 0, score);
    sessionBests.set(key, best);
    try { localStorage.setItem(key, String(best)); } catch { /* Keep the in-session record. */ }
    return previous;
  }
  try {
    if (globalThis.navigator?.locks) return await navigator.locks.request(key, save);
  } catch { /* Storage-restricted contexts can also deny locks. */ }
  return save();
}
