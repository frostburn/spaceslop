import * as T from 'three';
import {mergeBoulevard} from './boulevard-geometry';
import type {BoulevardMaterials} from './boulevard-materials';
export const FOUNTAIN_Y=63;
export function createBoulevardFountain(m:BoulevardMaterials){
 const root=new T.Group();root.name='boulevard-central-fountain';
 const add=(g:T.BufferGeometry,material:T.Material,z:number)=>{const mesh=new T.Mesh(g,material);mesh.position.z=z;root.add(mesh);return mesh;};
 const ring=(points:[number,number][],material:T.Material)=>add(new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),48).rotateX(Math.PI/2),material,0);
 add(new T.CylinderGeometry(1.46,1.53,.13,48).rotateX(Math.PI/2),m.stone,.065);
 ring([[1.12,.12],[1.30,.12],[1.40,.23],[1.40,.43],[1.31,.47],[1.24,.37],[1.20,.22]],m.chrome);
 add(new T.TorusGeometry(1.36,.025,6,64),m.cyan,.44);
 add(new T.TorusGeometry(1.48,.018,6,64),m.pink,.13);
 ring([[.30,.15],[.27,.50],[.16,.72],[.18,.91],[.50,1.02],[.54,1.13],[.46,1.17],[.37,1.06],[.13,1.04]],m.chrome);
 const clock={value:0},water=m.glass.clone();water.color.set(0x366d81);water.roughness=.12;water.metalness=.48;
 water.onBeforeCompile=shader=>{shader.uniforms.fountainClock=clock;shader.fragmentShader='uniform float fountainClock;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize(normal+vec3(sin(vViewPosition.x*25.+fountainClock*2.)*.08,cos(vViewPosition.y*22.-fountainClock*1.7)*.07,0.));');};
 add(new T.CircleGeometry(1.24,64),water,.31);add(new T.CircleGeometry(.44,40),water,1.09);
 const flow=new T.ShaderMaterial({uniforms:{clock},transparent:true,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float clock;varying vec2 vUv;void main(){float pulse=.58+.42*pow(.5+.5*sin(vUv.x*95.-clock*14.),3.);gl_FragColor=vec4(vec3(.30,.87,1.2)*pulse,.58);}' });
 const jet=(t:number,a:number,out=new T.Vector3())=>out.set(Math.cos(a)*(.28+.86*t),Math.sin(a)*(.28+.86*t),.64+3.4*t-3.73*t*t);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,points=Array.from({length:25},(_,k)=>jet(k/24,a));add(new T.TubeGeometry(new T.CatmullRomCurve3(points),28,.020,5,false),flow,0);}
 add(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0,0,1.1),new T.Vector3(.015,0,1.85),new T.Vector3(.07,.02,2.03)]),16,.026,6,false),flow,0);
 mergeBoulevard(root);
 const drops=new T.InstancedMesh(new T.SphereGeometry(.025,5,3),m.cyan,72);drops.name='boulevard-fountain-spray';drops.instanceMatrix.setUsage(T.DynamicDrawUsage);drops.frustumCulled=false;root.add(drops);
 const dummy=new T.Object3D();
 function update(time:number){clock.value=time;for(let i=0;i<72;i++){const t=((time*.58+i*.137)%1+1)%1,a=(i%8)*Math.PI/4;jet(t,a,dummy.position);dummy.position.x+=Math.sin(i*13.7)*t*.06;dummy.position.y+=Math.cos(i*9.3)*t*.06;dummy.scale.set(.60,.60,1.3);dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);}drops.instanceMatrix.needsUpdate=true;}
 update(0);return{root,drops,update};
}
