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
 vec3 caveRoof(vec2 p){
   float rock=caveNoise(p*.7);vec3 color=vec3(.015,.022,.036)*(0.4+rock);
   // Long pale roof facets and narrow fissures supply legible river reflections.
   vec2 tile=vec2(p.x*.95,p.y*.42);vec2 f=fract(tile)-.5;
   float shard=max(abs(f.x)*1.5,abs(f.y)*.85+abs(f.x)*.55);
   float crystal=(1.0-smoothstep(.18,.23,shard))*step(.52,caveHash(floor(tile)));
   float facet=.18+positivePow(.5+.5*sin(f.x*24.0+f.y*8.0),10.0)*2.7;
   color+=crystal*vec3(.31,.43,.56)*facet;
   return color;
 }
`;
