import * as T from 'three';

// A padded window covers visible receivers and their offscreen casters. Snap
// in the scaled habitat's metric; the habitat is narrower along X, so snapping
// its unscaled local axes would still slide diagonally through shadow texels.
export function createPreserveShadow(sun: T.DirectionalLight, world: T.Object3D) {
  sun.shadow.mapSize.set(2048, 2048);
  const camera = sun.shadow.camera;
  camera.left = -26; camera.right = 26; camera.bottom = -34; camera.top = 34;
  camera.near = .5; camera.far = 160; camera.updateProjectionMatrix();
  const offset = new T.Vector3(-22,-12,35), scaledOffset = offset.clone().multiply(world.scale);
  const forward = scaledOffset.clone().normalize().negate();
  const right = forward.clone().cross(new T.Vector3(0,1,0)).normalize();
  const up = right.clone().cross(forward).normalize(), center = new T.Vector3();
  const tx = 52 / sun.shadow.mapSize.x, ty = 68 / sun.shadow.mapSize.y;
  return (scroll: number) => {
    center.set(0,scroll+8,-3);
    const x = Math.round(center.dot(right)/tx)*tx, y = Math.round(center.dot(up)/ty)*ty;
    const z = Math.round(center.dot(forward)/tx)*tx;
    center.copy(right).multiplyScalar(x).addScaledVector(up,y).addScaledVector(forward,z);
    sun.target.position.copy(center).divide(world.scale);sun.position.copy(sun.target.position).add(offset);
    // Three's shadow camera is outside the light hierarchy. Keep its up vector
    // attached to the rotating habitat through the approach and boss view.
    world.updateWorldMatrix(true,false);
    camera.up.set(0,1,0).transformDirection(world.matrixWorld);
  };
}
