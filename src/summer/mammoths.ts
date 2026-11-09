import * as T from 'three';
import {atlasGeometries,createRasterMaterial,rasterPart} from './atlas';
export function createMammothAssets(){
  const material=createRasterMaterial(),geometries=atlasGeometries(3,2,[[.037,.076,.977,.969],[.066,.018,.977,.977],[.199,.023,.898,1],[.229,.123,.717,.865],[.197,.027,.783,.994],[.271,.016,.822,.994]]);
  const fur=new T.MeshStandardMaterial({color:0x65432a,roughness:1}),ivory=new T.MeshStandardMaterial({color:0xdccbaa,roughness:.72});
  const round=new T.SphereGeometry(1,16,10),rigs=new Set<{raster:T.Group;fallback:T.Group}>();
  return{material,geometries,fur,ivory,round,rigs,setAtlas(texture:T.Texture){material.map=texture;material.needsUpdate=true;for(const r of rigs){r.raster.visible=true;r.fallback.visible=false;}}};
}
export function createMammoth(a:ReturnType<typeof createMammothAssets>){
  const root=new T.Group();root.name='grazing-mammoth';
  const raster=new T.Group(),fallback=new T.Group();root.add(raster,fallback);a.rigs.add({raster,fallback});
  const shadow=new T.Mesh(new T.CircleGeometry(1,24),new T.MeshBasicMaterial({color:0x25391f,transparent:true,opacity:.17,depthWrite:false}));shadow.scale.set(1.8,2.3,1);shadow.position.set(0,-.4,-.15);root.add(shadow);
  const body=rasterPart(raster,a.geometries[0],a.material,3.4,3.7,0,0,.04);
  const head=new T.Group();head.position.set(-.75,-1,.13);raster.add(head);rasterPart(head,a.geometries[1],a.material,2.05,2.15,-.25,-.4,.02);
  const trunk=new T.Group();trunk.position.set(-.58,-.8,.04);head.add(trunk);rasterPart(trunk,a.geometries[2],a.material,.73,1.55,-.12,-.58,.02);
  const tip=new T.Group();tip.position.set(-.32,-1.18,.04);trunk.add(tip);rasterPart(tip,a.geometries[3],a.material,.43,.86,0,-.35,.02);
  const legs=[[-.25,.35,-.08],[.85,1,-.07],[-.8,-.8,.10],[1.05,.05,.09]].map(([x,y,z],i)=>{
    const pivot=new T.Group();pivot.position.set(x,y,z);raster.add(pivot);rasterPart(pivot,a.geometries[i%2?5:4],a.material,.68,1.55,0,-.65,0);return pivot;
  });
  function blob(parent:T.Object3D,x:number,y:number,z:number,sx:number,sy:number,sz:number,material:T.Material=a.fur){const m=new T.Mesh(a.round,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
  const fallbackBody=blob(fallback,0,0,.12,1.15,1.7,.6),fallbackHead=blob(fallback,-.8,-1.35,.35,.73,.8,.6);
  const fallbackLegs=[[-.6,-.7],[.55,-.65],[-.6,.9],[.6,.95]].map(([x,y])=>blob(fallback,x,y-.5,.03,.28,.8,.3));
  const proboscis=new T.Group();proboscis.position.set(-1,-1.9,.25);fallback.add(proboscis);
  for(let i=0;i<5;i++)blob(proboscis,-i*.08,-i*.27,.01,.24-i*.028,.32,.15);
  for(const dx of[-.4,.4]){const tusk=new T.Mesh(new T.TorusGeometry(.5,.055,7,16,Math.PI*.8),a.ivory);tusk.position.set(-.9+dx,-1.9,.6);tusk.rotation.z=2.8;fallback.add(tusk);}
  raster.visible=!!a.material.map;fallback.visible=!raster.visible;
  return{root,raster,fallback,head,trunk,tip,legs,pose(time:number,phase=0){
    const t=time+phase,chew=Math.sin(t*1.3),step=Math.max(0,Math.sin(t*.21))**10;
    body.scale.x=3.4*(1+.012*Math.sin(t*.8));head.rotation.z=.065*Math.sin(t*.5);head.position.y=-1+.045*chew;
    trunk.rotation.z=.09*Math.sin(t*.7+.4);tip.rotation.z=.14*Math.sin(t*1.1);tip.position.y=-1.18+.07*chew;
    legs.forEach((leg,i)=>leg.rotation.z=Math.sin(t*2+i*Math.PI)*.075*step);
    fallbackBody.scale.z=.6*(1+.025*Math.sin(t*.8));fallbackHead.position.y=-1.35+.06*chew;proboscis.rotation.z=trunk.rotation.z+tip.rotation.z*.4;
    fallbackLegs.forEach((leg,i)=>leg.rotation.z=Math.sin(t*2+i*Math.PI)*.075*step);
  }};
}
