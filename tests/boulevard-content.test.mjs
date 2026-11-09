import assert from 'node:assert/strict';import{test,after}from'node:test';import * as T from 'three';import{createServer}from'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const mines=await server.ssrLoadModule('/src/boulevard-mines.ts'),traffic=await server.ssrLoadModule('/src/boulevard-traffic.ts'),{createBoulevardScenery}=await server.ssrLoadModule('/src/boulevard-scenery.ts'),{Flight,STEP}=await server.ssrLoadModule('/src/game.ts'),{BOULEVARD_SPEED}=await server.ssrLoadModule('/src/boulevard.ts');

test('opaque mountain curtain closes below the exact neon crest',()=>{
 const s=createBoulevardScenery(),g=s.mountains.geometry,p=g.attributes.position,crest=s.crest,body=new T.Mesh(g,s.mountains.material);body.position.y=0;body.updateMatrixWorld(true);
 for(let i=0;i<crest.length;i++){assert.equal(p.getZ(i*2+1),-100);assert(Math.abs(p.getZ(i*2)-crest[i][2])<1e-6);}
 for(let i=0;i<crest.length-1;i++){const x=(crest[i][0]+crest[i+1][0])/2,z=(crest[i][2]+crest[i+1][2])/2,cast=z=>new T.Raycaster(new T.Vector3(x,-3,z),new T.Vector3(0,1,0)).intersectObject(body);assert(cast(z-.2).length);assert.equal(cast(z+.2).length,0);}
 const v=s.horizon.geometry.attributes.position;for(const c of crest)assert(Array.from({length:v.count},(_,i)=>[v.getX(i),v.getY(i),v.getZ(i)]).some(p=>p.every((n,i)=>Math.abs(n-c[i])<1e-5)));s.dispose();
});

test('two-way traffic points its white lamps forward and leaves space for overtaking bikes and the fountain',()=>{
 const s=createBoulevardScenery(),fleet=s.streetTraffic;
 for(let t=0;t<100;t+=.25){const scroll=t*BOULEVARD_SPEED;for(let i=0;i<4;i++){const b=traffic.boulevardBikePose(t,scroll,i);if(b.y-scroll < -30||b.y-scroll>70)continue;assert(Math.abs(b.x)<3.0);assert(Math.hypot(b.x,b.y-63)>1.9);for(let j=0;j<fleet.cars.length;j++){const c=traffic.boulevardCarPose(t,scroll,j);assert(Math.hypot(b.x-c.x,b.y-c.y)>.42,'bike intersects background car');}}}
 fleet.update(31,20);const before=fleet.cars.flatMap(c=>c.indicators.map(o=>o.visible));fleet.prime(true);assert(fleet.cars.every(c=>c.indicators.every(o=>o.visible)),'indicator variants were not warmed');fleet.prime(false);assert.deepEqual(fleet.cars.flatMap(c=>c.indicators.map(o=>o.visible)),before);assert.equal(fleet.trails.frustumCulled,false);const bytes=fleet.trails.instanceMatrix.array.slice(),colors=fleet.trails.instanceColor.array.slice();fleet.update(31,20);assert.deepEqual(fleet.trails.instanceMatrix.array,bytes);assert.deepEqual(fleet.trails.instanceColor.array,colors);assert(bytes.every(Number.isFinite));assert(colors[0]>colors[21*3]);const first=new T.Matrix4();fleet.trails.getMatrixAt(0,first);const behind=new T.Vector3().setFromMatrixPosition(first).sub(fleet.bikes[0].root.position),forward=new T.Vector3(0,-1,0).applyQuaternion(fleet.bikes[0].root.quaternion);assert(behind.dot(forward)<-.3,'trail starts ahead of the rear light');
 for(const car of fleet.cars){const lights=[];car.root.traverse(m=>{if(m.isMesh&&m.material.isMeshBasicMaterial)lights.push(m);});const front=lights.find(m=>m.material.color.r>1&&m.material.color.g>1),rear=lights.find(m=>m.material.color.r>1&&m.material.color.g<.1);assert(front&&rear);front.geometry.computeBoundingBox();rear.geometry.computeBoundingBox();assert(front.geometry.boundingBox.max.y<-.4);assert(rear.geometry.boundingBox.min.y>.4);}
 s.dispose();
});

function mineFlight(){const f=new Flight('sentry',[],'vex','boulevard');f.nextWave=20;f.nextMine=mines.mineSites.length;f.time=20;f.cooldown=f.droneCooldown=1e6;f.invulnerable=100;const state={site:0},p=mines.minePose(state,f.time),e={x:p.x,y:p.y,lane:p.x,age:0,fire:Infinity,hp:mines.MINE_HP,mine:state};f.enemies=[e];return{f,e,state,p};}
test('proximity mine waits outside its radius, warns, jumps and emits just one evenly spaced bullet ring',()=>{
 const{f,e,state,p}=mineFlight();f.player={x:p.x+mines.MINE_TRIGGER+.05,y:p.y};f.step(STEP);assert.equal(state.triggeredAt,undefined);assert.equal(f.threats.length,0);
 f.player={x:e.x,y:e.y};f.step(STEP);assert(state.triggeredAt>20);assert.equal(f.hull,4,'ground mine caused instant contact damage');const start=state.triggeredAt;f.player={x:3.8,y:-5};
 while(f.time<start+mines.MINE_WINDUP+mines.MINE_JUMP-STEP*1.5)f.step(STEP);assert.equal(f.threats.length,0);assert(mines.minePose(state,f.time).z>-.1);
 for(let n=0;n<3;n++)f.step(STEP);assert.equal(f.threats.length,12);assert.equal(e.hp,0);assert.equal(f.score,0);for(const b of f.threats)assert(Math.abs(Math.hypot(b.vx,b.vy)-3.6)<1e-9);
 for(let n=0;n<30;n++)f.step(STEP);assert(!f.enemies.includes(e));assert.equal(f.threats.length,12);
});

test('shooting or using Pulse defuses armed or jumping mines without their radial burst',()=>{
 for(const jumping of[false,true]){const{f,e,state,p}=mineFlight();f.player={x:p.x,y:p.y-5};if(jumping)state.triggeredAt=f.time-.6;f.damageEnemy(e,mines.MINE_HP);for(let n=0;n<90;n++)f.step(STEP);assert.equal(f.threats.length,0);assert.equal(f.score,50);assert.equal(state.burstAt,undefined);}
 const{f,e}=mineFlight();f.pulse();assert.equal(e.hp,0);assert.equal(f.score,50);
});

test('interceptor locks an aimed fan before the player dodges across lanes',()=>{
 const f=new Flight('sentry',[],'vex','boulevard');f.nextWave=20;f.nextMine=mines.mineSites.length;f.time=20;f.cooldown=f.droneCooldown=1e6;f.invulnerable=100;f.player={x:-3,y:-5};const e={x:-1.9,y:7,lane:-1.9,age:1.1,fire:1.7,hp:5,boulevard:{formation:'intercept',mirror:1,slot:0}};f.enemies=[e];f.step(STEP);const aim=e.interceptorAim;assert(Number.isFinite(aim));f.player.x=3;for(let n=0;n<40;n++)f.step(STEP);assert.equal(f.threats.length,3);const center=f.threats[1];assert(Math.abs(Math.atan2(center.vx,center.vy)-aim)<1e-9);assert.equal(e.interceptorAim,undefined);
});
