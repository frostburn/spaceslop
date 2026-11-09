import * as T from 'three';
import type { LevelFactory } from '../level';
import { createHeliostatScenery } from '../../heliostat/scenery';
import { createHeliostatBackdrop } from '../../heliostat/backdrop';
import { createHeliostatEnvironment } from '../../heliostat/materials';
import { createHeliostatDrone,createHeliostatGuard,actorPose } from '../../heliostat/actors';
import { heliostatFrame,heliostatMotion,HELIOSTAT_DISTANCE,HELIOSTAT_DRONE_POOL,HELIOSTAT_GUARD_POOL } from '../../heliostat/combat';
import { loadEncounterTexture } from '../../encounter-texture';
import { createBossLaserContact } from '../../laser-contact';
import { disposeScene } from '../dispose';
import type { HeliostatArt } from '../../heliostat/art';
import { BOSS_RECOIL_TIME } from '../../encounters';

export const createLevel:LevelFactory=({plane,scene,signal})=>{
  const root=new T.Group(),scenery=createHeliostatScenery(),backdrop=createHeliostatBackdrop(),environment=createHeliostatEnvironment();
  root.add(scenery.root);scene.environment=environment;
  const drone=createHeliostatDrone(scenery.materials),guard=createHeliostatGuard(scenery.materials);
  const drones=Array.from({length:HELIOSTAT_DRONE_POOL},()=>drone.clone(true));
  const guards=Array.from({length:HELIOSTAT_GUARD_POOL},()=>guard.clone(true));
  const actors=[...drones,...guards].map(root=>({root,pose:actorPose(root)}));for(const r of actors){root.add(r.root);r.root.visible=false;}
  const models:(T.Object3D|undefined)[]=[],contact=createBossLaserContact(plane,scenery.boss.root),art:HeliostatArt={};
  const flags=new Map<T.Mesh,boolean>();let restoreRoute:(()=>void)|undefined,progress=0,disposed=false;
  const size=new T.Vector2();
  return {root,boss:scenery.boss.root,models,stageDistance:HELIOSTAT_DISTANCE,farDistance:600,
    background:0x020814,key:0xffe6c4,keyIntensity:.9,sky:0xb3d5e5,ground:0x2c2219,skyIntensity:1.5,friendlyGlow:1.4,
    ready:Promise.all([
      loadEncounterTexture('heliostatBackdrop',texture=>backdrop.setTexture(texture,true),undefined,signal),
      loadEncounterTexture('ioCeramic',texture=>{art.heliostatCeramic=texture;scenery.materials.setArt(art,true);},1,signal),
    ]),
    applyArmor(texture){const copy=texture.clone();copy.repeat.set(1,1);copy.needsUpdate=true;art.heliostatMetal=copy;scenery.materials.setArt(art,true);},
    orientation:(_time,reveal)=>heliostatFrame(reveal),contacts:[scenery.boss.root,...actors.map(r=>r.root)],
    warmup:[[scenery.root,...actors.map(r=>r.root)]],
    prepare(){
      restoreRoute=scenery.route.prepare(-scenery.world.position.y);scenery.gates.prime();
      root.traverse(o=>{if(o instanceof T.Mesh){flags.set(o,o.frustumCulled);o.frustumCulled=false;}});
    },
    afterWarmup(){for(const[m,flag]of flags)m.frustumCulled=flag;flags.clear();restoreRoute?.();restoreRoute=undefined;},
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
      scenery.update(time,reveal,animationTime,flight.cannonWindup,flight.bossRecoil/BOSS_RECOIL_TIME,flight.bossHealth>0);
      for(const r of actors)r.root.visible=false;models.length=flight.enemies.length;models.fill(undefined);
      let di=0,gi=0;
      for(const[i,enemy]of flight.enemies.entries()){
        if(!enemy.heliostat)continue;
        const index=enemy.heliostat.kind==='guard'?HELIOSTAT_DRONE_POOL+gi++:di++,rig=actors[index];if(!rig)continue;
        const p=heliostatMotion(enemy.age,enemy.lane,enemy.heliostat);
        rig.root.visible=enemy.hp>0;rig.root.position.set(enemy.x,enemy.y,0);rig.root.rotation.set(0,0,enemy.heading??0);
        rig.pose(animationTime+enemy.heliostat.slot,p.bank);models[i]=rig.root;
      }
    },
    dispose(){
      if(disposed)return;disposed=true;restoreRoute?.();scenery.materials.releaseTextures();backdrop.releaseTextures();
      disposeScene(backdrop.scene);if(scene.environment===environment)scene.environment=null;environment.dispose();
    },
  };
};
