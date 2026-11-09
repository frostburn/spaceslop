import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  define: { __STUDY_TEXTURES__: JSON.stringify({heliostatSky:'sky.png',heliostatDistant:'distant.png',heliostatPanels:'panels.png'}) }, server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const layout = await server.ssrLoadModule('/src/studies/heliostat-layout.ts');
const { createHeliostatBay } = await server.ssrLoadModule('/src/studies/heliostat-bay.ts');
const { loadStudyTexture, loadStudyArt } = await server.ssrLoadModule('/src/studies/heliostat-assets.ts');

test('rectified panels expose different physical faces and stay inside their own atlas cell', () => {
  for (const [face, tile, axis, expected] of [['front',0,'y',-1.406],['side',1,'x',1.306],['top',2,'z',2.306]]) {
    const g = layout.panelFace(face, 2.6, 2.8, 4.6, tile), position = g.attributes.position, normal = g.attributes.normal, uv = g.attributes.uv;
    const rect = layout.atlasRect(tile);
    for (let i = 0; i < position.count; i++) {
      assert(Math.abs(position.getComponent(i, 'xyz'.indexOf(axis)) - expected) < 1e-6);
      assert(normal.getComponent(i, 'xyz'.indexOf(axis)) * Math.sign(expected) > .99);
      assert(uv.getX(i) >= rect.u0 - 1e-6 && uv.getX(i) <= rect.u1 + 1e-6);
      assert(uv.getY(i) >= rect.v0 - 1e-6 && uv.getY(i) <= rect.v1 + 1e-6);
    }
    g.dispose();
  }
  assert.throws(() => layout.atlasRect(6), RangeError);
  assert(layout.atlasRect(0).v0 > layout.atlasRect(3).v1, 'atlas rows are vertically swapped');
});

test('the bay closes its foreground solids but leaves a genuine flight/bullet corridor', () => {
  const bay = createHeliostatBay(); bay.root.updateMatrixWorld(true);
  for (let x = -layout.LANE_HALF_WIDTH; x <= layout.LANE_HALF_WIDTH; x += .2) {
    const ray = new T.Raycaster(new T.Vector3(x, -15, .4), new T.Vector3(0, 1, 0), 0, 35);
    assert.equal(ray.intersectObject(bay.root, true).length, 0, 'scenery intrudes into the clear flight lane');
  }
  const ray = new T.Raycaster(new T.Vector3(5.85, -15, -.9), new T.Vector3(0, 1, 0), 0, 35);
  assert(ray.intersectObject(bay.root, true).length > 2, 'tower is a flat card without a back');
  bay.setArt(new T.Texture(), true);
  const roof = new T.Raycaster(new T.Vector3(5.85, 1.8, 10), new T.Vector3(0, 0, -1))
    .intersectObject(bay.root, true).filter(hit => hit.object.parent.visible);
  assert.equal(roof[0].object.material, bay.panels, 'a solid roof cap hides the top artwork');
  let triangles = 0;
  bay.root.traverse(node => { if (node.isMesh) { const g = node.geometry;
    assert(Array.from(g.attributes.position.array).every(Number.isFinite));
    triangles += (g.index?.count ?? g.attributes.position.count) / 3;
  } });
  assert(triangles < 24000, 'one study bay has excessive placeholder geometry');
});

test('swing and timeline are continuous, reversible and deterministic at all three views', () => {
  let previous;
  const camera = new T.PerspectiveCamera(layout.CAMERA_FOV, 9 / 16, .1, 600); camera.up.set(0,0,1);
  for (let i = 0; i <= 180; i++) {
    const frame = layout.studyFrame(i / 10), pose = layout.cameraPose(frame.progress);
    assert.deepEqual(frame, layout.studyFrame(i / 10));
    if (previous) assert(pose.position.distanceTo(previous) < .5, 'camera jumps during ascent');
    camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld();
    assert(camera.matrixWorld.elements.every(Number.isFinite));
    assert(Math.abs(pose.position.x) < 1e-9, 'camera follows a winding route');
    previous = pose.position;
  }
  assert.equal(layout.studyFrame(5).progress, 0); assert.equal(layout.studyFrame(14).progress, 1);
  assert.deepEqual(layout.cameraPose(-1), layout.cameraPose(0));
  assert.deepEqual(layout.cameraPose(2), layout.cameraPose(1));
  for (let t = 0; t < 8; t += .1) assert(layout.bayTravel(t + .1) <= layout.bayTravel(t), 'bay reverses scroll direction');
  assert.equal(layout.bayTravel(7), layout.bayTravel(18), 'stopped bay drifts during the settled view');
});

test('missing, cancelled and late study art cannot change a disposed scene', async () => {
  const previousWindow = globalThis.window, originalLoad = T.TextureLoader.prototype.load;
  globalThis.window = { setTimeout, clearTimeout }; let complete, calls = 0, disposed = 0;
  T.TextureLoader.prototype.load = function(url, onLoad) { assert.equal(url, '/base/panels.png'); complete = onLoad; calls++; return new T.Texture(); };
  try {
    const scope = new AbortController(), pending = loadStudyTexture('/base/panels.png', scope.signal);
    scope.abort(); assert.equal(await pending, undefined);
    const late = new T.Texture(); late.addEventListener('dispose', () => disposed++); complete(late);
    assert.equal(disposed, 1);
    assert.equal(await loadStudyTexture('/base/panels.png', scope.signal), undefined); assert.equal(calls, 1);
  } finally { T.TextureLoader.prototype.load = originalLoad; globalThis.window = previousWindow; }
});

test('failed artwork resolves to a stand-in and abort releases an already-loaded sibling', async () => {
  const previousWindow = globalThis.window, originalLoad = T.TextureLoader.prototype.load;
  globalThis.window = { setTimeout, clearTimeout }; const callbacks = [];
  T.TextureLoader.prototype.load = function(url, success, progress, failure) { callbacks.push({url,success,failure}); return new T.Texture(); };
  try {
    const scope = new AbortController(), missing = loadStudyTexture('/missing.png', scope.signal);
    callbacks.pop().failure(new Error('missing')); assert.equal(await missing, undefined);
    const pending = loadStudyArt(scope.signal); assert.equal(callbacks.length, 3);
    const image = new T.Texture(); let disposed = 0; image.addEventListener('dispose', () => disposed++);
    callbacks[0].success(image); await Promise.resolve(); scope.abort();
    assert.deepEqual(await pending, {}); assert.equal(disposed, 1, 'a completed sibling image leaks on cancellation');
  } finally { T.TextureLoader.prototype.load = originalLoad; globalThis.window = previousWindow; }
});
