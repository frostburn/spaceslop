import * as T from 'three';
import { addBurner, burnerMaterial } from './burners';
import { shipAlloy as alloy } from './encounter-surfaces';
import type { PilotLivery } from './pilot-data';
import { part, pivot, plating, polygon } from './rig-geometry';

const light = (color: number) => new T.MeshBasicMaterial({ color });

type Section = [y: number, width: number, crown: number, keel: number];

function fuselage(sections: Section[]) {
  const positions: number[] = [];
  const indices: number[] = [];
  const uv: number[] = [];
  for (const [y, width, crown, keel] of sections) {
    positions.push(
      -width, y, 0, -width * 0.54, y, crown, width * 0.54, y, crown,
      width, y, 0, width * 0.62, y, keel, -width * 0.62, y, keel, -width, y, 0,
    );
    for (let j = 0; j <= 6; j++) uv.push(j / 6, y * 1.35);
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < 6; j++) {
      const a = i * 7 + j;
      const b = a + 1;
      indices.push(a, b, a + 7, b, b + 7, a + 7);
    }
  }
  const nose = (sections.length - 1) * 7;
  for (let j = 1; j < 5; j++) indices.push(0, j + 1, j, nose, nose + j, nose + j + 1);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function stripe(sections: [y: number, width: number, z: number][], x = 0) {
  const positions = sections.flatMap(([y, width, z]) => [x - width, y, z, x + width, y, z]);
  const indices: number[] = [];
  for (let i = 0; i < positions.length / 3 - 2; i += 2) {
    indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(sections.flatMap(([y, width]) =>
    [x - width, y, x + width, y]), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createFighterRig(livery?: PilotLivery) {
  const root = new T.Group();
  const paint = alloy(livery?.paint ?? 0x319eaf);
  const trim = alloy(livery?.trim ?? 0xa1a9ab);
  const frame = alloy(livery?.frame ?? 0x273745);
  const canopy = new T.MeshStandardMaterial({ color: 0x21435c, metalness: 0.24, roughness: 0.27 });
  const ice = light(0x82d8e5);
  const core = light(0xaffbff);
  const jet = burnerMaterial(0x28b6ff);

  part(root, fuselage([[-0.7, 0.23, 0.13, -0.11], [-0.19, 0.3, 0.19, -0.13],
    [0.38, 0.23, 0.15, -0.1], [0.78, 0.052, 0.071, -0.025], [0.88, 0.01, 0.033, -0.01]]),
    paint, 0, 0, 0);
  part(root, stripe([[0.38, 0.038, 0.154], [0.78, 0.017, 0.076], [0.87, 0.005, 0.041]]), trim, 0, 0, 0);
  part(root, fuselage([[-0.27, 0.072, 0.027, -0.01], [-0.14, 0.145, 0.1, -0.01],
    [0.25, 0.094, 0.079, -0.01], [0.4, 0.035, 0.016, -0.01]]), canopy, 0, 0, 0.16);
  part(root, stripe([[-0.12, 0.016, 0.263], [0.24, 0.009, 0.244]], 0.026), ice, 0, 0, 0);

  for (const side of [-1, 1]) {
    const wing = pivot(root, side < 0 ? 'fighter_wing_L' : 'fighter_wing_R', 0, 0, 0);
    wing.scale.x = side;
    part(wing, plating([[0.18, 0.35], [0.41, 0.31], [0.78, 0.02], [0.82, -0.17],
      [0.62, -0.24], [0.28, -0.55], [0.19, -0.42]], 0.08, 0.022), trim, 0, 0, -0.06);
    part(wing, plating([[0.3, 0.27], [0.7, 0.005], [0.73, -0.1], [0.62, -0.13],
      [0.32, -0.38], [0.26, -0.19]], 0.043, 0.012), paint, 0, 0, 0.042);
    part(wing, polygon([[0.68, -0.11], [0.76, -0.095], [0.75, -0.15], [0.65, -0.18]]), ice, 0, 0, 0.105);
    part(wing, polygon([[0.31, 0.18], [0.49, 0.084], [0.52, 0.058], [0.36, 0.126]]), trim, 0, 0, 0.101);
    part(wing, polygon([[0.32, 0.051], [0.62, -0.051], [0.64, -0.076], [0.33, 0.021]]), frame, 0, 0, 0.103);
    part(wing, fuselage([[-0.78, 0.135, 0.11, -0.1], [-0.48, 0.148, 0.15, -0.105],
      [-0.13, 0.108, 0.128, -0.077], [-0.015, 0.065, 0.06, -0.032]]), frame, 0.24, 0, 0.015);
    part(wing, new T.CylinderGeometry(0.092, 0.105, 0.095, 8), trim, 0.24, -0.774, 0.014);
    const exhaust = part(wing, new T.CircleGeometry(0.075, 8), core, 0.24, -0.826, 0.014);
    exhaust.rotation.x = Math.PI / 2;
    addBurner(wing, jet, 0.24, -0.827, 0.014, 0.088, 0.92);
  }
  return { root };
}

export function createScoutRig() {
  const root = new T.Group();
  const wine = alloy(0x8e3647);
  const cowl = alloy(0x4b2c3d);
  const bronze = alloy(0xbb7050);
  const charcoal = alloy(0x292237);
  const ember = light(0xf89462);
  const jet = burnerMaterial(0xff6628);

  part(root, fuselage([[-0.52, 0.24, 0.12, -0.095], [-0.13, 0.31, 0.21, -0.13],
    [0.27, 0.26, 0.16, -0.1], [0.54, 0.13, 0.067, -0.045], [0.62, 0.04, 0.03, -0.016]]),
    wine, 0, 0, 0);
  part(root, plating([[-0.16, -0.11], [0.16, -0.11], [0.11, 0.29], [0, 0.36], [-0.11, 0.29]], 0.032, 0.018),
    charcoal, 0, 0, 0.179);

  for (const side of [-1, 1]) {
    const wing = pivot(root, side < 0 ? 'scout_wing_L' : 'scout_wing_R', 0, 0, 0);
    wing.scale.x = side;
    part(wing, plating([[0.23, 0.24], [0.56, 0.19], [0.85, 0.33], [0.83, -0.17],
      [0.58, -0.45], [0.29, -0.39]], 0.105, 0.023), cowl, 0, 0, -0.06);
    part(wing, plating([[0.28, 0.16], [0.57, 0.13], [0.78, 0.25], [0.74, -0.087], [0.57, -0.27], [0.28, -0.24]],
      0.045, 0.015), wine, 0, 0, 0.069);
    part(wing, polygon([[0.51, 0.083], [0.74, 0.193], [0.72, 0.092], [0.5, -0.016]]), bronze, 0, 0, 0.134);
    for (let i = 0; i < 3; i++) {
      const vent = part(wing, new T.BoxGeometry(0.11, 0.027, 0.018), charcoal, 0.58 + i * 0.014, -0.06 + i * 0.042, 0.126);
      vent.rotation.z = 0.43;
    }
    part(wing, new T.BoxGeometry(0.104, 0.23, 0.095), charcoal, 0.34, -0.34, 0.066);
    part(wing, new T.BoxGeometry(0.082, 0.018, 0.065), ember, 0.34, -0.461, 0.066);
    addBurner(wing, jet, 0.34, -0.471, 0.066, 0.063, 0.62);
  }
  part(root, new T.BoxGeometry(0.12, 0.061, 0.05), ember, 0, 0.28, 0.218);
  return root;
}

export function createDroneRig(livery?: PilotLivery) {
  const root = new T.Group();
  const steel = alloy(livery?.paint ?? 0x526875);
  const casing = alloy(livery?.trim ?? 0x9babaa);
  const mint = light(0xa1ffc5);
  const jet = burnerMaterial(0x4bff92);
  const shell = part(root, new T.CylinderGeometry(0.3, 0.36, 0.17, 6), steel, 0, 0, -0.018);
  shell.rotation.x = Math.PI / 2;
  part(root, new T.RingGeometry(0.208, 0.315, 6), light(0x6adba4), 0, 0, 0.084);
  part(root, new T.OctahedronGeometry(0.174), mint, 0, 0, 0.073);
  const panel = plating([[-0.095, 0.2], [0.095, 0.2], [0.132, 0.289], [-0.132, 0.289]], 0.032, 0.012);
  for (let i = 0; i < 6; i++) part(root, panel, casing, 0, 0, 0.09).rotation.z = i * Math.PI / 3;
  for (const side of [-1, 1]) {
    part(root, new T.BoxGeometry(0.086, 0.13, 0.096), steel, side * 0.315, 0, -0.005);
    addBurner(root, jet, side * 0.315, -0.068, -0.005, 0.053, 0.7);
  }
  return root;
}

export function addTowlineEmitters(root: T.Group, livery?: PilotLivery) {
  const towlineEmitters = pivot(root, 'towline_emitters', 0, 0, 0);
  const arm = plating([[0.21, -0.145], [0.37, -0.24], [0.49, -0.145], [0.51, 0.14],
    [0.42, 0.235], [0.3, 0.15]], 0.09, 0.025);
  const coil = new T.BoxGeometry(0.069, 0.27, 0.058);
  const steel = alloy(livery?.paint ?? 0x526875);
  const violet = light(0xc8afff);
  for (const side of [-1, 1]) {
    part(towlineEmitters, arm, steel, 0, 0, 0.015).scale.x = side;
    part(towlineEmitters, coil, violet, side * 0.42, 0.015, 0.128).rotation.z = -side * 0.17;
  }
  towlineEmitters.visible = false;
  return towlineEmitters;
}
