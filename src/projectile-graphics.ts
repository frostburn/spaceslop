import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shipAlloy } from './encounter-surfaces';
import type { Flight } from './game';
import { wingWeapons } from './wing';

type Shot = Flight['shots'][number];
export const projectileKinds = ['ship', 'drone', 'homing', 'cannon', 'omega', 'hostile', 'spore'] as const;
export type ProjectileKind = typeof projectileKinds[number];
export const projectileNames: Record<ProjectileKind, string> = {
  ship: 'Ship pulse', drone: 'Drone pulse', homing: 'Homing missile', cannon: 'Cannon tracer',
  omega: 'Omega lance', hostile: 'Hostile plasma', spore: 'Hive spore',
};
const colors = { ship: 0x88f2ff, drone: 0xa1ffc5, homing: wingWeapons.homing.color,
  cannon: wingWeapons.cannon.color, omega: wingWeapons.omega.color, hostile: 0xff7749, spore: 0xfaa04c };
const pulse = new T.LatheGeometry([[0, -0.35], [0.6, -0.28], [1, 0.06], [0.55, 0.38], [0, 0.6]]
  .map(([r, y]) => new T.Vector2(r, y)), 10);
const slug = new T.LatheGeometry([[0, -0.45], [0.95, -0.45], [0.95, 0.18], [0.7, 0.38], [0, 0.52]]
  .map(([r, y]) => new T.Vector2(r, y)), 8);
const orb = new T.SphereGeometry(1, 14, 10);
const seed = new T.IcosahedronGeometry(1, 2);
const seedPosition = seed.getAttribute('position');
for (let i = 0; i < seedPosition.count; i++) {
  const x = seedPosition.getX(i), y = seedPosition.getY(i), z = seedPosition.getZ(i);
  const r = 1 + Math.sin(Math.atan2(x, z) * 5 + y * 3) * 0.06;
  seedPosition.setXYZ(i, x * r, y * r, z * r);
}
seed.computeVertexNormals();
const tail = new T.LatheGeometry([[0, -1], [0.28, -0.72], [0.72, -0.28], [1, 0]]
  .map(([r, y]) => new T.Vector2(r, y)), 10);
const omegaRing = new T.TorusGeometry(0.18, 0.022, 5, 12).rotateX(Math.PI / 2).translate(0, -0.22, 0);
const missile = mergeGeometries([
  new T.CylinderGeometry(0.061, 0.068, 0.3, 10),
  new T.ConeGeometry(0.062, 0.15, 10).translate(0, 0.225, 0),
  ...[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => {
    const fin = new T.Shape();
    fin.moveTo(0.035, -0.05); fin.lineTo(0.155, -0.19); fin.lineTo(0.045, -0.16);
    return new T.ShapeGeometry(fin).rotateY(angle);
  }),
]);
const missileBand = new T.CylinderGeometry(0.069, 0.069, 0.065, 10).translate(0, 0.025, 0);
const forward = new T.Vector3(0, 1, 0);
const white = new T.Color(0xfff8e6);

