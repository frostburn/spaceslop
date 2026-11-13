import * as T from 'three';
import { poseBurners, shipBurners } from '../burners';
import { disposeScene } from '../rendering/dispose';
import { BOSS_CAMERA_DISTANCE, HEIGHT, WIDTH } from '../playfield';
import type { LevelEnding } from '../rendering/level';
import { createApertureLightning } from './fons/lightning';

export const WORMHOLE_EXIT_DURATION = 2.85;
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
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec3 stars(float scale) {
        vec2 p = sky * scale;
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
        color += stars(23.0) * .76 + stars(45.0) * .24;
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

function createExitRim() {
  const mesh = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
    uniforms: { age: { value: 0 }, energy: { value: 0 } },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 disc;
      void main() {
        disc = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float age, energy;
      varying vec2 disc;
      void main() {
        vec2 p = disc * vec2(1.0, 1.11);
        float angle = atan(p.y, p.x + .00001);
        float r = length(p);
        float twist = angle + age * .77;
        float rim = .57 + .018 * sin(twist * 7.0) + .017 * sin(twist * 13.0);
        float edge = r - rim;
        float strands = .50 + .50 * sin(twist * 8.0 + r * 39.0);
        float core = exp(-abs(edge) * 113.0);
        float halo = exp(-abs(edge) * 13.0);
        float inner = (1.0 - smoothstep(-.14, .01, edge)) * smoothstep(.11, .53, r);
        vec3 violet = mix(vec3(.12,.43,1.12), vec3(.72,.115,1.16), .5 + .5 * sin(twist * 2.0));
        float inside = 1.0 - smoothstep(-.05, .012, edge);
        float folds = .18 + .82 * pow(.50 + .50 * sin(twist * 4.0 + r * 19.0), 3.0);
        vec3 light = violet * (halo * .36 + inner * (.20 + .49 * folds)) + vec3(1.14,.74,1.21) * core;
        float alpha = (.32 + .68 * strands) * (core + .5 * halo) * (.72 + energy * .55);
        gl_FragColor = vec4(light * (1.0 + energy * .54), min(alpha + .81 * inside, .97));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  mesh.name = 'wormhole-exterior-exit';
  mesh.position.copy(exit);
  mesh.scale.set(3.8, 3.8, 1);
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
  const camera = new T.PerspectiveCamera(39, aspect, .1, 220);
  const rim = createExitRim();
  const lightning = createApertureLightning();
  lightning.root.name = 'wormhole-exit-lightning';
  lightning.root.position.copy(exit);
  lightning.root.position.z += .06;
  lightning.root.scale.setScalar(1.21);
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
  exterior.add(createStarfield(), rim, lightning.root, trails.root, ship, key, back,
    new T.HemisphereLight(0xc1d8ff, 0x695292, 2.05));

  const aim = new T.Vector3();
  const shipForward = new T.Vector3(0, 1, 0);
  const bank = new T.Quaternion(), shipRotation = new T.Quaternion();
  const angle = new T.Vector3();
  const exitY = apertureY / (HEIGHT / 2) * (exitCameraZ - tunnelExitDepth) * Math.tan(T.MathUtils.degToRad(exitCameraFov / 2));
  function renderExterior(renderer: T.WebGLRenderer, time: number) {
    const age = T.MathUtils.clamp(time, 0, WORMHOLE_ENDING_DURATION - WORMHOLE_EXIT_DURATION);
    const burst = smooth(age, .62, WORMHOLE_EXIT_HOLD + .16) * (1 - smooth(age, 1.35, 2.1));
    const progress = T.MathUtils.clamp((age - WORMHOLE_EXIT_HOLD) / 2.2, 0, 1) ** 1.34;
    rim.material.uniforms.age.value = age;
    rim.material.uniforms.energy.value = burst;
    lightning.pose(age, burst * .81);
    ship.visible = progress > 0;
    escape(progress, ship.position, ship.quaternion);
    poseBurners(burners, age, .93);
    camera.position.set(1.8 - progress * .70, .85 + progress * .85, 6.7 + progress * 3.2);
    camera.lookAt(.35 + progress * .67, 1.35 - progress * .45, -10);
    trails.pose(progress, camera);
    renderer.render(exterior, camera);
  }

  return {
    duration: WORMHOLE_ENDING_DURATION,
    cutToExterior: WORMHOLE_EXIT_DURATION,
    exitPoint: new T.Vector3(0, exitY, tunnelExitDepth),
    // The combat camera looks down the tunnel. Ease into a close rear quarter
    // as the flares fire, then let the fighter pull ahead of the camera.
    poseExit(time, fighter, camera) {
      const pullIn = smooth(time, 0, .85);
      const lineUp = smooth(time, 1.6, WORMHOLE_EXIT_DURATION);
      const fly = (time / WORMHOLE_EXIT_DURATION) ** 2.65;
      const bankAngle = Math.sin(Math.PI * time / WORMHOLE_EXIT_DURATION);
      fighter.position.x -= .95 * bankAngle;
      const followX = fighter.position.x * pullIn * (1 - lineUp);
      fighter.position.y = T.MathUtils.lerp(fighter.position.y, exitY, fly);
      fighter.position.z = tunnelExitDepth * fly;
      angle.set(0, (exitY + 2.25) / -tunnelExitDepth, -1).normalize();
      shipRotation.setFromUnitVectors(shipForward, angle);
      fighter.quaternion.slerp(shipRotation, pullIn);
      fighter.quaternion.multiply(bank.setFromAxisAngle(shipForward, .58 * bankAngle));
      camera.position.set(-5.3 * pullIn * (1 - lineUp), 1.3 * pullIn * (1 - lineUp),
        T.MathUtils.lerp(BOSS_CAMERA_DISTANCE - 15.9 * pullIn, exitCameraZ, lineUp));
      aim.set(followX, -1.12 * pullIn * (1 - lineUp),
        T.MathUtils.lerp(-1.05 * pullIn, tunnelExitDepth, lineUp));
      camera.up.set(.12 * bankAngle, 1, 0);
      camera.lookAt(aim);
      camera.fov = T.MathUtils.lerp(camera.fov, exitCameraFov, pullIn);
      camera.updateProjectionMatrix();
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
