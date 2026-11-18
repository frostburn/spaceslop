import * as T from 'three';
import { BOSS_MUZZLE_Z } from './encounters';
import { applySurfaceMap } from './encounter-surfaces';
import { part, pivot } from './rig-geometry';
import { crabFeet, CRAB_LEGS, CRAB_TARGET_X } from './vent-crab';
import { VENT_APPROACH, VENT_CRAB_SCALE, VENT_DURATION } from './vent-layout';
import { crabApron, crabArm, crabBarnacles, crabCarapace, crabCup, crabFemur, crabHook,
  crabPalm, crabTibia, crabToe, paintCrabTile } from './vent-crab-geometry';

// Match the inner-to-outer order of the wall contacts. The last two values
// are the rigid femur and tibia lengths for that socket.
const legMounts = [
  [1.12, -0.78, 0, 2.13, 2.52],
  [1.46, -0.51, -0.07, 2.09, 2.46],
  [1.76, -0.24, -0.14, 2.13, 2.43],
  [2.03, 0.04, -0.20, 2.22, 2.45],
] as const;
const muzzle = CRAB_TARGET_X / VENT_CRAB_SCALE, contactZ = BOSS_MUZZLE_Z + 0.015;
const ball = new T.SphereGeometry(1, 18, 12);
const tooth = new T.ConeGeometry(1, 1, 8);
const chargeRing = new T.RingGeometry(0.29, 0.355, 36);