function energyMaterial(color: number, danger: boolean) {
  return new T.ShaderMaterial({
    uniforms: { tint: { value: new T.Color(color) }, hot: { value: white.clone() }, edge: { value: danger ? 0.12 : 0.48 } },
    vertexShader: `varying vec3 vNormal, vView;
      void main() {
        vec4 eye = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 n = normal / vec3(dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz),
          dot(instanceMatrix[1].xyz, instanceMatrix[1].xyz), dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz));
        vNormal = normalMatrix * mat3(instanceMatrix) * n; vView = -eye.xyz;
        gl_Position = projectionMatrix * eye;
      }`,
    fragmentShader: `uniform vec3 tint, hot; uniform float edge; varying vec3 vNormal, vView;
      void main() {
        float facing = max(0.0, dot(normalize(vNormal), normalize(vView)));
        vec3 color = mix(tint * edge, tint, smoothstep(0.15, 0.55, facing));
        color = mix(color, hot, smoothstep(0.67, 0.98, facing));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

function trailMaterial(color: number) {
  return new T.ShaderMaterial({
    uniforms: { tint: { value: new T.Color(color) }, clock: { value: 0 } },
    transparent: true, blending: T.AdditiveBlending, depthWrite: false,
    vertexShader: `varying float along; varying vec3 vNormal, vView;
      void main() {
        vec4 eye = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 n = normal / vec3(dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz),
          dot(instanceMatrix[1].xyz, instanceMatrix[1].xyz), dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz));
        along = uv.y; vNormal = normalMatrix * mat3(instanceMatrix) * n; vView = -eye.xyz;
        gl_Position = projectionMatrix * eye;
      }`,
    fragmentShader: `uniform vec3 tint; uniform float clock; varying float along; varying vec3 vNormal, vView;
      void main() {
        float center = max(0.0, dot(normalize(vNormal), normalize(vView)));
        float pulse = 0.85 + 0.15 * sin(along * 24.0 - clock * 37.0);
        gl_FragColor = vec4(mix(tint, vec3(1.0), pow(along, 5.0) * 0.45),
          pow(along, 1.8) * (0.12 + 0.45 * center) * pulse);
        #include <colorspace_fragment>
      }`,
  });
}

export function createProjectileBatch(kind: ProjectileKind) {
  const root = new T.Group();
  root.name = `projectiles-${kind}`;
  const danger = kind === 'hostile' || kind === 'spore';
  const material = kind === 'homing' ? shipAlloy(0xb7c9cc) : energyMaterial(colors[kind], danger);
  if (kind === 'homing') material.side = T.DoubleSide;
  const geometry = kind === 'homing' ? missile : kind === 'hostile' ? orb : kind === 'spore' ? seed : kind === 'cannon' ? slug : pulse;
  const body = new T.InstancedMesh(geometry, material, 128);
  const glowMaterial = trailMaterial(colors[kind]);
  const trails = new T.InstancedMesh(tail, glowMaterial, 128);
  const trim = kind === 'homing' || kind === 'omega' ? new T.InstancedMesh(kind === 'homing' ? missileBand : omegaRing,
    new T.MeshBasicMaterial({ color: colors[kind], side: T.DoubleSide }), 128) : undefined;
  const layers = trim ? [body, trails, trim] : [body, trails];
  for (const mesh of layers) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    root.add(mesh);
  }
  root.visible = false;
  const matrix = new T.Matrix4(), rotation = new T.Quaternion(), roll = new T.Quaternion();
  const position = new T.Vector3(), direction = new T.Vector3(), scale = new T.Vector3();
  const width = kind === 'omega' ? 0.15 : kind === 'drone' ? 0.067 : kind === 'cannon' ? 0.08 : danger ? 0.16 : 0.065;
  const length = kind === 'omega' ? 0.9 : kind === 'cannon' ? 0.48 : kind === 'drone' ? 0.34 : danger ? 0.16 : 0.46;
  const tailLength = kind === 'omega' ? 1.1 : kind === 'homing' ? 0.55 : danger ? 0.22 : 0.48;

  function draw(shots: readonly Shot[], time: number) {
    const count = Math.min(shots.length, 128);
    for (const mesh of layers) mesh.count = count;
    root.visible = count > 0;
    glowMaterial.uniforms.clock.value = time;
    for (let i = 0; i < count; i++) {
      const shot = shots[i];
      direction.set(shot.vx, shot.vy, shot.vz);
      const speed = direction.length();
      if (speed < 1e-6) direction.copy(forward); else direction.divideScalar(speed);
      rotation.setFromUnitVectors(forward, direction);
      if (kind === 'omega') rotation.multiply(roll.setFromAxisAngle(forward, time * 6 + i));
      const charge = shot.drone && (shot.damage ?? 1) > 1 ? 1.25 : 1;
      position.set(shot.x, shot.y, shot.z + 0.12);
      scale.set(kind === 'homing' ? 1 : width, kind === 'homing' ? 1 : length, kind === 'homing' ? 1 : width)
        .multiplyScalar(charge);
      matrix.compose(position, rotation, scale); body.setMatrixAt(i, matrix);
      if (trim) {
        matrix.compose(position, rotation, scale.setScalar(charge)); trim.setMatrixAt(i, matrix);
      }
      position.addScaledVector(direction, kind === 'homing' ? -0.16 : -0.06);
      const flicker = 0.94 + Math.sin(time * 34 + i * 2.4) * 0.06;
      scale.set((kind === 'omega' ? 0.16 : danger ? 0.085 : 0.07) * charge,
        tailLength * T.MathUtils.clamp(speed / 15, 0.7, 1.7) * flicker, (kind === 'omega' ? 0.16 : danger ? 0.085 : 0.07) * charge);
      matrix.compose(position, rotation, scale); trails.setMatrixAt(i, matrix);
    }
    for (const mesh of layers) mesh.instanceMatrix.needsUpdate = true;
  }
  return { root, draw, prime: () => draw([{ x: 0, y: 0, z: 0, vx: 0, vy: 15, vz: 0 }], 0) };
}

export function createMuzzleFlash(color: number) {
  const root = new T.Group();
  const outer = new T.Mesh(new T.ConeGeometry(0.11, 0.38, 5).translate(0, 0.14, 0),
    new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, blending: T.AdditiveBlending, depthWrite: false }));
  root.add(outer, new T.Mesh(new T.OctahedronGeometry(0.085), new T.MeshBasicMaterial({ color: 0xfffae8 })));
  root.visible = false;
  let remaining = 0;
  return {
    root,
    update(elapsed: number, fired: boolean) {
      remaining = fired ? 0.085 : Math.max(0, remaining - elapsed);
      root.visible = remaining > 0;
      root.scale.setScalar(0.6 + remaining / 0.085 * 0.75);
    },
    clear() { remaining = 0; root.visible = false; },
    prime() { root.visible = true; root.scale.setScalar(1); },
  };
}

export function createContinuousLaser() {
  const root = new T.Group(), beam = new T.Group();
  const material = new T.ShaderMaterial({
    uniforms: { clock: { value: 0 }, tint: { value: new T.Color(wingWeapons.laser.color) } },
    transparent: true, blending: T.AdditiveBlending, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float clock; uniform vec3 tint;
      void main() {
        float edge = pow(max(0.0, 1.0 - abs(vUv.x - 0.5) * 2.0), 1.7);
        float ripple = 0.35 + 0.3 * pow(0.5 + 0.5 * sin(vUv.y * 55.0 - clock * 31.0), 4.0);
        gl_FragColor = vec4(tint, edge * ripple);
        #include <colorspace_fragment>
      }`,
  });
  beam.add(new T.Mesh(new T.PlaneGeometry(0.24, 1), material),
    new T.Mesh(new T.PlaneGeometry(0.043, 1), new T.MeshBasicMaterial({ color: 0xffe8fc, transparent: true, opacity: 0.94, depthWrite: false })));
  const impact = new T.Group(); impact.name = 'laser-contact'; impact.renderOrder = 21;
  const glint = new T.Mesh(new T.PlaneGeometry(0.38, 0.038), new T.MeshBasicMaterial({
    color: 0xffdbf7, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending }));
  const cross = glint.clone(); cross.rotation.z = Math.PI / 2;
  const halo = new T.Mesh(new T.RingGeometry(0.11, 0.15, 20), new T.MeshBasicMaterial({
    color: wingWeapons.laser.color, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false,
    blending: T.AdditiveBlending }));
  const core = new T.Mesh(new T.OctahedronGeometry(0.085), new T.MeshBasicMaterial({
    color: 0xfff5fc, transparent: true, depthTest: false, depthWrite: false }));
  impact.add(glint, cross, halo, core);
  for (const mesh of impact.children) mesh.renderOrder = 21;
  root.add(beam, impact);
  root.visible = false;
  function draw(origin: { x: number; y: number }, end: { x: number; y: number }, hold: number, time: number, contact: boolean) {
    const dx = end.x - origin.x, dy = end.y - origin.y;
    beam.position.set((origin.x + end.x) / 2, (origin.y + end.y) / 2, 0.055);
    beam.rotation.z = Math.atan2(-dx, dy);
    beam.scale.set(1 + Math.min(hold, 0.85) * 0.75, Math.hypot(dx, dy), 1);
    material.uniforms.clock.value = time;
    impact.visible = contact;
    impact.position.set(end.x, end.y, 0.11);
    impact.rotation.z = time * 8;
    impact.scale.setScalar(0.65 + Math.min(hold, 0.85) * 0.55 + Math.sin(time * 36) * 0.08);
  }
  return { root, draw, prime() { root.visible = true; draw({ x: 0, y: 0 }, { x: 0, y: 4 }, 1, 0, true); } };
}
