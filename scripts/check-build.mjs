import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url).pathname;
const packs=JSON.parse(await readFile(join(root,'level-packages.json'),'utf8'));
assert.equal(packs.version,1);
const ids=['wormhole','fleet','den','biolume','preserve','broodlock','ice','titan','io','vents','boulevard','heliostat','summer'];assert.deepEqual(Object.keys(packs.levels).sort(),ids.toSorted());
const files=await readdir(join(root,'assets')),entry=files.find(f=>/^index-.*\.js$/.test(f));assert(entry);
assert((await stat(join(root,'assets',entry))).size<40000,'The menu bundle grew beyond 40 KB. Check for eager game imports.');
const serviceWorker=await readFile(join(root,'sw.js'),'utf8');
assert(!serviceWorker.includes('url:"assets/three-'),'The menu precaches the 3D engine.');
assert(!serviceWorker.includes('url:"assets/flight-session-'),'The menu precaches the flight runtime.');
assert(!serviceWorker.includes('officers/'),'The menu precaches briefing artwork.');
const precacheFiles=[...serviceWorker.matchAll(/url:"([^"]+)"/g)].map(match=>match[1]);
let shellBytes=0;for(const file of precacheFiles)shellBytes+=(await stat(join(root,file))).size;
assert(shellBytes<80000,'The precached menu grew beyond 80 KB.');

for(const id of ids){
 const pack=packs.levels[id];assert(pack.required.length>1);
 assert(pack.media.filter(path=>path.startsWith('officers/')&&!path.startsWith('officers/rank-insignia.png?')).length<=1, 'Unrelated officers entered a level package.');
 assert.equal(new Set(pack.media).size,pack.media.length,'Duplicate media in offline package');
 for(const file of pack.media){const url=new URL(file,'https://assets.invalid/');const hash=createHash('sha256').update(await readFile(join(root,url.pathname))).digest('hex').slice(0,12);assert.equal(url.searchParams.get('v'),hash,'Unversioned or stale media URL: '+file);}
assert(pack.required.includes(pack.entry));
 for(const file of pack.required){await stat(join(root,file));assert(!ids.some(other=>other!==id&&file===packs.levels[other].entry),`${id} includes ${file}`);}
 for(const other of ids)assert(!serviceWorker.includes(`url:"${packs.levels[other].entry}`),'The service worker precaches level code.');
 assert(!serviceWorker.includes('encounters/'),'The service worker eagerly downloads level media.');
}
for(const file of ['workshop.html','patrol-study.html','vent-study.html','io-study.html','heliostat-study.html','biolume-study.html','black-hole-study.html'])await assert.rejects(stat(join(root,file)));
for(const file of files.filter(f=>f.endsWith('.js'))){const text=await readFile(join(root,'assets',file),'utf8');assert(!text.includes('__qa'),'QA hooks leaked into production.');assert(!/(workshop|patrol-study|vent-study|io-study|heliostat-study|biolume-study|black-hole-study)\.html/.test(text),'Development links leaked into production.');assert(!/Play study|Orbit view|inspect-backdrop|Relief shading|Copy edits/.test(text),'Development renderer leaked into production code.');}
for(const [id,pack] of Object.entries(packs.levels)){
 assert(!pack.media.some(path=>/biolume-study-(backdrop|foreground)/.test(path)),'DEV plate entered an offline level package.');
 if(id!=='den')assert(!pack.media.some(path=>/draconian-(accretion-disk|galactic-center|gantry|cliffside|patrol-turns|cliff-props|defenses)/.test(path)||
  id!=='wormhole'&&path.startsWith('encounters/draconian-biker-atlas.')),'Den art leaked into another level.');
 if(id!=='biolume')assert(!pack.media.some(path=>/biolume-(backdrop|foreground|glider|study-atlas|frog-atlas)/.test(path)||
  id!=='wormhole'&&path.startsWith('encounters/biolume-lantern-ray.')),'Lantern Grove art leaked into another level.');
 if(id!=='fleet')assert(!pack.media.some(path=>path.startsWith('encounters/fleet-')&&
  !(id==='wormhole'&&path.startsWith('encounters/fleet-saucer-alloy.'))),'Fleet Clash art leaked into another level.');
 if(id==='wormhole'){
  const bossMaps = new Set(['interceptor-metal', 'ant-chitin', 'broodlock-fungus', 'ant-mold', 'io-ceramic', 'vent-crab',
   'titan-chitin', 'marine-hide', 'feather-vane', 'draconian-scales', 'summer-hydra', 'biolume-lantern-ray',
   'fleet-saucer-alloy', 'draconian-biker-atlas', 'fons-mane'].map(name=>`/encounters/${name}.png`));
  assert(!pack.media.some(path=>path.startsWith('encounters/')&&!bossMaps.has(new URL(path,'https://assets.invalid/').pathname)),
   'Wormhole included unrelated stage media.');
 }
 else assert(!pack.media.some(path=>path.startsWith('encounters/fons-')),'Fons art leaked into another level.');
}
console.log('Menu size, isolated level packages, selective precaching and production dev-page exclusions passed.');
