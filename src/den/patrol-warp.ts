import * as T from 'three';
import { denPatrolWarp } from './patrol';
import { turn16Crops, turn16Hardpoints, turn16Interior } from './patrol-atlas-16';

// Atlas crops and chassis pivots in source pixels. UVs are normalized so the
// registrations also work with whole-canvas resizes.
const crops = [
  [97, 31, 313, 461, 205, 269],
  [466, 30, 681, 453, 567, 264],
  [837, 39, 1095, 441, 955, 262],
  [1184, 52, 1508, 423, 1335, 262],
  [24, 585, 370, 914, 201, 766],
  [389, 605, 747, 872, 569, 757],
  [768, 621, 1143, 865, 962, 755],
] as const;

export const PATROL_GRID_SIZE = 8;
export const PATROL_VERTEX_COUNT = PATROL_GRID_SIZE ** 2;
const interiorSize = PATROL_GRID_SIZE - 2;
const edge = PATROL_GRID_SIZE - 1;

const indices: number[] = [];
for (let row = 0; row < edge; row++) for (let column = 0; column < edge; column++) {
  const i = row * PATROL_GRID_SIZE + column;
  indices.push(i, i + PATROL_GRID_SIZE, i + 1, i + 1, i + PATROL_GRID_SIZE, i + PATROL_GRID_SIZE + 1);
}

export type PatrolPoint = readonly [x: number, y: number];
export type PatrolRegistration = readonly (readonly PatrolPoint[])[];
type Crop = readonly [left: number, top: number, right: number, bottom: number, pivotX: number, pivotY: number];
type MeshAnchor = { vertices: [number, number, number]; weights: [number, number, number] };

export type PatrolAtlas = {
  width: number;
  height: number;
  pixel: number;
  crops: readonly Crop[];
  interiors: PatrolRegistration;
  hardpoints?: readonly (readonly [PatrolPoint, PatrolPoint, PatrolPoint])[];
};

export function patrolInteriorIndex(point: number) {
  const row = Math.floor(point / PATROL_GRID_SIZE), col = point % PATROL_GRID_SIZE;
  return row > 0 && row < edge && col > 0 && col < edge ? (row - 1) * interiorSize + col - 1 : -1;
}

export function patrolMirrorPoint(point: number) {
  return point + edge - 2 * (point % PATROL_GRID_SIZE);
}

export function patrolGridPoint(crop: Crop, interior: readonly PatrolPoint[], point: number): PatrolPoint {
  const i = patrolInteriorIndex(point);
  if (i >= 0) return interior[i];
  const [left, top, right, bottom] = crop;
  return [(point % PATROL_GRID_SIZE) * (right - left) / edge, Math.floor(point / PATROL_GRID_SIZE) * (bottom - top) / edge];
}

function uniformInterior([left, top, right, bottom]: Crop) {
  return Array.from({ length: interiorSize ** 2 }, (_, i): PatrolPoint => [
    (i % interiorSize + 1) * (right - left) / edge,
    (Math.floor(i / interiorSize) + 1) * (bottom - top) / edge,
  ]);
}

// An anchor inherits the same triangle deformation as its pixel in the artwork.
function bindAnchor(xy: number[], x: number, y: number, mirror: boolean): MeshAnchor {
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    const va = 2 * (mirror ? patrolMirrorPoint(a) : a);
    const vb = 2 * (mirror ? patrolMirrorPoint(b) : b);
    const vc = 2 * (mirror ? patrolMirrorPoint(c) : c);
    const ax = xy[va], ay = xy[va + 1];
    const bx = xy[vb] - ax, by = xy[vb + 1] - ay;
    const cx = xy[vc] - ax, cy = xy[vc + 1] - ay;
    const area = bx * cy - by * cx;
    const v = ((x - ax) * cy - (y - ay) * cx) / area;
    const w = (bx * (y - ay) - by * (x - ax)) / area;
    const u = 1 - v - w;
    if (Math.min(u, v, w) >= -1e-6) return { vertices: [a, b, c], weights: [u, v, w] };
  }
  throw new Error('Patrol hardpoint lies outside its atlas mesh');
}

