import * as T from 'three';
// Explicit friendly roots own these unlit materials; leave hull paint and enemy art alone.
export function boostFriendlyGlow(roots:readonly T.Object3D[],gain:number){
 if(gain===1)return;const seen=new Set<T.Material>();
 for(const root of roots)root.traverse(node=>{
  if(!(node instanceof T.Mesh))return;
  for(const material of[node.material].flat()){
   if(seen.has(material))continue;seen.add(material);
   if(material instanceof T.MeshBasicMaterial)material.color.multiplyScalar(gain);
   else if(material instanceof T.ShaderMaterial){
    material.fragmentShader=material.fragmentShader.replace('#include <colorspace_fragment>',`gl_FragColor.rgb *= ${gain.toFixed(3)};\n#include <colorspace_fragment>`);material.needsUpdate=true;
   }
  }
 });
}
