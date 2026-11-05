import { prismSafe } from './prism-safe';
// Shared neutral cave surfaces and water current; no spectral illumination.
export const prismLight = `${prismSafe}
uniform vec3 caveEye;
 uniform float caveScroll,caveTime;
 float caveHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float caveNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
   return mix(mix(caveHash(i),caveHash(i+vec2(1,0)),f.x),mix(caveHash(i+vec2(0,1)),caveHash(i+1.0),f.x),f.y);}
 vec2 riverCurrent(vec2 p){
   float n=caveNoise(p*vec2(.8,1.5)+vec2(0,-caveTime*.16));
   return vec2(sin(p.y*14.0+p.x*3.0+n*9.0-caveTime*1.4)*.018,
     sin(p.y*8.0-p.x*7.0+n*6.0-caveTime*.9)*.006);
 }
 float roofOpening(vec2 p){
   vec2 cell=floor(p/vec2(7.0,14.0)),f=fract(p/vec2(7.0,14.0));
   vec2 center=vec2(.30+caveHash(cell+2.0)*.4,.30+caveHash(cell+7.0)*.4);
   vec2 q=(f-center)*vec2(7.0,14.0);
   float radius=.65+caveHash(cell+19.0)*.70;
   float edge=length(q)+sin(atan(q.y,q.x)*5.0+caveHash(cell)*8.0)*.12;
   return 1.0-smoothstep(radius-.035,radius+.035,edge);
 }
 vec3 basaltRoof(vec2 p){
   float stone=caveNoise(p*.8),grain=caveHash(floor(p*55.0));
   vec2 tile=p*1.25,cell=floor(tile),f=fract(tile);float first=100.0,second=100.0,facet=.5;
   for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
     vec2 offset=vec2(float(x),float(y)),id=cell+offset;
     vec2 q=offset+vec2(caveHash(id),caveHash(id+17.0))*.65+.175-f;
     float d=dot(q,q);if(d<first){second=first;first=d;facet=.4+caveHash(id+3.0)*.7;}else second=min(second,d);
   }
   float seam=1.0-smoothstep(.015,.08,second-first);
   vec3 basalt=mix(vec3(.025,.027,.030),vec3(.10,.105,.11),stone)*facet;
   return basalt*(.8+grain*.3)*(1.0-seam*.75);
 }
 vec3 roofStarlight(vec2 p){
   float dust=caveNoise(p*.17);
   return vec3(2.5,2.7,3.0)*(1.0+dust*.6);
 }
 vec3 caveRoof(vec2 p){return mix(basaltRoof(p),roofStarlight(p),roofOpening(p));}
`;
