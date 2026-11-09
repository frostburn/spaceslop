import * as T from 'three';
import { heliostatBatch } from './geometry';
import type { HeliostatMaterials } from './materials';
import { starConduit } from './thermal';

export type HeliostatBayKind='docking'|'generation'|'cooling'|'containment';
type Batch=ReturnType<typeof heliostatBatch>;

export function coolingCell(b:Batch,shell:Batch,m:HeliostatMaterials,x:number,y:number){
  shell.box([3.2,4.8,.3],[x,y,-2.85],m.titanium,.08);
  for(const dx of[-.72,.72]){
    starConduit(b,m,[[x+dx,y-1.55,-1.65],[x+dx,y+1.55,-1.65]],.55);
    for(const end of[-1,1]){
      const cap=new T.SphereGeometry(.55,16,10);cap.scale(1,.4,1);b.add(cap,m.titanium,[x+dx,y+end*1.55,-1.65]);
    }
    for(const yy of[-.9,.9])b.ring(.57,.06,[x+dx,y+yy,-1.65],m.hotCoil);
    b.pipe([[x+dx,y-1.9,-1.65],[x+dx,y-2.1,-1.0],[x+dx*.7,y-2.1,-.65]],.1,m.copper);
    b.box([.4,.12,.25],[x+dx,y-2.15,-.6],m.cyan,.025);
  }
  shell.box([2.3,.75,1.6],[x,y+1.6,-.25],m.ceramic,.08);
}

/** Paired supply/return mains join across bay seams and feed actual machines. */
export function addThermalCircuit(b:Batch,m:HeliostatMaterials,kind:HeliostatBayKind){
  for(const side of[-1,1]){
    const supply=side*4.65,returnX=side*7.8,x=side*6.2;
    starConduit(b,m,[[supply,-9,-1.4],[supply,5,-1.4],[supply,19,-1.4]],.25,false);
    starConduit(b,m,[[returnX,19,.15],[returnX,5,.15],[returnX,-9,.15]],.21,false);
    for(const y of(kind==='cooling'?[-.5,9.5]:[-2,8])){
      if(kind==='docking'&&y<0)continue;
      for(const dx of(kind==='cooling'?[-.72,.72]:[-.57,.57])){
        const cx=x+dx,half=kind==='cooling'?1.55:1.75,z=kind==='cooling'?-1.65:-.9;
        starConduit(b,m,[[supply,y-3.5,-1.4],[supply,y-half-.6,-1.4],[cx,y-half-.4,z],[cx,y-half,z]],.16);
        starConduit(b,m,[[cx,y+half,z],[cx,y+half+.5,z+.35],[returnX,y+half+.5,.15],[returnX,y+3.5,.15]],.15);
      }
    }
  }
  // Cross-lane transfer stays below both combat and the pedestrian railing.
  starConduit(b,m,[[-4.65,-7.1,-1.4],[-3.8,-7.1,-3.05],[3.8,-7.1,-3.05],[4.65,-7.1,-1.4]],.2);
}

export function dockingCell(b:Batch,shell:Batch,m:HeliostatMaterials,x:number,y:number){
  shell.box([3.1,4.4,1.65],[x,y,-2.1],m.dark,.12);
  for(let i=0;i<3;i++){
    shell.box([.65,3.5,.65],[x+(i-1)*.9,y,-.95],i%2?m.blue:m.ceramic,.07);
    b.box([.66,.12,.18],[x+(i-1)*.9,y-1.8,-.92],m.amber,.015);
  }
  for(const end of[-1,1])b.box([3.3,.2,.3],[x,y+end*2.1,-1.25],m.titanium);
}

export function addServiceMachinery(root:T.Group,m:HeliostatMaterials,kind:HeliostatBayKind){
  const b=heliostatBatch(root);
  for(const side of[-1,1]){
    if(kind==='cooling'||kind==='generation')for(const y of(kind==='cooling'?[-.5,9.5]:[8])){
      const x=side*(kind==='cooling'?6.2:8.6),z=1.25;
      b.rod([x,y,-1.2],[x,y,z-.1],.64,m.graphite,16);b.ring(.68,.065,[x,y,z],m.titanium,[0,0,0]);
      const rotor=new T.Group();rotor.name='service-fan-rotor';rotor.position.set(x,y,z);root.add(rotor);
      const blades=heliostatBatch(rotor);
      for(let j=0;j<4;j++){
        const a=j*Math.PI/2;blades.box([.48,.15,.055],[Math.cos(a)*.31,Math.sin(a)*.31,0],m.titanium,0,[.17,0,a]);
      }
      blades.add(new T.SphereGeometry(.14,12,8),m.dark,[0,0,.025]);blades.finish();
    }
    if(kind==='docking'){
      const mount=new T.Group();mount.position.set(side*8.6,-6.5,-2.45);mount.rotation.z=side>0?Math.PI:0;root.add(mount);
      const shoulder=new T.Group();shoulder.name='service-arm-shoulder';mount.add(shoulder);
      const upper=heliostatBatch(shoulder);upper.box([2,.24,.3],[1,0,0],m.blue,.045);
      upper.rod([0,0,-.18],[0,0,.18],.25,m.titanium,12);upper.finish();
      const elbow=new T.Group();elbow.name='service-arm-elbow';elbow.position.x=2;shoulder.add(elbow);
      const lower=heliostatBatch(elbow);lower.rod([0,0,-.18],[0,0,.18],.22,m.titanium,12);
      lower.box([1.6,.18,.24],[.8,0,0],m.ceramic,.035);
      for(const finger of[-1,1])lower.box([.6,.09,.13],[1.8,finger*.22,0],m.titanium,0,[0,0,-finger*.25]);
      lower.box([.12,.3,.1],[1.55,0,.15],m.cyan);lower.finish();
      b.rod([side*8.6,-6.5,-3.5],[side*8.6,-6.5,-2.45],.35,m.dark,12);
    }
  }
  if(kind==='containment')for(const y of[-6,12.5]){
    const points=Array.from({length:33},(_,i)=>new T.Vector3(Math.cos(i*Math.PI/32)*6.1,y,.4+Math.sin(i*Math.PI/32)*6.1));
    b.add(new T.TubeGeometry(new T.CatmullRomCurve3(points),48,.095,8,false),m.copper);
    for(const side of[-1,1])b.rod([side*6.1,y,-3.4],[side*6.1,y,.4],.14,m.titanium);
  }
  b.finish();
}

export function machineryPose(root:T.Group){
  const fans=root.getObjectsByProperty('name','service-fan-rotor');
  const shoulders=root.getObjectsByProperty('name','service-arm-shoulder');
  const elbows=root.getObjectsByProperty('name','service-arm-elbow');
  const buses=root.getObjectsByProperty('name','electric-service-bus');
  return (time:number,slot:number)=>{
    fans.forEach((fan,i)=>{fan.rotation.z=time*(.8+(i%3)*.09)+slot*.31;});
    shoulders.forEach((joint,i)=>{joint.rotation.z=Math.sin(time*.23+slot+i)*.16;});
    elbows.forEach((joint,i)=>{joint.rotation.z=1.1+Math.sin(time*.19+slot*.4+i)*.2;});
    buses.forEach(bus=>{bus.visible=Math.sin(time*2.8+slot*.6)>-.7;});
  };
}
