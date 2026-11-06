import type { LevelId } from '../levels';
const cacheName = 'spaceslop-runtime-v1';
interface Package {
  required: string[];
  media: string[];
}
export async function saveLevelOffline(level: LevelId, signal: AbortSignal) {
  if (import.meta.env.DEV || !('serviceWorker' in navigator) || !('caches' in window))
    return false;
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'level-packages.json', { signal });
    if (!response.ok)
      return false;
    const packages = await response.json() as {
      version: number;
      levels: Record<LevelId, Package>;
    };
    if (packages.version !== 1 || signal.aborted)
      return false;
    const cache = await caches.open(cacheName);
    const pack = packages.levels[level];
    async function save(path: string) {
      if (signal.aborted)
        throw new DOMException('Cancelled', 'AbortError');
      const url = new URL(import.meta.env.BASE_URL + path, location.href).href;
      if (await cache.match(url))
        return;
      const result = await fetch(url, { signal });
      if (!result.ok)
        throw Error('Unavailable offline file');
      await cache.put(url, result);
    }
    await Promise.all(pack.required.map(save));
    // Media is optional: a failed image must preserve the procedural fallback.
    await Promise.allSettled(pack.media.map(save));
    return !signal.aborted;
  }
  catch {
    return false;
  }
}
export async function savedLevels(): Promise<LevelId[]> {
  if (import.meta.env.DEV || !('caches' in window))
    return [];
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'level-packages.json');
    if (!response.ok)
      return [];
    const packages = await response.json() as {
      version: number;
      levels: Record<LevelId, Package>;
    };
    if (packages.version !== 1)
      return [];
    const cache = await caches.open(cacheName);
    const ready: LevelId[] = [];
    for (const [id, pack] of Object.entries(packages.levels)) {
      const present = await Promise.all(pack.required.map(path => cache.match(new URL(import.meta.env.BASE_URL + path, location.href).href)));
      if (present.every(Boolean))
        ready.push(id as LevelId);
    }
    return ready;
  }
  catch {
    return [];
  }
}
export async function clearSavedLevels() {
  try {
    if ('caches' in window)
      await caches.delete(cacheName);
    return true;
  }
  catch {
    return false;
  }
}
