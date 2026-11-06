import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url).pathname;
const packs=JSON.parse(await readFile(join(root,'level-packages.json'),'utf8'));
assert.equal(packs.version,1);
const ids=['preserve','broodlock','ice','titan','io','vents'];assert.deepEqual(Object.keys(packs.levels).sort(),ids.toSorted());
const files=await readdir(join(root,'assets')),entry=files.find(f=>/^index-.*\.js$/.test(f));assert(entry);
assert((await stat(join(root,'assets',entry))).size<40000,'The menu bundle grew beyond 40 KB. Check for eager game imports.');
const serviceWorker=await readFile(join(root,'sw.js'),'utf8');
assert(!serviceWorker.includes('url:"assets/three-'),'The menu precaches the 3D engine.');
assert(!serviceWorker.includes('url:"assets/flight-session-'),'The menu precaches the flight runtime.');
const precacheFiles=[...serviceWorker.matchAll(/url:"([^"]+)"/g)].map(match=>match[1]);
let shellBytes=0;for(const file of precacheFiles)shellBytes+=(await stat(join(root,file))).size;
assert(shellBytes<80000,'The precached menu grew beyond 80 KB.');

for(const id of ids){
 const pack=packs.levels[id];assert(pack.required.length>1);
 assert.equal(new Set(pack.media).size,pack.media.length,'Duplicate media in offline package');
 for(const file of pack.media){const url=new URL(file,'https://assets.invalid/');const hash=createHash('sha256').update(await readFile(join(root,url.pathname))).digest('hex').slice(0,12);assert.equal(url.searchParams.get('v'),hash,'Unversioned or stale media URL: '+file);}
assert(pack.required.includes(pack.entry));
 for(const file of pack.required){await stat(join(root,file));assert(!ids.some(other=>other!==id&&file===packs.levels[other].entry),`${id} includes ${file}`);}
 for(const other of ids)assert(!serviceWorker.includes(`url:"${packs.levels[other].entry}`),'The service worker precaches level code.');
 assert(!serviceWorker.includes('encounters/'),'The service worker eagerly downloads level media.');
}
for(const file of ['workshop.html','vent-study.html','io-study.html'])await assert.rejects(stat(join(root,file)));
for(const file of files.filter(f=>f.endsWith('.js'))){const text=await readFile(join(root,'assets',file),'utf8');assert(!text.includes('__qa'),'QA hooks leaked into production.');}
console.log('Menu size, six isolated level packages, selective precaching and production dev-page exclusions passed.');
