import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  define: { __STUDY_TEXTURES__: JSON.stringify({heliostatMetal:'metal.png',heliostatCeramic:'ceramic.png',heliostatBackdrop:'backdrop.png',biolumeBackdrop:'biolume-study-backdrop.png',biolumeForeground:'biolume-study-foreground.png'}) },
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const layout = await server.ssrLoadModule('/src/heliostat/layout.ts');
const { createHeliostatMaterials } = await server.ssrLoadModule('/src/heliostat/materials.ts');
const { createHeliostatBay } = await server.ssrLoadModule('/src/heliostat/bay.ts');
const { createDistantPlant } = await server.ssrLoadModule('/src/heliostat/distant.ts');
const { createHeliostatCollector } = await server.ssrLoadModule('/src/heliostat/collector.ts');
const { createHeliostatRoute,routeKinds } = await server.ssrLoadModule('/src/heliostat/route.ts');
const { machineryPose } = await server.ssrLoadModule('/src/heliostat/machinery.ts');
const { createHeliostatBackdrop,backdropCrop } = await server.ssrLoadModule('/src/heliostat/backdrop.ts');
const { loadStudyTexture, loadStudyArt } = await server.ssrLoadModule('/src/studies/heliostat-assets.ts');

test('foreground and distant machinery have lit, textured volume with no raster stand-ins', () => {
  const m = createHeliostatMaterials(), bay = createHeliostatBay(m), far = createDistantPlant(m);
  let triangles = 0, meshes = 0;
  for (const root of [bay.root,far.root]) root.traverse(node => {
    if (!node.isMesh) return; meshes++;
    const effect=[m.starstuff,m.plasmaHalo,m.containmentGlass].includes(node.material);
    if(!effect){assert(node.material.isMeshStandardMaterial);assert.equal(node.material.transparent,false);}
    const g = node.geometry; assert(g.attributes.normal && g.attributes.uv);
    assert(Array.from(g.attributes.position.array).every(Number.isFinite));
    g.computeBoundingBox(); const size = g.boundingBox.getSize(new T.Vector3());
    assert(Math.min(size.x,size.y,size.z) > .02, 'a background structure is still a flat image card');
    triangles += (g.index?.count ?? g.attributes.position.count)/3;
  });
  assert(meshes<34 && triangles<110000, 'one bay and its distant scenery exceed the geometry budget');
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

test('ten-screen route shares four templates and bounds the active bay count',()=>{
  const m=createHeliostatMaterials(),route=createHeliostatRoute(m);assert.equal(route.bays.length,11);assert.equal(new Set(routeKinds).size,4);
  const mesh=root=>{let found;root.traverse(node=>{if(node.isMesh&&!found)found=node;});return found;};
  assert.equal(mesh(route.bays[2].root).geometry,mesh(route.bays[3].root).geometry,'identical bays duplicate geometry');
  for(let t=0;t<=layout.STUDY_DURATION;t+=.5){route.update(t);assert(route.bays.filter(b=>b.root.visible).length<=4);}
  assert.equal(layout.ROUTE_SPEED*layout.ROUTE_DURATION,10*layout.BAY_SPACING);m.releaseTextures();
});

test('prewarming exposes every variant and restores visibility, origin and culling flags',()=>{
  const m=createHeliostatMaterials(),route=createHeliostatRoute(m);route.update(51);route.root.visible=false;
  const before=route.bays.map(b=>[b.root.visible,b.root.position.y]);const restore=route.prepare(20);
  assert.equal(route.root.visible,true);const visible=route.bays.filter(b=>b.root.visible);
  assert.equal(new Set(visible.map(b=>b.kind)).size,4);assert(visible.every(b=>b.root.position.y===20));
  restore();assert.equal(route.root.visible,false);assert.deepEqual(route.bays.map(b=>[b.root.visible,b.root.position.y]),before);m.releaseTextures();
});

test('service fans and rigid arms animate from absolute presentation time without touching geometry',()=>{
  const m=createHeliostatMaterials();
  for(const kind of['docking','cooling']){
    const bay=createHeliostatBay(m,kind),pose=machineryPose(bay.root),nodes=bay.root.getObjectsByProperty('name',kind==='docking'?'service-arm-elbow':'service-fan-rotor');
    assert(nodes.length>=2);pose(8,1);const before=nodes.map(n=>n.quaternion.toArray());pose(8,1);assert.deepEqual(nodes.map(n=>n.quaternion.toArray()),before);
    pose(9,1);assert.notDeepEqual(nodes.map(n=>n.quaternion.toArray()),before);
    for(let t=0;t<=108;t+=3){pose(t,1);bay.root.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(0,-15,.4),new T.Vector3(0,1,0),0,40);assert.equal(ray.intersectObject(bay.root,true).length,0);}
  }
  m.releaseTextures();
});

test('raster pan preserves aspect ratio, scale and horizontal crop at every view',()=>{
  for(const view of[9/16,390/844,16/9])for(const image of[1/3,2/3,1/4]){
    const first=backdropCrop(view,image,0);let previous=first.y;
    for(const p of[0,.25,.5,.75,1]){
      const crop=backdropCrop(view,image,p);
      assert(Math.abs(crop.width*image/crop.height-view)<1e-12,'image is stretched');
      assert.equal(crop.width,first.width);assert.equal(crop.height,first.height);assert.equal(crop.x,first.x);assert(crop.y>=previous);previous=crop.y;
      assert(crop.x>=-1e-12&&crop.y>=0&&crop.x+crop.width<=1+1e-12&&crop.y+crop.height<=1+1e-12);
    }
  }
});

test('backdrop map is owned separately and UI changes cannot reupload or double-dispose it',()=>{
  const m=createHeliostatMaterials(),backdrop=createHeliostatBackdrop(),texture=new T.Texture();let disposed=0;
  texture.addEventListener('dispose',()=>disposed++);m.setArt({heliostatBackdrop:texture},true);backdrop.setTexture(texture,true);const version=texture.version;
  backdrop.setTexture(texture,false);backdrop.setTexture(texture,true);assert.equal(texture.version,version);
  m.releaseTextures();assert.equal(disposed,0);backdrop.releaseTextures();backdrop.releaseTextures();assert.equal(disposed,1);
});

test('camera and travel remain continuous, straight and deterministic', () => {
  let previous;
  for(let i=0;i<=1080;i++){
    const frame=layout.studyFrame(i/10),pose=layout.cameraPose(frame.progress);
    assert.deepEqual(frame,layout.studyFrame(i/10));if(previous)assert(pose.position.distanceTo(previous)<.65);
    assert.equal(pose.position.x,0);previous=pose.position;
  }
  for(let t=0;t<108;t+=.1)assert(layout.bayTravel(t+.1)<=layout.bayTravel(t));
  assert.equal(layout.bayTravel(108),layout.bayTravel(150));
  for(const p of[0,.1,.5,.8,1])assert(Math.abs(layout.studyFrame(layout.studyTimeAtSwing(p)).progress-p)<1e-8);
  const e=1e-4,left=(layout.bayTravel(100)-layout.bayTravel(100-e))/e,right=(layout.bayTravel(100+e)-layout.bayTravel(100))/e;
  assert(Math.abs(left-right)<1e-3,'scroll jerks at approach start');
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
    const pending=loadStudyArt(scope.signal);assert.equal(callbacks.length,3);assert(!callbacks.some(c=>c.url.includes('biolume')),'Uranus study fetched unrelated grove art');const image=new T.Texture();let disposed=0;image.addEventListener('dispose',()=>disposed++);
    callbacks[0].success(image);await Promise.resolve();scope.abort();assert.deepEqual(await pending,{});assert.equal(disposed,1);
  }finally{T.TextureLoader.prototype.load=originalLoad;globalThis.window=previousWindow;}
});
