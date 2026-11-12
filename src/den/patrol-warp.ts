import * as T from 'three';
import { denPatrolWarp } from './patrol';
import { turn16Crops, turn16Hardpoints, turn16Rows } from './patrol-atlas-16';

const COLUMNS = 5;

// Atlas crops and chassis pivots in source pixels. UVs are normalized so the
// registrations also work with whole-canvas resizes.
const crops = [
  [97, 31, 313, 461, 206, 269],
  [466, 30, 681, 453, 567, 264],
  [837, 39, 1095, 441, 955, 262],
  [1184, 52, 1508, 423, 1335, 262],
  [24, 585, 370, 914, 201, 766],
  [389, 605, 747, 872, 569, 757],
  [768, 621, 1143, 865, 962, 755],
] as const;

// [height, left outline, interior landmark, right outline] after removing
// each view's yaw. The same rows follow the crest, snout, grips, engine and
// nose across views. Extra columns outside the outline preserve feather tips.
const rows = [
  [
    [-237, -5, 0, 5], [-219, -34, 0, 34], [-201, -58, 0, 58], [-183, -70, 0, 70], [-166, -68, 0, 68],
    [-148, -67, 0, 67], [-130, -66, 0, 66], [-112, -78, 0, 78], [-98, -86, 0, 86], [-84, -87, 0, 87],
    [-71, -83, 0, 83], [-57, -87, 0, 87], [-43, -96, 0, 96], [-27, -100, 0, 100], [-11, -104, 0, 104],
    [5, -108, 0, 108], [21, -90, 0, 90], [37, -87, 0, 87], [53, -83, 0, 83], [76, -43, 0, 43],
    [99, -38, 0, 38], [122, -31, 0, 31], [144, -23, 0, 23], [167, -14, 0, 14], [190, -7, 0, 7],
  ],
  [
    [-233, -29, -20, -19], [-213, -39, -5, 38], [-193, -66, -11, 57], [-173, -86, -18, 47], [-154, -81, -24, 54],
    [-134, -80, -31, 66], [-114, -79, -37, 68], [-94, -83, -44, 90], [-81, -89, -39, 92], [-68, -91, -34, 93],
    [-55, -89, -29, 92], [-42, -86, -24, 97], [-29, -87, -19, 101], [-14, -91, -17, 104], [0, -92, -15, 88],
    [14, -94, -13, 87], [29, -91, -11, 84], [44, -81, -9, 82], [58, -80, -7, 65], [80, -54, -6, 41],
    [102, -39, -5, 37], [124, -31, -3, 30], [147, -21, -2, 23], [169, -11, -1, 15], [191, -2, 0, 9],
  ],
  [
    [-229, -48, -13, -6], [-204, -63, -9, 21], [-179, -89, -21, 30], [-154, -109, -32, 26], [-128, -123, -44, 44],
    [-103, -116, -56, 67], [-78, -107, -67, 75], [-53, -111, -77, 77], [-43, -112, -70, 74], [-34, -112, -61, 74],
    [-24, -109, -52, 75], [-15, -107, -43, 75], [-5, -106, -34, 75], [8, -111, -25, 61], [20, -99, -17, 62],
    [32, -93, -9, 60], [45, -84, 0, 59], [58, -84, 9, 56], [70, -83, 17, 53], [93, -78, 6, 25],
    [116, -53, 6, 21], [138, -46, 1, 15], [161, -36, -4, 9], [184, -25, -10, 2], [207, -15, -13, -4],
  ],
  [
    [-233, -22, -13, -12], [-204, -79, -11, 10], [-175, -100, -24, 28], [-146, -115, -37, 43], [-116, -133, -50, 68],
    [-87, -134, -63, 81], [-58, -127, -76, 83], [-29, -111, -77, 76], [-19, -104, -71, 76], [-10, -101, -68, 75],
    [0, -98, -57, 76], [9, -97, -47, 75], [19, -99, -36, 63], [30, -98, -27, 64], [40, -75, -19, 63],
    [50, -66, -11, 62], [61, -66, -3, 61], [72, -66, 6, 59], [82, -64, 14, 51], [104, -60, 12, 33],
    [126, -43, 11, 29], [148, -34, 9, 25], [170, -23, 8, 21], [192, -11, 6, 16], [214, 0, 5, 12],
  ],
  [
    [-208, -62, -52, -51], [-177, -102, -39, -26], [-145, -112, -28, -2], [-114, -127, -43, 52], [-83, -139, -58, 89],
    [-52, -139, -73, 93], [-20, -133, -89, 86], [11, -115, -78, 87], [18, -108, -72, 87], [25, -102, -67, 88],
    [32, -93, -60, 87], [39, -75, -48, 74], [46, -76, -43, 77], [55, -69, -28, 77], [64, -44, -14, 77],
    [73, -40, 0, 76], [82, -39, 15, 75], [91, -38, 30, 74], [100, -35, 44, 66], [120, -29, 39, 54],
    [140, -19, 39, 52], [160, -9, 38, 49], [181, 4, 37, 46], [201, 18, 35, 44], [221, 31, 34, 42],
  ],
  [
    [-196, -74, -65, -64], [-164, -89, -35, -24], [-131, -120, -22, 61], [-99, -121, -34, 100], [-66, -125, -47, 107],
    [-34, -132, -59, 97], [-1, -122, -71, 99], [31, -97, -62, 93], [37, -88, -55, 90], [44, -80, -49, 91],
    [50, -34, -11, 91], [57, -31, -9, 91], [63, -30, -8, 91], [69, -28, -2, 91], [74, -26, 11, 91],
    [80, -24, 25, 90], [86, -22, 39, 84], [91, -14, 52, 83], [97, -12, 63, 80], [114, -6, 56, 70],
    [131, 1, 55, 68], [148, 11, 56, 67], [165, 24, 57, 65], [182, 38, 58, 64], [199, 50, 57, 62],
  ],
  [
    [-179, -92, -83, -82], [-146, -104, -8, 56], [-114, -128, -17, 99], [-81, -127, -26, 105], [-49, -124, -35, 99],
    [-16, -121, -45, 100], [16, -109, -54, 100], [49, -72, -41, 95], [54, -64, -35, 95], [59, -17, 3, 95],
    [63, -12, 7, 95], [68, -9, 9, 95], [73, -7, 11, 95], [76, -6, 19, 94], [79, -4, 28, 93],
    [82, -2, 38, 90], [86, -1, 51, 88], [89, 0, 60, 85], [92, 1, 66, 81], [109, 7, 66, 80],
    [127, 14, 66, 78], [144, 23, 66, 76], [161, 35, 65, 74], [179, 48, 64, 71], [196, 58, 63, 69],
  ],
] as const;

