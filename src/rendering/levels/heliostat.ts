import * as T from 'three';
import type { LevelFactory } from '../level';
import { createHeliostatScenery } from '../../heliostat/scenery';
import { createHeliostatBackdrop } from '../../heliostat/backdrop';
import { createHeliostatEnvironment } from '../../heliostat/materials';
import { createHeliostatDrone,actorPose } from '../../heliostat/actors';
import {createGuardAssets,createHeliostatGuard} from '../../heliostat/guard';
import {createAttackPlasma} from '../../heliostat/plasma';
import {crawlerPose,CRAWLER_POOL} from '../../heliostat/crawler';
import {createCrawlerAssets,createCrawlerRig} from '../../heliostat/crawler-rig';
import { heliostatFrame,heliostatMotion,heliostatCanAttack,HELIOSTAT_GUARD_CHARGE,HELIOSTAT_DISTANCE,HELIOSTAT_DRONE_POOL,HELIOSTAT_GUARD_POOL } from '../../heliostat/combat';
import { loadEncounterTexture } from '../../encounter-texture';
import { createBossLaserContact } from '../../laser-contact';
import { disposeScene } from '../dispose';
import type { HeliostatArt } from '../../heliostat/art';
import { BOSS_RECOIL_TIME } from '../../encounters';

