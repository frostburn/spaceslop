import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const { bindCentipede, severCentipede, stepCentipedes, CENTIPEDE_SPACING, CENTIPEDE_POOL } = await server.ssrLoadModule('/src/centipede.ts');
const { cicadaMotion, CICADA_SCOUT_POOL } = await server.ssrLoadModule('/src/titan-insects.ts');
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { createCicadaScout, createCentipedeSection } = await server.ssrLoadModule('/src/titan-insect-rigs.ts');
const { createLaserContactTrace } = await server.ssrLoadModule('/src/laser-contact.ts');

function chain(count = 7, x = 0) {
  const parts = Array.from({ length: count }, (_, i) => ({ x, y: i * CENTIPEDE_SPACING, hp: 2,
    lane: x, age: 0, fire: 100, heading: Math.PI }));
  bindCentipede(parts); return parts;
}
function combat(parts, drone = 'sentry', loadout = []) {
  const f = new Flight(drone, loadout, 'vex', 'titan');
  f.nextWave = 100; f.cooldown = f.droneCooldown = 100;
  f.player.x = -3; f.player.y = -6; f.drone.x = -3; f.drone.y = -6;
  f.enemies = parts; return f;
}

test('shooting a middle plate preserves live targets and sends the two connected fragments in opposite directions', () => {
  const parts = chain(), positions = parts.map(p => [p.x, p.y]);
  parts[3].hp = 0; severCentipede(parts[3]);
  const front = parts[0].centipede.chain, rear = parts[4].centipede.chain;
  assert.deepEqual(front.parts, parts.slice(0, 3)); assert.deepEqual(rear.parts, parts.slice(4));
  assert.equal(front.escape, -1); assert.equal(rear.escape, 1);
  assert.deepEqual(parts.map(p => [p.x, p.y]), positions, 'a sever must not teleport any targets');
  assert.equal(parts.filter(p => p.centipede.originalHead).length, 1);
  assert.equal(parts[4].centipede.originalHead, false, 'the cut end must not grow a replacement head');
  for (let i = 0; i < 90; i++) stepCentipedes(parts, STEP);
  assert(front.parts.every(p => p.x < -.5)); assert(rear.parts.every(p => p.x > .5));
  for (const group of [front, rear]) for (let i = 1; i < group.parts.length; i++)
    assert(Math.abs(Math.hypot(group.parts[i].x - group.parts[i-1].x, group.parts[i].y - group.parts[i-1].y) - CENTIPEDE_SPACING) < .03);
});

test('head, tail and repeated fragment cuts leave no dead leaders or orphaned live sections', () => {
  for (const cuts of [[0, 3, 6, 2], [6, 1, 4, 0], [3, 4, 2, 1]]) {
    const parts = chain();
    for (const index of cuts) {
      parts[index].hp = 0; severCentipede(parts[index]);
      for (let i = 0; i < 20; i++) stepCentipedes(parts, STEP);
      const alive = parts.filter(p => p.hp > 0), groups = new Set(alive.map(p => p.centipede.chain));
      assert.equal([...groups].reduce((n, group) => n + group.parts.length, 0), alive.length);
      for (const p of alive) {
        assert.equal(p.centipede.chain.parts[p.centipede.slot], p);
        assert(p.centipede.chain.parts.every(node => node.hp > 0));
        assert(Number.isFinite(p.x + p.y + p.heading));
      }
    }
    for (let i = 0; i < 300; i++) stepCentipedes(parts, STEP);
    assert(parts.filter(p => p.hp > 0).every(p => Math.abs(p.x) > 5.8), 'fragments must leave rather than remain as permanent enemies');
  }
});

test('ship, sentry, cannon and homing projectiles sever one section without paying the chain reward early', () => {
  for (const kind of ['ship', 'drone', 'cannon', 'homing']) {
    const parts = chain(3), target = parts[1], damage = kind === 'homing' ? .5 : 1;
    const reward = { weapon: 'laser', remaining: parts.length };
    for (const part of parts) part.reward = reward;
    target.hp = damage; const f = combat(parts);
    f.shots = [{ x: 0, y: target.y - .1, z: 0, vx: 0, vy: 12, vz: 0, damage,
      wing: ['cannon', 'homing'].includes(kind) ? kind : undefined, drone: kind === 'drone' }];
    f.step(STEP);
    assert.equal(target.hp, 0, kind); assert.equal(parts[0].hp, 2); assert.equal(parts[2].hp, 2);
    assert.equal(parts[0].centipede.chain.escape, -1); assert.equal(parts[2].centipede.chain.escape, 1);
    assert.equal(f.score, 100); assert.equal(f.drops.length, 0);
    f.step(STEP); assert.equal(f.score, 100); assert.equal(f.drops.length, 0);
  }
});

