import * as T from 'three';
import {atlasRectangles,createRasterMaterial,rasterPart,type Crop} from './atlas';
import {SUMMER_DISTANCE} from './layout';
import {hydraHead} from './combat';

export function createHydraAssets(){
  // Measured whole-sheet bounds; preserve these UVs when resizing the entire atlas.
  const rectangles:Crop[]=[[21/1246,13/1263,622/1246,539/1263],[781/1246,16/1263,1082/1246,528/1263]];
  for(let i=0;i<5;i++)rectangles.push([203/1246,(570+i*672/5)/1263,477/1246,(570+(i+1)*672/5)/1263]);
  const material=createRasterMaterial(),geometries=atlasRectangles(rectangles);
  const hide=new T.MeshStandardMaterial({color:0x426c52,roughness:.77}),pale=new T.MeshStandardMaterial({color:0xabb883,roughness:.86});
  const round=new T.SphereGeometry(1,16,10),rigs=new Set<{raster:T.Group;fallback:T.Group}>();
  return{material,geometries,hide,pale,round,rigs,setAtlas(texture:T.Texture){material.map=texture;material.needsUpdate=true;for(const r of rigs){r.raster.visible=true;r.fallback.visible=false;}}};
}

export function createRiverHydra(a:ReturnType<typeof createHydraAssets>,boss=false){
  const root=new T.Group();root.name=boss?'lotus-hydra':'river-hydra';
  const size=boss?1.85:1,depth=boss?-3.8:-16.2;
  const raster=new T.Group(),fallback=new T.Group();root.add(raster,fallback);a.rigs.add({raster,fallback});
  rasterPart(raster,a.geometries[0],a.material,3.5*size,3.05*size,0,3.9*size,depth);
  const body=new T.Mesh(a.round,a.hide);body.position.set(0,3.9*size,depth);body.scale.set(1.4*size,1.45*size,.5*size);fallback.add(body);
  const eyeGeometry=new T.SphereGeometry(.065,8,6),eyeMaterial=new T.MeshBasicMaterial({color:0xebc664});
  const necks=[-1,0,1].map(side=>{
    const segments=Array.from({length:5},(_,i)=>rasterPart(raster,a.geometries[i+2],a.material,1.05*size,.7*size));
    const head=rasterPart(raster,a.geometries[1],a.material,.91*size,1.55*size);
    const fallbackSegments=Array.from({length:5},()=>{const m=new T.Mesh(a.round,a.hide);fallback.add(m);return m;});
    const fallbackHead=new T.Mesh(a.round,a.pale);fallbackHead.scale.set(.39*size,.7*size,.3*size);fallback.add(fallbackHead);
    for(const eyeX of[-.5,.5]){const eye=new T.Mesh(eyeGeometry,eyeMaterial);eye.position.set(eyeX,-.12,.9);fallbackHead.add(eye);}
    return{side,segments,head,fallbackSegments,fallbackHead};
  });
  const crown=new T.Mesh(new T.TorusGeometry(boss?.33:.17,.035,6,32),new T.MeshBasicMaterial({color:0x91eee1}));crown.position.set(0,-.32,.38);root.add(crown);
  for(const label of['L','C','R']){const anchor=new T.Object3D();anchor.name='laser_contact_'+label;anchor.position.set(0,-.25,.35);root.add(anchor);}
  const origin=new T.Vector3(),top=new T.Vector3(),bottom=new T.Vector3();
  raster.visible=!!a.material.map;fallback.visible=!raster.visible;
  return{root,necks,pose(time:number,charge=0){
    root.getWorldPosition(origin);
    for(const neck of necks){
      const s=neck.side,phase=time*.85+s*1.7,{x:headX,y:headY}=hydraHead(time,s,size);
      const point=(u:number,p:T.Vector3)=>p.set((s*.9+.11)*size*(1-u)+headX*u+Math.sin(u*Math.PI)*(s*.35+.14*Math.sin(phase+u*2))*size,2.9*size*(1-u)+(headY+.62*size)*u,depth*(1-u)+.14*u);
      for(let i=0;i<5;i++){
        point(i/5,top);point((i+1)/5,bottom);
        const z=(top.z+bottom.z)/2,midDistance=SUMMER_DISTANCE-origin.z-z;
        // Reproject joints to each camera-facing strip's depth. The painted neck
        // stays continuous from the riverbed to the head without bending the art.
        for(const p of[top,bottom]){const k=midDistance/(SUMMER_DISTANCE-origin.z-p.z);p.x=(origin.x+p.x)*k-origin.x;p.y=(origin.y+p.y)*k-origin.y;}
        const dx=bottom.x-top.x,dy=bottom.y-top.y,p=neck.segments[i];
        p.position.set((top.x+bottom.x)/2,(top.y+bottom.y)/2,z);
        p.rotation.z=Math.atan2(dx,-dy);p.scale.set(1.05*size,Math.hypot(dx,dy)+.22*size,1);
        const f=neck.fallbackSegments[i];f.position.copy(p.position);f.rotation.z=p.rotation.z;f.scale.set(.35*size,p.scale.y*.65,.3*size);
      }
      neck.head.position.set(headX,headY,.2);neck.head.rotation.z=s*.07+Math.sin(phase)*.025;
      neck.fallbackHead.position.copy(neck.head.position);neck.fallbackHead.rotation.z=neck.head.rotation.z;
    }
    crown.scale.setScalar(1+.12*charge);crown.rotation.z=time*.18;
  }};
}
