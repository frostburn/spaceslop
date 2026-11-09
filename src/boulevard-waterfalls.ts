import * as T from 'three';
import {part} from './rig-geometry';
import {mergeBoulevard} from './boulevard-geometry';
import {BOULEVARD_DECK} from './boulevard';
import type {BoulevardMaterials} from './boulevard-materials';

export const WATERFALL_BAYS=[2,3,9,12,16,19,21] as const;
export const WATERFALL_IMPACT_Y=-.51;
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
 const impacts=Array.from({length:7},(_,i)=>new T.Vector2(-.78+i*.26,WATERFALL_IMPACT_Y));
 const basin=new T.ShaderMaterial({name:'boulevard-waterfall-basins',uniforms:{clock,impacts:{value:impacts}},toneMapped:false,
  vertexShader:'varying vec2 vUv,vPoolPoint;varying float vUpper;void main(){vUv=uv;vPoolPoint=position.xy;vUpper=step(1.,position.z);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform float clock;uniform vec2 impacts[7];varying vec2 vPoolPoint;varying float vUpper;
  void main(){vec2 p=vPoolPoint;float glint=0.;
   if(vUpper>.5){float flow=sin(p.x*27.+sin(p.y*4.+clock*.6))*sin(p.y*21.+clock*5.);glint=pow(max(0.,flow),8.)*.25;}
   else{for(int i=0;i<7;i++){float d=length(p-impacts[i]),aa=max(fwidth(d),.003);
     for(int k=0;k<2;k++){float age=fract(clock*(.95+float(i)*.023)+float(i)*.173+float(k)*.5),radius=.025+age*.60;
      float ring=1.-smoothstep(.008,.008+aa,abs(d-radius));glint+=ring*(1.-age)*(1.-age)*smoothstep(0.,.06,age);}}
    float line=p.y-(${WATERFALL_IMPACT_Y.toFixed(2)});glint+=exp(-line*line/.0015)*(.3+.2*sin(p.x*43.-clock*7.))*(1.-smoothstep(.83,.92,abs(p.x)));}
   vec3 c=vec3(.018,.13,.20)+vec3(.15,.55,.72)*glint;gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
  }`});
 part(prototype,new T.PlaneGeometry(1.80,1.38),basin,0,.60,2.075);part(prototype,new T.PlaneGeometry(1.86,1.62),basin,0,-.43,.23);
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
  vertexShader:`uniform float clock;varying float fade;void main(){vec3 origin=instanceMatrix[3].xyz;float seed=dot(origin,vec3(23.7,17.3,11.9)),age=fract(clock*(.65+.40*fract(sin(seed*7.13)*43758.5453))+fract(sin(seed*19.7)*15731.743));fade=(1.-age)*(1.-age);
   vec3 p=(instanceMatrix*vec4(position*(1.-age*.7),1.)).xyz;p+=vec3(sin(seed)*age*.24,-age*.28,(age-age*age)*1.15);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader:'varying float fade;void main(){gl_FragColor=vec4(vec3(.33,.85,1.1),fade*.55);\n#include <colorspace_fragment>\n}'});
 const spray=new T.InstancedMesh(new T.SphereGeometry(.018,5,3),sprayMaterial,24),dummy=new T.Object3D();spray.name='boulevard-waterfall-splash';
 for(let i=0;i<24;i++){dummy.position.set((i/23-.5)*1.73,WATERFALL_IMPACT_Y+.035*Math.sin(i*2.7),.255);dummy.scale.set(.65,.65,1.3);dummy.updateMatrix();spray.setMatrixAt(i,dummy.matrix);}spray.computeBoundingSphere();if(spray.boundingSphere)spray.boundingSphere.radius+=.65;prototype.add(spray);
 const streamGeometry=new T.SphereGeometry(.018,5,3),phases=new Float32Array(24);for(let i=0;i<phases.length;i++)phases[i]=(i*.381966)%1;streamGeometry.setAttribute('streamPhase',new T.InstancedBufferAttribute(phases,1));
 const streamMaterial=new T.ShaderMaterial({name:'boulevard-waterfall-source-flow',uniforms:{clock},transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
  vertexShader:`uniform float clock;attribute float streamPhase;varying float fade;void main(){float age=fract(clock*(.45+.34*fract(sin(streamPhase*127.1)*43758.5453))+streamPhase);fade=sin(age*3.14159265);
   vec3 p=(instanceMatrix*vec4(position,1.)).xyz;p.y=1.22-age*1.27+position.y*3.2;p.x+=sin(age*5.+streamPhase*13.)*.018;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader:'varying float fade;void main(){gl_FragColor=vec4(vec3(.56,.95,1.15),fade*.70);\n#include <colorspace_fragment>\n}'});
 const streams=new T.InstancedMesh(streamGeometry,streamMaterial,24);streams.name='boulevard-waterfall-source-particles';
 for(let i=0;i<24;i++){dummy.position.set((i/23-.5)*1.65,.60,2.092);dummy.scale.set(.65,3.2,.12);dummy.updateMatrix();streams.setMatrixAt(i,dummy.matrix);}streams.computeBoundingSphere();if(streams.boundingSphere)streams.boundingSphere.radius+=.75;prototype.add(streams);
 const roots:T.Group[]=[];
 return{clock,roots,create(bay:number,side:number){const root=prototype.clone(true),scale=.93+((bay+2)%3)*.055;root.position.set(side*5.15,6.4,BOULEVARD_DECK);root.scale.set(side,1,scale);roots.push(root);return root;},update(time:number){clock.value=time;}};
}
