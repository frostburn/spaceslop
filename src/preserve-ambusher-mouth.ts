import * as T from 'three';
import { part, pivot } from './rig-geometry';
import { ambusherLoft, ambusherMandible, ambusherSnout, ambusherProfileAt } from './preserve-ambusher-geometry';
import type { AmbusherMaterials } from './preserve-ambusher-rig';

function oralSurface(p:{width:number;floor:number;crown:number},fraction:number,upper:boolean) {
  const sine=fraction**(1/.72),height=(.5+(upper?-1:1)*.5*Math.sqrt(1-sine*sine))**.82;
  return p.floor+(p.crown-p.floor)*height;
}

// The root of each crown is inset into the actual oral side of its jaw loft.
// The gum ridge overlaps that root; it is never hung from an exterior offset.
export function ambusherToothRoot(upper:boolean,side:number,index:number) {
  const y=-.16-index*.12+(upper?0:-.28+.05),profile=ambusherProfileAt(upper?ambusherSnout:ambusherMandible,y);
  const fraction=.68,surface=oralSurface(profile,fraction,upper);
  return{x:side*profile.width*fraction,y,z:surface+(upper?.03:-.03),length:(upper?.10:.085)+.025*Math.exp(-(((y+(upper?1.25:1.53))/.25)**2))};
}

export function createAmbusherMouth(head:T.Group,m:AmbusherMaterials,tint:(g:T.BufferGeometry,belly?:boolean)=>T.BufferGeometry) {
  const jaw=pivot(head,'ambusher-jaw',0,.28,-.17);
  part(jaw,tint(ambusherLoft(ambusherMandible),true),m.skin,0,0,0).name='ambusher-mandible';
  const roof=ambusherSnout.map(([y,w,f])=>[y,w*.70,f-.012,f+.016] as const);
  part(head,ambusherLoft(roof),m.palate,0,0,0).name='ambusher-palate';
  const floor=ambusherMandible.map(([y,w,,c])=>[y,w*.70,c-.008,c+.008] as const);
  part(jaw,ambusherLoft(floor),m.flesh,0,0,0).name='ambusher-mouth-floor';
  const tongue=ambusherLoft([[0,.09,.03,.07],[-.4,.115,.035,.09],[-.9,.08,.03,.07],[-1.32,.07,.025,.06],[-1.65,.015,.015,.035]]);
  part(jaw,tongue,m.tongue,0,0,0).name='ambusher-single-tongue';
  for(const upper of[true,false]){
    const parent=upper?head:jaw,teeth=pivot(parent,upper?'ambusher-upper-teeth':'ambusher-lower-teeth',0,0,0);
    for(const side of[-1,1]){
      const gum:T.Vector3[]=[];
      for(let i=0;i<11;i++){
        const p=ambusherToothRoot(upper,side,i),g=new T.ConeGeometry(upper?.022:.020,p.length,8);
        g.rotateX(upper?-Math.PI/2:Math.PI/2);g.translate(0,0,(upper?-1:1)*p.length/2);
        part(teeth,g,m.horn,p.x,p.y,p.z);
        const marker=new T.Object3D();marker.name=`ambusher-tooth-root-${upper?'upper':'lower'}-${side}-${i}`;marker.position.set(p.x,p.y,p.z);teeth.add(marker);
        gum.push(new T.Vector3(p.x,p.y,p.z+(upper?-.021:.021)));
      }
      part(parent,new T.TubeGeometry(new T.CatmullRomCurve3(gum),28,.022,8,false),m.flesh,0,0,0);
    }
  }
  // Continuous cheek membranes bridge the hinge instead of exposing a pair of
  // disconnected jaw slabs. Only these fixed-size position buffers deform.
  const cheeks=[-1,1].map(side=>{
    const g=new T.PlaneGeometry(1,1,6,5),group=pivot(head,'ambusher-gape-fold',0,0,0),mesh=part(group,g,m.flesh,0,0,0);mesh.name='ambusher-gape-skin';
    (g.attributes.position as T.BufferAttribute).setUsage(T.DynamicDrawUsage);return{side,g};
  });
  return{jaw,pose(angle:number){
    jaw.rotation.x=angle;const c=Math.cos(angle),s=Math.sin(angle);
    for(const {side,g} of cheeks){const p=g.attributes.position;
      for(let row=0;row<=5;row++)for(let col=0;col<=6;col++){
        const u=col/6,v=row/5,y=.26-u*.47,upper=ambusherProfileAt(ambusherSnout,y),lower=ambusherProfileAt(ambusherMandible,y-.28);
        const ly=y-.28,lz=oralSurface(lower,.72,false)-.015,by=.28+ly*c-lz*s,bz=-.17+ly*s+lz*c;
        p.setXYZ(row*7+col,side*(T.MathUtils.lerp(upper.width,lower.width,v)*.72+.012*Math.sin(v*Math.PI)),T.MathUtils.lerp(y,by,v),T.MathUtils.lerp(oralSurface(upper,.72,true)+.015,bz,v));
      }
      p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    }
  }};
}
