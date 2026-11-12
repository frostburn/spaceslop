import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const {Flight,BOSS_CAMERA_DISTANCE,BOSS_DEPTH,BOSS_PROJECTION,STEP}=await server.ssrLoadModule('/src/game.ts');
for(const level of ['summer','heliostat','boulevard','vents','io','titan','ice','preserve','broodlock'])test(`${level}: drone rounds advance on screen, preserve lateral aim and hit at boss depth`,()=>{
 const f=new Flight('sentry',[],'vex',level);f.phase='boss';f.stepBoss=()=>{};f.cooldown=f.droneCooldown=1e6;f.invulnerable=100;
 const x=f.exposedCannonX*BOSS_PROJECTION,y=-4;f.fire({x,y},true);const s=f.shots[0];assert.equal(s.targetsBoss,false);let previous=y;
 for(let t=.02;t<=.38;t+=.02){const z=s.z+s.vz*t,k=BOSS_CAMERA_DISTANCE/(BOSS_CAMERA_DISTANCE-z),px=(s.x+s.vx*t)*k,py=(s.y+s.vy*t)*k;assert(Math.abs(px-x)<1e-9);assert(py>previous);previous=py;}
 const duration=BOSS_DEPTH/s.vz;assert(Math.abs(s.y+s.vy*duration-f.bossAimY)<1e-9);
 const before=f.bossHealth;for(let i=0;i<30;i++)f.step(STEP);assert(f.bossHealth<before);
 const g=new Flight('sentry',[],'vex',level);g.phase='boss';g.stepBoss=()=>{};g.cooldown=g.droneCooldown=1e6;g.invulnerable=100;g.fire({x:4,y},true);const hp=g.bossHealth;for(let i=0;i<30;i++)g.step(STEP);assert.equal(g.bossHealth,hp,'off-target drone acquired a horizontal lock');
});

function quietBoss(level, loadout = []) {
  const flight = new Flight('sentry', loadout, 'vex', level);
  flight.phase = 'boss';
  flight.stepBoss = () => {};
  flight.cooldown = flight.droneCooldown = 100;
  flight.invulnerable = 100;
  return flight;
}

test('an off-center shot in Broodlock does not recede toward the middle of the screen', () => {
  const flight = quietBoss('broodlock');
  flight.fire({ x: 3.6, y: 1.5 });
  const [shot] = flight.shots;
  flight.step(STEP);
  assert.equal(shot.x, 3.6);
  assert.equal(shot.z, 0);
  assert(shot.y > 1.5);
});

for (const level of ['broodlock', 'summer', 'wormhole']) {
  test(`${level}: shots and beams fired past the boss keep going up`, () => {
    for (const weapon of ['homing', 'cannon', 'omega', 'laser']) {
      const flight = quietBoss(level, [weapon]);
      flight.player = { x: 0, y: 6 };
      const origin = flight.wingOrigin(-1);
      flight.fire(flight.player);
      flight.fire({ x: flight.exposedCannonX * BOSS_PROJECTION, y: 6 }, true);
      flight.wings[0].cooldown = 0;
      flight.stepWing(flight.wings[0], true, STEP);
      const health = flight.bossHealth;
      const positions = flight.shots.map(shot => shot.y);
      if (weapon === 'laser') {
        assert(flight.wings[0].beamEnd.y > origin.y);
        assert.equal(flight.wings[0].laserTarget, undefined);
      } else {
        assert.equal(flight.shots.length, 3);
        flight.wings[0].cooldown = 100;
      }
      flight.step(STEP);
      for (const [index, shot] of flight.shots.entries()) {
        assert.equal(shot.z, 0);
        assert(shot.y > positions[index]);
      }
      for (let i = 0; i < 80; i++) flight.step(STEP);
      assert.equal(flight.shots.length, 0);
      assert.equal(flight.bossHealth, health);
    }
  });
}

test('Fons sidearms stay on the flight plane during combat', () => {
  const flight = new Flight('sentry', ['cannon', 'omega'], 'vex', 'wormhole');
  flight.startFonsApproach();
  flight.phase = 'boss';
  for (const wing of flight.wings) {
    wing.cooldown = 0;
    flight.stepWing(wing, true, STEP);
  }
  assert.equal(flight.shots.length, 2);
  for (const shot of flight.shots) {
    assert.equal(shot.vz, 0);
    assert(shot.vy > 0);
  }
});
