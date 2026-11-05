import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shipAlloy } from './encounter-surfaces';
import { wingWeapons, type WingWeapon } from './wing';

const casing = new T.CylinderGeometry(0.4, 0.37, 0.12, 8).rotateX(Math.PI / 2);
const face = new T.CircleGeometry(0.327, 8);
const rim = new T.RingGeometry(0.336, 0.365, 8);
const beacon = mergeGeometries([0.18, Math.PI + 0.18].map((angle) =>
  new T.RingGeometry(0.475, 0.503, 16, 1, angle, 1.45)));
const steel = shipAlloy(0x8a9aa2);
const charcoal = new T.MeshBasicMaterial({ color: 0x0b1621 });
const box = (x: number, y: number, w: number, h: number) => new T.BoxGeometry(w, h, 0.028).translate(x, y, 0);
function polygon(points: number[][]) {
  return new T.ShapeGeometry(new T.Shape(points.map(([x, y]) => new T.Vector2(x, y))));
}
const arrows = mergeGeometries([-1, 1].map((side) => polygon([
  [-0.12, 0.56 * side], [0, 0.475 * side], [0.12, 0.56 * side], [0.12, 0.6 * side],
  [0, 0.525 * side], [-0.12, 0.6 * side],
])));
const icons: Record<WingWeapon, T.BufferGeometry> = {
  homing: mergeGeometries([new T.RingGeometry(0.035, 0.055, 24), ...[-1, 1].flatMap((side) => [
    box(side * 0.17, 0, 0.14, 0.026), box(0, side * 0.17, 0.026, 0.14),
  ])]),
  cannon: mergeGeometries([box(0, -0.03, 0.12, 0.30), box(0, -0.14, 0.21, 0.055),
    polygon([[-0.06, 0.12], [0, 0.225], [0.06, 0.12]])]),
  laser: mergeGeometries([box(0, 0.04, 0.043, 0.38), box(-0.12, -0.09, 0.045, 0.25),
    box(0.12, -0.09, 0.045, 0.25), box(0, -0.195, 0.24, 0.045),
    polygon([[-0.16, 0.16], [-0.07, 0.19], [-0.11, 0.09]]),
    polygon([[0.16, 0.16], [0.07, 0.19], [0.11, 0.09]])]),
  omega: mergeGeometries([new T.RingGeometry(0.115, 0.175, 24, 1, -Math.PI / 2 + 0.5, Math.PI * 2 - 1),
    box(-0.115, -0.16, 0.14, 0.055), box(0.115, -0.16, 0.14, 0.055)]),
};
const palette = Object.fromEntries((Object.keys(wingWeapons) as WingWeapon[]).map((weapon) => [weapon, {
  signal: new T.MeshBasicMaterial({ color: wingWeapons[weapon].color, side: T.DoubleSide }),
  halo: new T.MeshBasicMaterial({ color: wingWeapons[weapon].color, transparent: true,
    opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }),
}])) as Record<WingWeapon, { signal: T.MeshBasicMaterial; halo: T.MeshBasicMaterial }>;
const lockCircle = new T.RingGeometry(0.94, 1, 40);
const lockMaterials = [0, 1].map(() => new T.MeshBasicMaterial({ color: wingWeapons.homing.color,
  transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide }));

export function createPowerupGraphic() {
  const root = new T.Group();
  root.name = 'powerup-capsule';
  const variants = (Object.keys(wingWeapons) as WingWeapon[]).map((weapon, index) => {
    const model = new T.Group(); model.name = `powerup-${weapon}`;
    const armor = new T.Mesh(casing, steel);
    const inset = new T.Mesh(face, charcoal); inset.position.z = 0.067;
    const border = new T.Mesh(rim, palette[weapon].signal); border.position.z = 0.072;
    const icon = new T.Mesh(icons[weapon], palette[weapon].signal); icon.position.z = 0.088;
    const orbit = new T.Mesh(beacon, palette[weapon].halo); orbit.position.z = 0.035;
    const chevrons = new T.Mesh(arrows, palette[weapon].signal); chevrons.position.z = 0.075;
    model.add(armor, inset, border, icon, orbit, chevrons);
    const circles = weapon === 'homing' ? lockMaterials.map((material, i) => {
      const circle = new T.Mesh(lockCircle, material); circle.name = `homing-lock-circle-${i}`;
      circle.position.z = 0.12; model.add(circle); return circle;
    }) : [];
    model.visible = false;
    root.add(model);
    return { weapon, model, orbit, index, circles };
  });
  root.visible = false;
  return {
    root,
    pose(weapon: WingWeapon, time: number, intro = 1) {
      root.visible = true;
      const t = T.MathUtils.clamp(intro, 0, 1);
      root.scale.setScalar(Math.max(0.05, 1 - (1 - t) ** 3 + Math.sin(t * Math.PI) * 0.1));
      root.rotation.set(Math.sin(time * 2) * 0.12, Math.cos(time * 1.7) * 0.1, Math.sin(time * 1.3) * 0.06);
      for (const variant of variants) {
        variant.model.visible = variant.weapon === weapon;
        if (!variant.model.visible) continue;
        variant.orbit.rotation.z = time * 1.6 + variant.index * 0.7;
        palette[weapon].halo.opacity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(time * 4 + variant.index));
        variant.circles.forEach((circle, i) => {
          const phase = (time * 0.8 + i * 0.5) % 1;
          circle.scale.setScalar(T.MathUtils.lerp(0.27, 0.045, phase));
          circle.material.opacity = Math.sin(phase * Math.PI) * 0.8;
        });
      }
    },
  };
}
