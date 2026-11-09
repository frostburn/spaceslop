import assert from 'node:assert/strict';import{test,after}from'node:test';import * as T from 'three';import{createServer}from'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const mines=await server.ssrLoadModule('/src/boulevard-mines.ts'),traffic=await server.ssrLoadModule('/src/boulevard-traffic.ts'),{createBoulevardScenery}=await server.ssrLoadModule('/src/boulevard-scenery.ts'),{Flight,STEP}=await server.ssrLoadModule('/src/game.ts'),{BOULEVARD_SPEED}=await server.ssrLoadModule('/src/boulevard.ts');

test('opaque mountains close below the neon crest and carry surface-aligned internal contours',()=>{
 const s=createBoulevardScenery(),g=s.mountains.geometry,p=g.attributes.position,crest=s.crest,body=new T.Mesh(g,s.mountains.material);body.position.y=0;body.updateMatrixWorld(true);
 for(let i=0;i<crest.length;i++){assert.equal(p.getZ(i*2+1),-100);assert(Math.abs(p.getZ(i*2)-crest[i][2])<1e-6);}
 for(let i=0;i<crest.length-1;i++){const x=(crest[i][0]+crest[i+1][0])/2,z=(crest[i][2]+crest[i+1][2])/2,cast=z=>new T.Raycaster(new T.Vector3(x,-3,z),new T.Vector3(0,1,0)).intersectObject(body);assert(cast(z-.2).length);assert.equal(cast(z+.2).length,0);}
 const v=s.horizon.geometry.attributes.position,key=(x,y,z)=>[x,y,z].map(n=>(Math.abs(n)<1e-5?0:n).toFixed(3)).join(','),surface=new Set(Array.from({length:p.count},(_,i)=>key(p.getX(i),p.getY(i)-.04,p.getZ(i))));
 for(const c of crest)assert(Array.from({length:v.count},(_,i)=>[v.getX(i),v.getY(i),v.getZ(i)]).some(p=>p.every((n,i)=>Math.abs(n-c[i])<1e-5)));
 let internal=0;for(let i=0;i<v.count;i++){assert(surface.has(key(v.getX(i),v.getY(i),v.getZ(i))),'contour is detached from opaque relief');if(v.getY(i)<-1)internal++;}assert(internal>500,'mountains only have a silhouette outline');s.dispose();
});

test('two-way traffic points its white lamps forward and leaves space for overtaking bikes and the fountain',()=>{
 const s=createBoulevardScenery(),fleet=s.streetTraffic;
 for(let t=0;t<100;t+=.25){const scroll=t*BOULEVARD_SPEED;for(let i=0;i<4;i++){const b=traffic.boulevardBikePose(t,scroll,i);if(b.y-scroll < -30||b.y-scroll>70)continue;assert(Math.abs(b.x)<3.0);assert(Math.hypot(b.x,b.y-63)>1.9);for(let j=0;j<fleet.cars.length;j++){const c=traffic.boulevardCarPose(t,scroll,j);assert(Math.hypot(b.x-c.x,b.y-c.y)>.42,'bike intersects background car');}}}
 fleet.update(31,20);const before=fleet.cars.flatMap(c=>c.indicators.map(o=>o.visible));fleet.prime(true);assert(fleet.cars.every(c=>c.indicators.every(o=>o.visible)),'indicator variants were not warmed');fleet.prime(false);assert.deepEqual(fleet.cars.flatMap(c=>c.indicators.map(o=>o.visible)),before);assert.equal(fleet.trails.frustumCulled,false);const bytes=fleet.trails.instanceMatrix.array.slice(),colors=fleet.trails.instanceColor.array.slice();fleet.update(31,20);assert.deepEqual(fleet.trails.instanceMatrix.array,bytes);assert.deepEqual(fleet.trails.instanceColor.array,colors);assert(bytes.every(Number.isFinite));assert(colors[1]>colors[21*3+1]);assert(colors[1]>colors[0]*10&&colors[1]>colors[2]*2,'bike trails should be green');const first=new T.Matrix4();fleet.trails.getMatrixAt(0,first);const behind=new T.Vector3().setFromMatrixPosition(first).sub(fleet.bikes[0].root.position),forward=new T.Vector3(0,-1,0).applyQuaternion(fleet.bikes[0].root.quaternion);assert(behind.dot(forward)<-.3,'trail starts ahead of the rear light');
 for(const bike of fleet.bikes)bike.root.traverse(o=>{if(o.isMesh){assert(o.material!==s.materials.chrome,'background bike still uses bright chrome');if(o.material.isMeshBasicMaterial)assert(Math.max(...o.material.color.toArray())<.6,'bike lamp competes with combat lights');}});
 for(const car of fleet.cars){const lights=[];car.root.traverse(m=>{if(m.isMesh&&m.material.isMeshBasicMaterial)lights.push(m);});const front=lights.find(m=>m.material.color.r>1&&m.material.color.g>1),rear=lights.find(m=>m.material.color.r>1&&m.material.color.g<.1);assert(front&&rear);front.geometry.computeBoundingBox();rear.geometry.computeBoundingBox();assert(front.geometry.boundingBox.max.y<-.4);assert(rear.geometry.boundingBox.min.y>.4);}
 s.dispose();
});

