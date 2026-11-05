import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadEncounterTexture } from './encounter-texture';
import { shipAlloy } from './encounter-surfaces';
import { iceRocks, iceWrecks, iceTravel, iceRockY, iceOrientation, ICE_DURATION } from './ice-layout';

function asteroidGeometry(seed: number) {
  const geometry = new T.IcosahedronGeometry(1, 2), positions = geometry.getAttribute('position');
  const colors: number[] = [], frost: number[] = [], point = new T.Vector3(), color = new T.Color();
  const stone = new T.Color(0x344352), ice = new T.Color(0xb4d3df);
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    const noise = Math.sin(point.x * 7 + seed) * Math.sin(point.y * 5 - seed) * Math.cos(point.z * 8 + seed);
    const ridge = Math.sin(point.x * 3 + point.y * 4 + seed) * 0.06;
    const radius = 0.84 + noise * 0.1 + ridge;
    const cover = T.MathUtils.smoothstep(point.z + Math.sin(point.x * 6 + seed) * 0.24 + noise * 0.2, -0.3, 0.35);
    point.multiplyScalar(radius);
    point.x = Math.min(0.74 + seed * 0.018, Math.max(-0.81, point.x));
    point.y *= 0.86 + Math.sin(seed * 2.1) * 0.1;
    positions.setXYZ(i, point.x, point.y, point.z);
    color.copy(stone).lerp(ice, cover).multiplyScalar(0.88 + noise * 0.18);
    colors.push(color.r, color.g, color.b); frost.push(cover);
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('frost', new T.Float32BufferAttribute(frost, 1));
  geometry.computeVertexNormals(); return geometry;
}

function wreckGeometry(kind: number) {
  const pieces: T.BufferGeometry[] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, angle = 0) =>
    pieces.push(new T.BoxGeometry(w, h, d).rotateZ(angle).translate(x, y, z));
  if (kind === 0) {
    for (const x of [-0.48, 0.48]) box(x, 0, 0, 0.11, 6.5, 0.18);
    for (let i = 0; i < 9; i++) box(0, i * 0.68 - 2.8, 0.01, 1.35, 0.07, 0.09, i % 2 ? 0.64 : -0.64);
  } else if (kind === 1) {
    for (let i = 0; i < 6; i++) box((i % 2) * 0.7 - 0.35, i * 0.65 - 1.7, 0, 1.4, 0.56, 0.16, i * 0.025);
    for (const x of [-1.1, 1.1]) box(x, 0, -0.1, 0.14, 4.8, 0.3);
    for (let i = 0; i < 7; i++) box(0, i * 0.48 - 1.5, 0.14, 1.2, 0.035, 0.07);
  } else {
    pieces.push(new T.TorusGeometry(1.6, 0.12, 5, 24, Math.PI * 1.45).translate(0, 0, -0.1));
    pieces.push(new T.TorusGeometry(1.3, 0.045, 5, 24, Math.PI * 1.45).translate(0, 0, 0.06));
    for (let i = 0; i < 7; i++) box(Math.cos(i * 0.62) * 1.45, Math.sin(i * 0.62) * 1.45, 0, 0.4, 0.08, 0.15, i * 0.62);
  }
  return mergeGeometries(pieces);
}

