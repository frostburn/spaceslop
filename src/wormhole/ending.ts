import * as T from 'three';
import { poseBurners, shipBurners } from '../burners';
import { disposeScene } from '../rendering/dispose';
import { BOSS_CAMERA_DISTANCE, HEIGHT, WIDTH } from '../playfield';
import type { LevelEnding } from '../rendering/level';
import { createCockpitFlares } from '../rendering/victory';
import { createApertureLightning } from './fons/lightning';

export const WORMHOLE_EXIT_DURATION = 3.35;
export const WORMHOLE_EXIT_HOLD = .95;
export const WORMHOLE_ENDING_DURATION = WORMHOLE_EXIT_DURATION + 3.15;

const exit = new T.Vector3(-.68, 5.2, -26);
const tunnelExitDepth = -26;
const exitCameraZ = -5;
const exitCameraFov = 47;
const aspect = WIDTH / HEIGHT;
const smooth = T.MathUtils.smoothstep;

function createEscapePath() {
  const forward = new T.Vector3(), right = new T.Vector3(), normal = new T.Vector3();
  const orientation = new T.Matrix4(), bank = new T.Quaternion();
  const localForward = new T.Vector3(0, 1, 0);
  return (progress: number, point: T.Vector3, rotation: T.Quaternion) => {
    const turn = Math.PI * progress;
    point.set(exit.x * (1 - progress) - 1.42 * Math.sin(turn) + 1.52 * progress ** 3,
      exit.y - 3.15 * progress - 2.05 * progress ** 2, exit.z + 28.4 * progress);
    forward.set(-exit.x - 1.42 * Math.PI * Math.cos(turn) + 4.56 * progress ** 2,
      -3.15 - 4.1 * progress, 28.4).normalize();
    // Keep the cockpit and wings legible as the nose foreshortens.
    normal.set(-.34, .87, .43);
    right.crossVectors(forward, normal).normalize();
    normal.crossVectors(right, forward);
    rotation.setFromRotationMatrix(orientation.makeBasis(right, forward, normal))
      .multiply(bank.setFromAxisAngle(localForward, -.67 * progress));
  };
}

