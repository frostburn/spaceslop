import * as T from 'three';
import { preserveNoise } from './preserve-layout';

export function preserveRockGeometry() {
  const g = new T.IcosahedronGeometry(1, 2), p = g.attributes.position, colors = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = .88 + preserveNoise(x * 3 + 8, y * 3 + z) * .22;
    // Flattened irregular bedding planes, broken by fractures rather than UV rings.
    p.setXYZ(i, x * s + .07 * Math.sin(z * 14), y * s, z * .85 + .045 * Math.sin(z * 21 + x * 2));
    const shade = .75 + .16 * preserveNoise(x * 5, y * 5 + z) + .06 * Math.sin(z * 19);
    colors.push(shade, shade * .97, shade * .86);
  }
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); return g;
}

// Broad fractured beds give the dry outcrops ledges and overhangs instead of
// uniformly rounded boulders. Cartesian relief avoids radial texture pinching.
export function preserveStratifiedRock() {
  const levels=[[-.65,.75],[-.45,1.02],[-.32,1.08],[-.23,.88],[.04,.94],[.15,1.09],[.24,1.12],[.31,.86],[.52,.78],[.62,.55]];
  const positions:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[],sides=16;
  for(const [j,[z,r]] of levels.entries())for(let i=0;i<=sides;i++){
    const a=(i%sides)/sides*Math.PI*2,facet=1+.12*Math.sin(a*3+.8)+.06*Math.sin(a*7);
    positions.push(Math.cos(a)*r*facet,Math.sin(a)*r*facet*.84,z+.025*Math.sin(a*5+z*4));uv.push(i/sides,j/3);
    const shade=.83+.07*Math.sin(z*18+a*2);colors.push(shade,shade*.95,shade*.82);
    if(j<levels.length-1&&i<sides){const n=j*(sides+1)+i;indices.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
  }
  for(const row of [0,levels.length-1]){
    const center=positions.length/3;positions.push(0,0,levels[row][0]);uv.push(.5,.5);colors.push(.85,.81,.70);
    for(let i=0;i<sides;i++){const a=row*(sides+1)+i;if(row)indices.push(center,a,a+1);else indices.push(center,a+1,a);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  const n=g.attributes.normal,v=new T.Vector3();
  for(let j=0;j<levels.length;j++){const a=j*(sides+1),b=a+sides;v.set(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
  return g;
}
