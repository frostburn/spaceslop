import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Group, type Texture } from 'three';
import { setFaceTexture } from './creature-faces';
import { setFeatherTexture, type createInterceptorRig, type createRaptorRig } from './encounter-rigs';
import { textureShipAlloy } from './encounter-surfaces';

type EncounterTexture = 'armor' | 'feathers' | 'scales' | 'preserve' | 'shipyard' |
  'hive' | 'hiveMask' | 'hiveStars' | 'hiveMines';
declare const __ENCOUNTER_TEXTURES__: Partial<Record<EncounterTexture, string>>;

export async function loadEncounterTexture(
  name: EncounterTexture, apply: (texture: Texture) => void, repeat?: number,
) {
  const path = __ENCOUNTER_TEXTURES__[name];
  if (!path) return;
  return new Promise<Texture | undefined>((resolve) => {
    let pending = true;
    const finish = (texture?: Texture) => {
      pending = false;
      clearTimeout(deadline);
      resolve(texture);
    };
    const deadline = window.setTimeout(() => finish(), 2500);
    new TextureLoader().load(import.meta.env.BASE_URL + path, (texture) => {
      if (!pending) {
        texture.dispose();
        return;
      }
      texture.colorSpace = SRGBColorSpace;
      if (repeat !== undefined) {
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.repeat.set(repeat, repeat);
      }
      apply(texture);
      finish(texture);
    }, undefined, () => finish());
  });
}

export function loadEncounterTextures(
  boss: ReturnType<typeof createInterceptorRig>, raptor: ReturnType<typeof createRaptorRig>, ships: readonly Group[],
) {
  return Promise.all([
    loadEncounterTexture('armor', (texture) => {
      boss.setArmorTexture(texture);
      textureShipAlloy(texture, ships);
    }, 0.55),
    loadEncounterTexture('feathers', setFeatherTexture),
    loadEncounterTexture('scales', (texture) => {
      // Use a larger scale pattern on screen and keep both UV edges inside the painted image.
      texture.repeat.set(0.62, 0.68);
      texture.offset.set(0.19, 0.16);
      setFaceTexture(texture);
      boss.setScaleTexture(texture);
      raptor.setScaleTexture(texture);
    }),
  ]);
}
