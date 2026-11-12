import * as T from 'three';
import type { Flight } from '../game';
import type { LevelId } from '../levels';
import { WING_FLASH_TIME, wingShots, type WingProjectile } from '../wing';

export const VICTORY_DURATION = 2.55;
export const SALUTE_START = 1.58;
export const SALUTE_ANGLE = Math.PI / 6;
const DEFEAT_DURATION = 1.5;
const flareTimes = [SALUTE_START, 1.96, 2.37];
const flareAngles = [-Math.PI / 9, 0, Math.PI / 9];
const lastWingShot = 2.44;

export function victoryFormation(time: number) {
  return T.MathUtils.smoothstep(time, .48, SALUTE_START);
}

export function addVictoryWingShots(shots: Flight['shots'], weapon: WingProjectile, upgraded: boolean,
  time: number, muzzle: T.Vector3, direction: T.Vector3) {
  const spec = wingShots[weapon];
  const speed = spec.speed * .7;
  let flash = 0;
  for (let launch = lastWingShot; launch >= SALUTE_START; launch -= spec.interval) {
    const age = time - launch;
    const travel = age * speed;
    if (age < 0 || travel > 6.1) continue;
    shots.push({
      x: muzzle.x + direction.x * travel, y: muzzle.y + direction.y * travel, z: muzzle.z + direction.z * travel,
      vx: direction.x * speed, vy: direction.y * speed, vz: direction.z * speed, wing: weapon, upgraded,
    });
    flash = Math.max(flash, 1 - age / WING_FLASH_TIME);
  }
  return flash;
}

const exits = {
  broodlock: { drift: [.9, -2.1, -4.4], pitch: .59, roll: .62 },
  io: { drift: [-.8, -1.7, -3], pitch: -.31, roll: -.24 },
  vents: { drift: [.5, -1.8, -5.4], pitch: .39, roll: .37 },
  titan: { drift: [2.2, 3.4, -17], pitch: .86, roll: .93 },
  heliostat: { drift: [-.9, -1.6, -4], pitch: -.35, roll: -.31 },
  ice: { drift: [-1.4, -2.6, -10], pitch: -.56, roll: -.42 },
  preserve: { drift: [1, -1.8, -3.5], pitch: .52, roll: .44 },
  summer: { drift: [.3, -.55, -5.8], pitch: .3, roll: -.18 },
  boulevard: { drift: [2.5, 2, -7.5], pitch: .31, roll: -.7 },
  biolume: { drift: [-2, 1, -6.5], pitch: -.63, roll: .66 },
  fleet: { drift: [2.1, 3.5, -14], pitch: .49, roll: -.82 },
  den: { drift: [-2.8, 1.3, -5.5], pitch: .42, roll: .96 },
  wormhole: { drift: [0, 3.3, -22], pitch: -.58, roll: -.71 },
} satisfies Record<LevelId, { drift: [number, number, number]; pitch: number; roll: number }>;

const bursts = [
  { at: 0, x: 0, y: .32 },
  { at: .22, x: -.82, y: .15 },
  { at: .46, x: .65, y: .7 },
  { at: .74, x: -.38, y: -.31 },
  { at: 1.02, x: .24, y: .47 },
];

