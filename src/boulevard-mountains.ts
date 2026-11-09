import * as T from 'three';
import {vectorGeometry,type VectorPath} from './boulevard-vectors';
import {mountainTerrain} from './boulevard-mountain-terrain';
export function createBoulevardMountains(wire:T.ShaderMaterial){
 const terrain=mountainTerrain(),crest=terrain.crest;
 const p:number[]=[],indices:number[]=[];
 for(const[x,y,z]of crest)p.push(x,y+.04,z,x,y+.04,-100);
 for(let i=0;i<crest.length-1;i++){const a=i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}
 // Delaunay facets follow ridges and asymmetric peaks rather than grid rows.
 const paths:VectorPath[]=[{points:crest,weight:1.15}],offset=p.length/3,edges=new Set<string>();
 for(const[x,y,z]of terrain.points)p.push(x,y+.04,z);
 for(let n=0;n<terrain.triangles.length;n+=3){const tri=terrain.triangles.slice(n,n+3);indices.push(...tri.map(i=>i+offset));for(let k=0;k<3;k++){const i=tri[k],j=tri[(k+1)%3],key=Math.min(i,j)+':'+Math.max(i,j);if(edges.has(key))continue;edges.add(key);if(i<crest.length&&j<crest.length)continue;paths.push({points:[terrain.points[i],terrain.points[j]],weight:.46});}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();
 const material=new T.MeshLambertMaterial({color:0x21102e,emissive:0x08030d,emissiveIntensity:.3,flatShading:true,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
 const body=new T.Mesh(g,material);body.name='boulevard-mountain-relief';
 // The line and the opaque curtain share every crest vertex: no exposed sky
 // beneath a ridge and no floating wire contour above the actual silhouette.
 const lattice=wire.clone(),viewport=new T.Vector4();lattice.name='boulevard-mountain-lattice';lattice.uniforms.tint.value.set(0xd081ff);lattice.onBeforeRender=renderer=>{renderer.getCurrentViewport(viewport);lattice.uniforms.resolution.value.set(Math.max(1,viewport.z),Math.max(1,viewport.w));lattice.uniformsNeedUpdate=true;};
 const root=new T.Mesh(vectorGeometry(paths),lattice);root.name='boulevard-distant-mountains';root.scale.setScalar(2.2);root.add(body);
 return{root,body,crest};
}
