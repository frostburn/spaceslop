import * as T from 'three';

// Camera-facing cloud deck: all optical motion follows simulation time.
export function createTitanClouds(){
 const root=new T.Mesh(new T.PlaneGeometry(9,16),new T.ShaderMaterial({depthWrite:false,uniforms:{time:{value:0},rise:{value:0}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);}',
 fragmentShader:`varying vec2 vUv;uniform float time,rise;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 float fbm(vec2 p){float n=0.0,w=.55;for(int i=0;i<5;i++){n+=noise(p)*w;p=p*2.03+17.3;w*=.48;}return n;}
 void main(){vec2 uv=vUv;float horizon=.68;float below=max(0.0,horizon-uv.y);
 vec2 overhead=vec2(uv.x*6.0,uv.y*9.0+time*.09);
 vec2 perspective=vec2((uv.x-.5)/(below+.12)*2.0,1.4/(below+.12)+time*.19);
 vec2 p=mix(overhead,perspective*2.1,rise);float n=fbm(p);n=fbm(p+vec2(n*2.4,n*1.2));
 float ridges=smoothstep(.2,.76,n);float sunlight=pow(max(0.0,1.0-length((uv-vec2(.04,.78))*vec2(.9,1.6))),3.0);
 vec3 cloud=mix(vec3(.17,.085,.03),vec3(.82,.46,.13),ridges);cloud+=vec3(.35,.22,.09)*sunlight;
 float sky=smoothstep(horizon-.02,horizon+.015,uv.y)*smoothstep(0.0,.3,rise);
 vec3 c=mix(cloud,mix(vec3(.30,.15,.055),vec3(.075,.043,.025),uv.y),sky);
 c+=vec3(.28,.13,.035)*exp(-abs(uv.y-horizon)*35.0)*rise;
 gl_FragColor=vec4(c,1);#include <colorspace_fragment>
 }`.replace(';#include',';\n#include')}));
 root.name='titan-cloud-deck';root.position.z=-90;root.frustumCulled=false;
 return {root,update(time:number,rise:number,distance:number){root.material.uniforms.time.value=time;root.material.uniforms.rise.value=rise;root.scale.setScalar((distance+90)/distance);}};
}
