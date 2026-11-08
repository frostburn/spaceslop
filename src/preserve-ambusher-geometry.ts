import * as T from 'three';
import { gkSnout } from './groundskeeper-geometry';
import { ambusherSailAt } from './preserve-ambusher';
import { preserveNoise } from './preserve-layout';

// S. aegyptiacus: a narrow rostrum with an expanded terminal tooth rosette.
export const ambusherSnout = [[.48,.27,-.16,.36],[.14,.32,-.18,.35],[-.2,.27,-.12,.27],[-.64,.17,-.085,.17],[-.98,.135,-.07,.14],[-1.26,.205,-.07,.14],[-1.5,.14,-.045,.10],[-1.62,.025,-.02,.04]] as const;
export function ambusherSnoutWidth(y:number) {
  let i=0;while(i<ambusherSnout.length-2&&y<ambusherSnout[i+1][0])i++;
  const a=ambusherSnout[i],b=ambusherSnout[i+1],t=T.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
  return T.MathUtils.lerp(a[1],b[1],t);
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
    c.copy(base).lerp(edge,v*.55);const stripe=T.MathUtils.smoothstep(Math.sin(y*11+noise*.65),.45,.85);
    c.lerp(bar,stripe*.55).multiplyScalar(.87+noise*.22);colors.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
}
