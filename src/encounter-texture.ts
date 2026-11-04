import { RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';
import type { createInterceptorRig } from './encounter-rigs';

declare const __INTERCEPTOR_METAL__: string;

export function loadInterceptorTexture(rig: ReturnType<typeof createInterceptorRig>) {
  if (!__INTERCEPTOR_METAL__) return;

  new TextureLoader().load(import.meta.env.BASE_URL + __INTERCEPTOR_METAL__, (texture) => {
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(0.62, 0.62);
    rig.setArmorTexture(texture);
  });
}
