import * as T from 'three';
import { denPatrolWarp } from './patrol';
import { turn16Crops, turn16Hardpoints, turn16Handoffs } from './patrol-atlas-16';

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
export type PatrolGrid = readonly PatrolPoint[];
export type PatrolGridPair = readonly [outgoing: PatrolGrid, incoming: PatrolGrid];
export type PatrolRegistration = readonly PatrolGridPair[];
type Crop = readonly [left: number, top: number, right: number, bottom: number, pivotX: number, pivotY: number];
type MeshAnchor = { vertices: [number, number, number]; weights: [number, number, number] };

export type PatrolAtlas = {
  width: number;
  height: number;
  pixel: number;
  crops: readonly Crop[];
  handoffs: PatrolRegistration;
  hardpoints?: readonly (readonly [PatrolPoint, PatrolPoint, PatrolPoint])[];
};

export function patrolInteriorIndex(point: number) {
  const row = Math.floor(point / PATROL_GRID_SIZE), col = point % PATROL_GRID_SIZE;
  return row > 0 && row < edge && col > 0 && col < edge ? (row - 1) * interiorSize + col - 1 : -1;
}

export function patrolMirrorPoint(point: number) {
  return point + edge - 2 * (point % PATROL_GRID_SIZE);
}

export function patrolGridPadding([left, top, right, bottom]: Crop) {
  return Math.ceil(Math.max(right - left, bottom - top) * .075);
}

export function patrolRestPoint(crop: Crop, point: number): PatrolPoint {
  const [left, top, right, bottom] = crop;
  const column = point % PATROL_GRID_SIZE, row = Math.floor(point / PATROL_GRID_SIZE);
  const width = right - left, height = bottom - top, pad = patrolGridPadding(crop);
  const coordinate = (index: number, span: number) => index === 0 ? -pad : index === edge ? span + pad : index * span / edge;
  return [coordinate(column, width), coordinate(row, height)];
}

export function patrolGridPoint(crop: Crop, grid: PatrolGrid, point: number): PatrolPoint {
  if (grid.length === PATROL_VERTEX_COUNT) return grid[point];
  const i = patrolInteriorIndex(point);
  return i >= 0 ? grid[i] : patrolRestPoint(crop, point);
}

