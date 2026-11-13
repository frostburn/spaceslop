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
import {createJellyDonuts,JELLY_DONUT_PERIOD} from './jelly-donut';
import {vortexPhase} from './vortex';
import {createHydraState,HYDRA_HEAD_HP,HYDRA_BOSS_HEAD_HP} from './hydra-targets';

export function createSummerStudies(camera?:T.Camera){
  const [donut] = createJellyDonuts(1);
  const mammals=createMammothAssets(),mammoth=createMammoth(mammals),hydras=createHydraAssets(),hydra=createRiverHydra(hydras),boss=createRiverHydra(hydras,true);
  const riverState=createHydraState(),bossState=createHydraState(HYDRA_BOSS_HEAD_HP);
  function headStudy(rig:typeof hydra,state:typeof riverState,time:number,hp:number){for(let i=0;i<3;i++){const at=5+i*3;state.hp[i]=time<at?hp:0;state.brokenAt[i]=time<at?-1:at;}rig.pose(time,Math.max(0,Math.sin(time*2)),0,state,time,camera);return 'three independent heads / collapse at 5, 8 and 11 seconds';}
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
    summer_hydra:{root:hydra.root,bounds:new T.Box3(new T.Vector3(-3,-1,-17),new T.Vector3(3,6,1)),duration:13,pose(time:number){return headStudy(hydra,riverState,time,HYDRA_HEAD_HP);}},
    summer_lotus_hydra:{root:boss.root,bounds:new T.Box3(new T.Vector3(-4,-2,-4),new T.Vector3(4,11,1)),duration:13,pose(time:number){return headStudy(boss,bossState,time,HYDRA_BOSS_HEAD_HP);}},
    summer_meadow:{root:meadow,bounds:new T.Box3(new T.Vector3(-12,-15,-18),new T.Vector3(12,15,5)),duration:100,pose(time:number){const scroll=Math.min(280,time*2.8);terrain.root.position.y=ice.root.position.y=wisps.root.position.y=-scroll;terrain.update(scroll,time);ice.update(scroll,time);wisps.update(scroll,time);herd.forEach((r,i)=>{r.root.position.x=mammothBankX(scroll+r.root.position.y,i?1:-1,i?.6:1);r.pose(time,i*3);});return summerSection(time);}},
    summer_vortex:{root:vortex.root,duration:12,pose(time:number){vortex.pose(time);const p=vortexPhase(time);return p.firing?'two rotating emitters / spiral burst':p.charge?'charging / amber warning ring':'entry / hover / cooling';}},
    summer_jelly_donut:{root:donut.root,duration:JELLY_DONUT_PERIOD,pose(time:number){donut.pose(time);return 'Floating red core · Irregular rim spin';}},
    summer_palace:{root:palace.root,bounds:new T.Box3(new T.Vector3(-16,-17,-18),new T.Vector3(16,17,5)),duration:20,pose(time:number){palace.update(time);return 'three monumental lotuses / botanical courts / glass dome';}},
  };
}
