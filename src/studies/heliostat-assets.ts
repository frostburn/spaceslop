import * as T from 'three';
import type { StudyTexture } from '../assets/catalog';

declare const __STUDY_TEXTURES__: Partial<Record<StudyTexture, string>>;
export type StudyArt = Partial<Record<StudyTexture, T.Texture>>;

export async function loadStudyArt(signal: AbortSignal): Promise<StudyArt> {
  const art: StudyArt = {};
  await Promise.all(Object.entries(__STUDY_TEXTURES__).filter(([name])=>name.startsWith('heliostat')).map(async ([name, path]) => {
    const texture = await loadStudyTexture(import.meta.env.BASE_URL + path, signal);
    if (texture) art[name as StudyTexture] = texture;
  }));
  // Abort may arrive after an earlier image succeeded but before the others settle.
  if (signal.aborted) { for (const texture of Object.values(art)) texture.dispose(); return {}; }
  return art;
}

export function loadStudyTexture(url: string, signal: AbortSignal): Promise<T.Texture | undefined> {
  if (signal.aborted) return Promise.resolve(undefined);
  return new Promise(resolve => {
    let pending = true;
    const finish = (texture?: T.Texture) => {
      if (!pending) return;
      pending = false; window.clearTimeout(deadline);
      signal.removeEventListener('abort', cancel); resolve(texture);
    };
    const cancel = () => finish();
    const deadline = window.setTimeout(cancel, 2500);
    signal.addEventListener('abort', cancel, { once: true });
    new T.TextureLoader().load(url, texture => {
      if (!pending || signal.aborted) { texture.dispose(); return; }
      texture.colorSpace = T.SRGBColorSpace;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.anisotropy = 4;
      finish(texture);
    }, undefined, cancel);
  });
}
