import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

const server = await createServer({
  root: new URL('..', import.meta.url).pathname, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] },
});
after(() => server.close());

const savedDocument = globalThis.document;
globalThis.document = {
  createElement: () => ({
    getContext: () => ({
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData() {},
    }),
  }),
};
let rigs;
try {
  rigs = await server.ssrLoadModule('/src/ant-rigs.ts');
} finally {
  globalThis.document = savedDocument;
}
const { BOSS_MUZZLE_Z } = await server.ssrLoadModule('/src/encounters.ts');
const { createBossLaserContact } = await server.ssrLoadModule('/src/laser-contact.ts');

test('ant mold follows the shell around the sides and through the soldier windup', () => {
  const { root, setKind, pose } = rigs.createAntRig();
  const ray = new T.Raycaster(), p = new T.Vector3(), direction = new T.Vector3();
  const start = new T.Vector3(), center = new T.Vector3();
  setKind('soldier');
  pose(1.13, 1);
  root.rotation.set(0.12, 0.41, Math.PI);
  root.updateMatrixWorld(true);
  for (const [name, centerZ] of [['gaster', 0.014], ['thorax', 0.19], ['head', 0.02]]) {
    const shell = root.getObjectByName(`${name}-shell`);
    const mold = root.getObjectByName(`${name}-mold`);
    assert(mold.isMesh);
    assert.equal(shell.parent, mold.parent);
    const positions = mold.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i += 11) {
      mold.localToWorld(p.fromBufferAttribute(positions, i));
      shell.localToWorld(center.set(0, positions.getY(i), centerZ));
      direction.subVectors(center, p).normalize();
      ray.set(start.copy(p).addScaledVector(direction, -0.06), direction);
      const hit = ray.intersectObject(shell, false)[0];
      assert(hit, `${name} mold overhangs its shell at vertex ${i}`);
      assert(p.distanceTo(hit.point) < 0.031, `${name} mold lifts off its shell at vertex ${i}`);
    }
  }
});

test('the Guardian only recoils on the fired side, keeping its shoulders seated and laser contacts aligned', () => {
  const x = 2.4, distance = 23;
  const { root, pose } = rigs.createHiveGuardian(x);
  const plane = new T.Group();
  plane.add(root);
  root.position.set(0, 4.2, -12);
  const contact = createBossLaserContact(plane, root);
  const vertex = new T.Vector3();
  for (const [name, sign] of [['L', -1], ['R', 1]]) {
    const arm = root.getObjectByName(`spore-arm_${name}`);
    const muzzle = root.getObjectByName(`muzzle_${name}`);
    const { radialSegments: sides, tubularSegments: rows } = arm.geometry.parameters;
    for (const pulse of [0, 0.37, 1]) {
      pose(1, 0.82, -sign * x, sign * x, pulse, 1.3);
      assert.equal(Math.abs(root.getObjectByName(`muzzle_${name === 'L' ? 'R' : 'L'}`).position.z), 0);
      assert.equal(muzzle.position.x, sign * x);
      assert.equal(muzzle.position.y, 0);
      const bind = arm.geometry.getAttribute('position');
      for (let i = 0; i <= sides; i++) {
        assert.equal(arm.getVertexPosition(i, vertex).z, bind.getZ(i));
        const tip = rows * (sides + 1) + i;
        assert(Math.abs(arm.getVertexPosition(tip, vertex).z - bind.getZ(tip) - muzzle.position.z) < 1e-6);
      }
      const z = root.position.z + BOSS_MUZZLE_Z - 0.29 * pulse + 1.05 * (0.19 + 0.06 * pulse);
      const factor = distance / (distance - z), projected = contact(sign * x, distance);
      assert(Math.abs(projected.x - sign * x * factor) < 1e-7);
      assert(Math.abs(projected.y - root.position.y * factor) < 1e-7);
      const chargedZ = root.position.z + BOSS_MUZZLE_Z + 1.05 * (0.19 + 0.1 * 0.82);
      assert(Math.abs(contact(-sign * x, distance).x + sign * x * distance / (distance - chargedZ)) < 1e-7);
    }
  }
});
