import * as T from 'three';
import type {LevelFactory} from '../level';
import {createBossLaserContact} from '../../laser-contact';
import {loadEncounterTexture} from '../../encounter-texture';
import {createScoutRig} from '../../ship-rigs';
import {shipBurners,poseBurners} from '../../burners';
import {SUMMER_DISTANCE,SUMMER_END,summerScroll,mammothSites} from '../../summer/layout';
import {SUMMER_AIR_POOL,SUMMER_HYDRA_POOL,summerMotion} from '../../summer/combat';
import {createMammothAssets,createMammoth} from '../../summer/mammoths';
import {createHydraAssets,createRiverHydra} from '../../summer/hydra';
import {createSummerTerrain} from '../../summer/terrain';
import {createSummerIce} from '../../summer/ice';
import {createLotusPalace} from '../../summer/palace';
import {batchAircraft} from '../../summer/aircraft';
import {createSummerClouds} from '../../summer/clouds';

function drone(){
  const root=new T.Group(),hull=new T.MeshStandardMaterial({color:0x676a85,metalness:.45,roughness:.48}),lamp=new T.MeshBasicMaterial({color:0xff814e});
  const core=new T.Mesh(new T.IcosahedronGeometry(.43,1),hull);core.scale.set(1,1,.55);root.add(core);
  const eye=new T.Mesh(new T.SphereGeometry(.14,12,8),lamp);eye.position.set(0,-.1,.25);root.add(eye);
  for(const side of[-1,1]){const pod=new T.Mesh(new T.BoxGeometry(.22,.75,.18),hull);pod.position.x=side*.55;root.add(pod);const nozzle=new T.Mesh(new T.ConeGeometry(.09,.3,8),lamp);nozzle.position.set(side*.55,.43,0);root.add(nozzle);}
  return root;
}
export const createLevel:LevelFactory=({plane,signal})=>{
  const root=new T.Group(),world=new T.Group();root.name='summer-thaw-level';root.add(world);
  const clouds=createSummerClouds(),terrain=createSummerTerrain(clouds.state),ice=createSummerIce(),palace=createLotusPalace(clouds.state),mammothAssets=createMammothAssets(),hydraAssets=createHydraAssets();
  world.add(terrain.root,ice.root,palace.root,clouds.root);
  const herd=mammothSites.map((site,i)=>{const rig=createMammoth(mammothAssets);rig.root.position.set(site.x,site.y,-17.1);rig.root.rotation.z=site.angle;rig.root.scale.set(site.size*(i%2?-1:1),site.size,site.size);world.add(rig.root);return{rig,site};});
  const scout=batchAircraft(createScoutRig()),probe=batchAircraft(drone());
  const air=Array.from({length:SUMMER_AIR_POOL},(_,i)=>{const root=(i<SUMMER_AIR_POOL/2?scout:probe).clone(true);root.visible=false;const burners=shipBurners(root);return{root,burners};});
  const hydras=Array.from({length:SUMMER_HYDRA_POOL},()=>createRiverHydra(hydraAssets));
  root.add(...air.map(r=>r.root),...hydras.map(r=>r.root));hydras.forEach(r=>r.root.visible=false);
  const boss=createRiverHydra(hydraAssets,true);boss.root.position.set(0,SUMMER_END+4.2,-12);world.add(boss.root);
  const contact=createBossLaserContact(plane,boss.root),models:(T.Object3D|undefined)[]=[];
  let restores:(()=>void)[]=[],disposed=false;const flags=new Map<T.Mesh,boolean>();
  const ready=Promise.all([loadEncounterTexture('summerMammoth',mammothAssets.setAtlas,undefined,signal),loadEncounterTexture('summerIce',ice.setAtlas,undefined,signal),loadEncounterTexture('summerHydra',hydraAssets.setAtlas,undefined,signal)]);
  return{root,boss:boss.root,models,ready,stageDistance:SUMMER_DISTANCE,farDistance:440,fixedCamera:true,
    background:0xb5cfc9,key:0xffedd0,keyIntensity:2.1,sky:0xd5e9ec,ground:0x728153,skyIntensity:1.6,friendlyGlow:1.4,
    orientation:()=>({pitch:0,bank:0,viewPitch:0}),
    contacts:[boss.root,...hydras.map(r=>r.root),...air.map(r=>r.root)],
    warmup:[[world,...air.map(r=>r.root),...hydras.map(r=>r.root)]],
    prepare(){restores=[terrain.prime(),ice.prime()];root.traverse(o=>{if(o instanceof T.Mesh){flags.set(o,o.frustumCulled);o.frustumCulled=false;}});const states=herd.map(h=>[h.rig.root.position.y,h.rig.root.visible] as const);herd.forEach(h=>{h.rig.root.position.y=0;h.rig.root.visible=true;});restores.push(()=>herd.forEach((h,i)=>{h.rig.root.position.y=states[i][0];h.rig.root.visible=states[i][1];}));},
    afterWarmup(){restores.forEach(restore=>restore());restores=[];for(const[m,cull]of flags)m.frustumCulled=cull;flags.clear();},
    contact:(x,d)=>contact(x,d),
    update({flight,time,animationTime}){
      const scroll=summerScroll(time);world.position.y=-scroll;clouds.update(scroll,animationTime);terrain.update(scroll,animationTime);ice.update(scroll,animationTime);palace.update(animationTime);
      for(const {rig,site}of herd){rig.root.visible=Math.abs(site.y-scroll)<29;rig.pose(animationTime,site.y*.13);}
      boss.root.visible=flight.bossHealth>0;boss.pose(time,flight.cannonWindup);
      for(const r of air)r.root.visible=false;hydras.forEach(r=>r.root.visible=false);models.length=flight.enemies.length;models.fill(undefined);
      let scoutIndex=0,droneIndex=SUMMER_AIR_POOL/2,hi=0;
      for(const[i,enemy]of flight.enemies.entries()){
        if(!enemy.summer)continue;
        if(enemy.summer.kind==='hydra'){const rig=hydras[hi++];if(!rig)continue;rig.root.visible=enemy.hp>0;rig.root.position.set(enemy.x,enemy.y,0);rig.pose(time,Math.max(0,1-(enemy.fire-enemy.age)/.7));models[i]=rig.root;continue;}
        const rig=air[enemy.summer.kind==='scout'?scoutIndex++:droneIndex++];if(!rig)continue;rig.root.visible=enemy.hp>0;rig.root.position.set(enemy.x,enemy.y,0);rig.root.rotation.set(0,0,enemy.summer.kind==='scout'?Math.PI:0);
        rig.root.rotation.y=summerMotion(enemy.age,enemy.lane,enemy.summer,time).bank;poseBurners(rig.burners,animationTime,.6);models[i]=rig.root;
      }
    },
    dispose(){if(disposed)return;disposed=true;restores.forEach(r=>r());restores=[];},
  };
};
