import * as T from 'three';
import {heliostatBatch} from './geometry';
import type {HeliostatMaterials} from './materials';
import {CRAWLER_RAIL_X,CRAWLER_RAIL_Z,type crawlerPose} from './crawler';

/** Shared buffers; per-crawler transforms, charge material and warning clock. */
export function createCrawlerAssets(m:HeliostatMaterials){
  const root=new T.Group(),body=new T.Group(),head=new T.Group();body.name='crawler-carriage';head.name='crawler-contact';root.add(body,head);
  const b=heliostatBatch(body),h=heliostatBatch(head);
  b.box([.64,1.18,.38],[0,0,.4],m.dark,.06);b.box([.5,.8,.13],[0,0,.65],m.ceramic,.04);
  for(const x of[-.2,.2])for(const y of[-.42,.42]){
    const wheel=new T.Mesh(new T.CylinderGeometry(.14,.14,.1,12).rotateZ(Math.PI/2),m.titanium);wheel.name='crawler-wheel';wheel.position.set(x,y,.15);body.add(wheel);
  }
  for(const y of[-.65,.65]){
    const clamp=new T.Group();clamp.name='crawler-clamp';clamp.position.set(0,y,.33);body.add(clamp);const c=heliostatBatch(clamp);
    for(const side of[-1,1]){c.rod([side*.26,0,0],[side*.12,0,-.23],.045,m.copper,8);c.box([.12,.15,.08],[side*.1,0,-.25],m.titanium,.01);}c.finish();
  }
  h.box([.65,.66,.32],[0,0,0],m.ceramic,.07);h.box([.42,.4,.11],[-.08,0,.22],m.cyan,.035);
  h.rod([.2,0,0],[.47,0,0],.105,m.dark,12);h.ring(.12,.032,[.41,0,0],m.hotCoil,[0,Math.PI/2,0],20);
  b.finish();h.finish();
  const mast=new T.Mesh(new T.CylinderGeometry(.8,1.1,1,10),m.titanium);mast.name='crawler-mast';root.add(mast);
  return{template:root,line:new T.CylinderGeometry(1,1,1,8),emitter:new T.SphereGeometry(.075,10,8)};
}
export function createCrawlerRig(assets:ReturnType<typeof createCrawlerAssets>){
  const root=assets.template.clone(true);root.name='rail-maintenance-crawler';
  const body=root.getObjectByName('crawler-carriage')!,head=root.getObjectByName('crawler-contact')!,mast=root.getObjectByName('crawler-mast')!;
  const wheels=root.getObjectsByProperty('name','crawler-wheel'),clamps=root.getObjectsByProperty('name','crawler-clamp');
  const emitter=new T.Mesh(assets.emitter,new T.MeshBasicMaterial({color:0xffaf37}));emitter.position.x=.47;head.add(emitter);
  const clock={value:0},warningMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{clock},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float clock;varying vec2 v;void main(){float dash=step(.45,fract(v.y*18.-clock*.55));
      gl_FragColor=vec4(1.8,.62,.08,dash*.65);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const warning=new T.Group();warning.name='crawler-sweep-warning';root.add(warning);
  const guides=Array.from({length:3},()=>{const line=new T.Mesh(assets.line,warningMaterial);line.frustumCulled=false;warning.add(line);return line;});
  const beam=new T.Group();beam.name='crawler-cutting-beam';root.add(beam);
  const beams=[[.14,new T.Color(1.7,.28,.015),.24],[.037,new T.Color(3.2,2.1,.75),1]].map(([radius,color,opacity])=>{
    const mesh=new T.Mesh(assets.line,new T.MeshBasicMaterial({color:color as T.Color,transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:opacity as number}));mesh.frustumCulled=false;beam.add(mesh);return{mesh,radius:radius as number};
  });
  const a=new T.Vector3(),delta=new T.Vector3(),up=new T.Vector3(0,1,0);
  function line(mesh:T.Object3D,start:{x:number;y:number;z?:number},end:{x:number;y:number;z?:number},radius:number){
    a.set(start.x,start.y,start.z??.06);delta.set(end.x-a.x,end.y-a.y,(end.z??.06)-a.z);
    const length=Math.max(.001,delta.length());mesh.position.copy(a).addScaledVector(delta,.5);mesh.quaternion.setFromUnitVectors(up,delta.multiplyScalar(1/length));mesh.scale.set(radius,length,radius);
  }
  return{root,head,beam,warning,pose(p:ReturnType<typeof crawlerPose>,time:number){
    body.position.set(p.side*CRAWLER_RAIL_X,p.physicalY,CRAWLER_RAIL_Z);
    head.position.set(p.head.x,p.head.y,p.head.z);head.rotation.z=p.heading;
    line(mast,{x:p.side*CRAWLER_RAIL_X,y:p.physicalY,z:CRAWLER_RAIL_Z+.6},{x:p.head.x,y:p.head.y,z:p.head.z-.06},.12);
    wheels.forEach(w=>w.rotation.x=-p.travel/.14);clamps.forEach(c=>c.scale.x=1-.25*p.brace);
    emitter.material.color.setRGB(.7+p.charge*2.4,.17+p.charge*1.1,.025+p.charge*.2);
    clock.value=time;warning.visible=p.warning;beam.visible=p.hot;
    line(guides[0],p.muzzle,p.start,.014);line(guides[1],p.muzzle,p.end,.014);line(guides[2],p.start,p.end,.014);
    beams.forEach(b=>line(b.mesh,p.muzzle,p.target,b.radius));
  },prime(){const state=[warning.visible,beam.visible];warning.visible=beam.visible=true;return()=>{warning.visible=state[0];beam.visible=state[1];};}};
}
