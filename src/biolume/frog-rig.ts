import * as T from 'three';
import type {createFrogAtlas} from './frog-raster';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FROG_BEADS,frogSignal,frogTonguePoint,type FrogState,type FrogPoint} from './frog';

/** Shared modeled frog: low crouch, powerful folded thighs and splayed toe pads. */
export function createFrogAssets(){
 const ball=new T.SphereGeometry(1,20,12),parts:T.BufferGeometry[]=[],spots:T.BufferGeometry[]=[];
 function ellipsoid(x:number,y:number,z:number,sx:number,sy:number,sz:number,target=parts){target.push(ball.clone().scale(sx,sy,sz).translate(x,y,z));}
 function limb(a:number[],b:number[],radius:number){
  const start=new T.Vector3(...a),end=new T.Vector3(...b),d=end.clone().sub(start),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize());
  parts.push(new T.CapsuleGeometry(radius,d.length(),4,8).applyQuaternion(q).translate(...start.add(end).multiplyScalar(.5).toArray()));
 }
 ellipsoid(0,.15,.19,.49,.65,.30);ellipsoid(0,-.38,.23,.48,.31,.25);
 for(const side of[-1,1]){
  ellipsoid(side*.53,.39,.17,.30,.43,.24);
  limb([side*.65,.58,.13],[side*.49,-.02,.10],.095);
  limb([side*.35,-.25,.17],[side*.68,-.05,.08],.095);
  limb([side*.68,-.05,.08],[side*.72,-.47,.055],.065);
  for(let j=0;j<3;j++){
   const x=side*(.64+j*.105),y=-.65+.04*j;
   limb([side*.72,-.47,.055],[x,y,.045],.025);ellipsoid(x,y,.05,.052,.072,.025);
   const hx=side*(.70+j*.13),hy=.44+.14*j;
   limb([side*.63,.25,.06],[hx,hy,.04],.027);ellipsoid(hx,hy,.045,.052,.072,.025);
  }
  ellipsoid(side*.29,-.45,.43,.18,.18,.19);
  // Broken rows of glands follow the dorsolateral folds rather than a grid.
  for(let i=0;i<9;i++)ellipsoid(side*(.23+.08*Math.sin(i*1.5)),.62-i*.12,.40+.065*Math.cos(i*.45),.04+.013*Math.sin(i*3),.058,.026,spots);
 }
 for(let i=0;i<15;i++){const a=i*2.3999,r=.27*Math.sqrt((i+.5)/15);ellipsoid(Math.cos(a)*r,.15+Math.sin(a)*r*1.4,.49-.07*r,.022+.013*(i%3),.025,.012,spots);}
 const skinGeometry=mergeGeometries(parts),glowGeometry=mergeGeometries(spots);parts.forEach(g=>g.dispose());spots.forEach(g=>g.dispose());ball.dispose();
 const skin=new T.MeshStandardMaterial({color:0x536b72,emissive:0x0b1929,emissiveIntensity:.7,roughness:.52,metalness:0});
 skin.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vFrogP;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFrogP=position;');
  shader.fragmentShader='varying vec3 vFrogP;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float grain=sin(vFrogP.x*83.+sin(vFrogP.y*63.))*sin(vFrogP.y*109.+sin(vFrogP.z*67.));
   float patches=sin(vFrogP.x*13.+sin(vFrogP.y*8.)*2.)*sin(vFrogP.y*19.+vFrogP.z*11.);
   diffuseColor.rgb*=mix(.46,1.14,smoothstep(-.6,.6,patches))*(.91+.09*grain);`);
 };skin.customProgramCacheKey=()=> 'grove-frog-skin-v1';
 return{skinGeometry,glowGeometry,skin,
  gland:new T.MeshStandardMaterial({color:0x69cfb0,emissive:0x35ffc9,emissiveIntensity:1.6,roughness:.5}),
  dark:new T.MeshStandardMaterial({color:0x061013,roughness:.3}),
  iris:new T.MeshBasicMaterial({color:0xb3ffa6}),
  bead:new T.SphereGeometry(.105,12,8),beadMaterial:new T.MeshBasicMaterial({color:0xffa35c}),
  halo:new T.SphereGeometry(.18,8,6),haloMaterial:new T.MeshBasicMaterial({color:0xff385c,transparent:true,opacity:.2,depthWrite:false,blending:T.AdditiveBlending}),
  eye:new T.SphereGeometry(1,16,10),ring:new T.TorusGeometry(.14,.018,5,20),
 };
}
export function createFrogRig(assets:ReturnType<typeof createFrogAssets>, atlas?:ReturnType<typeof createFrogAtlas>){
 const root=new T.Group();root.name='biolume-lantern-frog';const body=new T.Group();body.name='frog-body';root.add(body);
 const skin=new T.Mesh(assets.skinGeometry,assets.skin),glands=new T.Mesh(assets.glowGeometry,assets.gland);body.add(skin,glands);
 for(const side of[-1,1]){
  const eye=new T.Mesh(assets.eye,assets.iris);eye.position.set(side*.29,-.50,.54);eye.scale.set(.12,.13,.065);body.add(eye);
  const pupil=new T.Mesh(assets.eye,assets.dark);pupil.position.set(side*.29,-.51,.597);pupil.scale.set(.075,.027,.015);body.add(pupil);
  const rim=new T.Mesh(assets.ring,assets.dark);rim.position.set(side*.29,-.50,.54);body.add(rim);
 }
 const mouth=new T.Mesh(assets.eye,assets.dark);mouth.position.set(0,-.57,.34);mouth.scale.set(.28,.035,.045);body.add(mouth);
 const throat=new T.Mesh(assets.eye,assets.gland);throat.position.set(0,-.44,.46);throat.scale.set(.12,.11,.035);body.add(throat);
 const modeledParts = [...body.children];
 const raster = atlas ? new T.Group() : undefined;
 const torso = atlas ? new T.Mesh(atlas.body, atlas.material) : undefined;
 const closedHead = atlas ? new T.Mesh(atlas.closed, atlas.material) : undefined;
 const openHead = atlas ? new T.Mesh(atlas.open, atlas.material) : undefined;
 if(raster && torso && closedHead && openHead){
  raster.name = 'frog-atlas';
  torso.name = 'frog-raster-body';
  closedHead.name = 'frog-head-closed';
  openHead.name = 'frog-head-open';
  raster.add(torso, closedHead, openHead);
  raster.visible = false;
  body.add(raster);
 }
 const beads=new T.InstancedMesh(assets.bead,assets.beadMaterial,FROG_BEADS),halos=new T.InstancedMesh(assets.halo,assets.haloMaterial,FROG_BEADS);beads.frustumCulled=halos.frustumCulled=false;root.add(beads,halos);
 const matrix=new T.Object3D(),p={x:0,y:0};
 let last=NaN,lastX=NaN,lastY=NaN,lastAttack:number|undefined,lastArt=false;
 function pose(origin:FrogPoint,state:FrogState,age:number){
  const artwork = atlas?.available ?? false;
  if(age===last&&origin.x===lastX&&origin.y===lastY&&state.attackAt===lastAttack&&lastArt===artwork)return;
  last=age;lastX=origin.x;lastY=origin.y;lastAttack=state.attackAt;lastArt=artwork;
  const s=frogSignal(state,age),bodyZ=.2,k=(22-bodyZ)/22;
  body.position.set(origin.x*k,origin.y*k,bodyZ);body.rotation.z=state.angle;body.scale.setScalar(k);
  skin.scale.z=1+.025*Math.sin(age*2.1);glands.scale.z=skin.scale.z;
  throat.scale.set(.12+.05*s.warning,.11+.09*s.warning,.035+.025*s.warning);
  mouth.scale.y=.035+.08*Math.max(s.warning,s.extension);
  if(raster && torso && closedHead && openHead){
   raster.visible = artwork;
   for(const part of modeledParts) part.visible = !artwork;
   torso.scale.x = 1 + .018 * Math.sin(age * 2.1);
   closedHead.visible = !s.active;
   openHead.visible = s.active;
  }
  const length=state.reach*s.extension,count=s.active?Math.min(FROG_BEADS,Math.max(1,Math.ceil(length/.28))):0;
  beads.count=halos.count=count;
  for(let i=0;i<count;i++){
   frogTonguePoint(state,origin,age,(i+1)/count,p);
   const z=.85,scale=(22-z)/22;matrix.position.set(p.x*scale,p.y*scale,z);matrix.scale.setScalar(scale*(i===count-1?1.3:1));matrix.updateMatrix();beads.setMatrixAt(i,matrix.matrix);halos.setMatrixAt(i,matrix.matrix);
  }beads.instanceMatrix.needsUpdate=halos.instanceMatrix.needsUpdate=true;
 }
 return{root,body,beads,halos,pose,prime(){pose({x:0,y:0},{nextAt:0,attackAt:0,angle:0,reach:6},1.35);beads.count=halos.count=FROG_BEADS;for(const part of modeledParts)part.visible=true;if(atlas?.available&&closedHead&&openHead){closedHead.visible=openHead.visible=true;}},release(){beads.dispose();halos.dispose();}};
}