function mineFlight(){const f=new Flight('sentry',[],'vex','boulevard');f.nextWave=20;f.nextMine=mines.mineSites.length;f.time=20;f.cooldown=f.droneCooldown=1e6;f.invulnerable=100;const state={site:0},p=mines.minePose(state,f.time),e={x:p.x,y:p.y,lane:p.x,age:0,fire:Infinity,hp:1,mine:state};f.enemies=[e];return{f,e,state,p};}
test('proximity mine waits outside its radius, warns, jumps and emits just one evenly spaced bullet ring',()=>{
 const{f,e,state,p}=mineFlight();f.player={x:p.x+mines.MINE_TRIGGER+.05,y:p.y};f.step(STEP);assert.equal(state.triggeredAt,undefined);assert.equal(f.threats.length,0);
 f.player={x:e.x,y:e.y};f.step(STEP);assert(state.triggeredAt>20);assert.equal(f.hull,4,'ground mine caused instant contact damage');const start=state.triggeredAt;f.player={x:3.8,y:-5};
 while(f.time<start+mines.MINE_WINDUP+mines.MINE_JUMP-STEP*1.5)f.step(STEP);assert.equal(f.threats.length,0);assert(mines.minePose(state,f.time).z>-.1);
 for(let n=0;n<3;n++)f.step(STEP);assert.equal(f.threats.length,12);assert.equal(e.hp,0);assert.equal(f.score,0);for(const b of f.threats)assert(Math.abs(Math.hypot(b.vx,b.vy)-3.6)<1e-9);
 for(let n=0;n<30;n++)f.step(STEP);assert(!f.enemies.includes(e));assert.equal(f.threats.length,12);
});

test('armed and jumping mines are dodge-only hazards that weapons pass through and Pulse preserves',()=>{
 for(const jumping of[false,true]){
  const{f,e,state}=mineFlight();if(jumping)state.triggeredAt=f.time-.65;const p=mines.minePose(state,f.time+STEP);f.player={x:3.8,y:-5.3};
  const shots=[undefined,'drone','homing','cannon','omega'].map(kind=>({x:p.x,y:p.y-.02,z:0,vx:0,vy:20,vz:0,damage:1000,drone:kind==='drone',wing:kind==='drone'?undefined:kind,pierced:kind==='omega'?new Set():undefined}));f.shots=shots;f.step(STEP);assert(shots.every(s=>f.shots.includes(s)),'mine consumed a friendly projectile');assert.equal(e.hp,1);
  const missile={x:e.x+1,y:e.y-2,vx:0,vy:10,z:0,vz:0,wing:'homing'};f.guideMissile(missile,false,STEP);assert.equal(missile.vx,0,'homing missile tracks a mine');
  const wing=f.wings[0];f.stepLaser(wing,{x:e.x,y:e.y-2},false,STEP);assert.equal(wing.laserTarget,undefined);assert.equal(wing.beamEnd.y,8,'mine blocks a laser');
  f.droneWeapon='towline';f.droneCooldown=0;f.player={x:e.x,y:e.y-1};f.drone={x:e.x,y:e.y+1};f.stepDroneWeapon(STEP);f.damageEnemy(e,1000);f.pulse();assert.equal(e.hp,1);assert(f.enemies.includes(e));assert.equal(f.score,0);assert.equal(state.burstAt,undefined);
 }
});

test('interceptor guns and housing rotate together on a fixed connected bearing',async()=>{
 const{createBoulevardInterceptor}=await server.ssrLoadModule('/src/boulevard-enemies.ts'),s=createBoulevardScenery(),rig=createBoulevardInterceptor(s.materials);rig.root.updateMatrixWorld(true);const bearingMatrix=rig.bearing.matrix.clone();let first;
 for(const angle of[0,.8,-1.2]){rig.pose(.7,angle);rig.root.updateMatrixWorld(true);const q=rig.mount.getWorldQuaternion(new T.Quaternion()),heading=new T.Euler().setFromQuaternion(q).z;assert(Math.abs(heading-angle)<1e-8);assert(new T.Box3().setFromObject(rig.mount).intersectsBox(new T.Box3().setFromObject(rig.bearing)),'rotating mount floats above bearing');assert(rig.bearing.matrix.equals(bearingMatrix));const tip=new T.Vector3(.25,-.56,.1).applyMatrix4(rig.guns.matrixWorld);if(first)assert(tip.distanceTo(first)>.1);first=tip;}
 s.dispose();
});

test('interceptor locks an aimed fan before the player dodges across lanes',()=>{
 const f=new Flight('sentry',[],'vex','boulevard');f.nextWave=20;f.nextMine=mines.mineSites.length;f.time=20;f.cooldown=f.droneCooldown=1e6;f.invulnerable=100;f.player={x:-3,y:-5};const e={x:-1.9,y:7,lane:-1.9,age:1.1,fire:1.7,hp:5,boulevard:{formation:'intercept',mirror:1,slot:0}};f.enemies=[e];f.step(STEP);const aim=e.interceptorAim;assert(Number.isFinite(aim));f.player.x=3;for(let n=0;n<40;n++)f.step(STEP);assert.equal(f.threats.length,3);const center=f.threats[1];assert(Math.abs(Math.atan2(center.vx,center.vy)-aim)<1e-9);assert.equal(e.interceptorAim,undefined);
});
