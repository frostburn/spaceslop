import * as T from 'three';
import {atlasRectangles,createRasterMaterial,rasterPart} from './atlas';
export function createMammothAssets(){
  const material=createRasterMaterial(),geometries=atlasRectangles([[.07486979,.0078125,.25976562,.49414062],[.35611979,.01855469,.64453125,.48828125],[.7734375,.02539062,.90820312,.48046875],[.13346354,.55078125,.22460938,.95703125],[.42382812,.53125,.57617188,.96972656],[.75195312,.51953125,.91731771,.97167969]]);
  const fur=new T.MeshStandardMaterial({color:0x65432a,roughness:1}),ivory=new T.MeshStandardMaterial({color:0xdccbaa,roughness:.72});
  const round=new T.SphereGeometry(1,16,10),rigs=new Set<{raster:T.Group;fallback:T.Group}>();
  return{material,geometries,fur,ivory,round,rigs,setAtlas(texture:T.Texture){material.map=texture;material.needsUpdate=true;for(const r of rigs){r.raster.visible=true;r.fallback.visible=false;}}};
}
export function createMammoth(a:ReturnType<typeof createMammothAssets>){
  const root=new T.Group();root.name='grazing-mammoth';
  const raster=new T.Group(),fallback=new T.Group();root.add(raster,fallback);a.rigs.add({raster,fallback});
  const shadow=new T.Mesh(new T.CircleGeometry(1,24),new T.MeshBasicMaterial({color:0x25391f,transparent:true,opacity:.17,depthWrite:false}));shadow.scale.set(1.55,2.7,1);shadow.position.set(0,-.7,-.15);root.add(shadow);
  const body=rasterPart(raster,a.geometries[0],a.material,2.6,4.6,0,0,.04);
  const head=new T.Group();head.position.set(0,-1.6,.13);raster.add(head);rasterPart(head,a.geometries[1],a.material,2.1,2.3,0,-.55,.02);
  const trunk=new T.Group();trunk.position.set(0,-1.02,.04);head.add(trunk);rasterPart(trunk,a.geometries[2],a.material,.65,1.5,0,-.55,.02);
  const tip=new T.Group();tip.position.set(0,-1.16,.04);trunk.add(tip);rasterPart(tip,a.geometries[3],a.material,.4,1.25,0,-.53,.02);
  const legs=[[-1.17,-.9,-.08],[1.17,-.9,-.07],[-1.05,1.2,-.06],[1.05,1.2,-.05]].map(([x,y,z],i)=>{
    const pivot=new T.Group();pivot.position.set(x,y,z);raster.add(pivot);rasterPart(pivot,a.geometries[i<2?4:5],a.material,.64,1.2,0,-.45,0);return pivot;
  });
  function blob(parent:T.Object3D,x:number,y:number,z:number,sx:number,sy:number,sz:number,material:T.Material=a.fur){const m=new T.Mesh(a.round,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
  const fallbackBody=blob(fallback,0,0,.12,1.2,2.1,.6),fallbackHead=blob(fallback,0,-2.05,.35,.85,.8,.6);
  const fallbackLegs=[[-1.05,-.8],[1.05,-.8],[-.95,1.1],[.95,1.1]].map(([x,y])=>blob(fallback,x,y-.4,.03,.25,.6,.3));
  const proboscis=new T.Group();proboscis.position.set(0,-2.65,.25);fallback.add(proboscis);
  for(let i=0;i<7;i++)blob(proboscis,Math.sin(i*.3)*.07,-i*.29,.01,.23-i*.018,.32,.15);
  for(const side of[-1,1]){const points=[[.65,-2.3],[.97,-2.9],[.95,-3.45],[.68,-3.65]].map(([x,y])=>new T.Vector3(side*x,y,.5));fallback.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),20,.045,7,false),a.ivory));}
  raster.visible=!!a.material.map;fallback.visible=!raster.visible;
  return{root,raster,fallback,head,trunk,tip,legs,pose(time:number,phase=0){
    const t=time+phase,chew=Math.sin(t*1.3),step=Math.max(0,Math.sin(t*.21))**10;
    body.scale.x=2.6*(1+.012*Math.sin(t*.8));head.rotation.z=.055*Math.sin(t*.5);head.position.y=-1.6+.04*chew;
    trunk.rotation.z=.075*Math.sin(t*.7+.4);tip.rotation.z=.12*Math.sin(t*1.1);tip.position.y=-1.16+.05*chew;
    legs.forEach((leg,i)=>leg.rotation.z=Math.sin(t*2+i*Math.PI)*.075*step);
    fallbackBody.scale.z=.6*(1+.025*Math.sin(t*.8));fallbackHead.position.y=-2.05+.04*chew;proboscis.rotation.z=trunk.rotation.z+tip.rotation.z*.4;
    fallbackLegs.forEach((leg,i)=>leg.rotation.z=Math.sin(t*2+i*Math.PI)*.075*step);
  }};
}
