import * as T from 'three';
import type {LevelFactory} from '../level';
import {createBossLaserContact} from '../../laser-contact';
import {loadEncounterTexture} from '../../encounter-texture';
import {createScoutRig} from '../../ship-rigs';
import {shipBurners,poseBurners} from '../../burners';
import {SUMMER_DISTANCE,SUMMER_END,summerScroll,summerRiver,mammothSites} from '../../summer/layout';
import {SUMMER_AIR_POOL,SUMMER_HYDRA_POOL,HYDRA_BODY_Y,summerMotion} from '../../summer/combat';
import {createMammothAssets,createMammoth} from '../../summer/mammoths';
import {createHydraAssets,createRiverHydra} from '../../summer/hydra';
import {createSummerTerrain} from '../../summer/terrain';
import {createSummerIce} from '../../summer/ice';
import {createLotusPalace} from '../../summer/palace';
import {batchAircraft,weatherAircraft} from '../../summer/aircraft';
import {createSummerClouds} from '../../summer/clouds';
import {createLowWisps} from '../../summer/wisps';
import {createVortexDrone} from '../../summer/vortex-rig';
import {VORTEX_POOL} from '../../summer/vortex';

function createJellyDonuts(count: number) {
  const profile = [
    [.21, -.03], [.25, -.095], [.50, -.12], [.58, -.08], [.61, -.025],
    [.61, .025], [.58, .085], [.52, .11], [.50, .098], [.48, .116],
    [.36, .126], [.29, .119], [.25, .087], [.21, .03], [.21, -.03],
  ].map(([radius, height]) => new T.Vector2(radius, height));
  const segments = 72;
  const geometry = new T.LatheGeometry(profile, segments).rotateX(Math.PI / 2);
  const silver = new T.Color(0xb9c5cf), darkSteel = new T.Color(0x323e4c);
  const band = new T.Color();
  const colors: number[] = [];
  for (let i = 0; i <= segments; i++) {
    // Three inset marks in the face make the circular disc's spin visible.
    const mark = 1 - T.MathUtils.smoothstep(Math.abs(i % 24 - 12), 2, 4);
    for (const [radius, height] of profile) {
      const groove = radius === .50 && height > 0;
      const inset = height > .09 ? mark * .9 : 0;
      band.copy(silver).lerp(darkSteel, Math.max(groove ? .52 : 0, inset));
      colors.push(band.r, band.g, band.b);
    }
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  const rotor = new T.Mesh(geometry, new T.MeshStandardMaterial({
    vertexColors: true, metalness: .67, roughness: .31,
  }));
  rotor.name = 'jelly-donut-disc';
  const lens = new T.Mesh(new T.SphereGeometry(.22, 24, 12), new T.MeshStandardMaterial({
    color: 0xde1531, emissive: 0xd70824, emissiveIntensity: .62, roughness: .29,
  }));
  lens.name = 'jelly-donut-core';
  lens.scale.z = .53;
  lens.position.z = .047;
  return Array.from({ length: count }, () => {
    const root = new T.Group();
    root.name = 'jelly-donut';
    const disc = rotor.clone();
    root.add(disc, lens.clone());
    return { root, disc };
  });
}
export const createLevel:LevelFactory=({plane,signal})=>{
  const root=new T.Group(),world=new T.Group();root.name='summer-thaw-level';root.add(world);
  const clouds=createSummerClouds(),wisps=createLowWisps(),terrain=createSummerTerrain(clouds.state),ice=createSummerIce(),palace=createLotusPalace(clouds.state),mammothAssets=createMammothAssets(),hydraAssets=createHydraAssets();
  world.add(terrain.root,ice.root,palace.root,clouds.root,wisps.root);
  const herd=mammothSites.map((site,i)=>{const rig=createMammoth(mammothAssets);rig.root.position.set(site.x,site.y,-17.1);rig.root.rotation.z=site.angle;rig.root.scale.set(site.size*(i%2?-1:1),site.size,site.size);world.add(rig.root);return{rig,site};});
  const scout=weatherAircraft(batchAircraft(createScoutRig()));
  const scouts=Array.from({length:SUMMER_AIR_POOL/2},()=>{const root=scout.clone(true);return{root,burners:shipBurners(root)};});
  const donuts=createJellyDonuts(SUMMER_AIR_POOL/2);
  const hydras=Array.from({length:SUMMER_HYDRA_POOL},()=>createRiverHydra(hydraAssets));
  const vortices=Array.from({length:VORTEX_POOL},()=>createVortexDrone());
  const enemyRoots=[...scouts,...donuts,...hydras,...vortices].map(r=>r.root);
  root.add(...enemyRoots);enemyRoots.forEach(enemy=>enemy.visible=false);
  const boss=createRiverHydra(hydraAssets,true);boss.root.position.set(0,SUMMER_END+4.2,-12);world.add(boss.root);
  const contact=createBossLaserContact(plane,boss.root),models:(T.Object3D|undefined)[]=[];
  let restores:(()=>void)[]=[],disposed=false;const flags=new Map<T.Mesh,boolean>();
  const ready=Promise.all([loadEncounterTexture('summerMammoth',mammothAssets.setAtlas,undefined,signal),loadEncounterTexture('summerIce',ice.setAtlas,undefined,signal),loadEncounterTexture('summerHydra',hydraAssets.setAtlas,undefined,signal),loadEncounterTexture('summerLotusFlanks',palace.lotuses.setFlanks,undefined,signal),loadEncounterTexture('summerLotusWall',palace.lotuses.setWall,undefined,signal)]);
  return{root,boss:boss.root,models,ready,stageDistance:SUMMER_DISTANCE,farDistance:440,fixedCamera:true,
    background:0xb5cfc9,key:0xffedd0,keyIntensity:2.1,sky:0xd5e9ec,ground:0x728153,skyIntensity:1.6,friendlyGlow:1.4,
    orientation:()=>({pitch:0,bank:0,viewPitch:0}),
    contacts:[boss.root,...enemyRoots],
    warmup:[[world,...enemyRoots]],
    prepare(){restores=[terrain.prime(),ice.prime(),wisps.prime()];root.traverse(o=>{if(o instanceof T.Mesh){flags.set(o,o.frustumCulled);o.frustumCulled=false;}});const states=herd.map(h=>[h.rig.root.position.y,h.rig.root.visible] as const);herd.forEach(h=>{h.rig.root.position.y=0;h.rig.root.visible=true;});restores.push(()=>herd.forEach((h,i)=>{h.rig.root.position.y=states[i][0];h.rig.root.visible=states[i][1];}));},
    afterWarmup(){restores.forEach(restore=>restore());restores=[];for(const[m,cull]of flags)m.frustumCulled=cull;flags.clear();},
    contact:(x,d)=>contact(x,d),
    update({flight,time,animationTime,victory}){
      const scroll=summerScroll(time);world.position.y=-scroll;clouds.update(scroll,animationTime);wisps.update(scroll,animationTime);terrain.update(scroll,animationTime);ice.update(scroll,animationTime);palace.update(animationTime);
      for(const {rig,site}of herd){rig.root.visible=Math.abs(site.y-scroll)<29;rig.pose(animationTime,site.y*.13);}
      boss.root.visible=flight.bossHealth>0;boss.pose(time,flight.cannonWindup,0,flight.summerHydra,flight.summerBossTime+(victory?.time??0));
      for(const enemy of enemyRoots)enemy.visible=false;models.length=flight.enemies.length;models.fill(undefined);
      let scoutIndex=0,donutIndex=0,hi=0,vi=0;
      for(const[i,enemy]of flight.enemies.entries()){
        if(!enemy.summer)continue;
        if(enemy.summer.kind==='hydra'){const rig=hydras[hi++];if(!rig)continue;rig.root.visible=enemy.hp>0;rig.root.position.set(enemy.x,enemy.y,0);rig.pose(time,Math.max(0,1-(enemy.fire-enemy.age)/.7),summerRiver(enemy.y+scroll+HYDRA_BODY_Y)-enemy.x,enemy.hydra,time);models[i]=rig.root;continue;}
        if(enemy.summer.kind==='vortex'){const rig=vortices[vi++];if(!rig)continue;rig.root.visible=enemy.hp>0;rig.root.position.set(enemy.x,enemy.y,0);rig.pose(enemy.age,enemy.summer.mirror);models[i]=rig.root;continue;}
        const rig=enemy.summer.kind==='drone'?donuts[donutIndex++]:scouts[scoutIndex++];if(!rig)continue;
        rig.root.visible=enemy.hp>0;rig.root.position.set(enemy.x,enemy.y,0);
        const {bank}=summerMotion(enemy.age,enemy.lane,enemy.summer,time);
        rig.root.rotation.set(0,bank,'disc' in rig?0:Math.PI);
        if('disc' in rig)rig.disc.rotation.z=1.65*animationTime*enemy.summer.mirror+.55*enemy.summer.slot;
        else poseBurners(rig.burners,animationTime,.6);
        models[i]=rig.root;
      }
    },
    dispose(){if(disposed)return;disposed=true;restores.forEach(r=>r());restores=[];},
  };
};
