import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {createServer} from 'vite';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true},appType:'custom'});
after(()=>server.close());
const lens=await server.ssrLoadModule('/src/studies/black-hole-orbits.ts');
const exits=new Uint8Array(lens.ORBIT_COLUMNS*4);
const table=lens.bakeLightOrbits(exits);
function rowSample(column,row){
 const offset=(row*lens.ORBIT_COLUMNS+column)*4;
 return table[offset+2]===255?(256*table[offset]+table[offset+1])/131070:undefined;
}
function rayAt(impact,angle){
 const {ORBIT_FINE_START:start,ORBIT_FINE_END:end,ORBIT_FINE_FIRST:first,ORBIT_FINE_LAST:last}=lens;
 const column=impact<start?impact/start*first:impact<end?first+(impact-start)/(end-start)*(last-first):last+(impact-end)/(lens.ORBIT_MAX_IMPACT-end)*(lens.ORBIT_COLUMNS-1-last);
 return rowSample(Math.round(column),Math.round(angle/lens.ORBIT_MAX_ANGLE*(lens.ORBIT_ROWS-1)));
}
test('the Schwarzschild table resolves capture, escape and the critical photon orbit',()=>{
 const finalRow=lens.ORBIT_ROWS-1,critical=(lens.ORBIT_FINE_FIRST+lens.ORBIT_FINE_LAST)/2;
 const captured=lens.ORBIT_FINE_FIRST,escaped=lens.ORBIT_FINE_LAST;
 const finalSample=column=>{
  for(let row=finalRow;row>=0;row--){const u=rowSample(column,row);if(u!==undefined)return u;}
 };
 assert(finalSample(captured)>.48);
 assert(finalSample(escaped)<.015);
 assert(Math.abs(rowSample(critical,finalRow)-1/3)<.001);
});
test('a distant ray has nearly the straight-line closest approach',()=>{
 const u=rayAt(lens.ORBIT_MAX_IMPACT,Math.PI/2);
 assert(u>1/lens.ORBIT_MAX_IMPACT);
 assert(u<1.07/lens.ORBIT_MAX_IMPACT);
});
test('escaping rays bend the sky most strongly near the shadow',()=>{
 const bend=column=>{
  const i=4*column;
  return exits[i+2]===255?(exits[i]*256+exits[i+1])/65535*lens.ORBIT_MAX_ANGLE-Math.PI:undefined;
 };
 assert.equal(bend(lens.ORBIT_FINE_FIRST),undefined);
 assert.equal(bend((lens.ORBIT_FINE_FIRST+lens.ORBIT_FINE_LAST)/2),undefined);
 assert(bend(lens.ORBIT_FINE_LAST)>1);
 const distant=bend(lens.ORBIT_COLUMNS-1);
 assert(distant>4/lens.ORBIT_MAX_IMPACT&&distant<.2);
});
test('near-edge-on bending exposes both far-side disk images',()=>{
 const inclination=84*Math.PI/180;
 const inDisk=u=>u>=1/lens.DISK_OUTER&&u<=1/lens.DISK_INNER;
 const upperAngle=Math.PI/2+inclination,lowerAngle=Math.PI/2-inclination;
 assert(!inDisk(Math.sin(upperAngle)/8));
 assert(inDisk(rayAt(8,upperAngle)));
 assert(!inDisk(rayAt(6.9,lowerAngle)));
 assert(inDisk(rayAt(6.9,lowerAngle+Math.PI)));
});
