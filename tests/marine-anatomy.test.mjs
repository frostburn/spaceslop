import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const { createMarineRig, createLeviathan } = await server.ssrLoadModule('/src/marine-rigs.ts');
const { marineMotion, LOOP_ENTRY, LOOP_DURATION, SCHOOL_DELAY, marineBodyHit } = await server.ssrLoadModule('/src/marine.ts');

test('ichthyosaur nostrils are shallow side slits at the beak base', () => {
  const {root,body}=createMarineRig('ichthyosaur');body.geometry.computeBoundingBox();
  const tip=body.geometry.boundingBox.max.y;
  for(const side of ['L','R']) {
    const nostril=root.getObjectByName('nostril-'+side);
    assert(nostril.position.y<tip*.75 && nostril.position.y>tip*.5);
    assert(Math.abs(nostril.position.x)>.08);
    assert(nostril.scale.x<nostril.scale.y*.5);
  }
});

test('plesiosaur hip flipper roots remain embedded through the paddle cycle', () => {
  const rig=createMarineRig('plesiosaur'),material=rig.body.material,previousSide=material.side;
  material.side=T.DoubleSide;
  try {
    for(const time of [0,.65,1.3,1.95,2.6]) {
      rig.pose(time,.055);rig.root.updateMatrixWorld(true);
      for(const name of ['rear-flipper-L','rear-flipper-R']) {
        const fin=rig.root.getObjectByName(name).children[0],positions=fin.geometry.getAttribute('position');
        for(const index of [0,3,6,9]) {
          const point=new T.Vector3().fromBufferAttribute(positions,index).applyMatrix4(fin.matrixWorld);
          for(const sign of [-1,1]) {
            const ray=new T.Raycaster(point,new T.Vector3(0,0,sign),0,2);
            assert(ray.intersectObject(rig.body,false).length>0,`${name} separated at ${time}`);
          }
        }
      }
    }
  } finally { material.side=previousSide; }
});

test('Leviathan mandible rotates about both skull condyles without a displaced hinge', () => {
  const rig=createLeviathan(),jaw=rig.root.getObjectByName('lower-jaw');
  for(const time of [0,.55,.9,1.35,1.45,1.8,2.4,3.1,4.6]) {
    rig.pose(1,0,0,0,0,time);rig.root.updateMatrixWorld(true);
    for(const side of ['L','R']) {
      const upper=rig.root.getObjectByName('skull-hinge-'+side).getWorldPosition(new T.Vector3());
      const lower=rig.root.getObjectByName('jaw-hinge-'+side).getWorldPosition(new T.Vector3());
      assert(upper.distanceTo(lower)<1e-6,`hinge ${side} slipped at ${time}`);
    }
    assert(jaw.rotation.x<=0 && jaw.rotation.x>-.5);
  }
  const skin=rig.root.getObjectByName('mosasaur-body'),joints=skin.geometry.getAttribute('skinIndex');
  assert(skin.skeleton.bones.includes(jaw));assert(Array.from(joints.array).filter(j=>j===6).length>500);
});

test('plesiosaur path and bank stay gentle while the four paddles provide the stroke', () => {
  for(let time=0;time<20;time+=.05) {
    const p=marineMotion('plesiosaur',time,0),next=marineMotion('plesiosaur',time+.01,0);
    assert(Math.abs(p.x)<=.351);assert(Math.abs(p.heading)<.25);assert(Math.abs(p.bank)<.06);
    assert(Math.abs(next.heading-p.heading)<.005);assert.equal(p.speed,1.25);
  }
});