function registerPoses(atlas: PatrolAtlas, registration = atlas.interiors) {
  const { width, height, pixel, crops, hardpoints } = atlas;
  const poses = crops.map((crop, i) => {
    const [left, top, right, bottom, pivotX, pivotY] = crop;
    const angle = (Math.PI / 2) * i / (crops.length - 1), cos = Math.cos(angle), sin = Math.sin(angle);
    const xy: number[] = [], uv: number[] = [];
    const local = (x: number, y: number): PatrolPoint => {
      const dx = (x - pivotX) * pixel, dy = (y - pivotY) * pixel;
      return [cos * dx + sin * dy, sin * dx - cos * dy];
    };
    for (let point = 0; point < PATROL_VERTEX_COUNT; point++) {
      const [u, v] = patrolGridPoint(crop, registration[i], point);
      const x = left + u, y = top + v;
      xy.push(...local(x, y));
      uv.push(x / width, 1 - y / height);
    }
    const mounts = hardpoints?.[i].map(([x, y]) => {
      const [localX, localY] = local(x, y);
      // Mirroring changes the diagonal across a quad. Bind each mount to
      // the triangle that actually carries its source pixel.
      return { forward: bindAnchor(xy, localX, localY, false), mirrored: bindAnchor(xy, localX, localY, true) };
    });
    return { xy, uv, mounts, crop: new T.Vector4(left / width, 1 - bottom / height, right / width, 1 - top / height) };
  });
  return poses.map((pose, i) => ({
    ...pose,
    // A shared tangent carries vertex velocity through each key. Limit it to
    // monotone motion so a crest or hull edge cannot overshoot its source views.
    tangent: pose.xy.map((x, j) => {
      if (!hardpoints || i === 0 || i === poses.length - 1) return 0;
      const a = x - poses[i - 1].xy[j], b = poses[i + 1].xy[j] - x;
      return a * b > 0 ? 2 * a * b / (a + b) : 0;
    }),
  }));
}

const legacyAtlas: PatrolAtlas = { width: 1536, height: 1024, pixel: .00525, crops, interiors: crops.map(uniformInterior) };
const denseAtlas: PatrolAtlas = {
  width: 1254, height: 1254, pixel: .009, crops: turn16Crops,
  interiors: turn16Interior, hardpoints: turn16Hardpoints,
};
const legacyPoses = registerPoses(legacyAtlas), densePoses = registerPoses(denseAtlas);

export function patrolAtlasFor(width: number, height: number) {
  if (width === height && width > 0) return denseAtlas;
  if (width / height === 1.5) return legacyAtlas;
  throw new Error('Unsupported patrol atlas layout');
}

function createGeometry() {
  const vertexCount = PATROL_VERTEX_COUNT;
  const position = new T.BufferAttribute(new Float32Array(vertexCount * 3), 3).setUsage(T.DynamicDrawUsage);
  const uv = new T.BufferAttribute(new Float32Array(vertexCount * 2), 2).setUsage(T.DynamicDrawUsage);
  const nextUV = new T.BufferAttribute(new Float32Array(vertexCount * 2), 2).setUsage(T.DynamicDrawUsage);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', position);
  geometry.setAttribute('uv', uv);
  geometry.setAttribute('nextUV', nextUV);
  geometry.setIndex(indices);
  return { geometry, position, uv, nextUV };
}

export const patrolPoseSampling = `varying vec2 artUV, nextArtUV;
  uniform sampler2D atlas;
  uniform vec4 crop, nextCrop;
  vec4 samplePose(vec2 p, vec4 bounds) {
    vec4 art = texture2D(atlas, p);
    if (any(lessThan(p, bounds.xy)) || any(greaterThan(p, bounds.zw))) return vec4(0.0);
    float a = smoothstep(.27, .54, art.a);
    return vec4(art.rgb * a, a);
  }`;

