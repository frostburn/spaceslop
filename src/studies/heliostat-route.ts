import * as T from 'three';
import { createHeliostatBay,createHeliostatBus } from './heliostat-bay';
import { machineryPose,type HeliostatBayKind } from './heliostat-machinery';
import { BAY_SPACING,bayTravel } from './heliostat-layout';
import type { HeliostatMaterials } from './heliostat-materials';

export const routeKinds:readonly HeliostatBayKind[]=['docking','docking','generation','generation','cooling',
  'cooling','generation','containment','containment','containment','containment'];

/** Shared templates cover ten screens plus the collector apron. */
export function createHeliostatRoute(m:HeliostatMaterials){
  const root=new T.Group();root.name='heliostat-station-route';
  const templates=new Map<HeliostatBayKind,T.Group>();
  for(const kind of new Set(routeKinds)){
    const template=createHeliostatBay(m,kind).root;template.add(createHeliostatBus(m));templates.set(kind,template);
  }
  const bays=routeKinds.map((kind,i)=>{
    const node=templates.get(kind)!.clone(true);node.name=`${kind}-bay-${i}`;node.position.y=i*BAY_SPACING;
    root.add(node);return {root:node,kind,pose:machineryPose(node),origin:i*BAY_SPACING};
  });
  return{root,bays,
    update(time:number){
      const scroll=-bayTravel(time);
      bays.forEach((bay,i)=>{
        const relative=bay.origin-scroll;bay.root.visible=relative>-31&&relative<65;
        if(bay.root.visible)bay.pose(time,i);
      });
    },
    prepare(offset:number){
      const parentVisible=root.visible;root.visible=true;
      const state=bays.map(bay=>({visible:bay.root.visible,y:bay.root.position.y}));
      const flags=new Map<T.Mesh,boolean>(),seen=new Set<HeliostatBayKind>();
      bays.forEach(bay=>{
        bay.root.visible=!seen.has(bay.kind);seen.add(bay.kind);
        if(bay.root.visible)bay.root.position.y=offset;
        bay.root.traverse(node=>{if(node instanceof T.Mesh){flags.set(node,node.frustumCulled);node.frustumCulled=false;}});
      });
      return()=>{
        root.visible=parentVisible;
        bays.forEach((bay,i)=>{bay.root.visible=state[i].visible;bay.root.position.y=state[i].y;});
        for(const[node,flag]of flags)node.frustumCulled=flag;
      };
    },
  };
}
