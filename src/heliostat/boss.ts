import * as T from 'three';
import { heliostatBatch } from './geometry';
import type { HeliostatMaterials } from './materials';
import { HELIOSTAT_PITCH } from './combat';

/** The regulator hangs in front of the star; two curved magnetic ducts feed it. */
export function createHeliostatRegulator(m:HeliostatMaterials) {
  const root=new T.Group();root.name='sunspot-regulator';const b=heliostatBatch(root);
  const origin=[0,-.8*Math.sin(HELIOSTAT_PITCH),.8*Math.cos(HELIOSTAT_PITCH)] as const;
  b.box([6.1,1.1,1.15],[0,0,0],m.dark,.22);
  for(const side of[-1,1]) {
    b.box([1.2,2.1,.8],[side*2.4,.2,0],m.ceramic,.15);
    b.rod([side*2.4,origin[1],origin[2]],[side*2.4,-.4,origin[2]],.4,m.graphite,20);
    b.ring(.43,.075,[side*2.4,origin[1]+.04,origin[2]],m.copper);
    for(let j=0;j<7;j++) b.box([.85,.12,1.65],[side*3.5,-.3+j*.28,0],m.graphite,.015);
    b.pipe([[side*2.4,1,.15],[side*3.8,2.5,.8],[side*4.7,6,1.8]],.23,m.titanium);
    b.pipe([[side*3.2,0,-.3],[side*5.1,2,-.5],[side*5.5,4,-1]],.12,m.copper);
    for(const z of[-.45,.45])b.rod([side*2.4,1,z],[side*5.5,4,-1],.07,m.dark,8);
  }
  b.rod([0,origin[1]+.05,origin[2]],[0,.8,origin[2]],1.2,m.titanium,32);
  b.rod([0,origin[1]+.025,origin[2]],[0,-.6,origin[2]],.93,m.graphite,32);
  b.rod([0,origin[1],origin[2]],[0,origin[1]+.02,origin[2]],.72,m.cyan,32);
  b.ring(1.22,.09,[0,origin[1]+.06,origin[2]],m.copper);
  b.finish();
  const rotor=new T.Group();rotor.name='regulator-vane-rotor';root.add(rotor);const r=heliostatBatch(rotor);
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6; r.box([.18,.25,.42],[Math.cos(a)*1.08,origin[1]-.02,Math.sin(a)*1.08+origin[2]],m.titanium,.02,[0,-a,0]);
  }
  r.finish();rotor.position.z=origin[2];
  // Rotate about the aperture centre, rather than around the housing origin.
  rotor.children.forEach(child=>{if(child instanceof T.Mesh)child.geometry.translate(0,0,-origin[2]);});
  // The visible emitter and laser anchor share the simulation's muzzle depth.
  for(const label of['L','C','R']) { const a=new T.Object3D();a.name='laser_contact_'+label;a.position.set(...origin);root.add(a); }
  const plasma=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{clock:{value:0},charge:{value:0}},
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float clock,charge;varying vec2 v;
      void main(){float flow=.3+.7*pow(.5+.5*sin(v.x*160.+clock*7.),3.);
      gl_FragColor=vec4(vec3(2.8,.8,.18),flow*(.18+charge*.55));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const ducts=new T.Group();ducts.name='sunspot-feed-ducts';root.add(ducts);const d=heliostatBatch(ducts);
  for(const side of[-1,1]) {
    d.pipe([[side*2.4,.7,0],[side*4.7,5,1.8],[side*5.8,17,4],[side*2.9,47,7]],.13,plasma);
    d.pipe([[side*2.4,.7,0],[side*4.7,5,1.8],[side*5.8,17,4],[side*2.9,47,7]],.045,m.amber);
  }
  d.finish();
  const charge=new T.MeshBasicMaterial({color:new T.Color(2.8,1,.18)}),lights=new T.Group();const l=heliostatBatch(lights);
  for(const side of[-1,1])l.rod([side*2.4,origin[1]-.025,origin[2]],[side*2.4,origin[1]+.025,origin[2]],.24,charge,16);
  l.finish();root.add(lights);
  return {root,ducts,rotor,pose(time:number,windup:number,recoil:number) {
    rotor.rotation.y=time*.23;plasma.uniforms.clock.value=time;plasma.uniforms.charge.value=windup;
    charge.color.setRGB(.65+windup*2.2,.12+windup*.85,.025+windup*.12);
    lights.position.y=recoil*.12;
  }};
}
