import {createBoulevardArch} from './boulevard-arch';
import {createBoulevardScenery} from './boulevard-scenery';
import {createHovercar,createPursuitCruiser} from './boulevard-rigs';
import {boulevardBossPoint,BOULEVARD_PITCH,boulevardSection} from './boulevard';
import { createAmbusherMaterials, createPoolAmbusher } from './preserve-ambusher-rig';
import { ambusherStudy, AMBUSHER_DURATION, AMBUSHER_FALL } from './preserve-ambusher';
import { createPreserveUv, preserveLighting } from './preserve-lighting';
import { createFlyerAssets, createPreserveFlyer } from './preserve-flyer-rig';
import { flyerMotion, type FlyerCourse } from './preserve-flyer';
import {createVentBoss} from './vent-boss';
import {crabSmooth} from './vent-crab';
import {createFaunaAssets,createWormAssets,createVentShrimp,createVentWorm} from './vent-fauna-rig';
import {SHRIMP_FIRST_FIRE,SHRIMP_INTERVAL,WORM_FIRST_ATTACK,WORM_INTERVAL} from './vent-fauna';
import {createMortarAssets,createVentMortar} from './vent-mortar-rig';
import {MORTAR_FIRST_FIRE,MORTAR_INTERVAL} from './vent-mortar';
import {createCrucible,createSlag} from './io-crucible-rig';
import {CRUCIBLE_FIRST_POUR,CRUCIBLE_POUR_INTERVAL,crucibleValve} from './io-crucible';
import {setIoRockTexture,setIoCeramicTexture} from './io-materials';
import {createCaldera,createSkipper} from './io-rigs';
import {createIoBurnerStudy} from './io-burner';
import { createCicada } from './cicada-rig';
import { createCicadaScout, createCentipedeSection } from './titan-insect-rigs';
import { bindCentipede, severCentipede, stepCentipedes, CENTIPEDE_SPACING, type CentipedePart } from './centipede';
import { createMarineRig, createLeviathan, setMarineTexture } from './marine-rigs';
import { marineMotion, leviathanMotion, LEVIATHAN_INTERVAL } from './marine';
import { loadEncounterTexture } from './encounter-texture';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAntRig, createHiveGuardian } from './ant-rigs';
import { poseBurners, shipBurners } from './burners';
import { createInterceptorRig, createRaptorRig } from './encounter-rigs';
import { loadEncounterTextures } from './rendering/workshop-textures';
import {
  BOSS_FIRE_AT, BOSS_RECOIL_TIME, BOSS_VOLLEY_INTERVAL, BOSS_WINDUP_AT, RAPTOR_FLARE_END, raptorFlight,
} from './encounters';
import { BOSS_CANNON_X, TRANSITION_TIME } from './game';
import { createMushroomCluster } from './hive-fungi';
import { createIceScenery } from './ice-scenery';
import { createPreserveScenery } from './preserve-scenery';
import { createGroundskeeper } from './groundskeeper-rig';
import { groundskeeperAttack, GROUNDSKEEPER_CYCLE } from './groundskeeper';
import { PRESERVE_APPROACH, PRESERVE_SPEED, preserveSections } from './preserve-layout';
import { levels } from './levels';
import { ICE_DURATION, iceSection } from './ice-layout';
import { createDroneRig, createFighterRig, createScoutRig } from './ship-rigs';
import { createWingPod } from './wing-pod';
import type { WingWeapon } from './wing';
import { createPowerupGraphic } from './powerup-graphics';
import { createContinuousLaser, createProjectileBatch, projectileNames, type ProjectileKind } from './projectile-graphics';
import './workshop.css';

function element<T extends HTMLElement>(id: string) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

