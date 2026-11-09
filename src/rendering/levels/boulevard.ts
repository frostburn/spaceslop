import * as T from 'three';
import {type LevelFactory,addRoots} from '../level';
import {createBoulevardGlow} from '../../boulevard-glow';
import {createBoulevardScenery} from '../../boulevard-scenery';
import {createHovercar,cloneHovercar,createPursuitCruiser} from '../../boulevard-rigs';
import {boulevardFrame,boulevardBossPoint,boulevardMotion,BOULEVARD_POOL} from '../../boulevard';
import {loadEncounterTexture} from '../../encounter-texture';
import {createBossLaserContact} from '../../laser-contact';
import {BOSS_RECOIL_TIME} from '../../encounters';
export const createLevel:LevelFactory=({plane,signal})=>{
 const glow=createBoulevardGlow(),root=new T.Group(),scenery=createBoulevardScenery(),boss=createPursuitCruiser(scenery.materials);
 glow.setSun(scenery.sun.disk,scenery.sun.clock);
 const light=createHovercar(scenery.materials),heavy=createHovercar(scenery.materials,true);
 const cars=Array.from({length:BOULEVARD_POOL},()=>cloneHovercar(light.root)),haulers=Array.from({length:3},()=>cloneHovercar(heavy.root));
 const models:(T.Object3D|undefined)[]=[];addRoots(root,scenery,boss,...cars,...haulers);
 const actors=[...cars,...haulers].map(r=>r.root),contact=createBossLaserContact(plane,boss.root);
 return{root,boss:boss.root,models,stageDistance:36,background:0x0d071d,key:0xe7b8e8,sky:0x7d92cd,ground:0x321746,keyIntensity:2.3,skyIntensity:1.8,friendlyGlow:2.5,
  ready:Promise.all([loadEncounterTexture('boulevardRoad',scenery.road.setMap,1,signal)]),surfaces:[root],
  orientation:(_time,reveal)=>boulevardFrame(reveal),
  contacts:[boss.root,...actors],warmup:[[scenery.root,boss.root,...actors]],
  prepare(){scenery.prime(true);for(const r of actors)r.traverse(o=>{if(o instanceof T.Mesh)o.frustumCulled=false;});},
  afterWarmup(){scenery.prime(false);for(const r of actors)r.traverse(o=>{if(o instanceof T.Mesh)o.frustumCulled=true;});},
  present:glow.present,dispose(){glow.dispose();scenery.dispose();},contact:(x,d)=>contact(x,d),
  update({flight,time,reveal,animationTime}){
   scenery.update(time,reveal,animationTime);
   const p=boulevardBossPoint(time,reveal);boss.root.position.set(p.x,p.y,p.z);boss.root.rotation.x=-boulevardFrame(reveal).pitch;
   boss.root.visible=flight.bossHealth>0;boss.pose(animationTime,flight.cannonWindup,flight.bossRecoil/BOSS_RECOIL_TIME);
   models.length=flight.enemies.length;models.fill(undefined);let lights=0,heavies=0;for(const r of[...cars,...haulers])r.root.visible=false;
   for(const[i,enemy]of flight.enemies.entries()){
    if(!enemy.boulevard)continue;const rig=enemy.boulevard.heavy?haulers[heavies++]:cars[lights++];if(!rig)continue;
    const motion=boulevardMotion(enemy.age,enemy.lane,enemy.boulevard);rig.root.visible=true;rig.root.position.set(enemy.x,enemy.y,0);rig.root.rotation.z=enemy.heading??0;rig.pose(enemy.age,motion.bank);models[i]=rig.root;
   }
  }
 };
};
