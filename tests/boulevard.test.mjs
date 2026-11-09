import assert from 'node:assert/strict';import{test,after}from'node:test';import * as T from 'three';import{createServer}from'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const b=await server.ssrLoadModule('/src/boulevard.ts'),{Flight,STEP}=await server.ssrLoadModule('/src/game.ts'),{createBoulevardScenery}=await server.ssrLoadModule('/src/boulevard-scenery.ts'),{createHovercar,createPursuitCruiser}=await server.ssrLoadModule('/src/boulevard-rigs.ts');

test('ten-screen boulevard uses its own waves, all four repeat drops, armored escorts and a quiet plaza approach',()=>{
 const f=new Flight('sentry',[],'vex','boulevard');f.cooldown=f.droneCooldown=1e6;f.player.x=3.95;const forms=new Set(),drops=new Set();let heavy=false,max=0;
 while(f.phase==='stage'){f.invulnerable=100;f.step(STEP);max=Math.max(max,f.enemies.length);for(const e of f.enemies){assert(e.boulevard&&!e.raptor&&!e.flyer);forms.add(e.boulevard.formation);if(e.drop)drops.add(e.drop);heavy||=!!e.boulevard.heavy;}}
 assert.equal(forms.size,4);assert.equal(drops.size,4);assert(heavy);assert(max<=b.BOULEVARD_POOL);assert.equal(f.time,0);assert.equal(f.phase,'approach');assert.equal(f.enemies.length,0);assert.equal(f.transitionDuration,7);assert.equal(f.bossHealth,b.BOULEVARD_HP);
 for(let t=0;t<7.01;t+=STEP)f.step(STEP);assert.equal(f.phase,'boss');
});

test('absolute hovercar paths have continuous tangents, safe entry, bounded lanes and finite exits',()=>{
 for(const formation of['chevron','cross','train','rush'])for(const mirror of[-1,1])for(let slot=0;slot<4;slot++){
  const c={formation,mirror,slot},lane=mirror*(slot%2?2:-2);assert(b.boulevardMotion(0,lane,c).y>=10);assert(b.boulevardMotion(13,lane,c).y<-9);
  for(let age=0;age<11;age+=.035){const p=b.boulevardMotion(age,lane,c),next=b.boulevardMotion(age+.001,lane,c);assert(Object.values(p).every(Number.isFinite));assert(Math.abs(p.x)<2.6);assert(Math.hypot(next.x-p.x,next.y-p.y)<.02);assert(Math.abs(Math.atan2(Math.sin(next.heading-p.heading),Math.cos(next.heading-p.heading)))<.01);}
 }
});

test('boss enters the same 3D boulevard continuously and settles on the shared weapon target',()=>{
 for(const t of[0,1,3.5,6,7]){const e=t/7,p=b.boulevardBossPoint(100+t,e);assert(Object.values(p).every(Number.isFinite));}
 const p=b.boulevardBossPoint(107,1);assert(Math.abs(p.y-4.2)<1e-10);assert(Math.abs(p.z+12)<1e-10);
 assert.deepEqual(b.boulevardBossPoint(130,1),b.boulevardBossPoint(180,1));
 for(let reveal=0;reveal<=1;reveal+=.01)for(const y of[-7.1,0,6.6])assert(y*Math.sin(b.BOULEVARD_PITCH*reveal)-b.BOULEVARD_DECK+b.BOULEVARD_RISE*reveal>1,'road sweeps through the combat plane during the head-on swing');
 for(const t of[99.999,100,100.001,106.999,107,107.001])assert(Math.abs(b.boulevardScroll(t+.00001)-b.boulevardScroll(t))<.00002);
});

