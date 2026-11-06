import * as T from 'three';
import {type createMortarAssets} from './vent-mortar-rig';
import {createVentFormations} from './vent-formations';

// Decorative colonies use the mortar's foot and two shell plates, without its
// siphon, orange aperture, warning glow or any combat registration.
export function ventColonyPlacements(){
 return createVentFormations().filter((f,i)=>!f.front&&f.y>0&&f.y<132&&[0,1,8,9,11].includes(f.cell)&&i%3===0).flatMap((f,group)=>Array.from({length:3+group%4},(_,i)=>{
  const angle=i*2.399+group*.7,r=.18+Math.sqrt(i)*.3;
  return{x:f.x+Math.cos(angle)*r,y:f.y+Math.sin(angle)*r,z:f.z+.07,size:.28+((i*7+group*3)%11)*.022,angle:angle*.4,phase:group*1.9+i*1.3};
 }));
}
export function createVentColonies(assets:ReturnType<typeof createMortarAssets>){
 const root=new T.Group();root.name='background-mollusk-colonies';const placements=ventColonyPlacements(),pose=new T.Object3D(),color=new T.Color();
 const batches=[0,2,3].map((cell,part)=>{
  const mesh=new T.InstancedMesh(assets.geometries[cell],assets.material,placements.length);mesh.name='mollusk-shell-parts-'+cell;mesh.frustumCulled=false;if(part)mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  placements.forEach((_,i)=>mesh.setColorAt(i,color.setRGB(.38+(i%5)*.025,.51+(i%4)*.025,.53+(i%3)*.025)));root.add(mesh);return mesh;
 });
 function update(time:number){placements.forEach((p,i)=>batches.forEach((mesh,part)=>{
  const side=part===1?-1:part===2?1:0,opening=.12+Math.sin(time*.65+p.phase)*.045;
  pose.position.set(p.x+side*p.size*.16,p.y+p.size*.03,p.z+part*.012);pose.rotation.set(0,0,p.angle+side*opening);pose.scale.set(p.size*(part?.68:1.25),p.size*(part?.96:1.1),1);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);
 }));for(const mesh of batches)mesh.instanceMatrix.needsUpdate=true;}
 update(0);return{root,update};
}
