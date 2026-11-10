import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true},appType:'custom'});after(()=>server.close());
const frog=await server.ssrLoadModule('/src/biolume/frog.ts');
const {createFrogAssets,createFrogRig}=await server.ssrLoadModule('/src/biolume/frog-rig.ts');
const {Flight,STEP}=await server.ssrLoadModule('/src/game.ts');
const {groveMotion,groveWaves,groveCanAttack}=await server.ssrLoadModule('/src/biolume/combat.ts');
const {groveScroll}=await server.ssrLoadModule('/src/biolume/route.ts');
const origin={x:-2,y:2};
test('frog aim locks only on screen, warns, extends, holds and retracts into the mouth',()=>{
 const s=frog.createFrogState(-2);frog.stepFrog(s,origin,{x:0,y:-3},2,false);assert.equal(s.attackAt,undefined);
 frog.stepFrog(s,origin,{x:0,y:-3},2,true);const angle=s.angle;
 frog.stepFrog(s,origin,{x:3,y:3},2.2,true);assert.equal(s.angle,angle);
 assert(frog.frogSignal(s,2.4).warning>0);assert.equal(frog.frogSignal(s,2.4).extension,0);
 const full=2+frog.FROG_WINDUP+frog.FROG_EXTEND,holdEnd=full+frog.FROG_HOLD;
 assert.equal(frog.frogSignal(s,full).extension,1);assert.equal(frog.frogSignal(s,holdEnd-.01).extension,1);
 const returning=frog.frogSignal(s,holdEnd+frog.FROG_RETRACT/2);assert(returning.retracting);assert(Math.abs(returning.extension-.5)<1e-9);
 const mouth=frog.frogMouth(s,origin),far=frog.frogTonguePoint(s,origin,full,1),near=frog.frogTonguePoint(s,origin,holdEnd+frog.FROG_RETRACT/2,1);
 assert(Math.abs(Math.hypot(far.x-mouth.x,far.y-mouth.y)-s.reach)<1e-9);assert(Math.hypot(near.x-mouth.x,near.y-mouth.y)<s.reach);
 assert.deepEqual(frog.frogTonguePoint(s,origin,2+frog.FROG_ATTACK,1),mouth);
 frog.stepFrog(s,origin,{x:1,y:-3},2+frog.FROG_ATTACK+.01,true);assert.equal(s.attackAt,undefined);assert(s.nextAt>2+frog.FROG_ATTACK);
});
test('tongue contact matches the visible curve on extension and return, never the warning',()=>{
 const s={nextAt:0,attackAt:0,angle:.5,reach:5};
 for(const age of[1.05,1.4,1.9]){const p=frog.frogTonguePoint(s,origin,age,.8);assert(frog.frogTongueHits(s,origin,age,p));assert(!frog.frogTongueHits(s,origin,age,{x:p.x+2,y:p.y}));}
 assert(!frog.frogTongueHits(s,origin,.4,frog.frogMouth(s,origin)));
});
test('frogs scroll with the ground, enter fully before attacking, and stay within their two-rig pool',()=>{
 const waves=groveWaves.filter(w=>w.grove.kind==='frog');assert.equal(waves.length,6);
 for(const w of waves){const c={...w.grove,slot:0};assert(!groveCanAttack(-2.5,w.lanes[0],c));assert(!groveCanAttack(0,w.lanes[0],c));assert(groveCanAttack(2,w.lanes[0],c));
  const p=groveMotion(3,w.lanes[0],c),q=groveMotion(4,w.lanes[0],c);assert(Math.abs((p.y-q.y)-(groveScroll(w.time+4)-groveScroll(w.time+3))*16)<1e-10);}
 const f=new Flight('sentry',[],'vex','biolume');f.cooldown=f.droneCooldown=f.invulnerable=1e6;let maximum=0,attacks=0;
 for(let i=0;i<6000;i++){f.step(STEP);const active=f.enemies.filter(e=>e.frog);maximum=Math.max(maximum,active.length);for(const e of active)if(frog.frogSignal(e.frog,e.age).active)attacks++;}
 assert(maximum>0&&maximum<=frog.FROG_POOL);assert(attacks>0);
});
function quiet(weapon){
 const wing=['homing','cannon','laser','omega'].includes(weapon),f=new Flight(weapon==='towline'?'towline':'sentry',wing?[weapon,weapon]:[],'vex','biolume');f.nextWave=groveWaves.length;f.time=22;
 f.cooldown=weapon==='primary'?0:1e5;f.droneCooldown=['sentry','towline'].includes(weapon)?0:1e5;f.invulnerable=1e5;
 const x=wing?f.wingOrigin(-1).x:0,c={kind:'frog',formation:'weave',mirror:1,slot:0,anchor:22},p=groveMotion(0,x,c),e={...p,lane:x,age:0,hp:frog.FROG_HP,fire:1e5,grove:c,frog:frog.createFrogState(x)};f.enemies=[e];return{f,e};
}
for(const weapon of['primary','sentry','homing','cannon','laser','omega','towline','pulse'])test(`${weapon} can defeat a frog and remove its linked tongue`,()=>{
 const {f,e}=quiet(weapon);
 if(weapon==='pulse')f.pulse();
 for(let i=0;i<900&&e.hp>0;i++){
  if(weapon==='towline'){f.player={x:-1.2,y:e.y};f.drone={x:1.2,y:e.y};}
  f.step(STEP);
 }
 assert.equal(e.hp,0,weapon+' missed');assert.equal(f.threats.length,0,'frog leaked ordinary shots');f.step(STEP);assert(!f.enemies.includes(e));
});
test('frog models share resources, use registered tongue points, freeze uploads and release instances',()=>{
 const a=createFrogAssets(),r=createFrogRig(a),other=createFrogRig(a),s={nextAt:0,attackAt:0,angle:.4,reach:5};r.pose(origin,s,1.4);
 assert.equal(r.body.children[0].geometry,other.body.children[0].geometry);assert(r.beads.count>0&&r.beads.count<=frog.FROG_BEADS);
 const matrix=new T.Matrix4();r.beads.getMatrixAt(r.beads.count-1,matrix);const p=new T.Vector3().setFromMatrixPosition(matrix),tip=frog.frogTonguePoint(s,origin,1.4,1),k=22/(22-p.z);
 assert(Math.hypot(p.x*k-tip.x,p.y*k-tip.y)<1e-6);const version=r.beads.instanceMatrix.version;r.pose(origin,s,1.4);assert.equal(r.beads.instanceMatrix.version,version);
 r.pose(origin,s,2.5);assert.equal(r.beads.count,0);
 let disposed=0;r.beads.addEventListener('dispose',()=>disposed++);r.release();assert.equal(disposed,1);other.release();
 for(const v of Object.values(a))v.dispose();
});