const vertexCount = rows[0].length * COLUMNS;
const indices: number[] = [];
for (let row = 0; row < rows[0].length - 1; row++) for (let column = 0; column < COLUMNS - 1; column++) {
  const i = row * COLUMNS + column;
  indices.push(i, i + COLUMNS, i + 1, i + 1, i + COLUMNS, i + COLUMNS + 1);
}

type PixelPoint = readonly [number, number];
type MeshAnchor = { vertices: [number, number, number]; weights: [number, number, number] };
export type PatrolBand = readonly [height: number, left: number, center: number, right: number, innerLeft?: number, innerRight?: number];

export type PatrolAtlas = {
  width: number;
  height: number;
  pixel: number;
  gutter: number;
  crops: readonly (readonly [number, number, number, number, number, number])[];
  rows: readonly (readonly PatrolBand[])[];
  bandYaw?: number;
  hardpoints?: readonly (readonly [PixelPoint, PixelPoint, PixelPoint])[];
};

export function patrolBandXs([, left, center, right, innerLeft = left, innerRight = right]: PatrolBand, gutter: number) {
  return [left - gutter, innerLeft, center, innerRight, right + gutter];
}

export function patrolBandAngle(atlas: PatrolAtlas, frame: number) {
  return (atlas.bandYaw ?? 1) * Math.PI / 2 * frame / (atlas.rows.length - 1);
}

