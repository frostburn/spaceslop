import * as T from 'three';

export function createPatternCharge(color: number) {
  const geometry = new T.OctahedronGeometry(.17);
  const material = new T.MeshBasicMaterial({ color, toneMapped: false, depthWrite: false });
  return {
    attach(parent: T.Object3D, x: number, y: number, z: number) {
      const light = new T.Mesh(geometry, material);
      light.name = 'pattern-charge';
      light.position.set(x, y, z);
      light.visible = false;
      parent.add(light);
      return (charge: number, position?: { x: number; y: number; z: number }) => {
        if (position) light.position.set(position.x, position.y, position.z);
        light.visible = charge > .05;
        light.scale.setScalar(.25 + charge);
      };
    },
  };
}
