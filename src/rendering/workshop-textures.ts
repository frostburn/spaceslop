import type { Group, Texture } from 'three';
import { loadEncounterTexture } from '../encounter-texture';
import { setFaceTexture } from '../creature-faces';
import { setFeatherTexture, type createInterceptorRig, type createRaptorRig } from '../encounter-rigs';
import { textureShipAlloy } from '../encounter-surfaces';
import { setAntChitinTexture, setFungusTexture } from '../hive-materials';
import { setAntMoldTexture } from '../ant-mold';
import { setTitanChitinTexture } from '../titan-insect-surfaces';
export function loadEncounterTextures(boss: ReturnType<typeof createInterceptorRig>, raptor: ReturnType<typeof createRaptorRig>,
  ships: readonly Group[], applyArmor?: (texture: Texture) => void) {
  return Promise.all([
    loadEncounterTexture('armor', (texture) => {
      boss.setArmorTexture(texture);
      textureShipAlloy(texture, ships);
      applyArmor?.(texture);
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
    loadEncounterTexture('chitin', setAntChitinTexture, 1.2),
    loadEncounterTexture('fungus', setFungusTexture, 1.1),
    loadEncounterTexture('mold', setAntMoldTexture),
    loadEncounterTexture('titanChitin', setTitanChitinTexture, 1),
  ]);
}