function createStarfield() {
  const geometry = new T.PlaneGeometry(2, 2);
  const material = new T.ShaderMaterial({
    uniforms: { aperture: { value: new T.Vector2() }, radius: { value: .38 } },
    depthTest: false, depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 sky;
      void main() {
        sky = position.xy * vec2(${aspect}, 1.0);
        gl_Position = vec4(position.xy, .999, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 sky;
      uniform vec2 aperture;
      uniform float radius;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec3 stars(vec2 ray, float scale) {
        vec2 p = ray * scale;
        vec2 cell = floor(p), offset = fract(p) - .5;
        float seed = hash(cell + scale);
        offset -= .68 * vec2(hash(cell + 13.0) - .5, hash(cell - 9.0) - .5);
        float core = 1.0 - smoothstep(.018, .076, length(offset));
        return mix(vec3(.39,.63,1.0), vec3(1.0,.66,.45), seed) * core * seed * step(.60, seed);
      }
      void main() {
        vec2 p = sky - vec2(.12,.27);
        float haze = exp(-2.0 * dot(p, p));
        float band = exp(-6.0 * abs(sky.y - sky.x * 1.32 + .26));
        float filaments = .65 + .35 * cos(18.0 * sky.x + 6.0 * sky.y + 2.0 * cos(sky.y * 11.0));
        vec3 color = vec3(.0018,.0025,.008) + vec3(.009,.011,.024) * haze
          + vec3(.044,.011,.061) * band * haze * filaments;
        vec2 delta = sky - aperture;
        float distanceToExit = length(delta) / radius;
        float bend = exp(-distanceToExit * distanceToExit * 1.5);
        float turn = .95 * bend;
        vec2 ray = aperture + mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * delta * (1.0 + .38 * bend);
        color += stars(ray, 23.0) * .76 + stars(ray, 45.0) * .24;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

function createExitTrumpet() {
  const geometry = new T.PlaneGeometry(1, 1, 128, 48);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const angle = uv.getX(i) * 2 * Math.PI;
    const depth = uv.getY(i);
    const radius = .025 + 5.35 * (1 - depth) ** 2.36;
    const curl = angle + depth * 4.2;
    const ripple = 1 + .035 * Math.sin(5 * curl) + .024 * Math.cos(8 * curl + 1.7);
    position.setXYZ(i, radius * ripple * Math.cos(angle) + 1.1 * depth ** 2,
      .88 * radius * ripple * Math.sin(angle) - .65 * depth ** 2, -9.5 * depth ** 2.7);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new T.ShaderMaterial({
    uniforms: { age: { value: 0 }, energy: { value: 0 } },
    transparent: true, depthWrite: false, side: T.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 funnel;
      varying vec3 viewNormal, viewRay;
      void main() {
        funnel = uv;
        vec4 point = modelViewMatrix * vec4(position, 1.0);
        viewNormal = normalMatrix * normal;
        viewRay = -point.xyz;
        gl_Position = projectionMatrix * point;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float age, energy;
      varying vec2 funnel;
      varying vec3 viewNormal, viewRay;
      void main() {
        float depth = funnel.y;
        float turn = funnel.x * 6.2831853 + 7.5 * depth - .85 * age;
        float spiral = .5 + .5 * cos(4.0 * turn + 1.6 * sin(depth * 15.0));
        float threads = pow(.5 + .5 * sin(13.0 * turn + depth * 29.0), 7.0);
        float bands = pow(.5 + .5 * cos(56.0 * depth + 2.0 * turn - age * 3.1), 5.0);
        float wall = smoothstep(.02, .18, depth) * (1.0 - smoothstep(.48, .94, depth));
        float light = .36 + .64 * abs(dot(normalize(viewNormal), normalize(viewRay)));
        vec3 cold = mix(vec3(.075,.25,.78), vec3(.51,.085,.76), .5 + .5 * cos(turn + depth * 2.0));
        vec3 color = vec3(.003,.002,.014) + cold * light * wall *
          (.24 + .54 * pow(spiral, 3.0) + .19 * bands + .19 * threads);
        color += vec3(.56,.34,.89) * exp(-abs(depth - .14) * 23.0) * (.1 + .46 * spiral + .22 * threads);
        color *= 1.0 + .62 * energy;
        float alpha = smoothstep(0.0, .21, depth) * (1.0 - smoothstep(.68, 1.0, depth));
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = 'wormhole-exterior-exit';
  mesh.position.copy(exit);
  mesh.rotation.set(-.23, -.46, -.13);
  mesh.renderOrder = -2;
  return mesh;
}

function createEngineTrails(engines: readonly T.Vector3[], escape: ReturnType<typeof createEscapePath>) {
  const segments = 32;
  const stride = (segments + 1) * 2;
  const positions = new T.BufferAttribute(new Float32Array(stride * engines.length * 3), 3).setUsage(T.DynamicDrawUsage);
  const uv = new Float32Array(stride * engines.length * 2);
  const indices: number[] = [];
  for (let trail = 0; trail < engines.length; trail++) {
    for (let i = 0; i <= segments; i++) {
      const at = trail * stride + i * 2;
      uv.set([0, i / segments, 1, i / segments], at * 2);
      if (i < segments) indices.push(at, at + 2, at + 1, at + 1, at + 2, at + 3);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', positions);
  geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 ribbon;
      void main() {
        ribbon = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 ribbon;
      void main() {
        float across = abs(ribbon.x - .5) * 2.0;
        float core = exp(-across * across * 23.0);
        float glow = exp(-across * across * 3.6) * (1.0 - smoothstep(.72, 1.0, across));
        float fade = pow(1.0 - ribbon.y, 1.5);
        gl_FragColor = vec4(vec3(.12,.73,1.4) * glow + vec3(.84,.94,1.0) * core, fade * (.48 * glow + .72 * core));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const root = new T.Mesh(geometry, material);
  root.name = 'wormhole-exit-engine-trails';
  root.frustumCulled = false;
  const point = new T.Vector3();
  const nozzle = new T.Vector3(), across = new T.Vector3(), forward = new T.Vector3();
  const normal = new T.Vector3(0, 1, 0);
  const direction = new T.Quaternion();
  const thrust = new T.Vector3(0, 1, 0);
  return {
    root,
    pose(progress: number, camera: T.Camera) {
      root.visible = progress > 0;
      if (!root.visible) return;
      for (const [trail, engine] of engines.entries()) {
        for (let i = 0; i <= segments; i++) {
          const age = i / segments;
          const p = Math.max(0, progress - age * .98);
          escape(p, point, direction);
          forward.copy(thrust).applyQuaternion(direction);
          nozzle.copy(engine).applyQuaternion(direction).add(point);
          across.subVectors(camera.position, nozzle).cross(forward);
          if (across.lengthSq() < 1e-5) across.crossVectors(normal, forward);
          const width = (.041 + .12 * age) * smooth(progress, 0, .12);
          across.normalize().multiplyScalar(width);
          const at = trail * stride + i * 2;
          positions.setXYZ(at, nozzle.x - across.x, nozzle.y - across.y, nozzle.z - across.z);
          positions.setXYZ(at + 1, nozzle.x + across.x, nozzle.y + across.y, nozzle.z + across.z);
        }
      }
      positions.needsUpdate = true;
    },
  };
}

export function createWormholeEnding(fighter: T.Group, apertureY: number): LevelEnding & {
  exitPoint: T.Vector3;
  dispose(): void;
} {
  const exterior = new T.Scene();
  const cockpitFlares = createCockpitFlares(WORMHOLE_EXIT_DURATION);
  const camera = new T.PerspectiveCamera(39, aspect, .1, 220);
  const trumpet = createExitTrumpet();
  const starfield = createStarfield();
  const lightning = createApertureLightning();
  lightning.root.name = 'wormhole-exit-lightning';
  lightning.root.position.z = .08;
  lightning.root.scale.setScalar(1.62);
  trumpet.add(lightning.root);
  const ship = fighter.clone();
  ship.name = 'wormhole-exit-fighter';
  const burners = shipBurners(ship);
  const enginePositions = burners.map(flame => ship.worldToLocal(flame.getWorldPosition(new T.Vector3())));
  const escape = createEscapePath();
  const trails = createEngineTrails(enginePositions, escape);
  const key = new T.DirectionalLight(0xb0f0ff, 3.6);
  key.position.set(-4, 7, 4);
  const back = new T.DirectionalLight(0xff8a71, 3.2);
  back.position.set(6, 2, -6);
  exterior.add(starfield, trumpet, trails.root, ship, key, back,
    new T.HemisphereLight(0xc1d8ff, 0x695292, 2.05));

  const aim = new T.Vector3();
  const shipForward = new T.Vector3(0, 1, 0);
  const bank = new T.Quaternion(), shipRotation = new T.Quaternion();
  const angle = new T.Vector3(), projected = new T.Vector3();
  const exitY = apertureY / (HEIGHT / 2) * (exitCameraZ - tunnelExitDepth) * Math.tan(T.MathUtils.degToRad(exitCameraFov / 2));
  const cockpit = new T.Vector3(0, .025, .28);
  const sampledRotation = new T.Quaternion();
  const launchOrigin = new T.Vector3();
  const launchRotation = new T.Quaternion();
  const cockpitOffset = new T.Vector3();

  function flyThrough(time: number, origin: Readonly<T.Vector3>, facing: Readonly<T.Quaternion>,
    position: T.Vector3, rotation: T.Quaternion) {
    const progress = time / WORMHOLE_EXIT_DURATION;
    const travel = .20 * progress + .80 * progress ** 2.65;
    const bankAngle = Math.sin(Math.PI * progress);
    angle.set(-origin.x, exitY - origin.y, tunnelExitDepth).normalize();
    shipRotation.setFromUnitVectors(shipForward, angle);
    rotation.copy(facing).slerp(shipRotation, smooth(time, 0, .55));
    rotation.multiply(bank.setFromAxisAngle(shipForward, .34 * bankAngle));
    position.set(T.MathUtils.lerp(origin.x, 0, travel) - .58 * bankAngle,
      T.MathUtils.lerp(origin.y, exitY, travel), tunnelExitDepth * travel);
  }
  function sampleCockpit(launch: number, point: T.Vector3) {
    flyThrough(launch, launchOrigin, launchRotation, point, sampledRotation);
    point.add(cockpitOffset.copy(cockpit).applyQuaternion(sampledRotation));
  }
  function renderExterior(renderer: T.WebGLRenderer, time: number) {
    const age = T.MathUtils.clamp(time, 0, WORMHOLE_ENDING_DURATION - WORMHOLE_EXIT_DURATION);
    const burst = smooth(age, .62, WORMHOLE_EXIT_HOLD + .16) * (1 - smooth(age, 1.35, 2.1));
    const progress = T.MathUtils.clamp((age - WORMHOLE_EXIT_HOLD) / 2.2, 0, 1) ** 1.34;
    trumpet.material.uniforms.age.value = age;
    trumpet.material.uniforms.energy.value = burst;
    lightning.pose(age, burst * .81);
    ship.visible = progress > 0;
    escape(progress, ship.position, ship.quaternion);
    poseBurners(burners, age, .93);
    camera.position.set(1.8 - progress * .70, .85 + progress * .85, 6.7 + progress * 3.2);
    camera.lookAt(.35 + progress * .67, 1.35 - progress * .45, -10);
    projected.copy(exit).project(camera);
    const sky = starfield.material.uniforms;
    sky.aperture.value.set(projected.x * aspect, projected.y);
    sky.radius.value = 5.35 / ((camera.position.z - exit.z) * Math.tan(T.MathUtils.degToRad(camera.fov / 2)));
    trails.pose(progress, camera);
    renderer.render(exterior, camera);
  }

  return {
    duration: WORMHOLE_ENDING_DURATION,
    cutToExterior: WORMHOLE_EXIT_DURATION,
    exitPoint: new T.Vector3(0, exitY, tunnelExitDepth),
    cockpitFlares,
    poseExit(time, fighter, camera) {
      launchOrigin.copy(fighter.position);
      launchRotation.copy(fighter.quaternion);
      flyThrough(time, launchOrigin, launchRotation, fighter.position, fighter.quaternion);
      const pullIn = smooth(time, 0, .9);
      const lineUp = smooth(time, 1.7, WORMHOLE_EXIT_DURATION);
      const side = pullIn * (1 - lineUp);
      camera.position.set(fighter.position.x * pullIn - 8.9 * side, fighter.position.y * side + 1.8 * side,
        T.MathUtils.lerp(BOSS_CAMERA_DISTANCE, fighter.position.z + 7.2, pullIn));
      camera.position.x *= 1 - lineUp;
      camera.position.z = T.MathUtils.lerp(camera.position.z, exitCameraZ, lineUp);
      const wake = Math.abs(fighter.position.z - launchOrigin.z) * .19;
      aim.set(fighter.position.x * side, (fighter.position.y + 1.05) * side,
        T.MathUtils.lerp(0, fighter.position.z + Math.min(2, wake) * (1 - lineUp), pullIn));
      camera.up.set(0, 1, 0);
      camera.lookAt(aim);
      camera.fov = T.MathUtils.lerp(camera.fov, exitCameraFov + 4 * (1 - lineUp), pullIn);
      camera.updateProjectionMatrix();
      cockpitFlares.pose(time, camera.position, sampleCockpit);
    },
    renderExterior,
    warmup(renderer: T.WebGLRenderer) {
      renderExterior(renderer, WORMHOLE_EXIT_HOLD + .38);
    },
    dispose() {
      exterior.remove(ship);
      disposeScene(exterior);
    },
  };
}
