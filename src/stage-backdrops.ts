import * as T from 'three';
import { loadEncounterTexture } from './encounter-texture';
import { HEIGHT, WIDTH } from './game';

function plate(height: number) {
  const material = new T.MeshBasicMaterial({
    color: 0xc6c6c6, transparent: true, depthWrite: false, toneMapped: false,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(WIDTH, height), material);
  mesh.visible = false;
  return mesh;
}

function cropToField(texture: T.Texture) {
  const { width, height } = texture.image as HTMLImageElement;
  const targetAspect = WIDTH / HEIGHT;
  const aspect = width / height;
  texture.repeat.set(Math.min(1, targetAspect / aspect), Math.min(1, aspect / targetAspect));
  texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2);
}

export function createStageBackdrops() {
  const preserve = plate(3 * HEIGHT);
  preserve.position.set(0, HEIGHT, -5.2);
  loadEncounterTexture('preserve', (texture) => {
    cropToField(texture);
    // Reflections make adjacent tiles meet at the same edge while scrolling.
    texture.wrapT = T.MirroredRepeatWrapping;
    texture.repeat.y = 3;
    texture.offset.y = 0;
    preserve.material.map = texture;
    preserve.material.needsUpdate = true;
  });

  const shipyard = plate(HEIGHT);
  shipyard.position.z = -42;
  loadEncounterTexture('shipyard', (texture) => {
    cropToField(texture);
    shipyard.material.map = texture;
    shipyard.material.needsUpdate = true;
  });
  return { preserve, shipyard };
}
