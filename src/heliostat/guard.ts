import * as T from 'three';
import {createGuardFallback} from './actors';
import type {HeliostatMaterials} from './materials';

/** Four square atlas cells: bladder, sail, harness, articulated tendril. */
export function createGuardAssets(m:HeliostatMaterials){
  const material=new T.MeshBasicMaterial({alphaTest:.24,side:T.DoubleSide});
  const rigs=new Set<T.Group>();
  // Trim each cell's transparent framing so the visible body, emitters and
  // cosmetic laser-contact geometry occupy the same physical footprint.
  const crops=[[.26,.02,.74,.98],[.215,.014,.733,.986],[.165,.148,.845,.78],[.323,.012,.675,.987]];
  const geometries=Array.from({length:4},(_,cell)=>{
    const g=cell===0?new T.CircleGeometry(.5,32):new T.PlaneGeometry(1,1),uv=g.attributes.uv,[left,top,right,bottom]=crops[cell];
    for(let i=0;i<uv.count;i++)uv.setXY(i,(cell%2+left+uv.getX(i)*(right-left))/2,1-(Math.floor(cell/2)+bottom-uv.getY(i)*(bottom-top))/2);
    return g;
  });
  const fallback=createGuardFallback(m),lightGeometry=new T.SphereGeometry(.065,10,8);
  return{material,geometries,fallback,lightGeometry,rigs,setAtlas(texture:T.Texture){texture.anisotropy=4;material.map=texture;material.needsUpdate=true;for(const root of rigs){root.getObjectByName('guard-raster')!.visible=true;root.getObjectByName('guard-fallback')!.visible=false;}}};
}
export function createHeliostatGuard(assets:ReturnType<typeof createGuardAssets>){
  const root=new T.Group();root.name='cyborg-man-o-war';
  const contact=new T.Group();contact.name='guard-contact';root.add(contact);
  const fallback=assets.fallback.clone(true);fallback.name='guard-fallback';contact.add(fallback);
  const raster=new T.Group();raster.name='guard-raster';contact.add(raster);
  function part(parent:T.Object3D,cell:number,w:number,h:number,x:number,y:number,z:number){
    const mesh=new T.Mesh(assets.geometries[cell],assets.material);mesh.position.set(x,y,z);mesh.scale.set(w,h,1);parent.add(mesh);return mesh;
  }
  const body=part(raster,0,1.45,2.4,0,0,.21);body.name='guard-raster-body';
  part(raster,2,1.55,1.45,0,-.32,.29).name='guard-harness';
  const sail=part(raster,1,.63,2.1,0,.08,.32);sail.name='guard-sail';
  for(let i=0;i<5;i++){
    const pivot=new T.Group();pivot.name='guard-filament';pivot.position.set((i-2)*.2,-.6,.12+i*.003);raster.add(pivot);
    part(pivot,3,.3+(i%2)*.07,1.5+(i%3)*.2,0,-.78,.01).name='guard-tendril-skin';
    pivot.rotation.z=(i-2)*.13;
  }
  const glow=new T.Mesh(assets.lightGeometry,new T.MeshBasicMaterial({color:0xff9d2d}));glow.name='guard-charge';glow.position.set(-.29,-.9,.35);root.add(glow);
  const second=new T.Mesh(assets.lightGeometry,glow.material);second.position.x=.58;glow.add(second);
  raster.visible=!!assets.material.map;fallback.visible=!raster.visible;
  assets.rigs.add(root);
  return root;
}
