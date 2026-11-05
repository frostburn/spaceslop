import * as T from 'three';
import { titanFrame,titanWorld } from './titan-frame';
export function createTitanClouds(){
 const root=new T.Group(),geometry=new T.PlaneGeometry(400,400);
 const deck=new T.Mesh(geometry,new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},density:{value:0}},
 vertexShader:'varying vec2 ground;void main(){ground=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);}',
 fragmentShader:`varying vec2 ground;uniform float time,density;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 float fbm(vec2 p){float n=0.0,w=.55;for(int i=0;i<5;i++){n+=noise(p)*w;p=p*2.03+17.3;w*=.48;}return n;}
 void main(){vec2 p=ground*.3+vec2(time*.035,time*.13);float n=fbm(p);n=fbm(p+vec2(n*2.4,n));
 float light=smoothstep(.2,.76,n);vec3 cloud=mix(vec3(.19,.09,.03),vec3(.95,.58,.22),light);
 float farFog=smoothstep(30.0,170.0,length(ground));cloud=mix(cloud,vec3(.50,.30,.15),farFog);
 gl_FragColor=vec4(cloud,density);
 #include <colorspace_fragment>
 }`}));deck.name='titan-cloud-surface';root.add(deck);
 const sky=new T.Mesh(new T.PlaneGeometry(9,16),new T.ShaderMaterial({depthWrite:false,vertexShader:'varying vec2 uvSky;void main(){uvSky=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);}',fragmentShader:`varying vec2 uvSky;void main(){gl_FragColor=vec4(mix(vec3(.5,.30,.15),vec3(.07,.035,.02),uvSky.y),1);
 #include <colorspace_fragment>
 }`}));sky.position.z=-120;sky.frustumCulled=false;root.add(sky);
 const upper=[1,2].map(i=>{const sheet=new T.Mesh(geometry,deck.material.clone());sheet.name='titan-cloud-wisp-'+i;root.add(sheet);return sheet;});
 return{root,update(time:number,rise:number,distance:number){
  const frame=titanFrame(rise),density=T.MathUtils.smoothstep(rise,0,.5);
  [deck,...upper].forEach((sheet,i)=>{const point=titanWorld(0,1+i*1.2,rise);sheet.rotation.x=-frame.pitch;sheet.position.set(0,point.y,point.z);sheet.material.uniforms.time.value=time+i*1.3;sheet.material.uniforms.density.value=density*(i===0?1:.18);});
  sky.scale.setScalar((distance+120)/distance);
 }};
}
