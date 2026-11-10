import * as T from 'three';
import {loadEncounterTexture} from '../encounter-texture';
import {createMammothAssets,createMammoth} from './mammoths';
import {createHydraAssets,createRiverHydra} from './hydra';
import {createSummerIce} from './ice';
import {createSummerTerrain} from './terrain';
import {createLotusPalace} from './palace';
import {SUMMER_FLOOR,summerSection} from './layout';
import {mammothBankX} from './river';
import {createLowWisps} from './wisps';
import {createVortexDrone} from './vortex-rig';
import {vortexPhase} from './vortex';

export function createSummerStudies(){
  const mammals=createMammothAssets(),mammoth=createMammoth(mammals),hydras=createHydraAssets(),hydra=createRiverHydra(hydras,true);
  const terrain=createSummerTerrain(),ice=createSummerIce(),wisps=createLowWisps(),vortex=createVortexDrone(),meadow=new T.Group(),palace=createLotusPalace();palace.root.position.y=0;meadow.add(terrain.root,ice.root,wisps.root);
  const herd=[createMammoth(mammals),createMammoth(mammals)];
  herd.forEach((r,i)=>{r.root.position.set(i?5:-5,i?5:-3,SUMMER_FLOOR+.9);if(i)r.root.scale.setScalar(.6);meadow.add(r.root);});
  void loadEncounterTexture('summerMammoth',mammals.setAtlas);
  void loadEncounterTexture('summerHydra',hydras.setAtlas);
  void loadEncounterTexture('summerIce',ice.setAtlas);
  void loadEncounterTexture('summerLotusFlanks',palace.lotuses.setFlanks);
  void loadEncounterTexture('summerLotusWall',palace.lotuses.setWall);
  return{
    summer_mammoth:{root:mammoth.root,duration:24,pose(time:number){mammoth.pose(time);return 'grazing / trunk / head / breathing / occasional step';}},
    summer_hydra:{root:hydra.root,bounds:new T.Box3(new T.Vector3(-4,-2,-4),new T.Vector3(4,11,1)),duration:8,pose(time:number){hydra.pose(time,Math.max(0,Math.sin(time*2)));return 'three articulated necks / central crown';}},
    summer_meadow:{root:meadow,bounds:new T.Box3(new T.Vector3(-12,-15,-18),new T.Vector3(12,15,5)),duration:100,pose(time:number){const scroll=Math.min(280,time*2.8);terrain.root.position.y=ice.root.position.y=wisps.root.position.y=-scroll;terrain.update(scroll,time);ice.update(scroll,time);wisps.update(scroll,time);herd.forEach((r,i)=>{r.root.position.x=mammothBankX(scroll+r.root.position.y,i?1:-1,i?.6:1);r.pose(time,i*3);});return summerSection(time);}},
    summer_vortex:{root:vortex.root,duration:12,pose(time:number){vortex.pose(time);const p=vortexPhase(time);return p.firing?'two rotating emitters / spiral burst':p.charge?'charging / amber warning ring':'entry / hover / cooling';}},
    summer_palace:{root:palace.root,bounds:new T.Box3(new T.Vector3(-16,-17,-18),new T.Vector3(16,17,5)),duration:20,pose(time:number){palace.update(time);return 'three monumental lotuses / botanical courts / glass dome';}},
  };
}
