import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { preserveGround, preserveChannel } from './preserve-layout';
import type { PreserveMaterials } from './preserve-materials';

export function createPreserveTraces(m: PreserveMaterials) {
  const root = new T.Group(); root.name = 'preserve-nesting-signs';
  const outlines = [[-.19,-.24],[-.31,.04],[-.63,.46],[-.5,.56],[-.14,.3],[-.08,.86],
    [.07,.91],[.14,.3],[.52,.65],[.64,.54],[.29,.02],[.17,-.25]];
  const footprint = new T.Shape(outlines.map(([x,y])=>new T.Vector2(x,y))), pieces: T.BufferGeometry[] = [];
  for (let i=0;i<29;i++) {
    const y=144+i*1.3,x=preserveChannel(y)+(i%2?.48:-.48),scale=.38+i*.012,angle=.12*Math.sin(i*.8);
    const g=new T.ShapeGeometry(footprint),p=g.attributes.position;
    for(let j=0;j<p.count;j++) {
      const a=p.getX(j)*scale,b=p.getY(j)*scale,px=x+a*Math.cos(angle)-b*Math.sin(angle),py=y+a*Math.sin(angle)+b*Math.cos(angle);
      p.setXYZ(j,px,py,preserveGround(px,py)+.026);
    }
    g.computeVertexNormals();pieces.push(g);
  }
  const material=m.soil.clone(); material.color.setHex(0x504c39);material.vertexColors=false;
  material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;material.depthWrite=false;
  const prints=new T.Mesh(mergeGeometries(pieces),material);prints.name='large-three-toed-tracks';root.add(prints);pieces.forEach(g=>g.dispose());
  // Sparse fallen feathers reinforce the transition from garden to nest.
  const feathers: T.BufferGeometry[]=[];
  for(let i=0;i<24;i++) {
    const x=Math.sin(i*4.7)*2.7,y=145+i*1.6,z=preserveGround(x,y)+.04,angle=i*2.4;
    const p:number[]=[],c:number[]=[],uv:number[]=[];
    const point=(u:number,v:number)=>{p.push(x+u*Math.cos(angle)-v*Math.sin(angle),y+u*Math.sin(angle)+v*Math.cos(angle),z+Math.sin(v*8)*.025);c.push(.72,.66,.52);uv.push(u+.5,v);};
    for(let j=0;j<8;j++){const t=j/8,n=(j+1)/8,w=.08*Math.sin(t*Math.PI),wn=.08*Math.sin(n*Math.PI);
      point(-w,t*.4);point(w,t*.4);point(-wn,n*.4);point(w,t*.4);point(wn,n*.4);point(-wn,n*.4);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();feathers.push(g);
  }
  const scatter=new T.Mesh(mergeGeometries(feathers),m.foliage);scatter.name='fallen-nest-feathers';root.add(scatter);feathers.forEach(g=>g.dispose());return root;
}
