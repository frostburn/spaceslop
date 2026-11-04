import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { setFeatherTexture, type createInterceptorRig } from './encounter-rigs';

declare const __ENCOUNTER_TEXTURES__: Partial<Record<'armor' | 'feathers' | 'scales', string>>;

export function loadEncounterTextures(rig: ReturnType<typeof createInterceptorRig>) {
  const loader = new TextureLoader();

  function load(path: string | undefined, apply: (texture: Texture) => void, repeat?: number) {
    if (!path) return;
    loader.load(import.meta.env.BASE_URL + path, (texture) => {
      texture.colorSpace = SRGBColorSpace;
      if (repeat !== undefined) {
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.repeat.set(repeat, repeat);
      }
      apply(texture);
    });
  }

  load(__ENCOUNTER_TEXTURES__.armor, rig.setArmorTexture, 0.62);
  load(__ENCOUNTER_TEXTURES__.feathers, setFeatherTexture);
  load(__ENCOUNTER_TEXTURES__.scales, rig.setScaleTexture, 2);
}
