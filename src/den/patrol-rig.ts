import * as T from 'three';
import { addBurner, burnerMaterial, poseBurners, shipBurners } from '../burners';
import { createPatrolWarpCard } from './patrol-warp';

function placeholder() {
  const root = new T.Group();
  const armor = new T.MeshStandardMaterial({ color: 0x534959, metalness: .43, roughness: .59 });
  const red = new T.MeshStandardMaterial({ color: 0x913932, roughness: .68 });
  const hide = new T.MeshStandardMaterial({ color: 0xa68568, roughness: .83 });
  const amber = new T.MeshBasicMaterial({ color: 0xffb54b });
  const sphere = new T.SphereGeometry(1, 12, 8);
  const taper = new T.ConeGeometry(1, 1, 4).rotateZ(Math.PI);
  const part = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    root.add(mesh);
    return mesh;
  };
  part(taper, red, 0, -.16, .08, .45, 1.73, .20);
  part(sphere, armor, 0, .27, .17, .27, .46, .22);
  part(sphere, hide, 0, .02, .34, .18, .25, .18);
  for (const side of [-1, 1]) {
    part(sphere, armor, side * .39, .14, .09, .15, .47, .16);
    part(sphere, amber, side * .39, -.19, .18, .09, .07, .075);
    part(sphere, hide, side * .19, -.06, .24, .067, .24, .1).rotation.z = side * .43;
  }
  for (let i = -2; i <= 2; i++) {
    part(taper, red, i * .056, .21, .38, .06, .42 - .045 * Math.abs(i), .045).rotation.z = .17 * i;
  }
  return root;
}

export function createDenPatrols(count: number) {
  const model = placeholder();
  const jets = burnerMaterial(0xff812d);
  const warningShape = new T.RingGeometry(.047, .096, 14);
  const warningMaterial = new T.MeshBasicMaterial({ color: 0xffb650, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  const rigs = Array.from({ length: count }, () => {
    const root = new T.Group(), effects = new T.Group(), fallback = model.clone();
    root.name = 'draconian-patrol';
    const warp = createPatrolWarpCard(), card = warp.root;
    const nozzleOffsets = [-.36, .36];
    const nozzles = nozzleOffsets.map(x => addBurner(effects, jets, x, .42, -.13, .14, .87));
    for (const nozzle of nozzles) nozzle.rotation.z = Math.PI;
    const plumes = shipBurners(effects);
    for (const plume of plumes) plume.renderOrder = -2;
    const warning = new T.Mesh(warningShape, warningMaterial);
    warning.position.set(0, -.82, .34);
    warning.renderOrder = 1;
    warning.visible = false;
    effects.add(warning);
    root.add(fallback, card, effects);
    return {
      root,
      useArt(map: T.Texture) { warp.setArt(map); fallback.visible = false; },
      pose(x: number, y: number, heading: number, size: number, throttle: number, charge: number, time: number) {
        root.visible = true;
        root.position.set(x, y, .12);
        root.scale.setScalar(size);
        const mounts = card.visible ? warp.pose(heading) : undefined;
        effects.rotation.z = fallback.rotation.z = heading;
        poseBurners(plumes, time, throttle);
        let angle = Math.PI;
        if (mounts) {
          const [left, right, nose] = mounts;
          const dx = (left.x + right.x) * .5 - nose.x;
          const dy = (left.y + right.y) * .5 - nose.y;
          angle -= Math.atan2(dx, dy);
        }
        for (const [i, nozzle] of nozzles.entries()) {
          const mount = mounts?.[i];
          nozzle.position.x = mount?.x ?? nozzleOffsets[i];
          nozzle.position.y = mount?.y ?? .42;
          nozzle.rotation.z = angle;
          if (mount) {
            const plume = plumes[i];
            plume.scale.x *= .82;
            plume.scale.z *= .82;
            plume.scale.y *= .64 + .36 * Math.abs(Math.sin(heading));
          }
        }
        warning.visible = charge > 0;
        warning.scale.setScalar(.55 + 1.3 * charge);
      },
    };
  });
  return {
    rigs,
    setArt(map: T.Texture) { rigs.forEach(rig => rig.useArt(map)); },
  };
}
