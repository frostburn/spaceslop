import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadEncounterTexture } from './encounter-texture';
import { asteroidGeometry, weatheredMetal } from './ice-surfaces';
import { iceOptics } from './ice-optics';
import { iceRocks, iceWrecks, iceTravel, iceRockY, iceOrientation, ICE_DURATION, ICE_CAMERA_DISTANCE, ICE_CORRIDOR_PITCH, ICE_SHIP_Y, iceCrossSection } from './ice-layout';
import { iceIndustry, industryY, industrialGeometry } from './ice-industry';
import { createGalacticBackdrop } from './galactic-backdrop';

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

export function createIceScenery(signal?:AbortSignal) {
  const root = new T.Group(); root.name = 'frostwake-scenery'; root.visible = false;
  const field = new T.Group(); field.name = 'asteroid-corridor'; root.add(field);
  const galaxy = createGalacticBackdrop(signal); root.add(galaxy.root);
  const { surface, uniforms, textures, capture,dispose } = iceOptics(galaxy);
  const transform = new T.Object3D(), color = new T.Color();
  const batches = Array.from({ length: 6 }, (_, variant) => {
    const rocks = iceRocks.map((rock, index) => ({ rock, index })).filter(({ rock }) => rock.variant === variant);
    const mesh = new T.InstancedMesh(asteroidGeometry(variant), surface, rocks.length);
    mesh.geometry.setAttribute('rockId', new T.InstancedBufferAttribute(new Float32Array(rocks.length), 1).setUsage(T.DynamicDrawUsage));
    mesh.onBeforeRender = renderer => { const target = renderer.getRenderTarget();
      if (target) uniforms.iceViewport.value.set(target.width, target.height);
      else renderer.getDrawingBufferSize(uniforms.iceViewport.value);
    };
    mesh.name = `ice-rocks-${variant}`; mesh.count = 0; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.setColorAt(0, color.setHex(0xffffff)); field.add(mesh);
    return { rocks, mesh };
  });
  const metal = weatheredMetal();
  const wrecks = iceWrecks.map((recipe) => {
    const mesh = new T.Mesh(wreckGeometry(recipe.kind), metal);
    mesh.rotation.set(0.12, -0.18, recipe.angle); field.add(mesh); return { recipe, mesh };
  });
  const beacon = new T.InstancedMesh(new T.OctahedronGeometry(0.045), new T.MeshBasicMaterial({ color: 0xffc47a }), 36);
  beacon.count = 0; beacon.frustumCulled = false; beacon.instanceMatrix.setUsage(T.DynamicDrawUsage); field.add(beacon);
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
  buildings.instanceMatrix.setUsage(T.DynamicDrawUsage); field.add(buildings);
  const lightGeometry = mergeGeometries([
    new T.BoxGeometry(0.2, 0.018, 0.045).translate(-0.14, -0.205, 0.17),
    ...[-1, 1].map(side => new T.ConeGeometry(0.045, 0.18, 5).rotateZ(-side * Math.PI / 2)
      .translate(side * 0.54, 0, -0.025)),
  ]);
  const jets = new T.InstancedMesh(lightGeometry, new T.MeshBasicMaterial({ color: 0x83dfed }), 18);
  jets.name = 'outpost-attitude-jets'; jets.count = 0; jets.frustumCulled = false;
  jets.instanceMatrix.setUsage(T.DynamicDrawUsage); field.add(jets);
  const factories = Array.from({ length: 4 }, (_, kind) => {
    const recipes = iceIndustry.filter(recipe => recipe.kind === kind);
    const mesh = new T.InstancedMesh(industrialGeometry(kind), metal, recipes.length);
    mesh.name = `industry-${kind}`; mesh.count = 0; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); field.add(mesh); return { recipes, mesh };
  });
  const ready = Promise.all([
    galaxy.ready, ...textures.map(texture => Promise.resolve(texture)),
    loadEncounterTexture('ice', (texture) => { uniforms.iceMap.value = texture; uniforms.hasIce.value = 1; }, 1, signal),
    loadEncounterTexture('rock', (texture) => { uniforms.rockMap.value = texture; uniforms.hasRock.value = 1; }, 1, signal),
  ]);
  return {
    root, ready,dispose,
    capture(renderer: T.WebGLRenderer, camera: T.Camera) { capture(renderer, camera, root, field); },
    update(progress: number, reveal: number, time = progress * ICE_DURATION, distance = ICE_CAMERA_DISTANCE) {
      const scroll = iceTravel(time), angle = -ICE_CORRIDOR_PITCH * reveal;
      field.rotation.x = angle;
      field.position.set(0, ICE_SHIP_Y * (1 - Math.cos(angle)), -ICE_SHIP_Y * Math.sin(angle));
      galaxy.update(reveal, distance);
      const reach = 24 + reveal * 48;
      let lights = 0, stations = 0;
      for (const { rocks, mesh } of batches) {
        let count = 0;
        for (const { rock, index } of rocks) {
          const y = iceRockY(index, time);
          if (y < -24 || y > reach) continue;
          // Foreground is kept outside the shooting lane, then leaves before the boss reveal.
          transform.position.set(rock.x + (rock.z > 0 ? Math.sign(rock.x) * reveal * 1.5 : 0), y,
            T.MathUtils.lerp(rock.z, rock.solid ? rock.z : iceCrossSection(index), reveal));
          iceOrientation(index, time, transform.quaternion);
          transform.scale.set(rock.radius, rock.radius, rock.radius * (rock.solid ? 0.55 : 0.8));
          transform.updateMatrix(); mesh.setMatrixAt(count, transform.matrix);
          mesh.geometry.getAttribute('rockId').setX(count, (index + 1) / 255);
          color.setHex(rock.solid || rock.z > 0 ? 0xffffff : 0xb4bec6); mesh.setColorAt(count++, color);
          if (rock.solid) {
            transform.position.set(rock.x - Math.sign(rock.x) * rock.radius * 0.25, y, 0.23);
            transform.rotation.set(0, 0, rock.angle); transform.scale.setScalar(rock.radius * (0.48 + Math.min(1, rock.y / 144) * 0.52)); transform.updateMatrix();
            buildings.setMatrixAt(stations, transform.matrix); jets.setMatrixAt(stations++, transform.matrix);
          }
          if (rock.solid && reveal === 0) for (const side of [-1, 1]) {
            transform.position.set(rock.x - Math.sign(rock.x) * rock.radius * 0.76, y + side * rock.radius * 0.35, 0.35);
            transform.rotation.set(0, 0, 0); transform.scale.setScalar(1); transform.updateMatrix();
            beacon.setMatrixAt(lights++, transform.matrix);
          }
        }
        mesh.geometry.getAttribute('rockId').needsUpdate = true;
        mesh.count = count; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor!.needsUpdate = true;
      }
      beacon.count = lights; beacon.instanceMatrix.needsUpdate = true;
      buildings.count = jets.count = stations;
      buildings.instanceMatrix.needsUpdate = jets.instanceMatrix.needsUpdate = true;
      for (const { recipe, mesh } of wrecks) {
        mesh.position.set(recipe.x, recipe.y - scroll, recipe.z);
        mesh.visible = mesh.position.y > -24 && mesh.position.y < reach;
      }
      for (const { recipes, mesh } of factories) {
        let count = 0;
        for (const recipe of recipes) {
          const y = industryY(recipe, time);
          if (y < -24 || y > reach) continue;
          transform.position.set(recipe.x, y, T.MathUtils.lerp(recipe.z, 0, reveal));
          transform.rotation.set(0, 0, recipe.angle); transform.scale.setScalar(recipe.scale);
          transform.updateMatrix(); mesh.setMatrixAt(count++, transform.matrix);
        }
        mesh.count = count; mesh.instanceMatrix.needsUpdate = true;
      }
    },
    prime() {
      this.update(0, 0);
      // Prime every geometry, including wrecks and outpost materials used later in the route.
      for (const { mesh } of factories) { mesh.count = 1; mesh.setMatrixAt(0, new T.Matrix4()); mesh.instanceMatrix.needsUpdate = true; }
      for (const { mesh } of batches) { mesh.count = Math.max(1, mesh.count); }
      for (const { mesh } of wrecks) { mesh.visible = true; mesh.position.set(0, 0, -4); }
    },
  };
}
