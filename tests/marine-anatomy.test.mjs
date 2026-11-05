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
  const shell=rig.root.getObjectByName('lower-jaw-skin').geometry;shell.computeBoundingBox();
  assert(shell.boundingBox.min.y>-.10,'the mandible must not extend far behind its hinge');
  assert(shell.boundingBox.max.y>1);
});

test('plesiosaur path and bank stay gentle while the four paddles provide the stroke', () => {
  for(let time=0;time<20;time+=.05) {
    const p=marineMotion('plesiosaur',time,0),next=marineMotion('plesiosaur',time+.01,0);
    assert(Math.abs(p.x)<=.351);assert(Math.abs(p.heading)<.25);assert(Math.abs(p.bank)<.06);
    assert(Math.abs(next.heading-p.heading)<.005);assert.equal(p.speed,1.25);
  }
});


test('the torso blends continuously into the rigid mosasaur skull', () => {
  const rig=createLeviathan(),geometry=rig.root.getObjectByName('mosasaur-body').geometry;
  const uv=geometry.getAttribute('uv'),positions=geometry.getAttribute('position');
  const joints=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
  let previous=0;
  for(let i=0;i<positions.count;i++)if(uv.getX(i)===0) {
    let head=0;for(let j=0;j<4;j++)if(joints.array[i*4+j]===3)head+=weights.array[i*4+j];
    assert(Math.abs(head-previous)<.3,'a sudden head-weight jump folds the neck into a seam');previous=head;
  }
  assert(previous>.99);
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

test('the skinned throat stays joined to the neck and hinged chin across the bite cycle', () => {
  const rig=createLeviathan(),skin=rig.root.getObjectByName('gular-skin'),positions=skin.geometry.getAttribute('position');
  assert.equal(skin.isSkinnedMesh,true);assert.equal(skin.skeleton.bones[1],rig.root.getObjectByName('lower-jaw'));
  for(const time of [0,.8,1.45,1.8,2.4]) {
    rig.pose(1,0,0,0,0,time);rig.root.updateMatrixWorld(true);
    for(const [row,bone] of [[0,0],[3,1]])for(const column of [0,6,12,18]) {
      const index=row*25+column,point=new T.Vector3().fromBufferAttribute(positions,index);
      const expected=point.clone().applyMatrix4(skin.skeleton.boneInverses[bone]).applyMatrix4(skin.skeleton.bones[bone].matrixWorld);
      const actual=skin.applyBoneTransform(index,point).applyMatrix4(skin.matrixWorld);
      assert(expected.distanceTo(actual)<1e-6,'the throat attachment slipped');
    }
  }
  assert(skin.geometry.groups.some(group=>group.materialIndex===1),'the mouth-side closure needs oral tissue');
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
    assert(hood>.07);assert(eye.children.every(part=>part.position.z+part.scale.z<hood));
    assert(rig.root.getObjectByName('orbital-cup-'+side));
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
