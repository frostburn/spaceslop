import * as T from 'three';
import { createPreserveMaterials } from './preserve-materials';
import { createPreserveTerrain } from './preserve-terrain';
import { createPreserveStation } from './preserve-station';
import { createPreserveFoliage, type PreserveWake } from './preserve-foliage';
import { preserveFrame, preserveRandom, preserveScroll, PRESERVE_SPEED, PRESERVE_WIDTH_SCALE, PRESERVE_ARENA_Y } from './preserve-layout';
import { createPreserveShadow } from './preserve-shadow';
import { createPreserveTraces } from './preserve-traces';
import { createPreserveDock } from './preserve-dock';
import { createPreserveWater } from './preserve-water';
import { createPreserveArena } from './preserve-arena';
import { createGroundskeeper } from './groundskeeper-rig';
import { GROUNDSKEEPER_FLOOR } from './groundskeeper';

export function createPreserveScenery() {
  const root = new T.Group(); root.name = 'orbital-preserve';
  const world = new T.Group(); world.name = 'preserve-world'; root.add(world);
  world.scale.x = PRESERVE_WIDTH_SCALE;
  const materials = createPreserveMaterials(), foliage = createPreserveFoliage(materials);
  const dock = createPreserveDock(materials), irrigation = createPreserveWater(materials);
  world.add(createPreserveTerrain(materials), createPreserveStation(materials), foliage.root, dock.root, irrigation.root, createPreserveTraces(materials));
  const arena = createPreserveArena(materials), boss = createGroundskeeper();
  boss.root.position.set(0, PRESERVE_ARENA_Y, GROUNDSKEEPER_FLOOR);
  world.add(arena.root, boss.root);

  // The sun and its shadow raster stay attached to the habitat. No moving texel
  // origin as the deck scrolls, and no broad colored fog hiding outer space.
  const sun = new T.DirectionalLight(0xffedd2, 2.6);
  sun.position.set(-22, 0, 32); sun.target.position.set(0, 12, -3);
  sun.castShadow = true; sun.name = 'preserve-sun';
  sun.shadow.bias = -.00015; sun.shadow.normalBias = .035;
  sun.shadow.camera.updateProjectionMatrix();
  world.add(sun, sun.target);
  const shadowAnchor = createPreserveShadow(sun,world);
  // Low, broad bounce from the observation deck keeps the underside of the
  // curved neck legible against space without flattening the sun's key light.
  const bounce = new T.DirectionalLight(0x8eaaa4, 0);
  bounce.position.set(6, PRESERVE_ARENA_Y - 24, -1);
  bounce.target.position.set(0, PRESERVE_ARENA_Y, 7);
  world.add(bounce, bounce.target);

  const random = preserveRandom(927), points: number[] = [], colors: number[] = [];
  for (let i = 0; i < 600; i++) {
    points.push((random() - .5) * 70, (random() - .5) * 120, -75 - random() * 55);
    const c = new T.Color().setHSL(.56 + random() * .13, .13 + random() * .16, .35 + random() * .5);
    colors.push(c.r, c.g, c.b);
  }
  const sky = new T.BufferGeometry(); sky.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  sky.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  const stars = new T.Points(sky, new T.PointsMaterial({ vertexColors: true, size: .16 }));
  stars.name = 'preserve-distant-stars'; stars.frustumCulled = false; root.add(stars);
  return {
    root, world, foliage, boss, arena, irrigation, dock,
    prime(active: boolean) {
      // Upload every bay before launch, even ones outside the warm-up camera.
      world.traverse(o => { if (o instanceof T.Mesh) o.frustumCulled = !active; });
    },
    update(time: number, exit: number, animationTime = time, elapsed = 0, actors: readonly PreserveWake[] = [], reset = false) {
      const scroll = preserveScroll(time), { pitch, height } = preserveFrame(exit);
      world.rotation.x = -pitch;
      world.position.set(0, -scroll * Math.cos(pitch) - height * Math.sin(pitch), scroll * Math.sin(pitch) - height * Math.cos(pitch));
      bounce.intensity = exit * .85;
      shadowAnchor(scroll); dock.update(animationTime); irrigation.update(animationTime);
      // The station leaves the view physically. Keep its sun registered so the
      // boss does not trigger a new lighting/shadow shader variant at contact.
      stars.position.y = -Math.min(scroll, time * PRESERVE_SPEED) * .024;
      foliage.update(animationTime, scroll, exit, elapsed, actors, reset);
    },
  };
}