test('Leviathan has one connected exterior from torso through neck into both jaws', () => {
  const rig=createLeviathan(),body=rig.root.getObjectByName('mosasaur-body'),geometry=body.geometry;
  assert.equal(rig.root.getObjectByName('gular-skin'),undefined);
  assert.equal(rig.root.getObjectByName('upper-jaw-skin'),undefined);
  assert.equal(rig.root.getObjectByName('lower-jaw-skin'),undefined);
  const adjacency=Array.from({length:geometry.getAttribute('position').count},()=>[]),index=geometry.index.array;
  for(let i=0;i<index.length;i+=3)for(let j=0;j<3;j++) {const a=index[i+j],b=index[i+(j+1)%3];adjacency[a].push(b);adjacency[b].push(a);}
  const seen=new Set([0]),todo=[0];while(todo.length)for(const next of adjacency[todo.pop()])if(!seen.has(next)){seen.add(next);todo.push(next);}
  assert.equal(seen.size,adjacency.length,'the blubber must be one connected surface');
  const weights=geometry.getAttribute('skinWeight');
  for(let i=0;i<weights.count;i++)assert(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6);
});

test('marine bodies have closed nose and tail surfaces rather than open loft rings', () => {
  for(const kind of ['ichthyosaur','plesiosaur']) {
    const geometry=createMarineRig(kind).body.geometry,positions=geometry.getAttribute('position'),edges=new Map();
    const key=i=>[0,1,2].map(c=>Math.round(positions.getComponent(i,c)*1e6)).join('/');
    const indices=geometry.index.array;
    for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++) {
      const edge=[key(indices[i+j]),key(indices[i+(j+1)%3])].sort().join(':');
      edges.set(edge,(edges.get(edge)??0)+1);
    }
    assert([...edges.values()].every(count=>count===2),`${kind} has an open surface boundary`);
  }
});

test('the continuous neck has no splitting seams as the chin opens', () => {
  const rig=createLeviathan(),body=rig.root.getObjectByName('mosasaur-body'),p=body.geometry.getAttribute('position');
  const duplicates=new Map();
  for(let i=0;i<p.count;i++)if(p.getY(i)>.15&&p.getY(i)<1.3) {
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join('/');
    if(!duplicates.has(key))duplicates.set(key,[]);duplicates.get(key).push(i);
  }
  for(const time of [0,.8,1.45,1.8,2.4]) {
    rig.pose(1,0,0,0,0,time);rig.root.updateMatrixWorld(true);
    for(const indices of duplicates.values())if(indices.length>1) {
      const first=body.applyBoneTransform(indices[0],new T.Vector3().fromBufferAttribute(p,indices[0]));
      for(const i of indices.slice(1))assert(first.distanceTo(body.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(p,i)))<1e-5,'a neck seam opened');
    }
  }
  for(const name of ['upper-palate','lower-palate','oral-cavity']) {
    const material=rig.root.getObjectByName(name).material;
    assert(material.isMeshBasicMaterial);assert(Math.max(material.color.r,material.color.g,material.color.b)<.005,'oral tissue must remain dark under strong lights');
  }
});

test('Leviathan eyes sit behind protective angular orbital rims', () => {
  const rig=createLeviathan();
  for(const side of ['L','R']) {
    const eye=rig.root.getObjectByName('protected-eye-'+side),rim=rig.root.getObjectByName('orbital-rim-'+side);
    const positions=rim.geometry.getAttribute('position'),inverse=eye.quaternion.clone().invert();
    let hood=-Infinity;
    for(let i=0;i<positions.count;i++) {
      const local=new T.Vector3().fromBufferAttribute(positions,i).add(rim.position).sub(eye.position).applyQuaternion(inverse);
      hood=Math.max(hood,local.z);
    }
    assert(hood>.065);assert(eye.children.every(part=>part.position.z+part.scale.z<hood));
    assert(rig.root.getObjectByName('orbital-cup-'+side));
  }
});

test('both protected eyes have an unobstructed forward view past the snout and brow', () => {
  const rig=createLeviathan();rig.pose(1,0,0,0,0,0);rig.root.updateMatrixWorld(true);
  const body=rig.root.getObjectByName('mosasaur-body');
  for(const side of ['L','R']) {
    const eye=rig.root.getObjectByName('protected-eye-'+side);
    const gaze=new T.Vector3(0,0,1).applyQuaternion(eye.quaternion);
    assert(gaze.y>.75,'the socket must look forward along the animal, not up or sideways');
    const forward=new T.Vector3(0,1,0).transformDirection(eye.parent.matrixWorld);
    const pupil=eye.children[2].getWorldPosition(new T.Vector3());
    const ray=new T.Raycaster(pupil.clone().addScaledVector(forward,3),forward.clone().negate(),0,3.2);
    const blockers=[body,...eye.children,rig.root.getObjectByName('orbital-rim-'+side)];
    for(let i=0;i<3;i++)blockers.push(rig.root.getObjectByName('cranial-ridge-'+i));
    const hit=ray.intersectObjects(blockers,false)[0];
    assert(hit && eye.children.includes(hit.object),`${side} eye is hidden behind its own brow or snout`);
  }
});

