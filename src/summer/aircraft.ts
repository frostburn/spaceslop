import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Bake fixed prototype hull pieces together while retaining animated burners. */
export function batchAircraft(root:T.Group){
  root.updateMatrixWorld(true);const buckets=new Map<T.Material,T.Mesh[]>(),old=new Set<T.BufferGeometry>();
  root.traverse(node=>{if(node instanceof T.Mesh&&!Array.isArray(node.material)&&!(node.material instanceof T.ShaderMaterial)){const list=buckets.get(node.material)??[];list.push(node);buckets.set(node.material,list);}});
  for(const[material,meshes]of buckets){
    const parts=meshes.map(mesh=>{const source=mesh.geometry.clone(),g=source.index?source.toNonIndexed():source;if(g!==source)source.dispose();if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));g.applyMatrix4(mesh.matrixWorld);return g;});
    const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!merged)throw new Error('Incompatible aircraft geometry');
    for(const mesh of meshes){old.add(mesh.geometry);mesh.removeFromParent();}root.add(new T.Mesh(merged,material));
  }
  old.forEach(g=>g.dispose());return root;
}