export function createIceScenery() {
  const root = new T.Group(); root.name = 'frostwake-scenery'; root.visible = false;
  const starPositions = Array.from({ length: 720 }, (_, i) => [((i * 67 % 727) / 727 - 0.5) * 28,
    ((i * 131 % 733) / 733 - 0.5) * 48, -25 - i % 11]).flat();
  const stars = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(starPositions, 3)),
    new T.PointsMaterial({ color: 0x9aafc2, size: 0.07 }));
  root.add(stars);
  const uniforms = { iceMap: { value: null as T.Texture | null }, rockMap: { value: null as T.Texture | null },
    hasIce: { value: 0 }, hasRock: { value: 0 } };
  const surface = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });
  surface.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'attribute float frost; varying float vFrost; varying vec2 vIceUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFrost = frost; vIceUv = uv * 2.0;');
    shader.fragmentShader = 'uniform sampler2D iceMap, rockMap; uniform float hasIce, hasRock; varying float vFrost; varying vec2 vIceUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 iceGrain = vec3(1.0), rockGrain = vec3(1.0);
      if (hasIce > 0.5) iceGrain = clamp(texture2D(iceMap, vIceUv).rgb * 1.8 + 0.25, 0.5, 1.4);
      if (hasRock > 0.5) rockGrain = clamp(texture2D(rockMap, vIceUv).rgb * 4.0 + 0.5, 0.5, 1.3);
      diffuseColor.rgb *= mix(rockGrain, iceGrain, vFrost);`);
  };
  surface.customProgramCacheKey = () => 'frostwake-surface-v1';
  const transform = new T.Object3D(), color = new T.Color();
  const batches = Array.from({ length: 6 }, (_, variant) => {
    const rocks = iceRocks.map((rock, index) => ({ rock, index })).filter(({ rock }) => rock.variant === variant);
    const mesh = new T.InstancedMesh(asteroidGeometry(variant), surface, rocks.length);
    mesh.name = `ice-rocks-${variant}`; mesh.count = 0; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.setColorAt(0, color.setHex(0xffffff)); root.add(mesh);
    return { rocks, mesh };
  });
  const metal = shipAlloy(0x7d898e);
  const wrecks = iceWrecks.map((recipe) => {
    const mesh = new T.Mesh(wreckGeometry(recipe.kind), metal);
    mesh.rotation.set(0.12, -0.18, recipe.angle); root.add(mesh); return { recipe, mesh };
  });
  const beacon = new T.InstancedMesh(new T.OctahedronGeometry(0.045), new T.MeshBasicMaterial({ color: 0xffc47a }), 36);
  beacon.count = 0; beacon.frustumCulled = false; beacon.instanceMatrix.setUsage(T.DynamicDrawUsage); root.add(beacon);
  // Compact outposts explain why these particular asteroids hold their lane attitude.
  const stationGeometry = mergeGeometries([
    new T.BoxGeometry(0.82, 0.74, 0.09),
    ...[-1, 1].flatMap(x => [-1, 1].map(y => new T.BoxGeometry(0.08, 0.08, 0.27)
      .translate(x * 0.28, y * 0.24, -0.1))),
    new T.BoxGeometry(0.34, 0.44, 0.23).translate(-0.14, 0.02, 0.14),
    new T.BoxGeometry(0.18, 0.3, 0.15).translate(0.2, -0.12, 0.1),
    new T.BoxGeometry(0.035, 0.035, 0.44).translate(0.29, 0.25, 0.22),
    new T.BoxGeometry(0.19, 0.035, 0.04).translate(0.29, 0.25, 0.44),
    ...[-1, 1].map(side => new T.BoxGeometry(0.07, 0.88, 0.1).translate(side * 0.44, 0, 0)),
  ]);
  const buildings = new T.InstancedMesh(stationGeometry, metal, 18);
  buildings.name = 'stabilized-outposts'; buildings.count = 0; buildings.frustumCulled = false;
  buildings.instanceMatrix.setUsage(T.DynamicDrawUsage); root.add(buildings);
  const lightGeometry = mergeGeometries([
    new T.BoxGeometry(0.2, 0.018, 0.045).translate(-0.14, -0.205, 0.17),
    ...[-1, 1].map(side => new T.ConeGeometry(0.045, 0.18, 5).rotateZ(-side * Math.PI / 2)
      .translate(side * 0.54, 0, -0.025)),
  ]);
  const jets = new T.InstancedMesh(lightGeometry, new T.MeshBasicMaterial({ color: 0x83dfed }), 18);
  jets.name = 'outpost-attitude-jets'; jets.count = 0; jets.frustumCulled = false;
  jets.instanceMatrix.setUsage(T.DynamicDrawUsage); root.add(jets);
  const ready = Promise.all([
    loadEncounterTexture('ice', (texture) => { uniforms.iceMap.value = texture; uniforms.hasIce.value = 1; }, 1),
    loadEncounterTexture('rock', (texture) => { uniforms.rockMap.value = texture; uniforms.hasRock.value = 1; }, 1),
  ]);
  return {
    root, ready,
    update(progress: number, reveal: number, time = progress * ICE_DURATION) {
      const scroll = iceTravel(time);
      let lights = 0, stations = 0;
      for (const { rocks, mesh } of batches) {
        let count = 0;
        for (const { rock, index } of rocks) {
          const y = iceRockY(index, time);
          if (Math.abs(y) > 24) continue;
          // Foreground is kept outside the shooting lane, then leaves before the boss reveal.
          transform.position.set(rock.x + (rock.z > 0 ? Math.sign(rock.x) * reveal * 8 : 0), y, rock.z);
          iceOrientation(index, time, transform.quaternion);
          transform.scale.set(rock.radius, rock.radius, rock.radius * (rock.solid ? 0.55 : 0.8));
          transform.updateMatrix(); mesh.setMatrixAt(count, transform.matrix);
          color.setHex(rock.solid || rock.z > 0 ? 0xffffff : 0x6c8296); mesh.setColorAt(count++, color);
          if (rock.solid) {
            transform.position.set(rock.x - Math.sign(rock.x) * rock.radius * 0.25, y, 0.23);
            transform.rotation.set(0, 0, rock.angle); transform.scale.setScalar(rock.radius); transform.updateMatrix();
            buildings.setMatrixAt(stations, transform.matrix); jets.setMatrixAt(stations++, transform.matrix);
          }
          if (rock.solid && reveal === 0) for (const side of [-1, 1]) {
            transform.position.set(rock.x - Math.sign(rock.x) * rock.radius * 0.76, y + side * rock.radius * 0.35, 0.35);
            transform.rotation.set(0, 0, 0); transform.scale.setScalar(1); transform.updateMatrix();
            beacon.setMatrixAt(lights++, transform.matrix);
          }
        }
        mesh.count = count; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor!.needsUpdate = true;
      }
      beacon.count = lights; beacon.instanceMatrix.needsUpdate = true;
      buildings.count = jets.count = stations;
      buildings.instanceMatrix.needsUpdate = jets.instanceMatrix.needsUpdate = true;
      for (const { recipe, mesh } of wrecks) {
        mesh.position.set(recipe.x, recipe.y - scroll, recipe.z);
        mesh.visible = Math.abs(mesh.position.y) < 22;
      }

    },
    prime() {
      this.update(0, 0);
      // Prime every geometry, including wrecks and outpost materials used later in the route.
      for (const { mesh } of batches) { mesh.count = Math.max(1, mesh.count); }
      for (const { mesh } of wrecks) { mesh.visible = true; mesh.position.set(0, 0, -4); }
    },
  };
}
