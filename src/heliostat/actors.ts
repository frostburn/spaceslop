import * as T from 'three';
import { heliostatBatch } from './geometry';
import type { HeliostatMaterials } from './materials';

export function createHeliostatDrone(m: HeliostatMaterials) {
  const root = new T.Group(); root.name = 'heliostat-inspection-drone'; const b = heliostatBatch(root);
  b.box([.6,.95,.32],[0,0,0],m.ceramic,.12);
  b.box([.4,.48,.16],[0,-.12,.21],m.dark,.04);
  b.box([.28,.16,.1],[0,-.4,.23],m.amber,.025);
  for(const side of [-1,1]) {
    b.box([.42,.2,.1],[side*.42,.05,0],m.titanium,.035);
    b.rod([side*.57,-.38,0],[side*.57,.38,0],.14,m.blue,12);
    b.ring(.15,.035,[side*.57,.28,0],m.copper);
    b.box([.18,.04,.1],[side*.57,.43,0],m.cyan,.01);
  }
  b.rod([0,-.35,0],[0,-.75,0],.065,m.dark,10); b.finish();
  return root;
}

/** Pneumatophore, raised sail and trailing articulated stinging filaments. */
export function createGuardFallback(m: HeliostatMaterials) {
  const root = new T.Group(); root.name = 'cyborg-man-o-war'; const b = heliostatBatch(root);
  const bladder = new T.MeshPhysicalMaterial({color:0x6577ab,roughness:.28,metalness:.12,transparent:true,opacity:.7,depthWrite:false,clearcoat:.7});
  const float = new T.Mesh(new T.SphereGeometry(1,24,16).scale(.69,1,.33),bladder);
  float.name='guard-organic-float';float.position.z=.18;root.add(float);
  const sail = new T.Mesh(new T.SphereGeometry(1,20,12).scale(.095,.79,.55),bladder);
  sail.name='guard-organic-sail';sail.position.set(0,.08,.48);root.add(sail);
  const core = new T.SphereGeometry(1,16,10); core.scale(.46,.62,.2); b.add(core,m.blue,[0,0,.12]);
  for(const side of[-1,1]) {
    b.rod([side*.55,-.45,.15],[side*.55,.5,.15],.09,m.titanium,10);
    b.box([.22,.42,.19],[side*.54,-.2,.22],m.copper,.05);
    b.box([.13,.15,.09],[side*.54,-.37,.32],m.amber,.025);
    for(let j=0;j<3;j++) b.pipe([[side*.08,.63-j*.42,.4],[side*.45,.46-j*.42,.43],[side*.57,.25-j*.42,.22]],.016,m.copper);
  }
  b.finish();
  for(let j=0;j<6;j++) {
    const filament=new T.Group(); filament.name='guard-filament'; filament.position.set((j-2.5)*.19,-.48,.02); root.add(filament);
    const f=heliostatBatch(filament), x=(j-2.5)*.07, length=1.05+(j%3)*.21;
    f.pipe([[0,0,0],[x,-.35,-.1],[-x,-.72,-.08],[x*.8,-length,.06]],.025,m.blue);
    for(let k=1;k<=4;k++) f.ring(.041,.013,[x*.3,-length*k/5,-.04],m.copper,[Math.PI/2,0,0]);
    f.finish();
    filament.traverse(node=>{if(node instanceof T.Mesh&&node.material===m.blue)node.name='guard-tendril-skin';});
  }
  return root;
}

export function actorPose(root: T.Group) {
  const filaments=root.getObjectsByProperty('name','guard-filament');
  const raster=root.getObjectByName('guard-raster'),fallback=root.getObjectByName('guard-fallback');
  const body=root.getObjectByName('guard-raster-body') as T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>|undefined;
  const sail=root.getObjectByName('guard-sail'),glow=root.getObjectByName('guard-charge') as T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>|undefined;
  // Rest transforms belong to the rig, while buffers stay shared across actors.
  // Lower anchors keep soft tissue attached to the rigid harness as it breathes.
  const soft=[
    ...[body,root.getObjectByName('guard-organic-float')].filter((o):o is T.Mesh=>!!o).map(node=>({node,anchor:-.6,length:.055,width:.045,phase:0})),
    ...[sail,root.getObjectByName('guard-organic-sail')].filter((o):o is T.Object3D=>!!o).map(node=>({node,anchor:-.65,length:.075,width:.055,phase:.55})),
    ...root.getObjectsByProperty('name','guard-tendril-skin').map((node,i)=>({node,anchor:0,length:.075,width:.025,phase:1+i*.63})),
  ].map(part=>({...part,position:part.node.position.clone(),scale:part.node.scale.clone()}));
  return (time:number,bank:number,charge=0) => {
    root.rotation.y=bank;
    if(raster&&fallback){raster.visible=!!body?.material.map;fallback.visible=!raster.visible;}
    for(const p of soft){
      const wave=Math.sin(time*1.45-p.phase),stretch=1+p.length*wave;
      p.node.scale.set(p.scale.x*(1-p.width*wave),p.scale.y*stretch,p.scale.z);
      p.node.position.y=p.anchor+(p.position.y-p.anchor)*stretch;
    }
    if(sail)sail.rotation.y=.06*Math.sin(time*.9);
    if(glow)glow.material.color.setRGB(.55+charge*2.3,.16+charge*.9,.025+charge*.1);
    filaments.forEach((f,i)=>{f.rotation.z=.18*Math.sin(time*1.4-i*.7);f.rotation.x=.12*Math.sin(time*1.1+i*.8);});
  };
}
