import * as T from 'three';
import { heliostatBatch } from './geometry';
import type { HeliostatMaterials } from './materials';
import { HELIOSTAT_PITCH,HELIOSTAT_EMITTER_X,heliostatFeedPoint,heliostatPlasmaPhase } from './combat';
import {createPlasmaResources,type PlasmaResources} from './plasma';
import {starConduit} from './thermal';
import {createStellarDebris} from './stellar-debris';
export type RegulatorState={unstable:number;pattern:number;attackTime:number;active?:boolean};

/** The regulator hangs in front of the star; two curved magnetic ducts feed it. */
export function createHeliostatRegulator(m:HeliostatMaterials,resources:PlasmaResources=createPlasmaResources()) {
  const root=new T.Group();root.name='sunspot-regulator';const b=heliostatBatch(root);
  const origin=[0,-.8*Math.sin(HELIOSTAT_PITCH),.8*Math.cos(HELIOSTAT_PITCH)] as const;
  b.box([6.1,1.1,1.15],[0,0,0],m.dark,.22);
  for(const side of[-1,1]) {
    b.box([1.2,2.1,.8],[side*2.4,.2,0],m.ceramic,.15);
    b.rod([side*2.4,.2,.3],[side*HELIOSTAT_EMITTER_X,.1,.3],.24,m.titanium,12);
    for(let j=0;j<7;j++) b.box([.55,.12,1.65],[side*5.1,.6+j*.28,0],m.graphite,.015);
    b.pipe([[side*HELIOSTAT_EMITTER_X,1,.15],[side*4.7,2.5,.8],[side*5.4,6,1.8]],.23,m.titanium);
    starConduit(b,m,[[side*3.2,0,-.3],[side*5.1,2,-.5],[side*5.5,4,-1]],.2);
    for(const z of[-.45,.45])b.rod([side*2.4,1,z],[side*5.5,4,-1],.07,m.dark,8);
  }
  b.rod([0,origin[1]+.05,origin[2]],[0,.8,origin[2]],1.2,m.titanium,32);
  b.rod([0,origin[1]+.025,origin[2]],[0,-.6,origin[2]],.93,m.graphite,32);
  b.rod([0,origin[1],origin[2]],[0,origin[1]+.02,origin[2]],.72,m.cyan,32);
  b.ring(1.22,.09,[0,origin[1]+.06,origin[2]],m.copper);
  for(const side of[-1,1]){
    b.box([1.65,.45,.75],[side*1.4,-.6,.95],m.ceramic,.1,[0,side*.28,side*.18]);
    b.box([.8,.5,.55],[side*.6,-.55,1.5],m.titanium,.08,[0,side*.18,0]);
  }
  b.finish();
  const gyros=[-1,1].map(side=>{
    const rootGyro=new T.Group();rootGyro.name='regulator-magnetic-lens';rootGyro.position.set(side*HELIOSTAT_EMITTER_X,origin[1]+.3,origin[2]);root.add(rootGyro);
    const g=heliostatBatch(rootGyro);
    for(const y of[-.3,.3])for(const r of[.85,1.17])g.ring(r,.075,[0,y,0],r<1?m.hotCoil:m.titanium);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,x=Math.cos(a),z=Math.sin(a);
      g.rod([x*.85,-.3,z*.85],[x*1.17,-.3,z*1.17],.055,m.dark,8);
      g.rod([x*1.17,-.3,z*1.17],[Math.cos(a+.3)*1.17,.3,Math.sin(a+.3)*1.17],.05,m.titanium,8);
      for(let j=0;j<4;j++)g.ring(.09,.025,[x*.99,-.2+j*.13,z*.99],m.hotCoil);
    }
    g.finish();return rootGyro;
  });
  const fault=new T.Mesh(new T.TorusGeometry(1.25,.035,6,40),new T.MeshBasicMaterial({color:new T.Color(3,.4,.025),transparent:true,opacity:.7,blending:T.AdditiveBlending,depthWrite:false}));
  fault.name='unstable-lens-warning';fault.rotation.x=Math.PI/2;fault.position.y=-.34;gyros[1].add(fault);fault.visible=false;
  const debris=createStellarDebris();root.add(debris.root);
  const rotor=new T.Group();rotor.name='regulator-vane-rotor';root.add(rotor);const r=heliostatBatch(rotor);
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6; r.box([.18,.25,.42],[Math.cos(a)*1.08,origin[1]-.02,Math.sin(a)*1.08+origin[2]],m.titanium,.02,[0,-a,0]);
  }
  r.finish();rotor.position.z=origin[2];
  // Rotate about the aperture centre, rather than around the housing origin.
  rotor.children.forEach(child=>{if(child instanceof T.Mesh)child.geometry.translate(0,0,-origin[2]);});
  // The visible emitter and laser anchor share the simulation's muzzle depth.
  for(const label of['L','C','R']) { const a=new T.Object3D();a.name='laser_contact_'+label;a.position.set(...origin);root.add(a); }
  const ducts=new T.Group();ducts.name='sunspot-feed-ducts';root.add(ducts);
  const feeds=[-1,1].map(side=>resources.tube([heliostatFeedPoint(side),{x:side*2.5,y:29,z:6},{x:side*3.7,y:6,z:2},{x:side*HELIOSTAT_EMITTER_X,y:origin[1],z:origin[2]}],false,3));
  feeds.forEach(feed=>ducts.add(feed.root));
  const glowLights=[-1,1].map(side=>{const light=new T.PointLight(0xff8c29,12,14,2);light.position.set(side*HELIOSTAT_EMITTER_X,origin[1]-.35,origin[2]+.15);root.add(light);return light;});
  const charge=new T.MeshBasicMaterial({color:new T.Color(2.8,1,.18)}),lights=new T.Group();const l=heliostatBatch(lights);
  for(const side of[-1,1])l.rod([side*HELIOSTAT_EMITTER_X,origin[1]-.025,origin[2]],[side*HELIOSTAT_EMITTER_X,origin[1]+.025,origin[2]],.24,charge,16);
  l.finish();root.add(lights);
  return {root,ducts,rotor,gyros,debris,pose(time:number,windup:number,recoil:number,state?:RegulatorState) {
    const instability=Math.min(1,(state?.unstable??0)/.9);
    rotor.rotation.y=time*.23;feeds.forEach((feed,i)=>{
      const channel=state&&state.active!==false?heliostatPlasmaPhase(state.attackTime,i?1:-1,state.pattern).strength:0;
      feed.pose(time,(.65+Math.max(windup,channel)*.35)*(i?1-instability*(.08+.05*Math.sin(time*6.7)):1));
      glowLights[i].intensity=12+Math.max(windup,channel)*45;
    });
    gyros.forEach((g,i)=>{g.rotation.y=time*(i?.22:-.19);g.rotation.x=i?instability*(.1*Math.sin(time*5.3)+.045*Math.sin(time*8.1)):0;g.rotation.z=i?instability*.07*Math.sin(time*4.1+.6):0;});
    fault.visible=instability>0;fault.material.opacity=instability*(.58+.15*Math.sin(time*4.7));
    debris.update(state?.unstable??0,instability>0);
    charge.color.setRGB(.65+windup*2.2,.12+windup*.85,.025+windup*.12);
    lights.position.y=recoil*.12;
  },prime(){const restore=debris.prime(),visible=fault.visible;fault.visible=true;return()=>{restore();fault.visible=visible;};}};
}
