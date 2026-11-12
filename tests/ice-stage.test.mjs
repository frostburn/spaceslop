import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { Quaternion, Vector3, Group, Scene, Color } from 'three';
const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const { Flight, STEP, iceWaves } = await server.ssrLoadModule('/src/game.ts');
const { IceCollision } = await server.ssrLoadModule('/src/ice-collision.ts');
const { ICE_DURATION, ICE_TRAVEL, ICE_SCREENS, iceSolids, iceRocks, iceMotions, iceOrientation, iceRockY, iceTravel, iceCorridorPoint, ICE_CORRIDOR_PITCH, ICE_SHIP_Y } = await server.ssrLoadModule('/src/ice-layout.ts');
const { iceRefraction } = await server.ssrLoadModule('/src/ice-refraction.ts');
const { asteroidGeometry } = await server.ssrLoadModule('/src/ice-surfaces.ts');
const { iceIndustry, industryY } = await server.ssrLoadModule('/src/ice-industry.ts');
const { FIGHTER_HULL, DRONE_HULL } = await server.ssrLoadModule('/src/hive-collision.ts');

test('Frostwake traverses ten screens with a complete marine wave schedule', () => {
  assert.equal(ICE_TRAVEL + 16, ICE_SCREENS * 16);
  assert.equal(ICE_DURATION, 90); assert.equal(iceWaves.length, 20);
  assert(iceWaves.some(w => w.marine === 'ichthyosaur'));assert(iceWaves.some(w => w.marine === 'plesiosaur'));
  assert(iceWaves.every(w=>w.marine && w.raptor===undefined));
  assert(iceWaves.every(w => !w.ant));
  assert.equal(new Set(iceWaves.map(w => w.drop).filter(Boolean)).size, 4);
  assert(ICE_DURATION - iceWaves.at(-1).time >= 8);
});

test('solid outcrops keep the center open and scrolling cannot pin a fighter at either edge', () => {
  const collision = new IceCollision(), left = { x: -3.95, y: -7 }, right = { x: 3.95, y: 6.6 };
  for (let i = 0; i <= 5400; i++) {
    collision.update(i / 5400);
    for (const point of [left, right]) {
      collision.move(point, 0, 0, FIGHTER_HULL);
      assert(!collision.overlaps(point, FIGHTER_HULL), `embedded at frame ${i}`);
    }
    for (const y of [-7, -3, 0, 4, 6]) assert(!collision.overlaps({ x: 0, y }, FIGHTER_HULL));
  }
  collision.update(1);
  for (let x = -3.95; x <= 3.95; x += .2) for (const y of [-7.1, -5, 0, 5, 6.6])
    assert(!collision.overlaps({ x, y }, FIGHTER_HULL), `boss arena blocked at ${x}, ${y}`);
});

test('fast touch movement and drone docking stop at solid ice without hull damage', () => {
  const rock = iceSolids[0], f = new Flight('sentry', [], 'glint', 'ice');
  f.player.y = rock.y; f.aimBy(-3.95, 0); f.steer(0, 0, 1);
  const collision = new IceCollision(); collision.update(0);
  assert(!collision.overlaps(f.player, FIGHTER_HULL)); assert.equal(f.hull, 4);
  f.drone.y = rock.y; f.deployDrone(rock.x, rock.y);
  for (let i = 0; i < 80; i++) f.step(STEP);
  collision.update(f.hiveProgress);
  assert(!collision.overlaps(f.drone, DRONE_HULL)); assert.equal(f.droneTarget, undefined);
});

