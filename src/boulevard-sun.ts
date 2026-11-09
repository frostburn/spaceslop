import * as T from 'three';
export const SUN_RADIUS=5.4,SUN_BAND_PERIOD=1.15,SUN_BAND_SPEED=.07;
export function sunBandRise(time:number){return((time*SUN_BAND_SPEED)%SUN_BAND_PERIOD+SUN_BAND_PERIOD)%SUN_BAND_PERIOD;}
export function createBoulevardSun(){
 const root=new T.Group();root.name='boulevard-setting-sun';
 const clock={value:0},rise={value:0};
 const diskMaterial=new T.ShaderMaterial({name:'boulevard-scrolling-sun',uniforms:{rise},toneMapped:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform float rise;varying vec2 vUv;
  void main(){float height=(vUv.y-.5)*${(SUN_RADIUS*2).toFixed(1)},stripe=fract((height-rise)/${SUN_BAND_PERIOD.toFixed(2)}),gap=mix(.30,.16,vUv.y);
  if(stripe<gap)discard;
  vec3 c=mix(vec3(1.45,.23,.075),vec3(1.85,1.12,.40),smoothstep(0.,1.,vUv.y));gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
  }`});
 const disk=new T.Mesh(new T.CircleGeometry(SUN_RADIUS,96),diskMaterial);disk.name='boulevard-sun-disk';disk.rotation.x=Math.PI/2;root.add(disk);
 const haloMaterial=new T.ShaderMaterial({name:'boulevard-sun-warmth',transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,uniforms:{clock},
  vertexShader:diskMaterial.vertexShader,
  fragmentShader:`uniform float clock;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);
  float ring=exp(-pow((r-.56)/.17,2.)),wave=.65+.35*sin(r*28.-clock*.30+sin(a*3.+clock*.12));
  float haze=ring*wave*.065+exp(-r*r*7.)*.018;gl_FragColor=vec4(vec3(1.,.29,.065),haze);
  #include <colorspace_fragment>
  }`});
 const halo=new T.Mesh(new T.PlaneGeometry(20,20),haloMaterial);halo.name='boulevard-sun-halo';halo.rotation.x=Math.PI/2;halo.position.y=.04;root.add(halo);
 return{root,disk,clock,rise,update(time:number){clock.value=time;rise.value=sunBandRise(time);}};
}
