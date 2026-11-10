import * as T from 'three';
import type {LevelFactory} from '../level';
import {BOSS_CANNON_X} from '../../game';
import {BOSS_RECOIL_TIME} from '../../encounters';
import {createInterceptorRig,setFeatherTexture} from '../../encounter-rigs';
import {setFaceTexture} from '../../creature-faces';
import {loadEncounterTexture} from '../../encounter-texture';
import {createBossLaserContact} from '../../laser-contact';
import {lightUniforms} from '../../biolume/surface';
import {createGrovePlates} from '../../biolume/plates';
import {createGroveLighting} from '../../biolume/lighting';
import {createGliderRig} from '../../biolume/actors';
import {createSeedPods} from '../../biolume/modules';
import {GROVE_ENEMY_POOL,groveEnemySize,groveMotion} from '../../biolume/combat';
import {GROVE_DISTANCE,GROVE_BOSS_SCALE,GROVE_POD_POOL,grovePods,groveSitePoint,groveBossPoint} from '../../biolume/route';

export const createLevel:LevelFactory=({plane,signal})=>{
  const root=new T.Group();root.name='lantern-grove-level';
  const uniforms=lightUniforms(),plates=createGrovePlates(uniforms,signal),lighting=createGroveLighting(uniforms);
  const pods=createSeedPods(uniforms.emissionGain,GROVE_POD_POOL);
  const gains=Array.from({length:GROVE_ENEMY_POOL},()=>({value:1})),gliders=gains.map(g=>createGliderRig(g));
  const boss=createInterceptorRig(BOSS_CANNON_X);boss.root.name='grove-prototype-draconian';boss.root.scale.setScalar(GROVE_BOSS_SCALE);boss.root.visible=false;
  root.add(plates.root,lighting.root,...pods.meshes,...gliders.map(r=>r.root),boss.root);
  const models:(T.Object3D|undefined)[]=[],media:T.Texture[]=[];
  let disposed=false,restores:(()=>void)[]=[];
  const ready=Promise.all([
    plates.ready,
    loadEncounterTexture('biolumeEnemy',map=>{media.push(map);for(const rig of gliders)rig.raster.setArt(map);},undefined,signal),
    loadEncounterTexture('biolumePods',map=>{media.push(map);pods.setArt(map);},undefined,signal),
    loadEncounterTexture('feathers',setFeatherTexture,undefined,signal),
    loadEncounterTexture('scales',map=>{setFaceTexture(map);boss.setScaleTexture(map);},undefined,signal),
  ]).then(results=>[...new Set([...results.flat(),...plates.layers.flat().map(s=>s.fallback),...gliders.map(r=>r.raster.mesh.material.map!),pods.meshes[0].material.map!])]);
  const particleGeometry=new T.BufferGeometry(),positions=new Float32Array(72*3);
  for(let i=0;i<72;i++){positions[i*3]=(Math.sin(i*127.1)*.5+.5)*8-4;positions[i*3+1]=(i/72-.5)*22;positions[i*3+2]=.8+Math.sin(i)*.4;}
  particleGeometry.setAttribute('position',new T.BufferAttribute(positions,3));
  const motes=new T.Points(particleGeometry,new T.PointsMaterial({color:0x83edb6,size:.04,transparent:true,opacity:.5,depthWrite:false,blending:T.AdditiveBlending}));root.add(motes);
  return{root,boss:boss.root,models,ready,stageDistance:GROVE_DISTANCE,fixedCamera:true,orientation:()=>({pitch:0,bank:0,viewPitch:0}),
    background:0,keyIntensity:0,skyIntensity:0,toneMapping:T.ACESFilmicToneMapping,exposure:1.1,
    applyArmor:boss.setArmorTexture,
    contacts:[boss.root,...gliders.map(r=>r.root)],warmup:[[plates.root,...pods.meshes,motes],[boss.root,...gliders.map(r=>r.root)]],
    prepare(){plates.prime(true);restores=gliders.map(r=>r.prime());},afterWarmup(){plates.prime(false);restores.forEach(r=>r());restores=[];},
    contact:createBossLaserContact(plane,boss.root),
    update(frame){
      const {flight:f,time,reveal,animationTime}=frame;plates.update(time);
      let pi=0;
      for(const mesh of pods.meshes)mesh.visible=false;
      for(const site of grovePods){const p=groveSitePoint(site,time,.3);if(Math.abs(p.y)>10)continue;
        const mesh=pods.meshes[pi++];if(!mesh)break;mesh.visible=true;mesh.scale.setScalar(site.size);mesh.position.set(p.x,p.y+.49*site.size,p.z);
        mesh.rotation.z=.025*Math.sin(animationTime*.8+site.at);
      }
      boss.root.visible=reveal>0&&f.bossHealth>0;
      const b=groveBossPoint(reveal);boss.root.position.set(b.x,b.y,b.z);
      if(boss.root.visible)boss.pose(reveal,f.cannonWindup,f.exposedCannonX,f.firedCannonX,f.bossRecoil/BOSS_RECOIL_TIME);
      for(const r of gliders)r.root.visible=false;models.length=f.enemies.length;models.fill(undefined);let gi=0;
      for(const[i,enemy]of f.enemies.entries()){
        if(!enemy.grove||enemy.hp<=0)continue;const rig=gliders[gi];if(!rig)break;
        gains[gi++].value=1+Math.max(0,1-(enemy.fire-enemy.age)/.65);
        rig.root.visible=true;rig.root.position.set(enemy.x,enemy.y,.1);rig.root.rotation.set(0,groveMotion(enemy.age,enemy.lane,enemy.grove).bank,enemy.heading??0);rig.root.scale.setScalar(groveEnemySize(enemy.grove));rig.pose(enemy.age);models[i]=rig.root;
      }
      motes.position.set(.1*Math.sin(animationTime*.3),-.5*Math.sin(animationTime*.16),0);
      lighting.update(frame,boss.root);
    },
    dispose(){if(disposed)return;disposed=true;plates.dispose();gliders.forEach(r=>r.release());pods.release();for(const t of new Set(media))t.dispose();restores.forEach(r=>r());restores=[];},
  };
};
