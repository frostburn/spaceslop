import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import type { EncounterTexture } from './assets/catalog';
declare const __ENCOUNTER_TEXTURES__: Partial<Record<EncounterTexture, string>>;

export function encounterTextureUrl(name: EncounterTexture) {
  const path = __ENCOUNTER_TEXTURES__[name];
  return path ? import.meta.env.BASE_URL + path : undefined;
}

export async function loadEncounterTexture(
  name: EncounterTexture, apply: (texture: Texture) => void, repeat?: number, signal?: AbortSignal,
) {
  const url = encounterTextureUrl(name);
  if (!url || signal?.aborted) return;
  return new Promise<Texture | undefined>((resolve) => {
    let pending = true;
    const finish = (texture?: Texture) => {
      if (!pending) return;
      pending = false;
      clearTimeout(deadline);
      signal?.removeEventListener('abort', cancel);
      resolve(texture);
    };
    const cancel = () => finish();
    const deadline = window.setTimeout(cancel, 2500);
    signal?.addEventListener('abort', cancel, { once: true });
    new TextureLoader().load(url, (texture) => {
      if (!pending || signal?.aborted) { texture.dispose(); return; }
      texture.colorSpace = SRGBColorSpace;
      if (repeat !== undefined) {
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.repeat.set(repeat, repeat);
      }
      try { apply(texture); finish(texture); }
      catch { texture.dispose(); finish(); }
    }, undefined, cancel);
  });
}
