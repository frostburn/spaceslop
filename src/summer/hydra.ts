import * as T from 'three';
import {atlasRectangles,createRasterMaterial,rasterPart,type Crop} from './atlas';
import {SUMMER_DISTANCE} from './layout';
import {HYDRA_BODY_Y} from './combat';
import {hydraHead,HYDRA_SIDES,HYDRA_HEAD_HP,HYDRA_BOSS_HEAD_HP,HYDRA_BOSS_SIZE,type HydraState} from './hydra-targets';

export function createHydraAssets(){
  // Measured whole-sheet bounds; preserve these UVs when resizing the entire atlas.
  const rectangles:Crop[]=[[21/1246,13/1263,622/1246,539/1263],[781/1246,16/1263,1082/1246,528/1263]];
  for(let i=0;i<5;i++)rectangles.push([203/1246,(570+i*672/5)/1263,477/1246,(570+(i+1)*672/5)/1263]);
  const material=createRasterMaterial(),geometries=atlasRectangles(rectangles);
  const hide=new T.MeshStandardMaterial({color:0x426c52,roughness:.77}),pale=new T.MeshStandardMaterial({color:0xabb883,roughness:.86}),stump=new T.MeshStandardMaterial({color:0x304e3b,roughness:.9});
  const round=new T.SphereGeometry(1,16,10),rigs=new Set<{raster:T.Group;fallback:T.Group}>();
  return{material,geometries,hide,pale,stump,round,rigs,setAtlas(texture:T.Texture){material.map=texture;material.needsUpdate=true;for(const r of rigs){r.raster.visible=true;r.fallback.visible=false;}}};
}