export const createLevel:LevelFactory=({plane,scene,signal})=>{
  const root=new T.Group(),scenery=createHeliostatScenery(),backdrop=createHeliostatBackdrop(),environment=createHeliostatEnvironment();
  root.add(scenery.root);scene.environment=environment;
  const drone=createHeliostatDrone(scenery.materials),guard=createGuardAssets(scenery.materials),plasma=createAttackPlasma(scenery.plasma);
  root.add(plasma.root);
  const drones=Array.from({length:HELIOSTAT_DRONE_POOL},()=>drone.clone(true));
  const guards=Array.from({length:HELIOSTAT_GUARD_POOL},()=>createHeliostatGuard(guard));
  const crawlerAssets=createCrawlerAssets(scenery.materials),crawlers=Array.from({length:CRAWLER_POOL},()=>createCrawlerRig(crawlerAssets));
  for(const r of crawlers){root.add(r.root);r.root.visible=false;}
  const actors=[...drones,...guards].map(root=>({root,pose:actorPose(root)}));for(const r of actors){root.add(r.root);r.root.visible=false;}
  const models:(T.Object3D|undefined)[]=[],contact=createBossLaserContact(plane,scenery.boss.root),art:HeliostatArt={};
  const flags=new Map<T.Mesh,boolean>();let restoreRoute:(()=>void)|undefined,restoreUnderworks:(()=>void)|undefined,restoreBoss:(()=>void)|undefined,restoreCrawlers:(()=>void)[]=[],progress=0,disposed=false;
  const size=new T.Vector2();
  return {root,boss:scenery.boss.root,models,stageDistance:HELIOSTAT_DISTANCE,farDistance:600,
    background:0x020814,key:0xffe6c4,keyIntensity:.9,sky:0xb3d5e5,ground:0x2c2219,skyIntensity:1.5,friendlyGlow:1.4,
    ready:Promise.all([
      loadEncounterTexture('heliostatBackdrop',texture=>backdrop.setTexture(texture,true),undefined,signal),
      loadEncounterTexture('ioCeramic',texture=>{art.heliostatCeramic=texture;scenery.materials.setArt(art,true);},1,signal),
      loadEncounterTexture('heliostatGuard',guard.setAtlas,undefined,signal),
    ]),
    applyArmor(texture){const copy=texture.clone();copy.repeat.set(1,1);copy.needsUpdate=true;art.heliostatMetal=copy;scenery.materials.setArt(art,true);},
    orientation:(_time,reveal)=>heliostatFrame(reveal),contacts:[scenery.boss.root,...actors.map(r=>r.root),...crawlers.map(r=>r.head)],
    warmup:[[scenery.root,plasma.root,...actors.map(r=>r.root),...crawlers.map(r=>r.root)]],
    prepare(){
      restoreRoute=scenery.route.prepare(-scenery.world.position.y);scenery.gates.prime();plasma.prime();
      restoreUnderworks=scenery.underworks.prepare(-scenery.world.position.y);
      restoreBoss=scenery.boss.prime();restoreCrawlers=crawlers.map(r=>r.prime());
      root.traverse(o=>{if(o instanceof T.Mesh){flags.set(o,o.frustumCulled);o.frustumCulled=false;}});
    },
    afterWarmup(){for(const[m,flag]of flags)m.frustumCulled=flag;flags.clear();restoreRoute?.();restoreUnderworks?.();restoreBoss?.();restoreCrawlers.forEach(restore=>restore());restoreCrawlers=[];restoreRoute=restoreUnderworks=restoreBoss=undefined;plasma.root.visible=false;},
    present(renderer,foreground,camera){
      const background=foreground.background,clear=renderer.autoClear;
      try{
        renderer.getDrawingBufferSize(size);backdrop.update(size.x,size.y,progress,false);
        renderer.autoClear=false;renderer.clear();renderer.render(backdrop.scene,camera);renderer.clearDepth();
        foreground.background=null;renderer.render(foreground,camera);
      }finally{foreground.background=background;renderer.autoClear=clear;}
    },
    contact:(x,d)=>contact(x,d),
    update({flight,time,reveal,animationTime}){
      progress=reveal;
      scenery.update(time,reveal,animationTime,flight.cannonWindup,flight.bossRecoil/BOSS_RECOIL_TIME,flight.bossHealth>0,{unstable:flight.heliostatUnstableAge,pattern:flight.heliostatPattern,attackTime:flight.heliostatAttackTime,active:flight.heliostatTargets.length===2});
      plasma.update(flight.heliostatAttackTime,animationTime,flight.heliostatTargets,(flight.phase==='boss'||flight.phase==='lost')&&flight.bossHealth>0,flight.heliostatPattern);
      for(const r of actors)r.root.visible=false;models.length=flight.enemies.length;models.fill(undefined);
      for(const r of crawlers)r.root.visible=false;
      let di=0,gi=0,ci=0;
      for(const[i,enemy]of flight.enemies.entries()){
        if(enemy.crawler){const rig=crawlers[ci++];if(rig){rig.root.visible=enemy.hp>0;rig.pose(crawlerPose(enemy.crawler,time),animationTime);models[i]=rig.head;}continue;}
        if(!enemy.heliostat)continue;
        const index=enemy.heliostat.kind==='guard'?HELIOSTAT_DRONE_POOL+gi++:di++,rig=actors[index];if(!rig)continue;
        const p=heliostatMotion(enemy.age,enemy.lane,enemy.heliostat);
        rig.root.visible=enemy.hp>0;rig.root.position.set(enemy.x,enemy.y,0);rig.root.rotation.set(0,0,enemy.heading??0);
        const charge=enemy.heliostat.kind==='guard'&&heliostatCanAttack(enemy.age,enemy.lane,enemy.heliostat)?T.MathUtils.clamp(1-(enemy.fire-enemy.age)/HELIOSTAT_GUARD_CHARGE,0,1):0;
        rig.pose(animationTime+enemy.heliostat.slot,p.bank,charge);models[i]=rig.root.getObjectByName('guard-contact')??rig.root;
      }
    },
    dispose(){
      if(disposed)return;disposed=true;restoreRoute?.();restoreUnderworks?.();restoreBoss?.();restoreCrawlers.forEach(restore=>restore());scenery.materials.releaseTextures();backdrop.releaseTextures();
      disposeScene(backdrop.scene);if(scene.environment===environment)scene.environment=null;environment.dispose();
    },
  };
};
