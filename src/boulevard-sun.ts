import * as T from 'three';
export const SUN_RADIUS=5.4;
// Static cutouts widen the solid bands toward the crown, including closed caps.
export const SUN_BANDS:readonly(readonly[number,number])[]=[[-5.4,-4.9],[-4.53,-4.13],[-3.76,-3.20],[-2.83,-2.08],[-1.71,-.71],[-.34,1.0],[1.37,3.08],[3.45,5.4]];
function bandedDisk(){
 const p:number[]=[],uv:number[]=[],indices:number[]=[];
 for(const[bottom,top]of SUN_BANDS){const first=p.length/3,steps=Math.max(3,Math.ceil((top-bottom)*14));
  for(let i=0;i<=steps;i++){const y=bottom+(top-bottom)*i/steps,x=Math.sqrt(Math.max(0,SUN_RADIUS*SUN_RADIUS-y*y));for(const side of[-1,1]){p.push(side*x,y,0);uv.push(.5+side*x/(SUN_RADIUS*2),.5+y/(SUN_RADIUS*2));}}
  for(let i=0;i<steps;i++){const a=first+i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);return g;
}
export function createBoulevardSun(){
 const root=new T.Group();root.name='boulevard-setting-sun';
 const clock={value:0};
 const diskMaterial=new T.ShaderMaterial({name:'boulevard-banded-sun',toneMapped:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 vUv;
  void main(){
  vec3 c=mix(vec3(1.45,.23,.075),vec3(1.85,1.12,.40),smoothstep(0.,1.,vUv.y));gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
  }`});
 const disk=new T.Mesh(bandedDisk(),diskMaterial);disk.name='boulevard-sun-disk';disk.rotation.x=Math.PI/2;root.add(disk);
 const haloMaterial=new T.ShaderMaterial({name:'boulevard-sun-warmth',transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,uniforms:{clock},
  vertexShader:diskMaterial.vertexShader,
  fragmentShader:`uniform float clock;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);
  float band=(r-.56)/.17,ring=exp(-band*band),wave=.65+.35*sin(r*28.-clock*.30+sin(a*3.+clock*.12));
  float haze=ring*wave*.065+exp(-r*r*7.)*.018;gl_FragColor=vec4(vec3(1.,.29,.065),haze);
  #include <colorspace_fragment>
  }`});
 const halo=new T.Mesh(new T.PlaneGeometry(20,20),haloMaterial);halo.name='boulevard-sun-halo';halo.rotation.x=Math.PI/2;halo.position.y=.04;root.add(halo);
 return{root,disk,clock,update(time:number){clock.value=time;}};
}
