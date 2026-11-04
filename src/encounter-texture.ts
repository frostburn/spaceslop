import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { setFeatherTexture, type createInterceptorRig } from './encounter-rigs';

type EncounterTexture = 'armor' | 'feathers' | 'scales' | 'preserve' | 'shipyard';
declare const __ENCOUNTER_TEXTURES__: Partial<Record<EncounterTexture, string>>;

export function loadEncounterTexture(
  name: EncounterTexture, apply: (texture: Texture) => void, repeat?: number,
) {
  const path = __ENCOUNTER_TEXTURES__[name];
  if (!path) return;
  new TextureLoader().load(import.meta.env.BASE_URL + path, (texture) => {
    texture.colorSpace = SRGBColorSpace;
    if (repeat !== undefined) {
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(repeat, repeat);
    }
    apply(texture);
  });
}

export function loadEncounterTextures(rig: ReturnType<typeof createInterceptorRig>) {
  loadEncounterTexture('armor', rig.setArmorTexture, 0.62);
  loadEncounterTexture('feathers', setFeatherTexture);
  loadEncounterTexture('scales', rig.setScaleTexture, 2);
}
