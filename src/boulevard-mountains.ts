import * as T from 'three';
import {vectorGeometry,type VectorPoint,type VectorPath} from './boulevard-vectors';
export function createBoulevardMountains(wire:T.ShaderMaterial){
 const crest:VectorPoint[]=Array.from({length:81},(_,i)=>{const x=-35+i*70/80;return[x,0,1.4+.8*Math.sin(x*.29)+.9*Math.sin(x*.73+2)+.4*Math.sin(x*1.43)+Math.max(0,Math.abs(x)-8)*.20];});
 const p:number[]=[],indices:number[]=[];
 for(const[x,y,z]of crest)p.push(x,y+.04,z,x,y+.04,-100);
 for(let i=0;i<crest.length-1;i++){const a=i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}
 // Faceted foothills sit in front of the closed sky mask. Sparse contours and
 // descending spurs describe the relief without tracing its triangles.
 const rows:VectorPoint[][]=[],paths:VectorPath[]=[{points:crest,weight:1.15}],offset=p.length/3;
 for(let row=0;row<=8;row++){
  const t=row/8,points:VectorPoint[]=crest.map(([x,,z])=>[x,-14*(1-t),z*t*t-12*(1-t)+Math.sin(x*.41+row*.17)*Math.sin(t*Math.PI)*.6]);rows.push(points);
  for(const[x,y,z]of points)p.push(x,y+.04,z);
  if([1,3,5,7].includes(row))paths.push({points,weight:.40+row*.025});
 }
 for(let row=0;row<8;row++)for(let col=0;col<80;col++){const a=offset+row*81+col;indices.push(a,a+1,a+81,a+1,a+82,a+81);}
 for(const col of[3,14,26,38,48,60,70,78])paths.push({points:rows.map((r,i)=>r[Math.max(0,Math.min(80,col+Math.round(Math.sin(i*.72+col)*2*(1-i/8))))]),weight:.56});
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();
 const material=new T.MeshBasicMaterial({color:0x10091d,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
 const body=new T.Mesh(g,material);body.name='boulevard-mountain-relief';
 // The line and the opaque curtain share every crest vertex: no exposed sky
 // beneath a ridge and no floating wire contour above the actual silhouette.
 const root=new T.Mesh(vectorGeometry(paths),wire);root.name='boulevard-distant-mountains';root.scale.setScalar(2.2);root.add(body);
 return{root,body,crest};
}