// An anchor inherits the same triangle deformation as its pixel in the artwork.
function bindAnchor(xy: number[], x: number, y: number, mirror: boolean): MeshAnchor {
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    const va = 2 * (mirror ? mirrorColumn(a) : a);
    const vb = 2 * (mirror ? mirrorColumn(b) : b);
    const vc = 2 * (mirror ? mirrorColumn(c) : c);
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

function registerPoses(atlas: PatrolAtlas) {
  const { width, height, pixel, gutter, crops, rows, hardpoints } = atlas;
  const poses = rows.map((points, i) => {
    const [left, top, right, bottom, pivotX, pivotY] = crops[i];
    const angle = (Math.PI / 2) * i / (rows.length - 1);
    const band = patrolBandAngle(atlas, i), c = Math.cos(band), s = Math.sin(band);
    const turn = band - angle, cos = Math.cos(turn), sin = Math.sin(turn);
    const xy: number[] = [], uv: number[] = [];
    for (const point of points) for (const x of patrolBandXs(point, gutter)) {
      const y = point[0];
      xy.push((cos * x - sin * y) * pixel, -(sin * x + cos * y) * pixel);
      uv.push((pivotX + c * x - s * y) / width, 1 - (pivotY + s * x + c * y) / height);
    }
    const yawCos = Math.cos(angle), yawSin = Math.sin(angle);
    const mounts = hardpoints?.[i].map(([x, y]) => {
      const dx = (x - pivotX) * pixel, dy = (y - pivotY) * pixel;
      const localX = yawCos * dx + yawSin * dy, localY = yawSin * dx - yawCos * dy;
      // The mirrored columns change the diagonal across a quad. Bind the
      // point to the triangle the shader actually draws for each direction.
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

const legacyAtlas: PatrolAtlas = { width: 1536, height: 1024, pixel: .00525, gutter: 42, crops, rows };
const denseAtlas: PatrolAtlas = {
  width: 1254, height: 1254, pixel: .009, gutter: 24, crops: turn16Crops, rows: turn16Rows,
  bandYaw: .35, hardpoints: turn16Hardpoints,
};
const legacyPoses = registerPoses(legacyAtlas), densePoses = registerPoses(denseAtlas);

export function patrolAtlasFor(width: number, height: number) {
  if (width === height && width > 0) return denseAtlas;
  if (width / height === 1.5) return legacyAtlas;
  throw new Error('Unsupported patrol atlas layout');
}

function mirrorColumn(i: number) {
  return i + COLUMNS - 1 - 2 * (i % COLUMNS);
}

export function createPatrolWarpCard() {
  const geometry = new T.BufferGeometry();
  const position = new T.BufferAttribute(new Float32Array(vertexCount * 3), 3).setUsage(T.DynamicDrawUsage);
  const uv = new T.BufferAttribute(new Float32Array(vertexCount * 2), 2).setUsage(T.DynamicDrawUsage);
  const nextUV = new T.BufferAttribute(new Float32Array(vertexCount * 2), 2).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('uv', uv);
  geometry.setAttribute('nextUV', nextUV);
  geometry.setIndex(indices);
  let poses = legacyPoses;
  let dense = false;
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
    fragmentShader: `varying vec2 artUV, nextArtUV;
      uniform sampler2D atlas;
      uniform vec4 crop, nextCrop;
      uniform float poseBlend;
      vec4 samplePose(vec2 p, vec4 bounds) {
        vec4 art = texture2D(atlas, p);
        if (any(lessThan(p, bounds.xy)) || any(greaterThan(p, bounds.zw))) return vec4(0.0);
        float a = smoothstep(.27, .54, art.a);
        return vec4(art.rgb * a, a);
      }
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
  const root = new T.Mesh(geometry, material);
  root.name = 'patrol-heading';
  root.position.z = .19;
  root.visible = false;
  root.frustumCulled = false;
  let firstKey = Infinity, secondKey = Infinity;
  const mounts = [new T.Vector2(), new T.Vector2(), new T.Vector2()] as const;
  const nextMount = new T.Vector2();

  function placeAnchor(anchor: MeshAnchor, target: T.Vector2) {
    target.set(0, 0);
    for (let k = 0; k < 3; k++) {
      const i = anchor.vertices[k];
      target.x += anchor.weights[k] * position.getX(i);
      target.y += anchor.weights[k] * position.getY(i);
    }
  }

  function setRegistration(atlas: PatrolAtlas, bands = atlas.rows) {
    const next = bands === atlas.rows ? (atlas === denseAtlas ? densePoses : legacyPoses) : registerPoses({ ...atlas, rows: bands });
    poses = next;
    dense = atlas === denseAtlas;
    firstKey = secondKey = Infinity;
  }

  function pose(heading: number, blendOverride?: number) {
    const turn = denPatrolWarp(heading, poses.length);
    const a = poses[turn.first], b = poses[turn.second];
    const sign = turn.mirror ? -1 : 1;
    const keyA = turn.first * sign, keyB = turn.second * sign;
    const updateFirst = keyA !== firstKey, updateSecond = keyB !== secondKey;
    const t = turn.fraction;
    const w = dense ? t * t * (3 - 2 * t) : t;
    const tanA = dense ? t * (1 - t) ** 2 : 0;
    const tanB = dense ? t * t * (t - 1) : 0;
    for (let i = 0; i < vertexCount; i++) {
      // Reverse the columns when mirroring to retain front-face winding.
      const j = turn.mirror ? mirrorColumn(i) : i, x = 2 * j, y = x + 1;
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
