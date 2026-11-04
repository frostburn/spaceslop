import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { setFaceTexture } from './creature-faces';
import { setFeatherTexture, type createInterceptorRig, type createRaptorRig } from './encounter-rigs';

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

export function loadEncounterTextures(boss: ReturnType<typeof createInterceptorRig>, raptor: ReturnType<typeof createRaptorRig>) {
  loadEncounterTexture('armor', boss.setArmorTexture, 0.55);
  loadEncounterTexture('feathers', setFeatherTexture);
  loadEncounterTexture('scales', (texture) => {
    // Use a larger scale pattern on screen and keep both UV edges inside the painted image.
    texture.repeat.set(0.62, 0.68);
    texture.offset.set(0.19, 0.16);
    setFaceTexture(texture);
    boss.setScaleTexture(texture);
    raptor.setScaleTexture(texture);
  });
}
