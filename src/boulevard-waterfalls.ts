import * as T from 'three';
import {part} from './rig-geometry';
import {mergeBoulevard} from './boulevard-geometry';
import {BOULEVARD_DECK} from './boulevard';
import type {BoulevardMaterials} from './boulevard-materials';

export const WATERFALL_BAYS=[2,3,9,12,16,19,21] as const;
// The cascade faces down the boulevard, so both oblique flight and the head-on
// pursuit see flowing water, a raised source pool and a lower receiving basin.
export function createBoulevardWaterfalls(m:BoulevardMaterials){
 const clock={value:0},prototype=new T.Group();prototype.name='boulevard-streetside-waterfall';
 const box=(sx:number,sy:number,sz:number,material:T.Material,x:number,y:number,z:number)=>part(prototype,new T.BoxGeometry(sx,sy,sz),material,x,y,z);
 box(1.95,.38,1.95,m.shell,0,.13,.975);box(1.98,1.30,.18,m.chrome,0,.70,1.97);
 box(2.08,1.85,.16,m.shell,0,-.43,.08);
 for(const side of[-1,1]){box(.10,1.85,.22,m.chrome,side*.99,-.43,.20);box(.08,1.38,.20,m.chrome,side*.95,.70,2.12);}
 box(1.96,.10,.22,m.chrome,0,-1.30,.20);box(1.96,.10,.22,m.chrome,0,.45,.20);box(1.98,.10,.20,m.chrome,0,1.35,2.12);
 box(1.83,.045,.045,m.cyan,0,-.085,2.10);box(1.94,.045,.035,m.cyan,0,-1.35,.17);
 const basin=new T.ShaderMaterial({name:'boulevard-waterfall-basins',uniforms:{clock},toneMapped:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform float clock;varying vec2 vUv;void main(){vec2 p=vUv-.5;float ripple=sin(length(p*vec2(1.,1.3))*47.-clock*6.);float glint=pow(max(0.,ripple),12.);vec3 c=vec3(.018,.13,.20)+vec3(.15,.55,.72)*glint;gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
  }`});
 part(prototype,new T.PlaneGeometry(1.80,1.18),basin,0,.70,2.075);part(prototype,new T.PlaneGeometry(1.86,1.62),basin,0,-.43,.23);
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 for(let row=0;row<=18;row++){const t=row/18;for(let col=0;col<=8;col++){const u=col/8;positions.push((u-.5)*1.82,-.09-.42*t-.07*Math.sin(t*Math.PI),2.10-1.87*t);uv.push(u,t);}}
 for(let row=0;row<18;row++)for(let col=0;col<8;col++){const a=row*9+col;indices.push(a,a+9,a+1,a+1,a+9,a+10);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
 const flow=new T.ShaderMaterial({name:'boulevard-waterfall-curtain',uniforms:{clock},transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false,
  vertexShader:basin.vertexShader,
  fragmentShader:`uniform float clock;varying vec2 vUv;void main(){float u=vUv.x,t=vUv.y;
   float threads=pow(max(0.,.5+.5*sin(u*113.+sin(u*27.)*2.+clock*.7)),6.);
   float falling=.60+.40*sin(t*29.-clock*9.+sin(u*19.)*1.4),edge=smoothstep(0.,.035,u)*(1.-smoothstep(.965,1.,u));
   float foam=smoothstep(.82,1.,t)*(.5+.5*sin(u*47.-clock*4.));
   vec3 c=vec3(.055,.42,.68)+vec3(.40,.82,1.05)*(threads*falling+foam*.45);
   gl_FragColor=vec4(c,edge*(.70+threads*.25));
   #include <colorspace_fragment>
  }`});
 const sheet=part(prototype,geometry,flow,0,0,0);sheet.name='boulevard-waterfall-flow';mergeBoulevard(prototype);
 const sprayMaterial=new T.ShaderMaterial({name:'boulevard-waterfall-spray',uniforms:{clock},transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
  vertexShader:`uniform float clock;varying float fade;void main(){vec3 origin=instanceMatrix[3].xyz;float seed=dot(origin,vec3(23.7,17.3,11.9)),age=fract(clock*.85+seed);fade=(1.-age)*(1.-age);
   vec3 p=(instanceMatrix*vec4(position*(1.-age*.7),1.)).xyz;p+=vec3(sin(seed)*age*.24,-age*.28,(age-age*age)*1.15);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader:'varying float fade;void main(){gl_FragColor=vec4(vec3(.33,.85,1.1),fade*.55);\n#include <colorspace_fragment>\n}'});
 const spray=new T.InstancedMesh(new T.SphereGeometry(.018,5,3),sprayMaterial,24),dummy=new T.Object3D();spray.name='boulevard-waterfall-splash';
 for(let i=0;i<24;i++){dummy.position.set((i/23-.5)*1.73,-.56+.07*Math.sin(i*2.7),.255);dummy.scale.set(.65,.65,1.3);dummy.updateMatrix();spray.setMatrixAt(i,dummy.matrix);}spray.computeBoundingSphere();if(spray.boundingSphere)spray.boundingSphere.radius+=.65;prototype.add(spray);
 const roots:T.Group[]=[];
 return{clock,roots,create(bay:number,side:number){const root=prototype.clone(true),scale=.93+((bay+2)%3)*.055;root.position.set(side*5.15,6.4,BOULEVARD_DECK);root.scale.set(side,1,scale);roots.push(root);return root;},update(time:number){clock.value=time;}};
}