test('omega pierces successive plates and does not double-count them on subsequent frames', () => {
  const parts = chain(5), f = combat(parts);
  f.shots = [{ x: 0, y: .6, z: 0, vx: 0, vy: 100, vz: 0, damage: 4, wing: 'omega', pierced: new Set() }];
  f.step(STEP);
  assert.equal(parts[0].hp, 2); assert.equal(parts[1].hp, 0); assert.equal(parts[2].hp, 0); assert.equal(parts[3].hp, 0);
  assert.equal(f.score, 300); assert.equal(f.shots[0].pierced.size, 3);
  f.step(STEP); assert.equal(f.score, 400); assert.equal(parts[4].hp, 0);
});

test('laser locks track individual sections through a split and contact sparks meet opaque insect shells', () => {
  const parts = chain(4), f = combat(parts, 'sentry', ['laser']);
  // Put the head below the firing pod and the next body plate in its beam.
  f.player.x = 1.22; f.player.y = -.8;
  for (const p of parts) p.y -= 1;
  parts[1].hp = .001;
  f.step(STEP); assert.equal(parts[1].hp, 0); assert.equal(f.wings[0].laserTarget, parts[1]);
  f.step(STEP); assert.equal(f.wings[0].laserTarget, parts[2]); assert.equal(f.wings[0].laserHold, 0);
  assert(parts[2].laserDamage > 0);
  const plane = new T.Group();
  for (const rig of [createCentipedeSection(), createCicadaScout()]) {
    plane.add(rig.root); rig.root.rotation.z = Math.PI; rig.root.position.y = 2;
    const end = createLaserContactTrace(plane)({ x: 0, y: -5 }, { x: 0, y: 2 }, rig.root);
    assert(end.y < 1.9 && end.y > 1, 'contact should render before the raised shell center');
  }
});

test('Towline damages each intersected section once per pulse and Pulse clears split chains without duplicate rewards', () => {
  const parts = chain(5), f = combat(parts, 'towline');
  const reward = { weapon: 'omega', remaining: parts.length };
  parts.forEach(p => { p.hp = 4; p.reward = reward; }); parts[2].hp = 3;
  f.player.x = -2; f.player.y = 1.44; f.drone.x = 2; f.drone.y = 1.44; f.towlineCooldown = 0;
  f.step(STEP); assert.equal(parts[2].hp, 0); assert.equal(f.score, 100);
  for (let i = 0; i < 5; i++) f.step(STEP);
  assert(parts.filter(p => p.hp > 0).every(p => p.hp >= 1));
  assert.equal(f.score, 100, 'the same link pulse cannot re-hit a surviving section');
  assert.equal(f.drops.length, 0);
  f.pulse(); assert.equal(f.enemies.length, 0); assert.equal(f.score, 500);
  assert.equal(f.drops.length, 1); f.pulse(); assert.equal(f.score, 500); assert.equal(f.drops.length, 1);
});

test('all cicada formations have finite smooth facing, distinct paths, and leave the stage', () => {
  const paths = new Set();
  for (const formation of ['chevron', 'sweep', 'dive']) for (const mirror of [-1, 1]) {
    const course = { formation, mirror, slot: 1, count: 3 };
    let previous = cicadaMotion(0, 1, course);
    for (let t = STEP; t <= 9; t += STEP) {
      const p = cicadaMotion(t, 1, course);
      assert(Number.isFinite(p.x + p.y + p.heading + p.bank));
      assert(Math.hypot(p.x - previous.x, p.y - previous.y) < .09);
      previous = p;
    }
    assert(previous.y < -9); paths.add(JSON.stringify(cicadaMotion(3, 1, course)));
  }
  assert(paths.size >= 4);
});

test('pooled patrol rigs share geometry and materials while wingbeats and leg gaits use independent pivots', () => {
  for (const [create, count] of [[createCicadaScout, CICADA_SCOUT_POOL], [createCentipedeSection, CENTIPEDE_POOL]]) {
    const rigs = Array.from({ length: count }, create), resources = [];
    for (const rig of rigs) {
      const list = []; rig.root.traverse(o => { if (o.geometry) list.push([o.geometry, o.material]); }); resources.push(list);
    }
    for (const list of resources.slice(1)) list.forEach(([g, m], i) => { assert.equal(g, resources[0][i][0]); assert.equal(m, resources[0][i][1]); });
    rigs[0].pose(.4, 0, true, false); rigs[1].pose(.9, 0, true, false);
    assert.notDeepEqual(rigs[0].root.children.map(o => o.rotation.toArray()), rigs[1].root.children.map(o => o.rotation.toArray()));
    for (const rig of rigs) rig.root.traverse(o => assert(o.matrix.elements.every(Number.isFinite)));
  }
});
