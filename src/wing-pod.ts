import * as T from 'three';
import { addBurner, burnerMaterial, poseBurners, shipBurners } from './burners';
import { shipAlloy } from './encounter-surfaces';
import { part, pivot, plating, polygon } from './rig-geometry';
import { wingWeapons, type WingWeapon } from './wing';

export function createWingPod(weapon: WingWeapon) {
  const root = new T.Group();
  const color = wingWeapons[weapon].color;
  const steel = shipAlloy(0x95a6ab);
  const ceramic = shipAlloy(0x354653);
  const signal = new T.MeshBasicMaterial({ color });
  const hot = new T.MeshBasicMaterial({ color: 0xfff0cf });
  const jet = burnerMaterial(color);
  const wide = weapon === 'omega' ? 0.26 : weapon === 'homing' ? 0.23 : 0.17;
  const hull = pivot(root, 'pod_hull', 0, 0, 0);
  part(hull, plating([[-wide, -0.31], [-wide * 0.75, -0.15], [wide * 0.75, -0.15],
    [wide, -0.31], [wide * 0.68, -0.72], [0, -0.81], [-wide * 0.68, -0.72]], 0.14, 0.028),
    ceramic, 0, 0, -0.067);
  for (const side of [-1, 1]) {
    const rail = part(hull, plating([[wide * 0.41, -0.23], [wide, -0.28], [wide * 0.71, -0.65],
      [wide * 0.32, -0.72]], 0.045, 0.015), steel, 0, 0, 0.078);
    rail.scale.x = side;
    part(hull, new T.BoxGeometry(0.03, 0.18, 0.015), signal, side * wide * 0.6, -0.5, 0.147);
  }
  part(hull, new T.CylinderGeometry(0.07, 0.088, 0.11, 8), steel, 0, -0.75, 0);
  addBurner(hull, jet, 0, -0.81, 0, 0.061, 0.64);
  const burners = shipBurners(hull);
  const breech = pivot(hull, 'weapon_breech', 0, 0, 0);

  function barrel(x: number, length: number, radius: number) {
    part(breech, new T.CylinderGeometry(radius, radius * 1.15, length, 10), steel, x, -length / 2, 0);
    part(breech, new T.CylinderGeometry(radius * 1.28, radius * 1.28, 0.053, 10), ceramic, x, -0.041, 0);
    const muzzle = part(breech, new T.RingGeometry(radius * 0.65, radius, 10), signal, x, -0.012, 0);
    muzzle.rotation.x = -Math.PI / 2;
  }

  switch (weapon) {
    case 'homing':
      for (const side of [-1, 1]) {
        barrel(side * 0.119, 0.36, 0.071);
        part(breech, new T.BoxGeometry(0.037, 0.2, 0.025), signal, side * 0.119, -0.18, 0.078);
      }
      break;
    case 'cannon':
      barrel(0, 0.51, 0.067);
      part(breech, new T.BoxGeometry(0.048, 0.29, 0.035), signal, 0, -0.22, 0.078);
      break;
    case 'laser':
      for (const side of [-1, 1]) {
        const prong = part(breech, plating([[0.069, -0.46], [0.17, -0.39], [0.15, -0.08],
          [0.068, 0.003], [0.095, -0.21]], 0.086, 0.017), steel, 0, 0, -0.027);
        prong.scale.x = side;
      }
      part(breech, new T.OctahedronGeometry(0.104), signal, 0, -0.055, 0.023).scale.set(0.82, 1.55, 0.85);
      part(breech, polygon([[0, -0.11], [0.036, -0.23], [0, -0.37], [-0.036, -0.23]]), signal, 0, 0, 0.134);
      break;
    case 'omega':
      barrel(0, 0.42, 0.134);
      part(breech, new T.CylinderGeometry(0.168, 0.168, 0.081, 10), steel, 0, -0.15, 0);
      part(breech, new T.CylinderGeometry(0.162, 0.162, 0.038, 10), signal, 0, -0.21, 0);
      part(breech, new T.BoxGeometry(0.096, 0.19, 0.037), signal, 0, -0.32, 0.145);
      break;
  }
  const upgrade = pivot(breech, 'mk_ii_rails', 0, 0, 0);
  const brace = plating([[wide * 0.55, -0.12], [wide * 1.14, -0.16], [wide * 1.22, -0.29],
    [wide * 0.91, -0.46], [wide * 0.55, -0.41]], 0.13, 0.017);
  const stripe = new T.BoxGeometry(0.062, 0.22, 0.046);
  for (const side of [-1, 1]) {
    part(upgrade, brace, ceramic, 0, 0, 0.044).scale.x = side;
    part(upgrade, stripe, hot, side * wide * 0.9, -0.27, 0.2);
  }
  upgrade.visible = false;
  const flash = pivot(root, 'muzzle_flash', 0, -0.015, 0.025);
  const glow = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.68,
    blending: T.AdditiveBlending, depthWrite: false });
  const bloom = new T.SphereGeometry(0.105, 10, 7);
  part(flash, bloom, glow, 0, 0.02, 0).scale.set(1, 1.7, 0.94);
  part(flash, bloom, hot, 0, 0, 0).scale.set(0.48, 0.9, 0.46);

  return {
    root, upgrade,
    pose(time: number, throttle: number, activity: number, recoil: number, upgraded = false) {
      poseBurners(burners, time, throttle);
      breech.position.y = -recoil * (weapon === 'omega' ? 0.13 : 0.064);
      upgrade.visible = upgraded;
      const flashSize = (weapon === 'omega' ? 1.4 : 0.9) * (upgraded ? 1.25 : 1);
      flash.scale.setScalar(Math.max(0.001, activity * flashSize));
    },
  };
}
