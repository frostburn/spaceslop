import * as T from 'three';
import { addBurner, burnerMaterial, poseBurners, shipBurners } from '../burners';
import { denPatrolBlend } from './patrol';

// Measured on the original 1536×1024 atlas. The last pair marks the same
// chassis point in every view, so cropped poses share a world-space pivot.
const frames = [
  [97, 31, 313, 461, 206, 269],
  [466, 30, 681, 453, 567, 264],
  [837, 39, 1095, 441, 955, 262],
  [1184, 52, 1508, 423, 1335, 262],
  [24, 585, 370, 914, 201, 766],
  [389, 605, 747, 872, 569, 757],
  [768, 621, 1143, 865, 962, 755],
] as const;

const crops = frames.map(([left, top, right, bottom, x, y]) => ({
  bounds: new T.Vector4(left / 1536, 1 - bottom / 1024, right / 1536, 1 - top / 1024),
  pivot: new T.Vector2(x / 1536, 1 - y / 1024),
}));

function patrolMaterial() {
  const uniforms = {
    atlas: { value: null as T.Texture | null },
    cropA: { value: crops[0].bounds }, cropB: { value: crops[0].bounds },
    pivotA: { value: crops[0].pivot }, pivotB: { value: crops[0].pivot },
    orientationA: { value: new T.Vector3(1, 0, 1) }, orientationB: { value: new T.Vector3(1, 0, 1) },
    poseMix: { value: 0 },
  };
  return new T.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    vertexShader: `varying vec2 cardPoint;
      void main() {
        cardPoint = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `varying vec2 cardPoint;
      uniform sampler2D atlas;
      uniform vec4 cropA, cropB;
      uniform vec2 pivotA, pivotB;
      uniform vec3 orientationA, orientationB;
      uniform float poseMix;
      vec4 samplePose(vec4 crop, vec2 pivot, vec3 turn) {
        vec2 p = mat2(turn.x, -turn.y, turn.y, turn.x) * cardPoint;
        p.x *= turn.z;
        vec2 uv = pivot + p / (vec2(1536.0, 1024.0) * .00525);
        vec4 color = texture2D(atlas, uv);
        if (any(lessThan(uv, crop.xy)) || any(greaterThan(uv, crop.zw))) return vec4(0.0);
        color.a = smoothstep(.27, .54, color.a);
        return vec4(color.rgb * color.a, color.a);
      }
      void main() {
        vec4 pose = mix(samplePose(cropA, pivotA, orientationA), samplePose(cropB, pivotB, orientationB), poseMix);
        if (pose.a < .005) discard;
        gl_FragColor = vec4(pose.rgb / pose.a, pose.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <premultiplied_alpha_fragment>
      }`,
  });
}

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
  const geometry = new T.PlaneGeometry(3, 3);
  const model = placeholder();
  const jets = burnerMaterial(0xff812d);
  const warningShape = new T.RingGeometry(.047, .096, 14);
  const warningMaterial = new T.MeshBasicMaterial({ color: 0xffb650, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  const rigs = Array.from({ length: count }, () => {
    const root = new T.Group(), effects = new T.Group(), fallback = model.clone();
    root.name = 'draconian-patrol';
    const art = patrolMaterial(), uniforms = art.uniforms;
    const card = new T.Mesh(geometry, art);
    card.name = 'patrol-heading';
    card.position.z = .19;
    card.visible = false;
    for (const x of [-.36, .36]) addBurner(effects, jets, x, .42, -.13, .14, .87).rotation.z = Math.PI;
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
      useArt(map: T.Texture) { uniforms.atlas.value = map; card.visible = true; fallback.visible = false; },
      pose(x: number, y: number, heading: number, size: number, throttle: number, charge: number, time: number) {
        root.visible = true;
        root.position.set(x, y, .12);
        root.scale.setScalar(size);
        if (card.visible) {
          const turn = denPatrolBlend(heading);
          const first = crops[turn.first], second = crops[turn.second];
          uniforms.cropA.value = first.bounds;
          uniforms.cropB.value = second.bounds;
          uniforms.pivotA.value = first.pivot;
          uniforms.pivotB.value = second.pivot;
          uniforms.orientationA.value.set(Math.cos(turn.firstBank), Math.sin(turn.firstBank), turn.mirror && turn.first > 0 ? -1 : 1);
          uniforms.orientationB.value.set(Math.cos(turn.secondBank), Math.sin(turn.secondBank), turn.mirror && turn.second > 0 ? -1 : 1);
          uniforms.poseMix.value = turn.mix;
        }
        effects.rotation.z = fallback.rotation.z = heading;
        poseBurners(plumes, time, throttle);
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
