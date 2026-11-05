// Shared, world-anchored illumination for rock, water and crystal interiors.
// White stellar shafts split at bank-side prisms into bounded spectral fans.
export const prismLight = `
 uniform float caveScroll,caveTime;
 float caveHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float caveNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
   return mix(mix(caveHash(i),caveHash(i+vec2(1,0)),f.x),mix(caveHash(i+vec2(0,1)),caveHash(i+1.0),f.x),f.y);}
 vec3 spectrum(float t){
   return clamp(vec3(1.5-abs(4.0*t-3.0),1.5-abs(4.0*t-2.0),1.5-abs(4.0*t-1.0)),0.0,1.0);
 }
 vec2 riverCurrent(vec2 p){
   float n=caveNoise(p*vec2(.8,1.5)+vec2(0,-caveTime*.16));
   return vec2(sin(p.y*14.0+p.x*3.0+n*9.0-caveTime*1.4)*.018,
     sin(p.y*8.0-p.x*7.0+n*6.0-caveTime*.9)*.006);
 }
 vec3 stellarCaustics(vec3 point){
   vec2 p=point.xy+vec2(0,caveScroll);vec3 light=vec3(0);
   for(int i=0;i<6;i++){
     float k=float(i),side=mod(k,2.0)*2.0-1.0;
     float y=mod(p.y-k*7.7+24.0,48.0)-24.0;
     vec2 q=vec2(p.x-side*(4.3+sin(k*7.0)*.25),y);
     vec2 ray=normalize(vec2(-.82,-.57));
     if(side<0.0)ray=normalize(vec2(.78,-.62));
     float along=dot(q,ray),across=dot(q,vec2(-ray.y,ray.x));
     float width=.18+max(along,0.0)*.19;
     float t=(across+.035*sin(p.y*4.7+p.x*8.0)+.03*sin(p.y*15.0))/(width*2.0)+.5;
     float mask=smoothstep(-.3,.35,along)*(1.0-smoothstep(7.0,10.0,along));
     float envelope=smoothstep(0.0,.06,t)*(1.0-smoothstep(.94,1.0,t));
     float ripple=caveNoise(vec2(p.x*3.0+p.y*.9,p.y*15.0-caveTime*.8));
     float focus=pow(smoothstep(.25,.8,ripple),2.0);
     float filament=pow(.5+.5*sin(t*55.0+caveNoise(p*7.0)*8.0),18.0);
     light+=spectrum(t)*mask*envelope*(.16+focus*2.6+filament*.35);
   }
   vec2 flow=p*vec2(3.6,5.3)+riverCurrent(point.xy)*8.0;
   float net=abs(sin(flow.x+sin(flow.y*.71))*.55+sin(flow.y+sin(flow.x*.63))*.45);
   float lace=pow(max(0.0,1.0-net),22.0);
   float edge=smoothstep(2.4,4.4,abs(p.x));
   return light+lace*edge*vec3(1.1,.65,.19)*.25;
 }
 vec3 caveRoof(vec2 p){
   float rock=caveNoise(p*.7);vec3 color=vec3(.015,.022,.036)*(0.4+rock);
   // Long pale roof facets and narrow fissures supply legible river reflections.
   vec2 tile=vec2(p.x*.95,p.y*.42);vec2 f=fract(tile)-.5;
   float shard=max(abs(f.x)*1.5,abs(f.y)*.85+abs(f.x)*.55);
   float crystal=(1.0-smoothstep(.18,.23,shard))*step(.52,caveHash(floor(tile)));
   float facet=.18+pow(.5+.5*sin(f.x*24.0+f.y*8.0),10.0)*2.7;
   color+=crystal*vec3(.31,.43,.56)*facet;
   return color;
 }
`;
