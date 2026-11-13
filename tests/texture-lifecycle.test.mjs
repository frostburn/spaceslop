import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,define:{__ENCOUNTER_TEXTURES__:JSON.stringify({armor:'encounters/test.png?v=123'})},server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const {loadEncounterTexture}=await server.ssrLoadModule('/src/encounter-texture.ts');
const { applyRelief } = await server.ssrLoadModule('/src/encounter-surfaces.ts');
const { disposeScene } = await server.ssrLoadModule('/src/rendering/dispose.ts');
const { FlightView } = await server.ssrLoadModule('/src/view.ts');

test('cancelled preparation resolves promptly and a late image cannot overwrite the next scene',async()=>{
 const previousWindow=globalThis.window,originalLoad=T.TextureLoader.prototype.load;globalThis.window={setTimeout};let complete,calls=0,disposed=0;
 T.TextureLoader.prototype.load=function(url,onLoad){assert(url.endsWith('encounters/test.png?v=123'));complete=onLoad;calls++;return new T.Texture();};
 try{
  const controller=new AbortController();let applied=0;
  const pending=loadEncounterTexture('armor',()=>applied++,undefined,controller.signal);assert.equal(calls,1);controller.abort();assert.equal(await pending,undefined);
  const image=new T.Texture();image.addEventListener('dispose',()=>disposed++);complete(image);assert.equal(applied,0);assert.equal(disposed,1);
  await loadEncounterTexture('armor',()=>applied++,undefined,controller.signal);assert.equal(calls,1,'already-cancelled scope starts another image');
 }finally{T.TextureLoader.prototype.load=originalLoad;globalThis.window=previousWindow;}
});

test('scene teardown releases shared uploads and preserves procedural surface maps for the next flight', async () => {
  const previousDocument = globalThis.document;
  let hive, mold;
  try {
    globalThis.document = {
      createElement() {
        return {
          getContext: () => ({
            createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
            putImageData() {},
          }),
        };
      },
    };
    hive = await server.ssrLoadModule('/src/hive-materials.ts');
    mold = await server.ssrLoadModule('/src/ant-mold.ts');
  } finally {
    globalThis.document = previousDocument;
  }
  const root = new T.Scene();
  const shell = new T.Mesh(new T.BoxGeometry(), hive.antShell);
  root.add(shell, new T.Mesh(shell.geometry, hive.fungusStem));
  mold.addMoldPatch(root, 0, 0, 0, 1, 1);
  const sprite = root.getObjectByName('camera-facing-mold');
  const proceduralShell = hive.antShell.map;
  const proceduralMold = sprite.material.map;
  const proceduralCap = hive.fungusCap.map;
  const relief = new T.MeshStandardMaterial();
  root.add(new T.Mesh(shell.geometry, relief));
  const photo = new T.Texture();
  const releases = [];
  photo.addEventListener('dispose', () => releases.push(photo));
  hive.setAntChitinTexture(photo);
  hive.setFungusTexture(photo);
  mold.setAntMoldTexture(photo);
  applyRelief(photo, [relief]);
  assert.equal(sprite.material.map, photo);
  assert.equal(hive.fungusCap.map, photo);
  disposeScene(root);
  assert.deepEqual(releases, [photo]);
  assert.equal(sprite.material.map, proceduralMold);
  assert.equal(shell.material.map, proceduralShell);
  assert.equal(hive.fungusCap.map, proceduralCap);
  assert.equal(relief.map, null);
  assert.equal(relief.bumpMap, null);
  assert.equal(root.children.length, 0);
});

test('cancelling warm-up between frames restores the level before the next preparation', async () => {
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const frames = new Map();
  let nextId = 0;
  globalThis.requestAnimationFrame = callback => {
    frames.set(++nextId, callback);
    return nextId;
  };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const calls = [];
  const controller = new AbortController();
  const view = {
    texturesReady: Promise.resolve([]),
    renderer: { extensions: { has: () => false } },
    level: {
      contacts: [], warmup: [[]],
      prepare: () => calls.push('prepare'),
      afterWarmup: () => calls.push('restore'),
    },
    player: { root: new T.Group() },
    combat: { root: new T.Group() },
    playerMuzzle: { root: new T.Group() },
    droneMuzzle: { root: new T.Group() },
    victoryFlares: { root: new T.Group() },
    wingPods: [[], []],
    projectiles: {},
    drops: [],
    wingLasers: [],
    markers: [],
  };
  try {
    const warming = FlightView.prototype.warmup.call(view, controller.signal, () => calls.push('repaint'));
    await Promise.resolve();
    assert.equal(frames.size, 1);
    const [id, frame] = frames.entries().next().value;
    frames.delete(id);
    frame();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, ['prepare']);
    assert.equal(frames.size, 1);
    controller.abort();
    await warming;
    assert.equal(frames.size, 0);
    assert.deepEqual(calls, ['prepare', 'restore']);
  } finally {
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
});
