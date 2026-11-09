import * as T from 'three';
import {vectorGeometry,type VectorPoint} from './boulevard-vectors';
export function createBoulevardMountains(wire:T.ShaderMaterial){
 const crest:VectorPoint[]=Array.from({length:81},(_,i)=>{const x=-35+i*70/80;return[x,0,1.4+.8*Math.sin(x*.29)+.9*Math.sin(x*.73+2)+.4*Math.sin(x*1.43)+Math.max(0,Math.abs(x)-8)*.20];});
 const p:number[]=[],indices:number[]=[];
 for(const[x,y,z]of crest)p.push(x,y+.04,z,x,y+.04,-100);
 for(let i=0;i<crest.length-1;i++){const a=i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();
 const material=new T.MeshBasicMaterial({color:0x10091d,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
 const body=new T.Mesh(g,material);body.name='boulevard-mountain-relief';
 // The line and the opaque curtain share every crest vertex: no exposed sky
 // beneath a ridge and no floating wire contour above the actual silhouette.
 const root=new T.Mesh(vectorGeometry([{points:crest,weight:1.15}]),wire);root.name='boulevard-distant-mountains';root.scale.setScalar(2.2);root.add(body);
 return{root,body,crest};
}
