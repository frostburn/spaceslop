import * as T from 'three';
import { part, pivot } from '../rig-geometry';
import { heliostatBatch } from './geometry';
import type { HeliostatMaterials } from './materials';

const hull: [number, number][] = [[0, -0.605], [0.177, -0.52], [0.266, -0.305], [0.277, -0.07], [0.37, 0.245],
  [0.286, 0.459], [0.13, 0.549], [-0.13, 0.549], [-0.286, 0.459], [-0.37, 0.245], [-0.277, -0.07],
  [-0.266, -0.305], [-0.177, -0.52]];
const shield: [number, number][] = [[0.075, 0.47], [0.238, 0.403], [0.324, 0.227], [0.243, -0.13],
  [0.215, -0.372], [0.12, -0.33], [0.143, -0.18], [0.171, 0.077], [0.075, 0.21]];

function duct() {
  // The lip rolls back into the intake. The propeller and its shadow are visible through either end.
  const profile = [[0.134, -0.13], [0.181, -0.13], [0.198, -0.091], [0.192, -0.067], [0.195, 0.06],
    [0.217, 0.104], [0.211, 0.136], [0.175, 0.146], [0.151, 0.126], [0.14, 0.071], [0.134, -0.13]];
  return new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), 22).rotateX(Math.PI / 2);
}

export function createInspectionDroneAssets(m: HeliostatMaterials) {
  const root = new T.Group();
  root.name = 'heliostat-inspection-drone';
  const b = heliostatBatch(root);
  b.plate(hull, 0.18, 0.039, [0, 0, 0], m.blue);
  b.plate([[-0.24, 0.21], [-0.15, -0.48], [0, -0.57], [0.15, -0.48], [0.24, 0.21],
    [0.11, 0.48], [-0.11, 0.48]], 0.135, 0.028, [0, 0, -0.099], m.graphite);
  b.plate([[-0.07, -0.49], [-0.13, -0.265], [-0.125, 0.25], [-0.064, 0.39],
    [0.064, 0.39], [0.125, 0.25], [0.13, -0.265], [0.07, -0.49]], 0.071, 0.024, [0, 0, 0.111], m.dark);
  b.box([0.13, 0.056, 0.025], [0, 0.426, 0.131], m.amber, 0.009);

  for (const side of [-1, 1]) {
    b.plate(shield.map(([x, y]) => [side * x, y]), 0.071, 0.024, [0, 0, 0.122], m.ceramic);
    b.plate([[0, 0], [0.11, 0.067], [0.176, -0.037], [0.167, -0.14], [0.022, -0.16]]
      .map(([x, y]) => [side * x, y]), 0.094, 0.018, [side * 0.321, 0.18, 0.033], m.titanium);
    b.rod([side * 0.407, 0.129, 0.027], [side * 0.546, 0.129, 0.027], 0.077, m.dark, 12);
    b.pipe([[side * 0.145, 0.34, -0.074], [side * 0.283, 0.275, -0.116],
      [side * 0.382, 0.18, -0.085], [side * 0.481, 0.129, -0.017]], 0.022, m.copper);
    b.plate([[0.161, 0.28], [0.28, 0.209], [0.264, 0.153], [0.169, 0.211]].map(([x, y]) => [side * x, y]),
      0.012, 0.004, [0, 0, 0.183], m.copper);
    for (const y of [-0.11, 0.017, 0.144]) {
      b.box([0.096, 0.025, 0.036], [side * 0.13, y, -0.174], m.titanium, 0.005, [0, 0, side * -0.13]);
    }

    const thruster = pivot(root, 'inspection-thruster', side * 0.593, 0.129, 0.027);
    const housing = heliostatBatch(thruster);
    housing.add(duct(), m.blue);
    housing.ring(0.19, 0.018, [0, 0, 0.135], m.copper, [0, 0, 0], 22);
    housing.ring(0.171, 0.017, [0, 0, -0.127], m.dark, [0, 0, 0], 22);
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      housing.box([0.057, 0.023, 0.018], [Math.sin(angle) * 0.174, Math.cos(angle) * 0.174, 0.144],
        m.cyan, 0.006, [0, 0, -angle]);
    }
    housing.finish();

    const rotor = pivot(thruster, 'inspection-impeller', 0, 0, 0.026);
    const blades = heliostatBatch(rotor);
    blades.rod([0, 0, -0.025], [0, 0, 0.029], 0.051, m.titanium, 10);
    for (let i = 0; i < 3; i++) {
      blades.plate([[-0.029, 0.019], [0.049, 0.036], [0.038, 0.098], [-0.025, 0.132], [-0.051, 0.088]],
        0.021, 0.005, [0, 0, 0], m.titanium, [0, 0, i * Math.PI * 2 / 3]);
    }
    blades.finish();
  }

  // The scanner is a separate optic seated inside its titanium yoke.
  b.ring(0.146, 0.028, [0, -0.113, 0.159], m.titanium, [0, 0, 0], 22);
  b.ring(0.097, 0.022, [0, -0.43, 0.169], m.copper, [0, 0, 0], 18);
  b.finish();
  const scanner = pivot(root, 'inspection-scanner', 0, -0.113, 0.156);
  const optics = heliostatBatch(scanner);
  optics.add(new T.SphereGeometry(1, 16, 10).scale(0.133, 0.121, 0.087), m.graphite);
  optics.ring(0.061, 0.012, [0, 0, 0.079], m.blue, [0, 0, 0], 14);
  optics.box([0.126, 0.021, 0.015], [0, 0, 0.086], m.cyan, 0.007);
  optics.finish();
  const iris = part(root, new T.SphereGeometry(1, 14, 10), m.amber, 0, -0.43, 0.182);
  iris.name = 'inspection-emitter';
  iris.scale.set(0.046, 0.046, 0.019);
  return root;
}

export function createInspectionDrone(template: T.Group) {
  const root = template.clone(true);
  const scanner = root.getObjectByName('inspection-scanner')!;
  const emitter = root.getObjectByName('inspection-emitter')!;
  const thrusters = root.getObjectsByProperty('name', 'inspection-thruster');
  const impellers = root.getObjectsByProperty('name', 'inspection-impeller');
  return { root, pose(time: number, bank: number, charge = 0) {
    root.rotation.x = 0.041 * Math.sin(time * 2.7);
    root.rotation.y = bank;
    scanner.rotation.set(0.13 * Math.sin(time * 2.4) * (1 - charge), 0.48 * Math.sin(time * 2) * (1 - charge), 0);
    const radius = 0.044 + 0.037 * charge;
    emitter.scale.set(radius, radius, 0.017 + 0.011 * charge);
    for (const [i, thruster] of thrusters.entries()) {
      const side = i === 0 ? -1 : 1;
      thruster.rotation.x = side * 0.08 + 0.11 * Math.sin(time * 2.7 + i * 0.9);
      thruster.rotation.y = -0.81 * bank + side * 0.078;
      impellers[i].rotation.z = side * (time * 11 + i * 0.84);
    }
  } };
}