test('scenery, designed vector strokes and both actor variants construct without incompatible merged attributes',()=>{
 const s=createBoulevardScenery(),car=createHovercar(s.materials),heavy=createHovercar(s.materials,true),boss=createPursuitCruiser(s.materials);let wires=0;
 for(const root of[s.root,car.root,heavy.root,boss.root])root.traverse(o=>{if(o.isMesh){assert(o.geometry&&o.geometry.attributes.position);for(const a of Object.values(o.geometry.attributes))assert(a.array.every(Number.isFinite));if(o.material===s.materials.wire||o.material===s.city.wire){assert(o.geometry.attributes.otherPosition&&o.geometry.attributes.strokeEdge);assert(!o.geometry.attributes.barycentric);wires++;}}});
 assert(wires>25);assert.equal(s.chunks.length,22);assert.equal(s.tracks.length,2);
 s.update(55,0,55);const train=s.tracks[0].root.position.x;s.update(56,0,56);assert.notEqual(s.tracks[0].root.position.x,train);
 s.update(56,0,56);const frozen=s.traffic.map(t=>t.root.position.clone());s.update(56,0,56);assert(s.traffic.every((t,i)=>t.root.position.equals(frozen[i])));
 assert.equal(s.road.water.getRenderTarget().width,384);assert.equal(s.road.water.getRenderTarget().height,768);s.dispose();
});

test('cruiser aim locks before two-cannon fans and every weapon can finish the fight',()=>{
 const f=new Flight('sentry',[],'vex','boulevard');f.phase='boss';f.cooldown=f.droneCooldown=1e5;f.time=.7;f.stepBoss(0);const locked={...f.markers[0]};f.player.x=3;f.time=1.6;f.stepBoss(0);assert.equal(f.threats.length,10);assert(f.threats.some(t=>t.x<0)&&f.threats.some(t=>t.x>0));assert(Math.abs((f.threats[2].x+f.threats[2].vx*b.BOULEVARD_TRAVEL)-locked.x)<1e-8);
 for(const weapon of['homing','cannon','laser','omega']){const g=new Flight('sentry',[weapon,weapon],'vex','boulevard');g.phase='boss';g.deployDrone(0,1);for(let n=0;n<60*80&&g.phase==='boss';n++){g.invulnerable=100;g.step(STEP);}assert.equal(g.phase,'won',weapon);}
 const tow=new Flight('towline',[],'vex','boulevard');tow.phase='boss';tow.player={x:-2,y:2.5};tow.drone={x:2,y:2.5};tow.droneCooldown=0;const hp=tow.bossHealth;tow.stepDroneWeapon(STEP);assert(tow.bossHealth<hp);tow.pulse();assert(tow.bossHealth<hp-1);
});

// Exercise the renderer's dispatch with actual simulation threats and real instance batches.
test('Boulevard patrol and cruiser threats reach visible hostile batches; special sectors keep their own art',async()=>{
 const {FlightView}=await server.ssrLoadModule('/src/view.ts'),{createProjectileBatch,projectileKinds}=await server.ssrLoadModule('/src/projectile-graphics.ts');
 const projectiles=Object.fromEntries(projectileKinds.map(kind=>[kind,createProjectileBatch(kind)]));
 const view={projectiles,animationTime:0};
 function check(f,kind){
  assert(f.threats.length>0);FlightView.prototype.drawProjectiles.call(view,f);
  for(const name of['hostile','brine','spore']){const batch=projectiles[name];assert.equal(batch.root.visible,name===kind);assert.equal(batch.root.children[0].count,name===kind?f.threats.length:0);}
 }
 const f=new Flight('sentry',[],'vex','boulevard');f.cooldown=f.droneCooldown=1e6;f.player.x=3.95;
 while(!f.threats.length&&f.time<10){f.invulnerable=100;f.step(STEP);}check(f,'hostile');
 f.phase='boss';f.time=0;f.volley=0;f.markers=[];f.threats=[];
 while(!f.threats.length&&f.time<2){f.invulnerable=100;f.step(STEP);}assert.equal(f.threats.length,10);check(f,'hostile');
 for(const[level,kind]of[['ice','brine'],['broodlock','spore'],['io','hostile'],['titan','hostile'],['vents','hostile'],['preserve','hostile']]){const other=new Flight('sentry',[],'vex',level);other.threats=f.threats;check(other,kind);}
});