export function expandPatrolGrid(crop: Crop, grid: PatrolGrid): PatrolGrid {
  return grid.length === PATROL_VERTEX_COUNT ? grid
    : Array.from({ length: PATROL_VERTEX_COUNT }, (_, point) => patrolGridPoint(crop, grid, point));
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

function registerGrid(atlas: PatrolAtlas, frame: number, interior: PatrolGrid) {
  const { width, height, pixel, crops, hardpoints } = atlas;
  const crop = crops[frame], [left, top, right, bottom, pivotX, pivotY] = crop;
  const angle = (Math.PI / 2) * frame / (crops.length - 1), cos = Math.cos(angle), sin = Math.sin(angle);
  const xy: number[] = [], uv: number[] = [];
  const local = (x: number, y: number): PatrolPoint => {
    const dx = (x - pivotX) * pixel, dy = (y - pivotY) * pixel;
    return [cos * dx + sin * dy, sin * dx - cos * dy];
  };
  const grid = expandPatrolGrid(crop, interior);
  for (const [point, [u, v]] of grid.entries()) {
    const column = point % PATROL_GRID_SIZE, row = Math.floor(point / PATROL_GRID_SIZE);
    if ((column === 0 && u > 0) || (column === edge && u < right - left) ||
        (row === 0 && v > 0) || (row === edge && v < bottom - top)) {
      throw new Error('Patrol grid edge crosses the sprite crop');
    }
    if (((row === 0 || row === edge) && column > 0 && u <= grid[point - 1][0]) ||
        ((column === 0 || column === edge) && row > 0 && v <= grid[point - PATROL_GRID_SIZE][1])) {
      throw new Error('Patrol grid edges cross their neighbors');
    }
    const x = left + u, y = top + v;
    xy.push(...local(x, y));
    uv.push(x / width, 1 - y / height);
  }
  const mounts = hardpoints?.[frame].map(([x, y]) => {
    const [localX, localY] = local(x, y);
    // Mirroring changes the diagonal across a quad. Bind each mount to
    // the triangle that actually carries its source pixel.
    return { forward: bindAnchor(xy, localX, localY, false), mirrored: bindAnchor(xy, localX, localY, true) };
  });
  return { xy, uv, mounts, crop: new T.Vector4(left / width, 1 - bottom / height, right / width, 1 - top / height) };
}

function triangleArea(xy: number[], a: number, b: number, c: number) {
  return (xy[b] - xy[a]) * (xy[c + 1] - xy[a + 1]) - (xy[b + 1] - xy[a + 1]) * (xy[c] - xy[a]);
}

function registerHandoff(atlas: PatrolAtlas, handoff: number, grids: PatrolGridPair) {
  const outgoing = registerGrid(atlas, handoff, grids[0]), incoming = registerGrid(atlas, handoff + 1, grids[1]);
  const midpoint = outgoing.xy.map((coordinate, i) => (coordinate + incoming.xy[i]) / 2);
  for (const mirror of [false, true]) {
    const sign = mirror ? -1 : 1;
    const vertex = (index: number) => 2 * (mirror ? patrolMirrorPoint(index) : index);
    for (let i = 0; i < indices.length; i += 3) {
      const a = vertex(indices[i]), b = vertex(indices[i + 1]), c = vertex(indices[i + 2]);
      const start = sign * triangleArea(outgoing.xy, a, b, c), end = sign * triangleArea(incoming.xy, a, b, c);
      const middle = sign * triangleArea(midpoint, a, b, c);
      // Triangle area is quadratic in the interpolation weight. Check its
      // minimum, including any interior minimum between the two endpoints.
      const quadratic = 2 * (start + end - 2 * middle), linear = end - start - quadratic;
      const minimum = quadratic > 0 ? -linear / (2 * quadratic) : 0;
      const low = minimum > 0 && minimum < 1 ? start + minimum * (linear + minimum * quadratic) : Math.min(start, end);
      if (!(low > 1e-8)) throw new Error('Patrol handoff folds its mesh');
    }
  }
  return [outgoing, incoming] as const;
}

const legacyAtlas: PatrolAtlas = {
  width: 1536, height: 1024, pixel: .00525, crops,
  handoffs: crops.slice(0, -1).map((crop, i) => [uniformInterior(crop), uniformInterior(crops[i + 1])]),
};
const denseAtlas: PatrolAtlas = {
  width: 1254, height: 1254, pixel: .009, crops: turn16Crops,
  handoffs: turn16Handoffs, hardpoints: turn16Hardpoints,
};
const legacyHandoffs = legacyAtlas.handoffs.map((grids, i) => registerHandoff(legacyAtlas, i, grids));
const denseHandoffs = denseAtlas.handoffs.map((grids, i) => registerHandoff(denseAtlas, i, grids));

export function patrolAtlasFor(width: number, height: number) {
  if (width === height && width > 0) return denseAtlas;
  if (width / height === 1.5) return legacyAtlas;
  throw new Error('Unsupported patrol atlas layout');
}

export function patrolGridTurn(heading: number, poseCount: number) {
  const turn = denPatrolWarp(heading, poseCount);
  const atEnd = turn.first === turn.second;
  return {
    angle: turn.angle, mirror: turn.mirror, handoff: atEnd ? poseCount - 2 : turn.first,
    fraction: atEnd ? 1 : turn.fraction, blend: atEnd ? 1 : turn.blend,
  };
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
  let activeAtlas = denseAtlas, activeRegistration = denseAtlas.handoffs, handoffs = denseHandoffs;
  const uniforms = {
    atlas: { value: null as T.Texture | null },
    crop: { value: handoffs[0][0].crop }, nextCrop: { value: handoffs[0][1].crop }, poseBlend: { value: 0 },
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
  let textureKey = Infinity;
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

  function setRegistration(atlas: PatrolAtlas, registration = atlas.handoffs) {
    const defaults = atlas === denseAtlas ? denseHandoffs : legacyHandoffs;
    const next = registration === atlas.handoffs ? defaults : registration.map((grids, i) => {
      if (grids === atlas.handoffs[i]) return defaults[i];
      if (atlas === activeAtlas && grids === activeRegistration[i]) return handoffs[i];
      return registerHandoff(atlas, i, grids);
    });
    activeAtlas = atlas;
    activeRegistration = registration;
    handoffs = next;
    textureKey = Infinity;
  }

  function pose(heading: number, blendOverride?: number) {
    const { position, uv, nextUV } = buffers;
    const turn = patrolGridTurn(heading, handoffs.length + 1);
    const [a, b] = handoffs[turn.handoff];
    const sign = turn.mirror ? -1 : 1;
    const key = turn.mirror ? ~turn.handoff : turn.handoff;
    const updateUV = key !== textureKey;
    const t = turn.fraction;
    // Both grids reproduce the exact painted sprite at a key. Ease the local
    // deformation to rest there, so switching tessellations has no motion seam.
    const w = t * t * (3 - 2 * t);
    for (let i = 0; i < PATROL_VERTEX_COUNT; i++) {
      const j = turn.mirror ? patrolMirrorPoint(i) : i, x = 2 * j, y = x + 1;
      position.setXYZ(i, sign * T.MathUtils.lerp(a.xy[x], b.xy[x], w), T.MathUtils.lerp(a.xy[y], b.xy[y], w), 0);
      if (updateUV) {
        // The symmetric head-on grid shares its unmirrored texture in both directions.
        const k = (turn.handoff === 0 ? i : j) * 2;
        uv.setXY(i, a.uv[k], a.uv[k + 1]);
        nextUV.setXY(i, b.uv[x], b.uv[y]);
      }
    }
    position.needsUpdate = true;
    if (updateUV) {
      textureKey = key;
      uv.needsUpdate = nextUV.needsUpdate = true;
      uniforms.crop.value = a.crop;
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