export function createRiverHydra(a:ReturnType<typeof createHydraAssets>,boss=false){
  const root=new T.Group();root.name=boss?'lotus-hydra':'river-hydra';
  const size=boss?HYDRA_BOSS_SIZE:1,depth=boss?-3.8:-16.2;
  const raster=new T.Group(),fallback=new T.Group();root.add(raster,fallback);a.rigs.add({raster,fallback});
  const torso=rasterPart(raster,a.geometries[0],a.material,3.5*size,3.05*size,0,HYDRA_BODY_Y*size,depth);torso.name='hydra-riverbed-body';
  const body=new T.Mesh(a.round,a.hide);body.position.set(0,HYDRA_BODY_Y*size,depth);body.scale.set(1.4*size,1.45*size,.5*size);fallback.add(body);
  const eyeGeometry=new T.SphereGeometry(.065,8,6),eyeMaterial=new T.MeshBasicMaterial({color:0xebc664});
  const crownGeometry=new T.TorusGeometry(boss?.33:.17,.035,6,32),barGeometry=new T.PlaneGeometry(1,.045);
  const necks=HYDRA_SIDES.map(side=>{
    const segments=Array.from({length:5},(_,i)=>rasterPart(raster,a.geometries[i+2],a.material,1.05*size,.7*size));
    const head=rasterPart(raster,a.geometries[1],a.material,.91*size,1.55*size);
    head.name='hydra-head-'+side;
    const fallbackSegments=Array.from({length:5},()=>{const m=new T.Mesh(a.round,a.hide);fallback.add(m);return m;});
    const fallbackHead=new T.Mesh(a.round,a.pale);fallbackHead.scale.set(.39*size,.7*size,.3*size);fallback.add(fallbackHead);
    for(const eyeX of[-.5,.5]){const eye=new T.Mesh(eyeGeometry,eyeMaterial);eye.position.set(eyeX,-.12,.9);fallbackHead.add(eye);}
    const collar=new T.Mesh(a.round,a.hide);collar.scale.set(.47*size,.48*size,.18*size);root.add(collar);
    const crown=new T.Mesh(crownGeometry,new T.MeshBasicMaterial({color:0x91eee1,transparent:true,depthWrite:false}));root.add(crown);
    const anchor=new T.Object3D();anchor.name='laser_contact_'+(side<0?'L':side>0?'R':'C');root.add(anchor);
    const bar=boss?new T.Mesh(barGeometry,new T.MeshBasicMaterial({color:0x91eee1,depthWrite:false})):undefined;if(bar)root.add(bar);
    return{side,segments,head,fallbackSegments,fallbackHead,collar,crown,anchor,bar};
  });
  const origin=new T.Vector3(),eye=new T.Vector3(),top=new T.Vector3(),bottom=new T.Vector3();
  raster.visible=!!a.material.map;fallback.visible=!raster.visible;
  return{root,necks,pose(time:number,charge=0,bodyX=0,state?:HydraState,stateTime=time,camera?:T.Object3D){
    torso.position.x=body.position.x=bodyX;
    root.getWorldPosition(origin);
    if(camera){camera.getWorldPosition(eye);root.worldToLocal(eye);}else eye.set(-origin.x,-origin.y,SUMMER_DISTANCE-origin.z);
    for(const neck of necks){
      const s=neck.side,phase=time*.85+s*1.7,live=hydraHead(time,s,size,boss?0:undefined),alive=!state||state.hp[s+1]>0;
      const age=alive?0:Math.max(0,stateTime-state!.brokenAt[s+1]),t=Math.min(1,age/.75),sink=t*t*(3-2*t),visible=alive||sink<.999;
      const rootX=(s*.82+.08)*size+bodyX,rootY=(HYDRA_BODY_Y-.35)*size;
      const headX=live.x*(1-sink)+rootX*sink,headY=live.y*(1-sink)+rootY*sink,headZ=.2+(depth-.2)*sink;
      neck.collar.position.set(rootX,rootY,depth+.08);neck.collar.material=alive?a.hide:a.stump;
      const point=(u:number,p:T.Vector3)=>p.set(rootX*(1-u)+headX*u+Math.sin(u*Math.PI)*(s*.35+.14*Math.sin(phase+u*2))*size*(1-sink),rootY*(1-u)+(headY+.62*size)*u,depth*(1-u)+(headZ-.06)*u);
      for(let i=0;i<5;i++){
        point(i/5,top);point((i+1)/5,bottom);
        const z=(top.z+bottom.z)/2,midDistance=eye.z-z;
        // Reproject joints to each camera-facing strip's depth. The painted neck
        // stays continuous from the riverbed to the head without bending the art.
        for(const p of[top,bottom]){const denominator=eye.z-p.z;if((eye.z>.7||eye.z<depth-.7)&&Math.abs(denominator)>.1){const k=midDistance/denominator;p.x=eye.x+(p.x-eye.x)*k;p.y=eye.y+(p.y-eye.y)*k;}}
        const dx=bottom.x-top.x,dy=bottom.y-top.y,p=neck.segments[i];
        p.visible=neck.fallbackSegments[i].visible=visible;
        p.position.set((top.x+bottom.x)/2,(top.y+bottom.y)/2,z);
        p.rotation.z=Math.atan2(dx,-dy);p.scale.set(1.05*size,Math.hypot(dx,dy)+.22*size,1);
        const f=neck.fallbackSegments[i];f.position.copy(p.position);f.rotation.z=p.rotation.z;f.scale.set(.35*size,p.scale.y*.65,.3*size);
      }
      neck.head.visible=neck.fallbackHead.visible=visible;
      neck.head.position.set(headX,headY,headZ);neck.head.rotation.z=s*.07+Math.sin(phase)*.025+s*sink*.8;
      neck.fallbackHead.position.copy(neck.head.position);neck.fallbackHead.rotation.z=neck.head.rotation.z;
      const front=headZ+.3*size+.12;
      neck.anchor.position.set(headX,headY-.25*size,front);
      neck.crown.visible=alive;neck.crown.position.set(headX,headY-.32*size,front);neck.crown.scale.setScalar(1+.12*charge);neck.crown.rotation.z=time*.18;
      if(neck.bar){const ratio=(state?.hp[s+1]??HYDRA_BOSS_HEAD_HP)/HYDRA_BOSS_HEAD_HP;neck.bar.visible=alive;neck.bar.position.set(headX-(1-ratio)*.4*size,headY+.83*size,front);neck.bar.scale.set(.8*size*ratio,size,1);}
      neck.crown.material.opacity=boss?1:.45+.45*(state?.hp[s+1]??HYDRA_HEAD_HP)/HYDRA_HEAD_HP;
    }
  }};
}
