import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  define: { __STUDY_TEXTURES__: JSON.stringify({heliostatMetal:'metal.png',heliostatCeramic:'ceramic.png'}) },
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const layout = await server.ssrLoadModule('/src/studies/heliostat-layout.ts');
const { createHeliostatMaterials } = await server.ssrLoadModule('/src/studies/heliostat-materials.ts');
const { createHeliostatBay } = await server.ssrLoadModule('/src/studies/heliostat-bay.ts');
const { createDistantPlant } = await server.ssrLoadModule('/src/studies/heliostat-distant.ts');
const { createHeliostatCollector } = await server.ssrLoadModule('/src/studies/heliostat-collector.ts');
const { createUranus, URANUS_RADIUS:R, URANUS_TILT } = await server.ssrLoadModule('/src/studies/heliostat-space.ts');
const { loadStudyTexture, loadStudyArt } = await server.ssrLoadModule('/src/studies/heliostat-assets.ts');

test('foreground and distant machinery have lit, textured volume with no raster stand-ins', () => {
  const m = createHeliostatMaterials(), bay = createHeliostatBay(m), far = createDistantPlant(m);
  let triangles = 0, meshes = 0;
  for (const root of [bay.root,far.root]) root.traverse(node => {
    if (!node.isMesh) return; meshes++;
    assert(node.material.isMeshStandardMaterial); assert.equal(node.material.transparent,false);
    const g = node.geometry; assert(g.attributes.normal && g.attributes.uv);
    assert(Array.from(g.attributes.position.array).every(Number.isFinite));
    g.computeBoundingBox(); const size = g.boundingBox.getSize(new T.Vector3());
    assert(Math.min(size.x,size.y,size.z) > .02, 'a background structure is still a flat image card');
    triangles += (g.index?.count ?? g.attributes.position.count)/3;
  });
  assert(meshes<26 && triangles<110000, 'one bay and its distant scenery exceed the geometry budget');
  const bounds = new T.Box3().setFromObject(bay.root); m.setArt({},false);
  assert(bounds.equals(new T.Box3().setFromObject(bay.root)), 'texture fallback changes geometry'); m.releaseTextures();
});

test('the physical ship/bullet lane is clear beneath the overhead bus', () => {
  const m = createHeliostatMaterials(), bay = createHeliostatBay(m); bay.root.updateMatrixWorld(true);
  for (let x=-layout.LANE_HALF_WIDTH;x<=layout.LANE_HALF_WIDTH;x+=.2) {
    const ray = new T.Raycaster(new T.Vector3(x,-15,.4),new T.Vector3(0,1,0),0,40);
    assert.equal(ray.intersectObject(bay.root,true).length,0,'machinery intrudes into the flight lane');
  }
  const beam = new T.Raycaster(new T.Vector3(0,16.5,10),new T.Vector3(0,0,-1)).intersectObject(bay.root,true);
  assert(beam.length && beam[0].point.z>4.5,'bridge is missing or lies in the shot plane'); m.releaseTextures();
});

test('the collector closes around the star at every angle and has front/back truss depth', () => {
  const m=createHeliostatMaterials(),collector=createHeliostatCollector(m);collector.root.updateMatrixWorld(true);
  const direction=new T.Vector3(0,0,1).transformDirection(collector.root.matrixWorld);
  for(let i=0;i<72;i++){
    const angle=i*Math.PI/36;
    const origin=new T.Vector3(Math.cos(angle)*8.2,Math.sin(angle)*8.2,-12).applyMatrix4(collector.root.matrixWorld);
    const hits=new T.Raycaster(origin,direction,0,30).intersectObject(collector.root,true);
    assert(hits.length>=2,'collector hoop is open at angle '+angle);
    assert(hits.at(-1).distance-hits[0].distance>1,'collector has no structural depth');
  }
  assert(collector.sphere.position.length()<1e-9);m.releaseTextures();
});

test('Uranus rings are concentric, coplanar and perpendicular to the planet spin axis', () => {
  const planet=createUranus();planet.root.updateMatrixWorld(true);
  const normal=new T.Vector3(0,0,1).applyQuaternion(planet.root.quaternion);
  assert(normal.distanceTo(planet.axis)<1e-12);
  assert(Math.abs(planet.axis.z-Math.cos(URANUS_TILT))<1e-12);
  assert.equal(planet.rings.children.length,9);
  let previous=R;
  for(const ring of planet.rings.children){
    const g=ring.geometry,p=g.attributes.position;assert.equal(ring.material.side,T.DoubleSide);
    let min=Infinity,max=0;
    for(let i=0;i<p.count;i++){assert(Math.abs(p.getZ(i))<1e-10);const radius=Math.hypot(p.getX(i),p.getY(i));min=Math.min(min,radius);max=Math.max(max,radius);}
    assert(min>previous && max-min<R*.007,'rings overlap or become a broad ribbon');previous=max;
  }
  assert(planet.globe.material.isMeshStandardMaterial && planet.globe.material.map.isDataTexture);
});

