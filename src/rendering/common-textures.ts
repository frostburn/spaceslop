import type * as T from 'three';
import { loadEncounterTexture } from '../encounter-texture';
import { textureShipAlloy } from '../encounter-surfaces';
export async function loadCommonTextures(ships: readonly T.Group[], applyArmor?: (texture: T.Texture) => void, signal?: AbortSignal) {
  return [await loadEncounterTexture('armor', texture => {
    textureShipAlloy(texture, ships);
    applyArmor?.(texture);
  }, .55, signal)];
}