function openWorkshop(renderer: T.WebGLRenderer, canvas: HTMLCanvasElement) {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(39, 1, 0.05, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  scene.background = new T.Color(0x0b1020);
  const light = new T.DirectionalLight(0xb9e8ff, 2.7);
  light.position.set(3, 5, 6);
  const fill = new T.HemisphereLight(0xd6e3ff, 0x514873, 1.75);
  const uv = createPreserveUv(); scene.add(light, fill, uv, uv.target);

  const raptor = createRaptorRig();
  const interceptor = createInterceptorRig(BOSS_CANNON_X);
  const interceptorBurners = shipBurners(interceptor.root);
  const ant = createAntRig();
  ant.root.rotation.z = Math.PI;
  const soldier = createAntRig('soldier');
  soldier.root.rotation.z = Math.PI;
  const guardian = createHiveGuardian(BOSS_CANNON_X);
  raptor.root.rotation.z = Math.PI;
  const scout = createScoutRig();
  scout.rotation.z = Math.PI;

  function shipAsset(root: T.Group) {
    const burners = shipBurners(root);
    poseBurners(burners, 1, 1);
    return {
      root,
      duration: 2,
      bounds: new T.Box3().setFromObject(root),
      pose(time: number) {
        const throttle = Math.sin(time * Math.PI / 2) ** 2;
        poseBurners(burners, time, throttle);
        return throttle > 0.6 ? 'boost' : 'cruise';
      },
    };
  }

  function weaponAsset(weapon: WingWeapon) {
    const pod = createWingPod(weapon);
    return {
      root: pod.root,
      duration: 2,
      pose(time: number) {
        const recoil = weapon === 'laser' ? 0 : 1 - T.MathUtils.smoothstep(time, 1.3, 1.44);
        const firing = time >= 1.3 && time < (weapon === 'laser' ? 1.88 : 1.44);
        const charge = weapon === 'omega' ? T.MathUtils.smoothstep(time, 0.82, 1.3) * recoil : 0;
        pod.pose(time, 0.38 + 0.52 * Math.sin(time * Math.PI / 2) ** 2,
          firing ? (weapon === 'laser' ? 0.72 : recoil) : charge, firing ? recoil : 0);
        return firing ? 'fire' : charge > 0 ? 'charge' : 'cruise';
      },
    };
  }

  function bossAsset(rig: typeof guardian, burners?: T.Mesh[]) {
    return {
      root: rig.root,
      duration: TRANSITION_TIME + BOSS_VOLLEY_INTERVAL + BOSS_FIRE_AT + BOSS_RECOIL_TIME,
      pose(time: number) {
        const reveal = Math.min(1, time / TRANSITION_TIME);
        const eased = reveal ** 2 * (3 - 2 * reveal);
        const fight = Math.max(0, time - TRANSITION_TIME);
        const cycle = Math.floor(fight / BOSS_VOLLEY_INTERVAL);
        const elapsed = fight % BOSS_VOLLEY_INTERVAL;
        const cannon = cycle % 2 === 0 ? -BOSS_CANNON_X : BOSS_CANNON_X;
        const fired = elapsed >= BOSS_FIRE_AT;
        const windup = fired ? 0 : Math.max(0, (elapsed - BOSS_WINDUP_AT) / (BOSS_FIRE_AT - BOSS_WINDUP_AT));
        const recoil = fired ? Math.max(0, 1 - (elapsed - BOSS_FIRE_AT) / BOSS_RECOIL_TIME) : 0;
        rig.pose(eased, windup, fired ? -cannon : cannon, fired ? cannon : 0, recoil);
        if (burners) poseBurners(burners, time, 0.42 + 0.48 * Math.sin(eased * Math.PI));
        if (reveal < 1) return 'reveal';
        if (recoil > 0) return 'recoil';
        return windup > 0 ? 'windup' : 'ready';
      },
    };
  }

  function projectileAsset(kind: ProjectileKind) {
    const batch = createProjectileBatch(kind);
    return { root: batch.root, duration: 2, pose(time: number) {
      batch.draw([{ x: 0, y: 0, z: 0, vx: 0, vy: 15, vz: 0 }], time);
      return projectileNames[kind];
    } };
  }

  function pickupAsset(weapon: WingWeapon) {
    const pickup = createPowerupGraphic();
    return { root: pickup.root, duration: 3, pose(time: number) { pickup.pose(weapon, time); return 'beacon'; } };
  }
  const beam = createContinuousLaser();
  const iceField = createIceScenery();

  const hunter=createMarineRig('ichthyosaur'),sweeper=createMarineRig('plesiosaur'),leviathan=createLeviathan();
  hunter.root.rotation.z=sweeper.root.rotation.z=Math.PI;
  const cicada=createCicada();
  const cicadaScout = createCicadaScout();
  cicadaScout.root.rotation.z = Math.PI;
  const centipedeRoot = new T.Group(), centipede = Array.from({ length: 7 }, createCentipedeSection);
  for (const part of centipede) centipedeRoot.add(part.root);
  const caldera=createCaldera(),skipper=createSkipper();skipper.root.rotation.z=Math.PI;
  const burner=createIoBurnerStudy(),crucible=createCrucible(),slag=createSlag();
  const mortarAssets=createMortarAssets(),mortar=createVentMortar(mortarAssets);
  void loadEncounterTexture('ventMortar',mortarAssets.setAtlas);
  const faunaAssets=createFaunaAssets(),shrimp=createVentShrimp(faunaAssets),wormAssets=createWormAssets(),worm=createVentWorm(wormAssets);
  void loadEncounterTexture('ventFauna',faunaAssets.setAtlas);
  void loadEncounterTexture('ventWorm',wormAssets.setAtlas);
  const crab=createVentBoss();void loadEncounterTexture('ventCrab',crab.setAtlas);
  const ambusherMaterials=createAmbusherMaterials(),ambusher=createPoolAmbusher(ambusherMaterials),fallenAmbusher=createPoolAmbusher(ambusherMaterials);
  void loadEncounterTexture('scales',ambusherMaterials.setScales);
  const preserve = createPreserveScenery();
  const flyerAssets = createFlyerAssets(), flyer = createPreserveFlyer(flyerAssets), flockRoot = new T.Group();
  const flock = Array.from({length:4},()=>createPreserveFlyer(flyerAssets));flockRoot.add(...flock.map(r=>r.root));
  const loopCourse:FlyerCourse={formation:'loop',mirror:1,slot:0,count:4};
  void loadEncounterTexture('feathers',flyerAssets.setFeathers);
  void loadEncounterTexture('scales',flyerAssets.setScales);
  const keeper = createGroundskeeper(), keeperPreview = new T.Group();
  keeperPreview.rotation.x = -Math.PI / 2; keeperPreview.position.y = -7; keeperPreview.add(keeper.root);
  void loadEncounterTexture('feathers', texture => { keeper.setFeatherTexture(texture); preserve.boss.setFeatherTexture(texture); });
  void loadEncounterTexture('scales', texture => { keeper.setScaleTexture(texture); preserve.boss.setScaleTexture(texture); });
  const boulevard=createBoulevardScenery(),cruiser=createPursuitCruiser(boulevard.materials),hovercar=createHovercar(boulevard.materials),boulevardPreview=new T.Group(),routeCruiser=createPursuitCruiser(boulevard.materials);
  boulevardPreview.add(boulevard.root,routeCruiser.root);cruiser.root.rotation.x=-BOULEVARD_PITCH;
  void loadEncounterTexture('boulevardRoad',boulevard.road.setMap);
  void loadEncounterTexture('boulevardFacades',boulevard.facades.setAtlas);
  const boulevardArch=createBoulevardArch(boulevard.materials);boulevardArch.root.rotation.x=-Math.PI/2;
  const assets = {
    boulevard_arch:{root:boulevardArch.root,bounds:new T.Box3(new T.Vector3(-5,-3.2,-1),new T.Vector3(5,3.6,1)),duration:1,pose:()=> 'curved chrome shell / luminous triangular lattice'},
    boulevard_route:{root:boulevardPreview,duration:125,bounds:new T.Box3(new T.Vector3(-5,-8,-5),new T.Vector3(5,8,1)),pose(time:number){const reveal=T.MathUtils.smoothstep(time,100,107);boulevard.update(time,reveal,time);const p=boulevardBossPoint(time,reveal);routeCruiser.root.position.set(p.x,p.y,p.z);routeCruiser.root.rotation.x=-BOULEVARD_PITCH*reveal;routeCruiser.pose(time,Math.max(0,Math.sin(time*2)),0);return boulevardSection(time);}},
    pursuit_cruiser:{root:cruiser.root,duration:6.8,pose(time:number){cruiser.pose(time,T.MathUtils.smoothstep(time%3.4,.55,1.55),time%3.4>1.55?Math.max(0,1-(time%3.4-1.55)/.24):0);return 'rotary cannons / exposed lattice / cyan core';}},
    hovercar:{root:hovercar.root,duration:3.4,pose:()=> 'solid core / luminous cage'},
    microraptor:{root:flyer.root,duration:5.6,pose(time:number){const p=flyerMotion(time,0,{...loopCourse,formation:'swoop'});const stroke=flyer.pose(time,{...loopCourse,formation:'swoop'},p.bank);return stroke.tuck>.1?'tucked swoop':stroke.burst>.1?'burst wingbeats':'four-wing glide';}},
    microraptor_flock:{root:flockRoot,duration:12,bounds:new T.Box3(new T.Vector3(-3.5,-9,-1),new T.Vector3(3.5,10,1)),pose(time:number){flock.forEach((r,i)=>{const course={...loopCourse,slot:i},p=flyerMotion(time,0,course);r.root.position.set(p.x,p.y,0);r.pose(time,course,p.bank,p.heading);});return 'staggered train · tangent-continuous loop';}},
    pool_ambusher:{root:ambusher.root,duration:AMBUSHER_DURATION+2.5,bounds:new T.Box3(new T.Vector3(-3.5,-6.2,-4),new T.Vector3(3.5,3.7,1.5)),pose(time:number){const p=ambusherStudy(time);ambusher.pose(p);return p.phase;}},
    pool_ambusher_defeat:{root:fallenAmbusher.root,duration:2.5+AMBUSHER_FALL+2,bounds:new T.Box3(new T.Vector3(-3.5,-6.2,-4),new T.Vector3(3.5,3.7,1.5)),pose(time:number){const p=ambusherStudy(time,true);fallenAmbusher.pose(p);return p.dead?'defeated · sideways fall':p.phase;}},
    groundskeeper: { root: keeperPreview, duration: GROUNDSKEEPER_CYCLE * 4,
      bounds: new T.Box3(new T.Vector3(-8, -8, -5), new T.Vector3(8, 9, 6)),
      pose(time: number) { return keeper.pose(time).kind; } },
    preserve_section: { root: preserve.root, duration: levels.preserve.duration + PRESERVE_APPROACH + GROUNDSKEEPER_CYCLE * 4,
      bounds: new T.Box3(new T.Vector3(-5, -8, -6), new T.Vector3(5, 8, 1)),
      pose(time: number) { const rise=T.MathUtils.smoothstep(time, levels.preserve.duration, levels.preserve.duration+PRESERVE_APPROACH); preserve.update(time, rise); const fight=time-levels.preserve.duration-PRESERVE_APPROACH; preserve.boss.pose(fight); return time<levels.preserve.duration?[...preserveSections].reverse().find(section=>section.y<=time*PRESERVE_SPEED)!.name:rise<1?'observation rotunda approach':groundskeeperAttack(fight).kind; } },
    vent_crab:{root:crab.root,duration:12,bounds:new T.Box3(new T.Vector3(-6,-5,-5),new T.Vector3(6,3.5,1.5)),pose(time:number){const left=crabSmooth((time-3)/.8),right=crabSmooth((time-6)/.8),opening=crabSmooth((time-6)/.8),target=time<3?-2.4:time<6?2.4:0;crab.pose(1,Math.max(0,Math.sin(time*3)),target,target,Math.max(0,Math.sin(time*3+1))*.2,108+time,[left,right],opening);return time<3?'crusher charge / barnacle colonies':time<6?'crusher disabled / cutter charge':'both claws disabled / gill chamber';}},
    vent_shrimp:{root:shrimp.root,duration:6,pose(time:number){const next=SHRIMP_FIRST_FIRE+Math.max(0,Math.floor((time-SHRIMP_FIRST_FIRE)/SHRIMP_INTERVAL)+1)*SHRIMP_INTERVAL;shrimp.pose(time,next);return 'swimmerets / abdomen / paired pincers';}},
    vent_worm:{root:worm.root,duration:WORM_INTERVAL+WORM_FIRST_ATTACK,bounds:new T.Box3(new T.Vector3(-2,-10,-.1),new T.Vector3(2,1.5,.6)),pose(time:number){const next=WORM_FIRST_ATTACK+Math.max(0,Math.floor((time-WORM_FIRST_ATTACK)/WORM_INTERVAL)+1)*WORM_INTERVAL;const p=worm.pose(time,next,.12,8.5,.8);return p.phase==='hidden'?'concealed in hole':p.phase==='windup'?'locked aim / warning':p.phase==='retreat'?'withdrawing into hole':'body lunge / bite';}},
    vent_mortar:{root:mortar.root,duration:6,pose(time:number){const next=MORTAR_FIRST_FIRE+Math.max(0,Math.floor((time-MORTAR_FIRST_FIRE)/MORTAR_INTERVAL)+1)*MORTAR_INTERVAL;const p=mortar.pose(time,next,Math.sin(time*.5)*.6);return p.recoil>0?'pearl volley / recoil':p.charge>0?'shell opening / charge':'tracking / folded shell';}},
    crucible: {root:crucible.root,duration:7.2,pose(time:number){const next=CRUCIBLE_FIRST_POUR+Math.max(0,Math.floor((time-CRUCIBLE_FIRST_POUR)/CRUCIBLE_POUR_INTERVAL)+1)*CRUCIBLE_POUR_INTERVAL;crucible.pose(time,crucibleValve(time,next));return 'valve charge / molten pour';}},
    slag: {root:slag.root,duration:2,pose(time:number){slag.pose(time);return time<.9?'molten droplet':'cooled · shootable slag';}},
    burner: {root:burner.root,duration:6,bounds:new T.Box3(new T.Vector3(-.6,-.6,0),new T.Vector3(.6,.6,3.6)),pose:burner.pose},
    caldera: {root:caldera.root,duration:8,bounds:new T.Box3(new T.Vector3(-7,-7,-4),new T.Vector3(7,7.5,5)),pose(time:number){const sag=T.MathUtils.smoothstep(time,3,4.2);caldera.pose(time,sag,time>=3,0);return time<3?'braced · dredging wheel':'failed support · chassis sag';}},
    skipper: {root:skipper.root,duration:3,pose(time:number){skipper.pose(time,Math.sin(time*2)*.16,(1+Math.sin(time*5))*.5);return 'corrective jets';}},
    cicada_scout: { root: cicadaScout.root, duration: 3, pose(time: number) { cicadaScout.pose(time, Math.sin(time * 2) * .25); return 'wingbeat'; } },
    centipede: { root: centipedeRoot, duration: 4,
      bounds: new T.Box3(new T.Vector3(-5, -3, -.5), new T.Vector3(5, 4, 1)),
      pose(time: number) {
        const parts: CentipedePart[] = centipede.map((_, i) => ({ x: 0, y: -1.6 + i * CENTIPEDE_SPACING, hp: 2, heading: Math.PI }));
        bindCentipede(parts);
        // Replay the same chain solver so timeline scrubbing includes an actual mid-body cut.
        for (let t = 0; t < time; t += 1 / 60) {
          if (t >= 1.4 && parts[3].hp > 0) { parts[3].hp = 0; severCentipede(parts[3]); }
          stepCentipedes(parts, Math.min(1 / 60, time - t));
        }
        parts.forEach((part, i) => {
          const rig = centipede[i], link = part.centipede!;
          rig.root.visible = part.hp > 0; rig.root.position.set(part.x, part.y + Math.min(time, 1.4) * 2.15, 0);
          rig.root.rotation.z = -(part.heading ?? Math.PI); rig.pose(time, link.slot, link.originalHead, Boolean(link.chain.escape));
        });
        return time < 1.4 ? 'metachronal crawl' : 'mid-section severed · opposite escapes';
      } },
    cicada: {root:cicada.root,duration:7.2,pose(time:number){cicada.pose(1,Math.max(0,Math.sin(time*2)),time<3.6?-2.4:2.4,0,0,time);return 'wingbeat and thorax vents';}},
    ichthyosaur: {root:hunter.root,duration:5,pose(time:number){hunter.pose(time,marineMotion('ichthyosaur',time,0).bank);return time>1.25?'hunting bank':'cruise';}},
    plesiosaur: {root:sweeper.root,duration:5,pose(time:number){sweeper.pose(time,marineMotion('plesiosaur',time,0).bank,Math.max(0,1-Math.abs(time-1.8)/.55));return 'four-flipper stroke';}},
    leviathan: {root:leviathan.root,duration:LEVIATHAN_INTERVAL*2,pose(time:number){leviathan.pose(1,0,0,0,0,time);return leviathanMotion(time).windup>0?'jaw windup':'pursuit';}},
    ice_field: { root: iceField.root, duration: ICE_DURATION + 30,
      bounds: new T.Box3(new T.Vector3(-7, -8, -7), new T.Vector3(7, 8, 3)),
      pose(time: number) { iceField.update(Math.min(1, time / ICE_DURATION), time > ICE_DURATION ? 1 : 0, time);
        return time > ICE_DURATION ? 'Boss pursuit' : iceSection(time / ICE_DURATION); } },
    fighter: shipAsset(createFighterRig().root),
    scout: shipAsset(scout),
    drone: shipAsset(createDroneRig()),
    homing: weaponAsset('homing'),
    cannon: weaponAsset('cannon'),
    laser: weaponAsset('laser'),
    omega: weaponAsset('omega'),
    ammo_ship: projectileAsset('ship'), ammo_drone: projectileAsset('drone'),
    ammo_homing: projectileAsset('homing'), ammo_cannon: projectileAsset('cannon'),
    ammo_omega: projectileAsset('omega'), ammo_hostile: projectileAsset('hostile'), ammo_spore: projectileAsset('spore'), ammo_brine: projectileAsset('brine'),
    beam_laser: { root: beam.root, duration: 2, pose(time: number) {
      beam.root.visible = true; beam.draw({ x: 0, y: -1 }, { x: 0, y: 1 }, 0.8, time, true); return 'contact';
    } },
    pickup_homing: pickupAsset('homing'), pickup_cannon: pickupAsset('cannon'),
    pickup_laser: pickupAsset('laser'), pickup_omega: pickupAsset('omega'),
    ant: {
      root: ant.root,
      duration: 3.1,
      pose(time: number) {
        const windup = T.MathUtils.clamp((time - 2.55) / 0.55, 0, 1);
        ant.pose(time, windup);
        return windup > 0 ? 'spore windup' : 'scuttle';
      },
    },
    soldier: {
      root: soldier.root,
      duration: 3.1,
      pose(time: number) {
        const windup = T.MathUtils.clamp((time - 2.55) / 0.55, 0, 1);
        soldier.pose(time, windup);
        return windup > 0 ? 'spore windup' : 'scuttle';
      },
    },
    mushroom: { root: createMushroomCluster(), duration: 0, pose: () => 'rooted' },
    guardian: bossAsset(guardian),
    raptor: {
      root: raptor.root,
      duration: RAPTOR_FLARE_END,
      pose(time: number) {
        raptor.pose(time);
        return raptorFlight(time).pose;
      },
    },
    interceptor: bossAsset(interceptor, interceptorBurners),
  };
  void loadEncounterTexture('marine',setMarineTexture,1);
  void loadEncounterTexture('ioBasalt',setIoRockTexture,1);
  void loadEncounterTexture('ioCeramic',setIoCeramicTexture,1);
  void loadEncounterTextures(interceptor, raptor, Object.values(assets).map(({ root }) => root));
  for (const asset of Object.values(assets)) scene.add(asset.root);
  const assetSelect = element<HTMLSelectElement>('asset');
  const sector = element<HTMLSelectElement>('sector');
  const groups = Array.from(assetSelect.querySelectorAll('optgroup'));
  const lastAssets = new Map<string, string>();
  const timeline = element<HTMLInputElement>('timeline');
  const play = element<HTMLButtonElement>('play');
  const motion = element('motion-controls');
  const pose = element<HTMLOutputElement>('pose');
  const wireframe = element<HTMLInputElement>('wireframe');
  let selected: (typeof assets)[keyof typeof assets] = assets.raptor;
  let time = 0;
  let playing = false;
  const gameView = new T.Vector3(0, 0, 1);
  const angleView = new T.Vector3(0.68, 0.42, 1);
  const sideView = new T.Vector3(1, 0, 0);
  let cameraView = gameView;

  function updatePose() {
    const label = selected.pose(time);
    if (pose.value !== label) pose.value = label;
  }

  function fitCamera(direction: T.Vector3) {
    cameraView = direction;
    const box = 'bounds' in selected ? selected.bounds : new T.Box3().setFromObject(selected.root);
    const bounds = box.getBoundingSphere(new T.Sphere());
    const vertical = T.MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const distance = bounds.radius * 1.07 / Math.sin(Math.min(horizontal, vertical));
    controls.target.copy(bounds.center);
    camera.position.copy(direction).normalize().multiplyScalar(distance).add(bounds.center);
    controls.minDistance = bounds.radius * 0.5;
    controls.maxDistance = distance * 3;
    controls.update();
  }

  function setPlaying(active: boolean) {
    playing = active;
    play.textContent = active ? 'Pause' : 'Play';
  }

  function selectAsset() {
    const key = assetSelect.value;
    selected = Object.hasOwn(assets, key) ? assets[key as keyof typeof assets] : assets.raptor;
    lastAssets.set(sector.value, key);
    const habitat = sector.value === 'preserve', scenery = key === 'preserve_section';
    light.color.setHex(habitat ? preserveLighting.key : 0xb9e8ff);
    light.intensity = habitat ? (scenery ? preserveLighting.keyIntensity : 2.4) : 2.7;
    fill.color.setHex(habitat ? preserveLighting.sky : 0xd6e3ff);
    fill.groundColor.setHex(habitat ? preserveLighting.ground : 0x514873);
    fill.intensity = habitat ? preserveLighting.skyIntensity : 1.75;
    uv.visible = habitat && !scenery;
    for (const asset of Object.values(assets)) asset.root.visible = asset === selected;
    time = 0;
    motion.hidden = selected.duration === 0;
    timeline.max = String(selected.duration);
    timeline.value = '0';
    setPlaying(false);
    updatePose();
    fitCamera(gameView);
  }

  assetSelect.addEventListener('change', selectAsset);
  function selectSector() {
    assetSelect.replaceChildren(...groups.filter(group => group.dataset.sector === sector.value));
    assetSelect.value = lastAssets.get(sector.value) ?? assetSelect.options[0].value;
    selectAsset();
  }
  sector.addEventListener('change', selectSector);
  element('game-view').addEventListener('click', () => fitCamera(gameView));
  element('angle-view').addEventListener('click', () => fitCamera(angleView));
  element('side-view').addEventListener('click', () => fitCamera(sideView));
  play.addEventListener('click', () => setPlaying(!playing));
  timeline.addEventListener('input', () => {
    setPlaying(false);
    time = timeline.valueAsNumber;
    updatePose();
  });
  wireframe.addEventListener('change', () => {
    scene.traverse((node) => {
      if (!(node instanceof T.Mesh)) return;
      for (const material of [node.material].flat() as T.Material[]) {
        if ('wireframe' in material) material.wireframe = wireframe.checked;
      }
    });
  });

  function resize() {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    fitCamera(cameraView);
  }

  selectSector();
  resize();
  new ResizeObserver(resize).observe(canvas);

  let previous = performance.now();
  renderer.setAnimationLoop((now) => {
    if (playing) {
      time = (time + Math.min((now - previous) / 1000, 0.1)) % selected.duration;
      timeline.value = String(time);
      updatePose();
    }
    previous = now;
    controls.update();
    if(iceField.root.visible)iceField.capture(renderer,camera);
    renderer.render(scene, camera);
  });
}

if (import.meta.env.DEV) {
  const canvas = element<HTMLCanvasElement>('preview');
  let renderer: T.WebGLRenderer | undefined;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
  } catch {
    element('viewer-error').hidden = false;
  }
  if (renderer) openWorkshop(renderer, canvas);
}