test('a media-free simulation completes the full schedule and reaches Leviathan', () => {
  const f = new Flight('sentry', [], 'vex', 'ice');
  let maxEnemies = 0, sawHunter = false, sawSweeper = false;
  for (let i = 0; i < (ICE_DURATION + 1.5) * 60; i++) {
    f.invulnerable = 100; f.step(STEP);
    maxEnemies = Math.max(maxEnemies, f.enemies.length); sawHunter ||= f.enemies.some(e => e.marine==='ichthyosaur');sawSweeper ||= f.enemies.some(e=>e.marine==='plesiosaur');
    assert(f.enemies.filter(e=>e.marine==='plesiosaur').length<=4);
  }
  assert(sawHunter&&sawSweeper); assert(maxEnemies <= 12, `renderer pool exceeded: ${maxEnemies}`);
  assert.equal(f.phase, 'boss'); assert.equal(f.enemies.length, 0);
  assert.equal(f.stageDuration, 90); assert.equal(f.bossHealth, 60);
  f.pulse(); f.pulse(); assert.equal(f.bossHealth, 48);
});

test('free asteroids visibly tumble on distinct axes while built-on outcrops hold attitude', () => {
  const axes = new Set();
  for (const [i, rock] of iceRocks.entries()) {
    const motion = iceMotions[i], before = iceOrientation(i, 0, new Quaternion()), after = iceOrientation(i, 30, new Quaternion());
    assert(Math.abs(motion.axis.length() - 1) < 1e-10);
    if (rock.solid) assert(before.angleTo(after) < 1e-7);
    else {
      assert(motion.rate >= 0.07 && motion.rate < 0.18);
      assert(before.angleTo(iceOrientation(i, 5, new Quaternion())) > 0.34);
      axes.add(motion.axis.toArray().map(x => x.toFixed(4)).join(','));
    }
    const again = iceOrientation(i, 30, new Quaternion());
    assert(after.angleTo(again) < 1e-7, 'sampling is deterministic and independent of frame cadence');
  }
  assert.equal(axes.size, iceRocks.filter(r => !r.solid).length);
});

test('boss pursuit continues forward and only decorative rocks recycle outside the viewport', () => {
  assert.equal(iceTravel(ICE_DURATION), ICE_TRAVEL);
  assert(iceTravel(ICE_DURATION + 30) > ICE_TRAVEL + 40);
  for (let time = 90; time < 390; time += 0.2) {
    let visible = 0;
    for (const [i, rock] of iceRocks.entries()) {
      const y = iceRockY(i, time), next = iceRockY(i, time + 0.1);
      if (!rock.solid && Math.abs(y) < 18) {
        visible++;
        assert(Math.abs((y - next) - 0.16) < 1e-7, 'visible rocks move continuously through the boss arena');
      }
      if (rock.solid) assert.equal(y, rock.y - iceTravel(time));
    }
    assert(visible > 8, `field became empty during pursuit at ${time}`);
  }
});

test('fractured asteroids retain smooth regions and sharp rims within collision envelopes', () => {
  for (let seed = 0; seed < 6; seed++) {
    const geo = asteroidGeometry(seed), p = geo.getAttribute('position'), n = geo.getAttribute('normal');
    const shared = new Map(); let smooth = 0, creased = 0;
    for (let i = 0; i < p.count; i++) {
      const v = new Vector3().fromBufferAttribute(p, i), normal = new Vector3().fromBufferAttribute(n, i);
      assert(v.length() < 1.04); assert(Math.abs(normal.length() - 1) < 1e-5);
      const key = v.toArray().map(x => Math.round(x * 1e5)).join('/');
      if (shared.has(key)) {
        if (normal.distanceTo(shared.get(key)) < 1e-5) smooth++;
        if (normal.dot(shared.get(key)) < 0.94) creased++;
      }
      else shared.set(key, normal);
    }
    assert(smooth > 100); assert(creased > 20); geo.dispose();
  }
});

test('the pitched corridor shares the ship forward axis and recedes toward Leviathan', () => {
  const origin = new Vector3(0, ICE_SHIP_Y, 0), out = new Vector3();
  assert(iceCorridorPoint(origin, 1, out).distanceTo(origin) < 1e-10);
  const forward = new Vector3(0, Math.cos(ICE_CORRIDOR_PITCH), -Math.sin(ICE_CORRIDOR_PITCH));
  const target = new Vector3(0, 4.2 - ICE_SHIP_Y, -12);
  const point = iceCorridorPoint(origin.clone().add(new Vector3(0, target.length(), 0)), 1, out);
  assert(point.distanceTo(new Vector3(0, 4.2, -12)) < 1e-10);
  assert(target.normalize().distanceTo(forward) < 1e-10);
  assert(iceCorridorPoint(new Vector3(5, 4, -2), 0, out).distanceTo(new Vector3(5, 4, -2)) < 1e-10);
});

