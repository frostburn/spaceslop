import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export type BoulevardPart={x:number;y:number;z:number;sx:number;sy:number;sz:number;color:number;rx?:number;ry?:number;rz?:number};
export const block=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color=0xffffff,rz=0):BoulevardPart=>({x,y,z,sx,sy,sz,color,rz});
export function boulevardBatch(name:string,geometry:T.BufferGeometry,material:T.Material,parts:BoulevardPart[]){
 const mesh=new T.InstancedMesh(geometry,material,parts.length),o=new T.Object3D(),c=new T.Color();mesh.name=name;
 parts.forEach((p,i)=>{o.position.set(p.x,p.y,p.z);o.rotation.set(p.rx??0,p.ry??0,p.rz??0);o.scale.set(p.sx,p.sy,p.sz);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);mesh.setColorAt(i,c.setHex(p.color));});mesh.computeBoundingSphere();return mesh;
}
export function wireGeometry(source:T.BufferGeometry){
 const g=source.index?source.toNonIndexed():source.clone(),p=g.getAttribute('position'),b=[];
 for(let i=0;i<p.count;i++)b.push(i%3===0?1:0,i%3===1?1:0,i%3===2?1:0);
 g.setAttribute('barycentric',new T.Float32BufferAttribute(b,3));return g;
}
export function mergeBoulevard(group:T.Group){
 for(const child of group.children)if(child instanceof T.Group)mergeBoulevard(child);
 const buckets=new Map<T.Material,T.Mesh[]>();for(const child of group.children)if(child instanceof T.Mesh&&!(child instanceof T.InstancedMesh)&&!Array.isArray(child.material)){const a=buckets.get(child.material)??[];a.push(child);buckets.set(child.material,a);}
 for(const[material,meshes]of buckets){if(meshes.length<2)continue;const copies=meshes.map(m=>{m.updateMatrix();const original=m.geometry.clone(),g=original.index?original.toNonIndexed():original;if(g!==original)original.dispose();return g.applyMatrix4(m.matrix);});const g=mergeGeometries(copies);copies.forEach(c=>c.dispose());const m=new T.Mesh(g,material);m.name='batched-boulevard-parts';group.remove(...meshes);group.add(m);}
}
export function boulevardRandom(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function boulevardBeam(a:T.Vector3,b:T.Vector3,width:number,color:number){const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()),e=new T.Euler().setFromQuaternion(q);return{...block((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,width,a.distanceTo(b),width,color),rx:e.x,ry:e.y,rz:e.z};}
