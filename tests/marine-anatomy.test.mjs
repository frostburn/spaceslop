import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const { createMarineRig, createLeviathan } = await server.ssrLoadModule('/src/marine-rigs.ts');
const { marineMotion } = await server.ssrLoadModule('/src/marine.ts');

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
