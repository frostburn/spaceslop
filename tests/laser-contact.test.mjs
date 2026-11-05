import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const { createLaserContactTrace } = await server.ssrLoadModule('/src/laser-contact.ts');
const solid = new T.MeshBasicMaterial();
const box = (x, y, z, width = 1, height = 1) => {
  const mesh = new T.Mesh(new T.BoxGeometry(width, height, 1), solid);
  mesh.position.set(x, y, z); return mesh;
};

test('a laser meets a raised shell before the simulation hitbox, including a rotated flight plane', () => {
  const plane = new T.Group(); plane.rotation.x = -Math.PI / 2;
  const model = new T.Group(); model.add(box(0, 2, 1, 2, 2)); plane.add(model);
  const origin = { x: 0, y: -5 }, hitbox = { x: 0, y: 2 };
  const contact = createLaserContactTrace(plane)(origin, hitbox, model, 26);
  assert(Math.abs(contact.x) < 1e-6);
  assert(Math.abs(contact.y - 26 / 25.5) < 1e-6);
  assert.deepEqual(hitbox, { x: 0, y: 2 }, 'render tracing must not move the simulation hitbox');
});

test('tracing skips holes inside bounds, hidden parts, and transparent effects', () => {
  const plane = new T.Group(), model = new T.Group(); plane.add(model);
  const split = new T.BufferGeometry();
  split.setAttribute('position', new T.Float32BufferAttribute([-2, 0, 1, -1, 0, 1, -1, 4, 1,
    1, 0, 1, 2, 0, 1, 1, 4, 1], 3));
  model.add(new T.Mesh(split, solid), box(0, 4, 1));
  const hidden = box(0, -2, 1); hidden.visible = false; model.add(hidden);
  const glow = box(0, -3, 1); glow.material = new T.MeshBasicMaterial({ transparent: true }); model.add(glow);
  const contact = createLaserContactTrace(plane)({ x: 0, y: -5 }, { x: 0, y: 4 }, model);
  assert(Math.abs(contact.y - 3.5) < 1e-6);
});

test('boss contact uses perspective projection rather than the distant model coordinates', () => {
  const plane = new T.Group(), model = new T.Group(); plane.add(model);
  model.position.set(0, 4.2, -12); model.add(box(-2.4, 0, 0, 1.2, 1));
  const x = -2.4 * 22 / 34, end = { x, y: 4.2 * 22 / 34 };
  const contact = createLaserContactTrace(plane)({ x, y: -5 }, end, model, 22);
  assert.equal(contact.x, x);
  assert(contact.y > 2.2 && contact.y < 2.5);
  assert(contact.y < end.y);
});

test('a missed silhouette keeps the beam endpoint and a diagonal beam follows its visible edge', () => {
  const plane = new T.Group(), model = new T.Group(); plane.add(model); model.add(box(2, 2, 1, 2, 2));
  const trace = createLaserContactTrace(plane);
  assert.deepEqual(trace({ x: -2, y: -4 }, { x: -2, y: 2 }, model).toArray(), [-2, 2]);
  const contact = trace({ x: -2, y: -2 }, { x: 2, y: 2 }, model);
  assert(Math.abs(contact.x - 1) < 1e-6 && Math.abs(contact.y - 1) < 1e-6);
});
