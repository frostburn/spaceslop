import { CatmullRomCurve3, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { HEIGHT, WIDTH } from './playfield';

export const HIVE_SCREENS = 3;
export const HIVE_ROOT_DEPTH = -2.6;
export const HIVE_CAMERA_DISTANCE = 26;
export const hiveFungusAnchors = [
  [0.17, 0.10], [0.83, 0.17], [0.16, 0.25], [0.84, 0.31],
  [0.17, 0.40], [0.84, 0.46], [0.16, 0.53], [0.83, 0.60],
  [0.17, 0.69], [0.84, 0.76], [0.16, 0.84], [0.83, 0.91],
] as const;
export const mushroomCapProfile = [
  [0, 0.34], [0.2, 0.36], [0.49, 0.31], [0.76, 0.18], [0.94, 0.02],
  [1, -0.035], [0.97, -0.09], [0.73, -0.15], [0.37, -0.21], [0, -0.22],
] as const;

// A spreading foot, a sideways bend, and a returning neck give each stem its own growth direction.
export const mushroomStems = [
  [[0, 0, 0], [-0.14, 0.19, 0.3], [-0.42, 0.53, 0.87], [-0.29, 0.95, 1.56], [0.13, 1.16, 2.18], [0.28, 1.19, 2.72]],
  [[0, 0, 0], [0.2, 0.1, 0.36], [0.45, 0.39, 1.04], [0.32, 0.79, 1.8], [-0.13, 1.04, 2.58], [-0.23, 1.05, 3.19]],
  [[0, 0, 0], [-0.13, 0.16, 0.27], [-0.3, 0.49, 0.72], [0.03, 0.88, 1.26], [0.43, 1.02, 1.79], [0.48, 1.03, 2.26]],
].map((points) => {
  const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)));
  return {
    curve, end: curve.getPoint(1),
    crownRotation: new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), curve.getTangent(1)),
  };
});

export function mushroomStemRadius(t: number) {
  return 0.13 - 0.065 * t + 0.045 * Math.exp(-t * 18);
}

export function mushroomBodies(seed: number) {
  return Array.from({ length: 3 }, (_, i) => ({
    stem: (i + seed) % mushroomStems.length,
    offset: new Vector3(i === 0 ? 0 : 0.15, (i - 1) * 0.16, 0),
    angle: i === 0 ? Math.sin(seed * 1.7) * 0.18 : i === 1 ? 1.7 : -1.8,
    scale: i === 0 ? 1 : i === 1 ? 0.47 : 0.57,
  }));
}

export function hiveRoot(u: number, v: number, progress: number) {
  return { x: (u - 0.5) * WIDTH, y: (v * HIVE_SCREENS - (HIVE_SCREENS - 1) * progress - 0.5) * HEIGHT };
}

// Local samples are shared with the mesh recipes. Projection onto the flight plane accounts
// for cap height; root-depth compensation cancels out of this expression.
export function projectHivePoint(root: { x: number; y: number }, local: Vector3, distance: number, out: { x: number; y: number }) {
  const scale = 1 / (1 - local.z / distance);
  out.x = (root.x + local.x) * scale;
  out.y = (root.y + local.y) * scale;
  return scale;
}

export const hiveCollisionRecipes = hiveFungusAnchors.map(([u, v], seed) => {
  const side = new Matrix4().makeRotationZ(u < 0.5 ? Math.PI : 0);
  const bodies = mushroomBodies(seed).map((body) => {
    const stem = mushroomStems[body.stem];
    const transform = new Matrix4().compose(body.offset,
      new Quaternion().setFromEuler(new Euler(0, 0, body.angle)), new Vector3().setScalar(body.scale));
    transform.premultiply(side);
    const spine = Array.from({ length: 17 }, (_, i) => ({
      point: stem.curve.getPoint(i / 16).applyMatrix4(transform),
      radius: mushroomStemRadius(i / 16) * body.scale,
    }));
    const crown = new Matrix4().compose(stem.end, stem.crownRotation, new Vector3(0.76, 0.66, 0.85));
    crown.premultiply(transform);
    const cap = mushroomCapProfile.flatMap(([r, h]) => Array.from({ length: r ? 16 : 1 }, (_, i) => {
      const angle = i * Math.PI * 2 / 16;
      return new Vector3(Math.sin(angle) * r, Math.cos(angle) * r, h).applyMatrix4(crown);
    }));
    return { spine, cap };
  });
  return { u, v, bodies };
});