export function createPatrolWarpCard() {
  const buffers = createGeometry();
  let poses = densePoses;
  let dense = true;
  const uniforms = {
    atlas: { value: null as T.Texture | null },
    crop: { value: poses[0].crop }, nextCrop: { value: poses[0].crop }, poseBlend: { value: 0 },
  };
  const material = new T.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    vertexShader: `attribute vec2 nextUV;
      varying vec2 artUV, nextArtUV;
      void main() {
        artUV = uv;
        nextArtUV = nextUV;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `${patrolPoseSampling}
      uniform float poseBlend;
      void main() {
        vec4 art;
        if (poseBlend <= 0.0) art = samplePose(artUV, crop);
        else if (poseBlend >= 1.0) art = samplePose(nextArtUV, nextCrop);
        else art = mix(samplePose(artUV, crop), samplePose(nextArtUV, nextCrop), poseBlend);
        if (art.a < .005) discard;
        gl_FragColor = vec4(art.rgb / art.a, art.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <premultiplied_alpha_fragment>
      }`,
  });
  const root = new T.Mesh(buffers.geometry, material);
  root.name = 'patrol-heading';
  root.position.z = .19;
  root.visible = false;
  root.frustumCulled = false;
  let firstKey = Infinity, secondKey = Infinity;
  const mounts = [new T.Vector2(), new T.Vector2(), new T.Vector2()] as const;
  const nextMount = new T.Vector2();

  function placeAnchor(anchor: MeshAnchor, target: T.Vector2) {
    const { position } = buffers;
    target.set(0, 0);
    for (let k = 0; k < 3; k++) {
      const i = anchor.vertices[k];
      target.x += anchor.weights[k] * position.getX(i);
      target.y += anchor.weights[k] * position.getY(i);
    }
  }

  function setRegistration(atlas: PatrolAtlas, registration = atlas.interiors) {
    poses = registration === atlas.interiors ? (atlas === denseAtlas ? densePoses : legacyPoses) : registerPoses(atlas, registration);
    dense = atlas === denseAtlas;
    firstKey = secondKey = Infinity;
  }

  function pose(heading: number, blendOverride?: number) {
    const { position, uv, nextUV } = buffers;
    const turn = denPatrolWarp(heading, poses.length);
    const a = poses[turn.first], b = poses[turn.second];
    const sign = turn.mirror ? -1 : 1;
    const keyA = turn.first * sign, keyB = turn.second * sign;
    const updateFirst = keyA !== firstKey, updateSecond = keyB !== secondKey;
    const t = turn.fraction;
    const w = dense ? t * t * (3 - 2 * t) : t;
    const tanA = dense ? t * (1 - t) ** 2 : 0;
    const tanB = dense ? t * t * (t - 1) : 0;
    for (let i = 0; i < PATROL_VERTEX_COUNT; i++) {
      // Reverse the columns when mirroring to retain front-face winding.
      const j = turn.mirror ? patrolMirrorPoint(i) : i, x = 2 * j, y = x + 1;
      position.setXYZ(i, sign * (T.MathUtils.lerp(a.xy[x], b.xy[x], w) + tanA * a.tangent[x] + tanB * b.tangent[x]),
        T.MathUtils.lerp(a.xy[y], b.xy[y], w) + tanA * a.tangent[y] + tanB * b.tangent[y], 0);
      // Each texture follows the same vertices, with the head-on view shared
      // between both turn directions.
      if (updateFirst) {
        const k = (turn.first === 0 ? i : j) * 2;
        uv.setXY(i, a.uv[k], a.uv[k + 1]);
      }
      if (updateSecond) {
        const k = (turn.second === 0 ? i : j) * 2;
        nextUV.setXY(i, b.uv[k], b.uv[k + 1]);
      }
    }
    position.needsUpdate = true;
    if (updateFirst) {
      firstKey = keyA;
      uv.needsUpdate = true;
      uniforms.crop.value = a.crop;
    }
    if (updateSecond) {
      secondKey = keyB;
      nextUV.needsUpdate = true;
      uniforms.nextCrop.value = b.crop;
    }
    const blend = blendOverride ?? turn.blend;
    uniforms.poseBlend.value = blend;
    root.rotation.z = turn.angle;
    if (a.mounts && b.mounts) {
      const orientation = turn.mirror ? 'mirrored' : 'forward';
      for (let i = 0; i < mounts.length; i++) {
        const source = turn.mirror && i < 2 ? 1 - i : i;
        const mount = mounts[i];
        placeAnchor(a.mounts[source][orientation], mount);
        placeAnchor(b.mounts[source][orientation], nextMount);
        mount.lerp(nextMount, blend);
      }
      return mounts;
    }
  }

  return {
    root,
    setRegistration,
    setArt(texture: T.Texture) {
      const image = texture.image as { width: number; height: number } | undefined;
      setRegistration(patrolAtlasFor(image?.width ?? 0, image?.height ?? 0));
      uniforms.atlas.value = texture;
      pose(0);
      root.visible = true;
    },
    pose,
  };
}