test('near rings occult the globe while the globe hides the far rings', () => {
  const planet=createUranus();planet.root.updateMatrixWorld(true);
  const origin=new T.Vector3(0,-6*R,.7*R).applyMatrix4(planet.root.matrixWorld);
  const objects=[planet.globe,...planet.rings.children];
  for(const side of[-1,1]){
    const target=new T.Vector3(0,side*1.751*R,0).applyMatrix4(planet.root.matrixWorld);
    const hits=new T.Raycaster(origin,target.sub(origin).normalize()).intersectObjects(objects,false);
    assert(hits.length>=2,'test ray does not cross ring and globe');
    assert.equal(hits[0].object===planet.globe,side>0,'planet/ring depth order is reversed');
  }
});

test('the planet surface closes its longitude seam and rotation freezes with presentation time', () => {
  const p=createUranus(),image=p.globe.material.map.image;
  for(let y=0;y<image.height;y++)for(let c=0;c<3;c++)assert(Math.abs(image.data[(y*image.width)*4+c]-image.data[(y*image.width+image.width-1)*4+c])<=1,'visible longitude seam');
  const m=createHeliostatMaterials(),collector=createHeliostatCollector(m),storage=collector.sphere.geometry.attributes.position.array.slice();
  collector.update(8);const q=collector.sphere.quaternion.clone();collector.update(8);
  assert(collector.sphere.quaternion.equals(q));assert.deepEqual(collector.sphere.geometry.attributes.position.array,storage);m.releaseTextures();
});

test('camera and travel remain continuous, straight and deterministic', () => {
  let previous;
  for(let i=0;i<=180;i++){
    const frame=layout.studyFrame(i/10),pose=layout.cameraPose(frame.progress);
    assert.deepEqual(frame,layout.studyFrame(i/10));if(previous)assert(pose.position.distanceTo(previous)<.5);
    assert.equal(pose.position.x,0);previous=pose.position;
  }
  for(let t=0;t<8;t+=.1)assert(layout.bayTravel(t+.1)<=layout.bayTravel(t));
  assert.equal(layout.bayTravel(7),layout.bayTravel(18));
});

test('surface-map switches retain the model and release active and inactive maps once', () => {
  const m=createHeliostatMaterials(),metal=new T.Texture(),ceramic=new T.Texture();let released=0;
  for(const texture of[metal,ceramic,m.titanium.map,m.titanium.bumpMap])texture.addEventListener('dispose',()=>released++);
  m.setArt({heliostatMetal:metal,heliostatCeramic:ceramic},true);assert.equal(m.titanium.map,metal);assert.equal(m.ceramic.map,ceramic);
  m.setArt({heliostatMetal:metal,heliostatCeramic:ceramic},false);assert.notEqual(m.titanium.map,metal);
  m.releaseTextures();m.releaseTextures();assert.equal(released,4);
});

test('cancelled study preparation resolves and disposes a late image', async () => {
  const previousWindow=globalThis.window,originalLoad=T.TextureLoader.prototype.load;
  globalThis.window={setTimeout,clearTimeout};let complete,calls=0,disposed=0;
  T.TextureLoader.prototype.load=function(url,onLoad){assert.equal(url,'/base/metal.png');complete=onLoad;calls++;return new T.Texture();};
  try{
    const scope=new AbortController(),pending=loadStudyTexture('/base/metal.png',scope.signal);scope.abort();assert.equal(await pending,undefined);
    const image=new T.Texture();image.addEventListener('dispose',()=>disposed++);complete(image);assert.equal(disposed,1);
    await loadStudyTexture('/base/metal.png',scope.signal);assert.equal(calls,1);
  }finally{T.TextureLoader.prototype.load=originalLoad;globalThis.window=previousWindow;}
});

test('failed maps fall back and abort releases an already-loaded sibling', async () => {
  const previousWindow=globalThis.window,originalLoad=T.TextureLoader.prototype.load;globalThis.window={setTimeout,clearTimeout};const callbacks=[];
  T.TextureLoader.prototype.load=function(url,success,progress,failure){callbacks.push({url,success,failure});return new T.Texture();};
  try{
    const scope=new AbortController(),missing=loadStudyTexture('/missing.png',scope.signal);callbacks.pop().failure(new Error('missing'));assert.equal(await missing,undefined);
    const pending=loadStudyArt(scope.signal);assert.equal(callbacks.length,2);const image=new T.Texture();let disposed=0;image.addEventListener('dispose',()=>disposed++);
    callbacks[0].success(image);await Promise.resolve();scope.abort();assert.deepEqual(await pending,{});assert.equal(disposed,1);
  }finally{T.TextureLoader.prototype.load=originalLoad;globalThis.window=previousWindow;}
});
