import * as T from 'three';
import {type LevelFactory,addRoots} from '../level';
import {createBoulevardGlow} from '../../boulevard-glow';
import {createBoulevardScenery} from '../../boulevard-scenery';
import {createBoulevardMine,createBoulevardInterceptor} from '../../boulevard-enemies';
import {MINE_POOL} from '../../boulevard-mines';
import {createHovercar,cloneHovercar,createPursuitCruiser} from '../../boulevard-rigs';
import {boulevardFrame,boulevardBossPoint,boulevardMotion,BOULEVARD_POOL,CRUISER_MUZZLE_Y} from '../../boulevard';
import {boulevardChallengeTiming} from '../../boulevard-challenge';
import {patternBurstCharge} from '../../challenge-patterns';
import {createPatternCharge} from '../pattern-charge';
import {loadEncounterTexture} from '../../encounter-texture';
import {createBossLaserContact} from '../../laser-contact';
import {BOSS_RECOIL_TIME} from '../../encounters';
export const createLevel:LevelFactory=({plane,signal})=>{
 const glow=createBoulevardGlow(),root=new T.Group(),scenery=createBoulevardScenery(),boss=createPursuitCruiser(scenery.materials);
 glow.setSun(scenery.sun.disk,scenery.sun.clock);
 const light=createHovercar(scenery.materials),heavy=createHovercar(scenery.materials,true);
 const cars=Array.from({length:BOULEVARD_POOL},()=>cloneHovercar(light.root)),haulers=Array.from({length:3},()=>cloneHovercar(heavy.root));
 const mines=Array.from({length:MINE_POOL},()=>createBoulevardMine(scenery.materials)),interceptors=Array.from({length:4},()=>createBoulevardInterceptor(scenery.materials));
 const neon=createPatternCharge(0xff72cb),teal=createPatternCharge(0x70f4ff);
 const carCharges=cars.map(r=>neon.attach(r.root,0,-.75,.22)),haulerCharges=haulers.map(r=>teal.attach(r.root,0,-.75,.22));
 const cruiserCharges=boss.guns.map(({rotor},i)=>(i===0?neon:teal).attach(rotor,0,CRUISER_MUZZLE_Y,0));
 const models:(T.Object3D|undefined)[]=[];addRoots(root,scenery,boss,...cars,...haulers,...mines,...interceptors);
 const actors=[...cars,...haulers,...mines,...interceptors].map(r=>r.root),contact=createBossLaserContact(plane,boss.root);
 return{root,boss:boss.root,models,stageDistance:36,farDistance:520,background:0x0d071d,key:0xe7b8e8,sky:0x7d92cd,ground:0x321746,keyIntensity:2.3,skyIntensity:1.8,friendlyGlow:2.5,
  ready:Promise.all([loadEncounterTexture('boulevardRoad',scenery.road.setMap,1,signal)]),surfaces:[root],
  orientation:(_time,reveal)=>boulevardFrame(reveal),
  contacts:[boss.root,...actors],warmup:[[scenery.root,boss.root,...actors]],
  prepare(){scenery.prime(true);carCharges[0](1);haulerCharges[0](1);cruiserCharges.forEach(charge=>charge(1));for(const m of mines)m.prime(true);for(const r of actors)r.traverse(o=>{if(o instanceof T.Mesh)o.frustumCulled=false;});},
  afterWarmup(){scenery.prime(false);carCharges[0](0);haulerCharges[0](0);cruiserCharges.forEach(charge=>charge(0));for(const m of mines)m.prime(false);for(const r of actors)r.traverse(o=>{if(o instanceof T.Mesh)o.frustumCulled=true;});},
  present:glow.present,dispose(){glow.dispose();scenery.dispose();},contact:(x,d)=>contact(x,d),
  update({flight,time,reveal,animationTime}){
   scenery.update(time,reveal,animationTime);
   const p=boulevardBossPoint(time,reveal);boss.root.position.set(p.x,p.y,p.z);boss.root.rotation.x=-boulevardFrame(reveal).pitch;
   const challenge=flight.isBoulevardChallenge,windup=flight.cannonWindup;
   boss.root.visible=flight.bossHealth>0;boss.pose(challenge?time:animationTime,windup,flight.bossRecoil/BOSS_RECOIL_TIME);
   for(const charge of cruiserCharges)charge(challenge?windup:0);
   models.length=flight.enemies.length;models.fill(undefined);let lights=0,heavies=0,mineCount=0,interceptorCount=0;for(const r of[...cars,...haulers,...mines,...interceptors])r.root.visible=false;
   for(const[i,enemy]of flight.enemies.entries()){
    if(enemy.mine){const rig=mines[mineCount++];if(rig){rig.root.visible=true;rig.pose(enemy.mine,time,enemy.hp>0);}continue;}
    const course=enemy.boulevard;if(!course)continue;
    const charge=challenge?patternBurstCharge(enemy,boulevardChallengeTiming(course).windup):0;
    if(course.formation==='intercept'){
     const rig=interceptors[interceptorCount++];if(!rig)continue;
     const heading=enemy.heading??0,aim=enemy.interceptorHeading??Math.PI-heading;
     rig.root.visible=true;rig.root.position.set(enemy.x,enemy.y,0);rig.root.rotation.z=heading;
     rig.pose(challenge?charge:T.MathUtils.clamp(1-(enemy.fire-enemy.age)/.65,0,1),Math.atan2(Math.sin(aim),-Math.cos(aim))-heading,animationTime);
     models[i]=rig.root;continue;
    }
    const index=course.heavy?heavies++:lights++,rig=(course.heavy?haulers:cars)[index];if(!rig)continue;
    (course.heavy?haulerCharges:carCharges)[index](charge);
    const motion=boulevardMotion(enemy.age,enemy.lane,course);rig.root.visible=true;rig.root.position.set(enemy.x,enemy.y,0);rig.root.rotation.z=enemy.heading??0;rig.pose(enemy.age,motion.bank);models[i]=rig.root;
   }
  }
 };
};