export function createBossDefeat(boss: T.Group, plane: T.Group, level: LevelId) {
  // An identity parent leaves the authored rig and its local pose intact in combat.
  const parent = new T.Group();
  parent.name = 'boss-defeat';
  const visible = boss.visible;
  boss.parent!.add(parent);
  parent.add(boss);
  const path = exits[level];
  const core = boss.getObjectByName('laser_contact_C') ?? boss;
  const drift = new T.Vector3(...path.drift);
  const offset = new T.Vector3();
  const source = new T.Vector3();
  let nextBurst = 0;
  return {
    reset() {
      parent.position.set(0, 0, 0);
      parent.quaternion.identity();
      parent.scale.setScalar(1);
      boss.visible = visible;
      nextBurst = 0;
    },
    pose(time: number, emit: (source: T.Vector3, tint: number) => void) {
      boss.visible = time < DEFEAT_DURATION;
      if (!boss.visible) return false;
      const fall = T.MathUtils.smoothstep(time, .08, DEFEAT_DURATION);
      const scale = 1 - .99 * T.MathUtils.smoothstep(time, .62, DEFEAT_DURATION);
      const shake = .065 * Math.sin(time * 39) * (1 - T.MathUtils.smoothstep(time, 0, .54));
      parent.rotation.set(path.pitch * fall + shake, 0, path.roll * fall + shake * .6);
      parent.scale.setScalar(scale);
      offset.copy(boss.position).multiplyScalar(scale).applyQuaternion(parent.quaternion);
      parent.position.copy(boss.position).sub(offset).addScaledVector(drift, fall);

      let emitted = false;
      while (nextBurst < bursts.length && bursts[nextBurst].at <= time) {
        const { x, y } = bursts[nextBurst++];
        plane.worldToLocal(core.getWorldPosition(source));
        source.x += x;
        source.y += y;
        source.z += .52;
        emit(source, level === 'wormhole' ? 0xc58bff : nextBurst % 2 ? 0xffa361 : 0xffe2a2);
        emitted = true;
      }
      return emitted;
    },
  };
}

export function createVictoryFlares() {
  const streakGeometry = new T.PlaneGeometry(1, 1);
  const sparkGeometry = new T.OctahedronGeometry(.125);
  // The salute stays readable in front of overhead scenery after combat stops.
  const sparkMaterial = new T.MeshBasicMaterial({ color: 0xfff6df, toneMapped: false,
    transparent: true, depthTest: false, depthWrite: false });
  const streakMaterial = new T.ShaderMaterial({
    uniforms: { gold: { value: new T.Color(0xffb75f) }, white: { value: new T.Color(0xfff6df) } },
    transparent: true, blending: T.AdditiveBlending, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 gold, white;
      void main() {
        float lengthwise = vUv.y;
        float across = abs(vUv.x - 0.5) * 2.0;
        float plume = 1.0 - smoothstep(0.0, 0.16 + 0.78 * lengthwise, across);
        float tip = 1.0 - smoothstep(0.92, 1.0, lengthwise);
        gl_FragColor = vec4(mix(gold, white, plume * lengthwise), plume * lengthwise * tip);
        #include <colorspace_fragment>
      }`,
  });
  const root = new T.Group();
  root.name = 'victory-flares';
  root.visible = false;
  const flares = flareTimes.flatMap(launch => flareAngles.map(angle => {
    const flare = new T.Group();
    const spark = new T.Mesh(sparkGeometry, sparkMaterial);
    const streak = new T.Mesh(streakGeometry, streakMaterial);
    spark.renderOrder = 24;
    streak.renderOrder = 23;
    spark.scale.set(.88, 1.38, .88);
    flare.rotation.z = angle;
    flare.add(streak, spark);
    root.add(flare);
    return { flare, streak, launch, direction: new T.Vector3(-Math.sin(angle), Math.cos(angle), 0) };
  }));
  return {
    root,
    pose(time?: number) {
      root.visible = time !== undefined && time >= SALUTE_START;
      if (!root.visible || time === undefined) return;
      for (const { flare, streak, launch, direction } of flares) {
        const age = time - launch;
        flare.visible = age >= 0 && age < 1.04;
        if (!flare.visible) continue;
        flare.position.copy(direction).multiplyScalar(age * 4.35);
        flare.scale.setScalar(1 - .88 * T.MathUtils.smoothstep(age, .58, 1.04));
        const length = .47 + age * .73;
        streak.position.set(0, .08 - length / 2, -.018);
        streak.scale.set(.42, length, 1);
      }
    },
  };
}