function createCrabMaterial() {
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.67, metalness: 0.10 });
  m.onBeforeCompile = shader => {
    shader.vertexShader = `varying float crabFace;\n${shader.vertexShader}`.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ncrabFace = normal.z;');
    shader.fragmentShader = `varying float crabFace;\n${shader.fragmentShader}`.replace('#include <map_fragment>',
      T.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;', `
        float paintCoverage = smoothstep(0.04, 0.67, crabFace) * sampledDiffuseColor.a;
        diffuseColor.rgb = mix(diffuseColor.rgb, sampledDiffuseColor.rgb, paintCoverage);
      `)).replace('#include <opaque_fragment>', `
        #ifdef USE_MAP
          // Keep some of the baked light from the atlas on the raised armor.
          outgoingLight = mix(outgoingLight, outgoingLight * 0.38 + sampledDiffuseColor.rgb * 0.80, paintCoverage);
        #endif
        #include <opaque_fragment>
      `);
  };
  m.customProgramCacheKey = () => 'crab-projected-paint';
  return m;
}

const calcareous = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 });
const membrane = new T.MeshStandardMaterial({ color: 0x2c3335, roughness: 0.74 });
const ivory = new T.MeshStandardMaterial({ color: 0xbca888, roughness: 0.58 });
const lens = new T.MeshStandardMaterial({ color: 0x172933, roughness: 0.22, metalness: 0.28 });
const stem = paintCrabTile(crabHook([[0, -0.09, 0], [0.04, 0.16, 0.06], [0.095, 0.40, 0.14], [0.12, 0.55, 0.18]],
  [0.16, 0.125, 0.098, 0.14], 0.89, false), 9, [-0.24, -0.11, 0.28, 0.75]);
const eyeHousing = crabCup([[0, -0.18], [0.62, -0.16], [0.97, -0.09], [1, 0.02], [0.85, 0.095],
  [0.65, 0.065], [0.51, -0.032], [0, -0.054]], 0.205, 0.195, 9);
const fingerGeometry = paintCrabTile(crabHook([[0, -0.10, 0], [0.24, 0.20, 0.018], [0.30, 0.58, 0.028],
  [0.17, 0.85, 0.008], [-0.13, 1.09, -0.016]], [0.22, 0.225, 0.175, 0.095, 0], 0.92, true),
  8, [-0.28, -0.19, 0.56, 1.13], [0.08, 0.10, 0.96, 1]);
const fixedFinger = paintCrabTile(crabHook([[0.48, 1.15, 0.23], [0.27, 1.46, 0.26], [0.26, 1.76, 0.25],
  [0.45, 2.04, 0.21], [0.72, 2.17, 0.17]], [0.29, 0.25, 0.183, 0.092, 0], 0.95, true),
  7, [0.04, 0.76, 0.98, 2.27], [0.01, 0.43, 0.46, 1]);
const clawSocket = crabCup([[0, -0.44], [0.63, -0.38], [0.97, -0.24], [1.04, -0.07], [1, 0.041],
  [0.82, 0.073], [0.72, 0.009], [0.63, -0.112], [0.37, -0.21], [0, -0.22]], 0.495, 0.445, 11);
const chamber = crabCup([[0, -0.51], [0.58, -0.49], [0.89, -0.34], [1, -0.11], [0.986, 0.045],
  [0.89, 0.072], [0.81, -0.025], [0.68, -0.122], [0.42, -0.24], [0, -0.30]], 1.02, 0.77, 2);

const fin = new T.Shape();
fin.moveTo(0, -0.048);
fin.bezierCurveTo(0.20, -0.15, 0.39, -0.20, 0.60, -0.25);
fin.bezierCurveTo(0.48, -0.10, 0.25, 0.078, 0, 0.079);
fin.closePath();
const gillFin = new T.ExtrudeGeometry(fin, { depth: 0.049, bevelEnabled: true, bevelThickness: 0.020,
  bevelSize: 0.014, bevelSegments: 2, curveSegments: 8 });
const gillTissue = new T.MeshStandardMaterial({ color: 0x789b90, roughness: 0.64, emissive: 0x246451, emissiveIntensity: 0.21 });

const bodyGrowth = crabBarnacles(crabCarapace, [[-1.92, 0.46, 0.21], [-1.22, 1.04, 0.22], [-0.42, 1.2, 0.137],
  [1.01, 1.03, 0.205], [1.76, 0.67, 0.24], [2.06, -0.24, 0.18], [-1.64, -0.43, 0.13],
  [-1.55, 0.53, 0.195, true], [0.25, 0.96, 0.18, true], [1.47, -0.42, 0.17, true]]);
const clawGrowth = crabBarnacles(crabPalm, [[0.44, -0.11, 0.235], [-0.20, -0.22, 0.17], [0.18, 0.40, 0.13],
  [0.20, 0.19, 0.15, true], [-0.45, -0.05, 0.12, true]]);
const legGrowth = crabBarnacles(crabFemur, [[0.10, -0.11, 0.14], [-0.14, 0.14, 0.105]]);

function createBiolight() {
  return new T.MeshStandardMaterial({ color: 0x437f73, roughness: 0.37, emissive: 0x51dcb1, emissiveIntensity: 0.2 });
}

export function createVentBoss() {
  const root = new T.Group();
  root.name = 'barnacled-rim-crab';
  root.scale.setScalar(VENT_CRAB_SCALE);
  const shell = createCrabMaterial();

  const along = new T.Vector3(), across = new T.Vector3(), front = new T.Vector3(), axes = new T.Matrix4();
  function span(mesh: T.Mesh, from: T.Vector3, to: T.Vector3, length = from.distanceTo(to)) {
    mesh.position.copy(from).lerp(to, 0.5);
    along.subVectors(from, to).normalize();
    across.set(along.y, -along.x, 0);
    if (across.lengthSq() < 1e-8) across.set(along.z, 0, -along.x);
    across.normalize();
    front.crossVectors(across, along);
    mesh.quaternion.setFromRotationMatrix(axes.makeBasis(across, along, front));
    mesh.scale.y = length;
  }

  part(root, crabCarapace, shell, 0, 0, 0).name = 'crab-carapace';
  part(root, bodyGrowth, calcareous, 0, 0, 0).name = 'crab-barnacle-colony';
  const legs = Array.from({ length: CRAB_LEGS }, (_, i) => {
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
    const [x, y, z, upperLength, lowerLength] = legMounts[row];
    const hip = new T.Vector3(side * x, y, z);
    const upper = part(root, crabFemur, shell, 0, 0, 0), lower = part(root, crabTibia, shell, 0, 0, 0);
    const toe = part(root, crabToe, shell, 0, 0, 0), knee = part(root, ball, membrane, 0, 0, 0);
    const socket = part(root, ball, membrane, hip.x, hip.y, hip.z);
    socket.scale.set(0.294, 0.268, 0.30);
    knee.scale.set(0.24, 0.225, 0.23);
    upper.name = `crab-leg-upper-${i}`;
    lower.name = `crab-leg-lower-${i}`;
    toe.name = `crab-foot-${i}`;
    knee.name = `crab-knee-${i}`;
    upper.scale.set(side * (0.80 + 0.047 * row), 1, 0.84);
    lower.scale.set(side * (0.79 + 0.039 * row), 1, 0.84);
    toe.scale.x = side;
    part(upper, legGrowth, calcareous, 0, 0, 0).name = 'crab-barnacle-colony';
    return { side, hip, upper, lower, toe, knee, upperLength, lowerLength };
  });

  const eyes = [-1, 1].map(side => {
    const eye = pivot(root, `crab-eye-${side}`, side * 0.86, 0.68, 0.36);
    eye.scale.x = side;
    part(eye, stem, shell, 0, 0, 0);
    part(eye, eyeHousing, shell, 0.12, 0.58, 0.21);
    part(eye, ball, lens, 0.12, 0.58, 0.239).scale.set(0.128, 0.122, 0.103);
    return { side, eye };
  });

  const gills = pivot(root, 'crab-gill-chamber', 0, 0, 0.82);
  part(gills, chamber, shell, 0, 0, 0);
  const fins = [-1, 1].flatMap(side => Array.from({ length: 4 }, (_, i) => {
    const y = 0.46 - i * 0.244;
    const lamella = part(gills, gillFin, gillTissue, side * (0.84 - Math.abs(y) * 0.39), y, -0.18);
    lamella.scale.set(-side * (1 - Math.abs(y) * 0.28), 0.84, 1);
    return { side, i, lamella };
  }));
  const centerLight = part(root, ball, createBiolight(), 0, 0, 0.70);
  centerLight.name = 'crab-gill-vent';
  centerLight.scale.set(0.20, 0.24, 0.10);
  const center = pivot(root, 'laser_contact_C', 0, 0, contactZ);
  const apron = [-1, 1].map(side => {
    const hinge = pivot(root, `crab-apron-${side}`, side * 1.245, -0.16, side < 0 ? 0.956 : 0.970);
    hinge.scale.x = side;
    part(hinge, crabApron(side), shell, 0, 0, 0);
    part(hinge, ball, membrane, 0, 0, -0.09).scale.set(0.31, 0.42, 0.21);
    return { side, hinge };
  });

  function teeth(parent: T.Group, sites: readonly (readonly [number, number, number])[], direction: number) {
    for (const [x, y, size] of sites) {
      const prong = part(parent, tooth, ivory, x, y, 0.2);
      prong.rotation.z = -direction * 1.26;
      prong.scale.set(size * 0.48, size, size * 0.50);
    }
  }

  const foreStart = new T.Vector3(), foreEnd = new T.Vector3(0.91, 0.65, 0.18);
  const claws = [-1, 1].map((side, i) => {
    const crusher = side < 0, shoulder = new T.Vector3(side * 1.51, 0.075, -0.025);
    const upper = part(root, crabArm, shell, 0, 0, 0);
    upper.name = `crab-claw-arm-${i}`;
    const hinge = pivot(root, crusher ? 'crab-crusher' : 'crab-cutter', side * muzzle, 0, 0.45);
    hinge.scale.x = side;
    part(hinge, ball, membrane, 0, 0, -0.014).scale.set(0.345, 0.312, 0.352);
    span(part(hinge, crabArm, shell, 0, 0, 0), foreStart, foreEnd);
    const palm = pivot(hinge, `crab-palm-${i}`, 0.91, 0.79, 0.21);
    palm.scale.set(crusher ? 1.15 : 0.91, crusher ? 1.04 : 0.96, crusher ? 1.19 : 0.92);
    part(palm, crabPalm, shell, 0, 0, 0);
    part(palm, clawGrowth, calcareous, 0, 0, 0).name = 'crab-barnacle-colony';
    part(hinge, fixedFinger, shell, 0, 0, 0).scale.z = crusher ? 1.22 : 0.93;
    teeth(hinge, [[0.50, 1.48, 0.25], [0.48, 1.72, 0.22], [0.56, 1.93, 0.18]], 1);
    const finger = pivot(hinge, `crab-finger-${i}`, 1.32, 1.23, 0.22);
    finger.scale.set(crusher ? 1.11 : 0.97, crusher ? 0.84 : 1.015, crusher ? 1.18 : 0.88);
    part(finger, ball, membrane, 0, 0, -0.032).scale.set(0.245, 0.23, 0.21);
    part(finger, fingerGeometry, shell, 0, 0, 0).name = `crab-finger-blade-${i}`;
    teeth(finger, [[0.10, 0.31, 0.26], [0.12, 0.52, 0.21], [0.10, 0.72, 0.16]], -1);

    const joint = pivot(root, `crab-claw-joint-${i}`, side * muzzle, 0, 0.78);
    part(joint, clawSocket, shell, 0, 0, 0);
    const light = part(joint, ball, createBiolight(), 0, 0, -0.029);
    light.scale.set(0.246, 0.207, 0.075);
    const glow = part(joint, chargeRing, new T.MeshBasicMaterial({ color: 0x70ffd3, transparent: true,
      blending: T.AdditiveBlending, depthWrite: false, opacity: 0.18 }), 0, 0, 0.091);
    const anchor = pivot(root, side < 0 ? 'laser_contact_L' : 'laser_contact_R', side * muzzle, 0, contactZ);
    return { side, i, shoulder, upper, hinge, finger, joint, light, glow, anchor };
  });

  const foot = new T.Vector3(), ankle = new T.Vector3(), knee = new T.Vector3();
  const reach = new T.Vector3(), bend = new T.Vector3();
  function pose(reveal: number, windup: number, targetX: number, firedX: number, recoil: number,
    time = 0, broken: readonly number[] = [0, 0], opening = 0) {
    const feet = crabFeet(reveal, Math.max(0, time - VENT_DURATION - VENT_APPROACH));
    for (const [i, leg] of legs.entries()) {
      const { side, hip, upperLength, lowerLength } = leg;
      foot.copy(feet[i]).divideScalar(VENT_CRAB_SCALE);
      ankle.set(foot.x - side * 0.16, foot.y + 0.50, foot.z + 0.13);
      reach.subVectors(ankle, hip);
      const distance = reach.length();
      reach.divideScalar(distance);
      bend.set(side * 0.33, 1, -0.13).addScaledVector(reach, -bend.dot(reach)).normalize();
      const down = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
      const up = Math.sqrt(Math.max(0, upperLength ** 2 - down ** 2));
      knee.copy(hip).addScaledVector(reach, down).addScaledVector(bend, up);
      span(leg.upper, hip, knee, upperLength);
      span(leg.lower, knee, ankle, lowerLength);
      span(leg.toe, ankle, foot);
      leg.knee.position.copy(knee);
    }
    for (const { side, eye } of eyes) eye.rotation.set(windup * 0.14, 0, side * (0.08 + Math.sin(time * 0.72) * 0.062));
    for (const { side, hinge } of apron) hinge.rotation.y = side * opening * 1.30;
    for (const { side, i, lamella } of fins) {
      lamella.rotation.y = side * (0.20 + opening * (0.28 * windup + 0.115 * Math.sin(time * 5.7 - i * 0.83)));
    }
    const coreKick = targetX === 0 ? recoil * 0.06 : 0;
    gills.position.z = 0.82 - coreKick;
    center.position.z = contactZ - coreKick;
    centerLight.position.z = 0.70 - coreKick;
    centerLight.material.emissiveIntensity = 0.08 + (0.48 + 1.25 * windup) * opening;
    centerLight.scale.set(0.20 + opening * windup * 0.10, 0.24 + opening * windup * 0.08, 0.10);
    for (const c of claws) {
      const sag = broken[c.i] ?? 0, active = Math.sign(targetX) === c.side && sag === 0;
      const charge = active ? windup : 0, kick = Math.sign(firedX) === c.side ? recoil : 0;
      c.hinge.rotation.z = -c.side * (sag * 0.99 + 0.038 * Math.sin(time * 0.9 + c.i) + 0.10 * kick);
      c.hinge.rotation.x = sag * 0.26 - kick * 0.14 + charge * 0.07;
      c.hinge.position.z = 0.45 - kick * 0.10;
      span(c.upper, c.shoulder, c.hinge.position);
      c.finger.rotation.z = 0.35 - 0.65 * charge + 0.19 * kick - 0.44 * sag;
      c.joint.position.z = 0.78 - kick * 0.06;
      c.anchor.position.z = contactZ - kick * 0.06;
      c.light.material.emissiveIntensity = (0.14 + (active ? 0.47 + 1.15 * charge : 0)) * (1 - sag);
      c.light.scale.z = 0.073 + 0.025 * charge;
      c.glow.visible = active;
      c.glow.material.opacity = 0.13 + charge * 0.61;
    }
  }
  pose(1, 0, -CRAB_TARGET_X, 0, 0);
  return { root, pose, setAtlas(texture: T.Texture) {
    texture.anisotropy = 4;
    applySurfaceMap(texture, [shell]);
  } };
}