test('industry density builds along the route and pursuit modules recycle beyond the view', () => {
  const early = iceIndustry.filter(p => !p.loop && p.y < 48).length;
  const late = iceIndustry.filter(p => !p.loop && p.y > 112).length;
  assert(late > early * 2);
  for (let time = 80; time < 500; time += .2) for (const recipe of iceIndustry.filter(p => p.loop)) {
    const y = industryY(recipe, time), next = industryY(recipe, time + .1);
    if (y > -22 && y < 72) assert(Math.abs(y - next - .16) < 1e-6, 'visible industry jumped');
  }
});


test('refraction captures preserve the rotated flight frame and restore renderer state after failure', () => {
  const parent = new Scene(), root = new Group(), field = new Group(), rock = new Group(), decoration = new Group();
  parent.rotation.x = -Math.PI / 2; parent.add(root); root.add(field, decoration); field.add(rock); rock.name = 'ice-rocks-0';
  decoration.visible = false; parent.updateMatrixWorld(true);
  const expected = root.matrixWorld.clone(), optics = iceRefraction();
  let target = null, scissor = true, alpha = .7, clear = new Color(0x123456), calls = 0;
  const renderer = {
    getDrawingBufferSize: v => v.set(1080,1920), getRenderTarget: () => target,
    getClearAlpha: () => alpha, getClearColor: v => v.copy(clear), getScissorTest: () => scissor,
    setScissorTest: v => { scissor = v; }, setClearColor: (v,a) => { clear.set(v); alpha = a; },
    setRenderTarget: v => { target = v; }, render: scene => {
      scene.updateMatrixWorld(true); assert.deepEqual(root.matrixWorld.elements, expected.elements);
      assert(target.height <= 512); assert(!decoration.visible);
      for (const [name, uniform] of Object.entries(optics.uniforms)) if (name !== 'captureLayer') assert.notEqual(uniform.value, target.texture);
      if (++calls === 2) throw new Error('capture interrupted');
    },
  };
  assert.throws(() => optics.capture(renderer, {}, root, field), /capture interrupted/);
  assert.equal(root.parent, parent); assert.equal(decoration.visible, false); assert.equal(target,null);
  assert.equal(scissor,true); assert.equal(alpha,.7); assert.equal(clear.getHex(),0x123456);
  assert.equal(optics.uniforms.captureLayer.value,0);
});


test('Leviathan locks a readable mouth volley and central weakpoint before firing', () => {
  const f=new Flight('sentry',[],'vex','ice');f.phase='boss';f.player.x=1.5;f.invulnerable=100;
  for(let i=0;i<40;i++)f.step(STEP);
  assert.equal(f.exposedCannonX,0);assert.equal(f.markers.length,3);assert(f.cannonWindup>0);
  const locked=f.markers.map(p=>({...p}));f.player.x=-2;
  for(let i=0;i<60;i++)f.step(STEP);
  assert(f.threats.length>=3);assert.deepEqual(f.markers,locked);
  assert(f.threats.every(t=>Number.isFinite(t.vx)&&Number.isFinite(t.vz)&&t.vz>0));
});

test('marine bodies can be hit at the snout and still release their wing drop', () => {
  const f=new Flight('towline',[],'vex','ice');f.nextWave=100;f.cooldown=100;f.droneCooldown=f.towlineCooldown=100;
  const enemy={x:1,y:1,lane:1,age:0,fire:100,hp:1,marine:'plesiosaur',reward:{weapon:'laser',remaining:1}};
  f.enemies=[enemy];f.shots=[{x:1,y:-.5,z:0,vx:0,vy:15,vz:0}];f.step(STEP);
  assert.equal(enemy.hp,0);assert.equal(f.drops[0].weapon,'laser');
});