test('the looping line follows a complete closed turn with continuous facing and delayed followers', () => {
  for(const mirror of [-1,1]) {
    const leader={formation:'loop',slot:0,count:5,mirror};
    const first=marineMotion('ichthyosaur',LOOP_ENTRY,0,leader),last=marineMotion('ichthyosaur',LOOP_ENTRY+LOOP_DURATION,0,leader);
    assert(Math.hypot(first.x-last.x,first.y-last.y)<1e-8);
    let upward=false,right=false,left=false;
    for(let t=0;t<LOOP_ENTRY+LOOP_DURATION+3;t+=.025) {
      const p=marineMotion('ichthyosaur',t,0,leader),next=marineMotion('ichthyosaur',t+.001,0,leader);
      assert(Math.abs(p.x)<=1.901);assert(p.speed>2.9&&p.speed<3.42);
      assert(Math.hypot(next.x-p.x,next.y-p.y)<.0035);
      assert(Math.abs(Math.sin(next.heading-p.heading))<.004);
      assert(Math.abs(Math.sin(p.heading)-p.vx/p.speed)<1e-8);
      upward ||= p.vy>1;right ||= p.vx>1;left ||= p.vx< -1;
      for(let slot=1;slot<5;slot++) {
        const follower=marineMotion('ichthyosaur',t+slot*SCHOOL_DELAY,0,{...leader,slot});
        assert(Math.hypot(p.x-follower.x,p.y-follower.y)<1e-8);
      }
    }
    assert(upward&&right&&left);
  }
});

test('formation movement stays bounded, and chevrons, pincers and slalom trains have distinct spacing', () => {
  for(const formation of ['chevron','pincer','slalom'])for(let age=0;age<10;age+=.05)for(let slot=0;slot<3;slot++) {
    const lane=[-1.8,0,1.8][slot],p=marineMotion('ichthyosaur',age,lane,{formation,slot,count:3,mirror:1});
    assert(Math.abs(p.x)<2.3);assert(Number.isFinite(p.heading));assert(p.vy<0);
  }
  const v=[0,1,2].map(slot=>marineMotion('ichthyosaur',1,[-1.8,0,1.8][slot],{formation:'chevron',slot,count:3,mirror:1}));
  assert(v[1].y<v[0].y-1.7&&v[1].y<v[2].y-1.7);
});

test('projectiles and contact bounds follow a hunter turned sideways or backwards', () => {
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
    const body={x:0,y:0,marine:'ichthyosaur',heading},nose={x:Math.sin(heading)*.95,y:-Math.cos(heading)*.95};
    assert(marineBodyHit(body,nose,nose));
    const outside={x:Math.cos(heading)*.8,y:Math.sin(heading)*.8};
    assert(!marineBodyHit(body,outside,outside));
    assert(marineBodyHit(body,{x:-2,y:0},{x:2,y:0}));
  }
});

test('banking rolls a hunter around its course without tipping its nose off the path', () => {
  const rig=createMarineRig('ichthyosaur');
  for(const heading of [0,.7,Math.PI/2,2.4,Math.PI])for(const bank of [-.5,0,.5]) {
    rig.root.rotation.z=Math.PI+heading;rig.pose(0,bank);rig.root.updateMatrixWorld(true);
    const forward=new T.Vector3(0,1,0).transformDirection(rig.root.matrixWorld);
    assert(forward.distanceTo(new T.Vector3(Math.sin(heading),-Math.cos(heading),0))<1e-6);
  }
});
