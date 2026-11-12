// Shared by vertex displacement and fragment detail. The field moves in world
// coordinates, so its painted crests cannot slide over unrelated geometry.
export const titanCloudNoise=`
float cloudHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float cloudNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(cloudHash(i),cloudHash(i+vec2(1,0)),f.x),mix(cloudHash(i+vec2(0,1)),cloudHash(i+vec2(1,1)),f.x),f.y);}
`;
export const titanCloudField=`${titanCloudNoise}
float cloudHeight(vec2 p){p+=vec2(cloudNoise(p*.11),cloudNoise(p*.11+19.3))*1.8;vec2 g=p*.16,cell=floor(g);float dome=0.0;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=cell+vec2(float(x),float(y));vec2 centre=c+.1+vec2(cloudHash(c),cloudHash(c+31.7))*.8;vec2 q=(g-centre)/(.64+cloudHash(c+71.3)*.36);float puff=exp(-dot(q,q)*2.5)*(.7+cloudHash(c+19.3)*.3),blend=clamp(.5+.5*(dome-puff)/.25,0.0,1.0);dome=mix(puff,dome,blend)+.25*blend*(1.0-blend);}
 return clamp(dome*.82+cloudNoise(p*.45)*.10,0.0,1.0);}

`;
export const TITAN_CLOUD_RELIEF=[2.6,1.65,.85] as const;
