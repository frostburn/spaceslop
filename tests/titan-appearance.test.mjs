import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';
const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const { createCicadaScout, createCentipedeSection } = await server.ssrLoadModule('/src/titan-insect-rigs.ts');
const { createCicada } = await server.ssrLoadModule('/src/cicada-rig.ts');
const surfaces = await server.ssrLoadModule('/src/titan-insect-surfaces.ts');

test('patrol wing roots and membranes stay on the dorsal side throughout the beat', () => {
  const rig = createCicadaScout(), wings = rig.root.children.filter(o => o.name.startsWith('patrol-'));
  assert.equal(wings.length, 4);
  const p = new T.Vector3();
  for (let frame = 0; frame <= 80; frame++) {
    rig.pose(frame / 80); rig.root.updateMatrixWorld(true);
    for (const wing of wings) {
      assert(wing.position.z >= .32); assert(Math.abs(wing.position.x) < .2);
      const blade = wing.getObjectByName('wing-membrane'), vertices = blade.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        p.fromBufferAttribute(vertices, i); blade.localToWorld(p); rig.root.worldToLocal(p);
        assert(p.z > .31, 'membrane dips underneath the carapace');
      }
    }
  }
});

test('the three species use distinct shell palettes and actual mip-filtered textures without uploaded media', () => {
  const scout = createCicadaScout(), crawler = createCentipedeSection(), boss = createCicada();
  const shells = [scout.root.getObjectByName('scout-carapace').material,
    crawler.root.getObjectByName('overlapping-tergite').material,
    boss.root.children.find(o => o.isMesh).material];
  for (const material of shells) {
    assert(material.map.isDataTexture); assert(material.map.generateMipmaps);
    assert.equal(material.map.minFilter, T.LinearMipmapLinearFilter);
    assert.equal(material.map.colorSpace, T.SRGBColorSpace);
  }
  assert(shells[0].color.g > shells[0].color.r, 'patrol should be cool jade');
  assert(shells[1].color.r > shells[1].color.g * 2, 'crawler should be rusty red');
  assert(shells[2].color.r > .6 && shells[2].color.g > .5, 'boss should have a pale shell');
  const replacement = new T.Texture(); surfaces.setTitanChitinTexture(replacement);
  for (const material of shells) assert.equal(material.map, replacement);
  // Models created after loading also receive the reviewed map.
  assert.equal(createCicada().root.children.find(o => o.isMesh).material.map, replacement);
});

test('boss stubble is much denser than patrol stubble and follows the posed body without hiding weakpoint anchors', () => {
  const scout = createCicadaScout(), boss = createCicada(), fur = rig => {
    const patches = []; rig.root.traverse(o => { if (o.name === 'coarse-setae-patch') patches.push(o); }); return patches;
  };
  const light = fur(scout), heavy = fur(boss);
  assert.equal(light.length, 3); assert(heavy.length >= 24);
  assert(heavy.reduce((n,p)=>n+p.geometry.attributes.position.count,0)>light.reduce((n,p)=>n+p.geometry.attributes.position.count,0)*10);
  for(const patch of [...light,...heavy]){assert(patch.isMesh);assert(!patch.material.transparent);assert(patch.material.depthWrite);}
  const headPatch = heavy.find(p => p.parent !== boss.root && !p.parent.name.startsWith('leg-'));
  boss.pose(1, 0, -2.4, 0, 0, 0); boss.root.updateMatrixWorld(true); const before = headPatch.getWorldPosition(new T.Vector3());
  boss.pose(1, 0, -2.4, 0, 0, 2); boss.root.updateMatrixWorld(true);
  assert(before.distanceTo(headPatch.getWorldPosition(new T.Vector3())) > .005);
  for (const side of [-1, 1]) {
    const anchor = boss.root.getObjectByName(side < 0 ? 'laser_contact_L' : 'laser_contact_R');
    assert.equal(anchor.position.x, side * 2.4); assert.equal(anchor.position.z, .88);
  }

});
