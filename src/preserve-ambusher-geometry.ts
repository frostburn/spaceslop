import * as T from 'three';
import { gkSnout, gkTube } from './groundskeeper-geometry';
import { ambusherSailAt } from './preserve-ambusher';
import { preserveNoise } from './preserve-layout';

// S. aegyptiacus: a narrow rostrum with an expanded terminal tooth rosette.
export const ambusherSnout = [[.48,.27,-.16,.36],[.14,.32,-.18,.35],[-.2,.27,-.12,.27],[-.64,.17,-.085,.17],[-.98,.135,-.07,.14],[-1.26,.205,-.07,.14],[-1.5,.14,-.045,.10],[-1.62,.025,-.02,.04]] as const;
export const ambusherMandible = [[.1,.25,-.17,.04],[-.45,.23,-.16,.035],[-.95,.13,-.13,.025],[-1.33,.13,-.10,.025],[-1.56,.195,-.08,.025],[-1.77,.12,-.045,.02],[-1.91,.025,-.02,.01]] as const;
type Profile=readonly (readonly [number,number,number,number])[];
export function ambusherProfileAt(profile:Profile,y:number) {
  let j=0;while(j<profile.length-2&&y<profile[j+1][0])j++;
  const a=profile[j],b=profile[j+1],previous=profile[Math.max(0,j-1)],next=profile[Math.min(profile.length-1,j+2)];
  const dy=b[0]-a[0],t=T.MathUtils.clamp((y-a[0])/dy,0,1),t2=t*t,t3=t2*t;
  const value=(k:number)=>{
    const m0=(b[k]-previous[k])/(b[0]-previous[0]),m1=(next[k]-a[k])/(next[0]-a[0]);
    return(2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*dy*m0+(-2*t3+3*t2)*b[k]+(t3-t2)*dy*m1;
  };
  return{width:Math.max(.005,value(1)),floor:value(2),crown:value(3)};
}
export function ambusherSnoutWidth(y:number) {
  let i=0;while(i<ambusherSnout.length-2&&y<ambusherSnout[i+1][0])i++;
  const a=ambusherSnout[i],b=ambusherSnout[i+1],t=T.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
  return T.MathUtils.lerp(a[1],b[1],t);
}

// Smooth longitudinal profiles keep the chest, rostrum and mandible continuous
// rather than joining obvious stretched spheres and straight-sided segments.
export function ambusherLoft(profile:readonly (readonly [number,number,number,number])[]) {
  const sections:[number,number,number,number][]=[],rows=profile.length*4;
  for(let row=0;row<=rows;row++){
    const y=T.MathUtils.lerp(profile[0][0],profile.at(-1)![0],row/rows);
    const p=ambusherProfileAt(profile,y);sections.push([y,p.width,p.floor,p.crown]);
  }
  return gkSnout(sections);
}

// One deforming skin sleeve follows each limb through its joints. Radius
// profiles describe fat, muscle bellies and tendons beneath that skin.
export function ambusherLimbSkin(profile:readonly (readonly [number,number])[]) {
  const tube=gkTube(30,16),p=tube.geometry.attributes.position;
  return{geometry:tube.geometry,pose(points:T.Vector3[]){
    const curve=new T.CatmullRomCurve3(points);tube.pose(curve,1,1);
    for(let row=0;row<=30;row++){
      const t=row/30,c=curve.getPoint(t);let j=0;while(j<profile.length-2&&t>profile[j+1][0])j++;
      const a=profile[j],b=profile[j+1],u=T.MathUtils.smoothstep(t,a[0],b[0]),r=T.MathUtils.lerp(a[1],b[1],u);
      for(let i=0;i<=16;i++){const n=row*17+i;p.setXYZ(n,c.x+(p.getX(n)-c.x)*r,c.y+(p.getY(n)-c.y)*r,c.z+(p.getZ(n)-c.z)*r*.86);}
    }
    p.needsUpdate=true;tube.geometry.computeVertexNormals();tube.geometry.computeBoundingBox();tube.geometry.computeBoundingSphere();
  }};
}

export function ambusherHandClaw(x:number,length:number,width:number) {
  const tube=gkTube(10,8);
  tube.pose(new T.CatmullRomCurve3([new T.Vector3(x,-.18,0),new T.Vector3(x*1.15,-.18-length*.55,-.025),new T.Vector3(x*.85,-.18-length,-.15)]),width,.004,true);
  return tube.geometry;
}

// A closed, thin lenticular membrane, with a rounded edge rather than a
// double-sided card. Pigment is speculative; the sail/tail proportions follow
// the published skeletal reconstruction (Ibrahim et al., Nature 2020, fig. 1).
export function ambusherSailGeometry() {
  const sections: [number,number,number,number][]=[];
  for(let i=0;i<=40;i++){
    const t=i/40,y=1.4-t*2.35,{base,top}=ambusherSailAt(y);
    sections.push([y,.012+.035*Math.sin(t*Math.PI),base,top]);
  }
  const g=gkSnout(sections),p=g.attributes.position,colors:number[]=[],base=new T.Color(0x8d6246),edge=new T.Color(0xc3a674),bar=new T.Color(0x3c493b),c=new T.Color();
  for(let i=0;i<p.count;i++){
    const y=p.getY(i),z=p.getZ(i),s=ambusherSailAt(y),v=(z-s.base)/Math.max(.01,s.top-s.base),noise=preserveNoise(y*3+8,z*3+4);
    const rib=Math.max(0,Math.cos(y*24+v*.18))**10*(1-v)*.009;
    p.setX(i,p.getX(i)+Math.sign(p.getX(i))*rib);
    c.copy(base).lerp(edge,v*.55);const stripe=T.MathUtils.smoothstep(Math.sin(y*10+noise*2.6),.2,.8);
    c.lerp(bar,stripe*(.3+noise*.35)).multiplyScalar(.87+noise*.22);colors.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
