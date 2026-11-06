import {createFaunaAssets,createVentShrimp,createVentWorm} from './vent-fauna-rig';
import {SHRIMP_POOL,WORM_POOL,faunaMuzzle} from './vent-fauna';
import {createMortarAssets,createVentMortar} from './vent-mortar-rig';
import {MORTAR_POOL} from './vent-mortar';
import {createVentScenery} from './vent-scenery';
import {createVentBoss} from './vent-boss';
import {VENT_DURATION,VENT_APPROACH,VENT_CAMERA_DISTANCE,VENT_PITCH,ventBossPose,ventWorld,ventFrame} from './vent-layout';
import { createCrucible, createSlag } from './io-crucible-rig';
import { CRUCIBLE_POOL, SLAG_POOL, crucibleValve } from './io-crucible';
import { setIoRockTexture, setIoCeramicTexture } from './io-materials';
import { createIoScenery } from './io-scenery';
import { createSkipper } from './io-rigs';
import { IO_DURATION, IO_APPROACH, IO_CAMERA_DISTANCE, IO_SKIPPER_POOL, ioFrame, skipperMotion } from './io-layout';
import { titanBossPoint, titanFrame, TITAN_PITCH } from './titan-frame';
import { createCicada } from './cicada-rig';
import { createCicadaScout, createCentipedeSection } from './titan-insect-rigs';
import { CICADA_SCOUT_POOL, cicadaMotion } from './titan-insects';
import { CENTIPEDE_POOL } from './centipede';
import { createTitanScenery } from './titan-scenery';
import * as T from 'three';
import { createAntRig, createHiveGuardian } from './ant-rigs';
import { poseBurners, shipBurners } from './burners';
import { createCorridorBridge } from './corridor-bridge';
import { createInterceptorRig, createRaptorRig } from './encounter-rigs';
import { createMarineRig, createLeviathan, setMarineTexture } from './marine-rigs';
import { marineMotion } from './marine';
import { loadEncounterTexture, loadEncounterTextures } from './encounter-texture';
import { BOSS_MUZZLE_Z, BOSS_RECOIL_TIME, raptorFlight } from './encounters';
import {
  BOSS_CAMERA_DISTANCE, BOSS_CANNON_RADIUS, BOSS_CANNON_X, BOSS_DEPTH, BOSS_PROJECTION,
  BOSS_Y, Flight, HEIGHT, TRANSITION_TIME, WIDTH,
} from './game';
import { createPreserveEdges, PRESERVE_LOOP } from './preserve-edges';
import { createDroneRig, createFighterRig, createScoutRig } from './ship-rigs';
import { createShipyard } from './shipyard';
import { createStageBackdrops } from './stage-backdrops';
import { createHiveScenery } from './hive-scenery';
import { createIceScenery } from './ice-scenery';
import { ICE_CAMERA_DISTANCE, ICE_CORRIDOR_PITCH } from './ice-layout';
import { HIVE_CAMERA_DISTANCE } from './hive-layout';
import { antScales } from './ant-navigation';
import { WING_FLASH_TIME, wingWeapons, type WingWeapon } from './wing';
import { createWingPod } from './wing-pod';
import { createCombatEffects } from './combat-effects';
import { createBossLaserContact, createLaserContactTrace } from './laser-contact';
import { createPowerupGraphic } from './powerup-graphics';
import { createContinuousLaser, createMuzzleFlash, createProjectileBatch, projectileKinds, type ProjectileKind } from './projectile-graphics';

const sceneColor = 0x0b1020;
const teal = 0x88f2ff;
const orange = 0xff885d;
const mint = 0xa1ffc5;

function trackMotion() {
  const previous = new T.Vector2();
  const velocity = new T.Vector2();
  return (point: { x: number; y: number }, elapsed: number, reset: boolean) => {
    if (reset) {
      velocity.set(0, 0);
    } else if (elapsed <= 0) {
      return velocity;
    } else {
      const weight = 1 - Math.exp(-12 * elapsed);
      velocity.x += ((point.x - previous.x) / elapsed - velocity.x) * weight;
      velocity.y += ((point.y - previous.y) / elapsed - velocity.y) * weight;
    }
    previous.set(point.x, point.y);
    return velocity;
  };
}

export class FlightView {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private plane = new T.Group();
  private ortho = new T.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 0.1, 240);
  private perspective = new T.PerspectiveCamera(38, WIDTH / HEIGHT, 0.1, 240);
  private keyLight?: T.DirectionalLight;
  private skyLight?: T.HemisphereLight;
  private player = createFighterRig();
  private boss = createInterceptorRig(BOSS_CANNON_X);
  private leviathan = createLeviathan();
  private cicada = createCicada();
  private io = createIoScenery();
  private caldera = this.io.boss;
  private skippers = Array.from({length:IO_SKIPPER_POOL},createSkipper);
  private skipperModels: (T.Object3D | undefined)[] = [];
  private crucibles=Array.from({length:CRUCIBLE_POOL},createCrucible);
  private slags=Array.from({length:SLAG_POOL},createSlag);
  private crucibleModels:(T.Object3D|undefined)[]=[];
  private vents=createVentScenery();
  private ventBoss=createVentBoss();
  private mortarAssets=createMortarAssets();
  private mortars=Array.from({length:MORTAR_POOL},()=>createVentMortar(this.mortarAssets));
  private mortarModels:(T.Object3D|undefined)[]=[];
  private faunaAssets=createFaunaAssets();
  private shrimps=Array.from({length:SHRIMP_POOL},()=>createVentShrimp(this.faunaAssets));
  private worms=Array.from({length:WORM_POOL},()=>createVentWorm(this.faunaAssets));
  private faunaModels:(T.Object3D|undefined)[]=[];
  private ventTime=0;
  private ioTime = 0;
  private ioPitch = 0;
  private ioBank = 0;
  private ioOrientation = new T.Euler();
  private cicadaScouts = Array.from({ length: CICADA_SCOUT_POOL }, createCicadaScout);
  private centipedeParts = Array.from({ length: CENTIPEDE_POOL }, createCentipedeSection);
  private insectModels: (T.Object3D | undefined)[] = [];
  private ichthyosaurs = Array.from({ length: 12 }, () => createMarineRig('ichthyosaur'));
  private plesiosaurs = Array.from({ length: 4 }, () => createMarineRig('plesiosaur'));
  private marineModels: (T.Object3D | undefined)[] = [];
  private hiveBoss = createHiveGuardian(BOSS_CANNON_X);
  private ants = Array.from({ length: 12 }, () => createAntRig());
  private playerBurners = shipBurners(this.player.root);
  private bossBurners = shipBurners(this.boss.root);
  private raptor = createRaptorRig();
  private preserveEdges = createPreserveEdges();
  private bridge = createCorridorBridge();
  private shipyard = createShipyard();
  private backdrops = createStageBackdrops();
  private hive = createHiveScenery();
  private ice = createIceScenery();
  private titan = createTitanScenery();
  private drone = createDroneRig();
  private droneBurners = shipBurners(this.drone);
  private droneGoal = new T.Mesh(
    new T.RingGeometry(0.31, 0.38, 4),
    new T.MeshBasicMaterial({ color: mint, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  private towline = new T.Group();
  private towlineGlow = new T.Mesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({ color: 0xb49bff, transparent: true, depthWrite: false }),
  );
  private towlineCore = new T.Mesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({ color: 0xf5eaff, transparent: true, depthWrite: false }),
  );
  private cannonMarker = new T.Mesh(
    new T.RingGeometry(BOSS_CANNON_RADIUS * BOSS_PROJECTION - 0.06, BOSS_CANNON_RADIUS * BOSS_PROJECTION, 24),
    new T.MeshBasicMaterial({ color: mint, depthTest: false }),
  );
  private enemies: { root: T.Group; burners: T.Mesh[] }[];
  private projectiles = Object.fromEntries(projectileKinds.map((kind) => [kind, createProjectileBatch(kind)])) as
    Record<ProjectileKind, ReturnType<typeof createProjectileBatch>>;
  private playerMuzzle = createMuzzleFlash(teal);
  private droneMuzzle = createMuzzleFlash(mint);
  private combat = createCombatEffects();
  private wingPods = Array.from({ length: 2 }, () => (Object.keys(wingWeapons) as WingWeapon[])
    .map((weapon) => ({ weapon, ...createWingPod(weapon) })));
  private wingLasers = Array.from({ length: 2 }, createContinuousLaser);
  private laserContact = createLaserContactTrace(this.plane);
  private ioContact = createBossLaserContact(this.plane, this.caldera.root);
  private bossLaserContact = {
    vents: createBossLaserContact(this.plane,this.ventBoss.root),
    io: (x:number,distance:number) => this.ioContact(x < -1 ? -1 : 1,distance),
    preserve: createBossLaserContact(this.plane, this.boss.root),
    broodlock: createBossLaserContact(this.plane, this.hiveBoss.root),
    ice: createBossLaserContact(this.plane, this.leviathan.root),
    titan: createBossLaserContact(this.plane, this.cicada.root),
  };
  private drops = Array.from({ length: 12 }, createPowerupGraphic);
  private markers = Array.from({ length: 3 }, () => new T.Mesh(
    new T.RingGeometry(0.53, 0.61, 24),
    new T.MeshBasicMaterial({ color: 0xffcc78, transparent: true, depthWrite: false }),
  ));
  private pulse = new T.Mesh(
    new T.RingGeometry(0.92, 1, 48),
    new T.MeshBasicMaterial({ color: teal, transparent: true, depthWrite: false }),
  );
  private stars: T.Points;
  private texturesReady: Promise<(T.Texture | undefined)[][]>;
  private surfacesReady = false;
  private swing = 0;
  private stageTime = 0;
  private iceTime = 0;
  private titanTime = 0;
  private animationTime = 0;
  private lastFlight?: Flight;
  private fighterMotion = trackMotion();
  private droneMotion = trackMotion();
  private seenShots = new WeakSet<Flight['shots'][number]>();
  private seenDrops = new WeakMap<Flight['drops'][number], number>();
  private previousDrops: Flight['drops'] = [];
  private enemyVitals = new Map<Flight['enemies'][number], { hp: number; laserDamage: number; at: number }>();
  private previousBossHealth = 30;
  private previousBossLaserDamage = 0;
  private previousHull = 4;
  private bossHitAt = -1;
  private rotation = new T.Quaternion();
  private axis = new T.Vector3(1, 0, 0);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.scene.background = new T.Color(sceneColor);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap;
    const light = new T.DirectionalLight(0xb9e8ff, 2.7);
    light.position.set(3, 5, 6);
    this.scene.add(this.plane);
    this.keyLight=light;this.skyLight=new T.HemisphereLight(0xd6e3ff,0x514873,1.75);
    this.plane.add(light,this.skyLight);

    const points = Array.from({ length: 220 }, (_, i) => [
      ((i * 67 % 223) / 223 - 0.5) * 26,
      ((i * 97 % 227) / 227 - 0.5) * 48,
      -2 - i % 15,
    ]).flat();
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    this.stars = new T.Points(geometry, new T.PointsMaterial({ color: 0x607796, size: 0.07 }));
    this.stars.frustumCulled = false;
    this.boss.root.position.set(0, BOSS_Y, BOSS_DEPTH);
    const scout = createScoutRig();
    const pods = this.wingPods.flatMap((side) => side.map(({ root }) => root));
    for(const rig of [this.player.root,this.drone,...pods])rig.traverse(o=>{if(o instanceof T.Mesh&&!([o.material].flat().some(m=>m.transparent))){o.castShadow=true;o.receiveShadow=true;}});
    const ammo = Object.values(this.projectiles).map(({ root }) => root);
    this.texturesReady = Promise.all([this.backdrops.ready, this.hive.ready, this.ice.ready, this.titan.ready, Promise.all([this.vents.ready,loadEncounterTexture('ventMortar',this.mortarAssets.setAtlas),loadEncounterTexture('ventFauna',this.faunaAssets.setAtlas)]),
      Promise.all([loadEncounterTexture('marine', setMarineTexture, 1), loadEncounterTexture('ioBasalt',setIoRockTexture,1), loadEncounterTexture('ioCeramic',setIoCeramicTexture,1)]), loadEncounterTextures(this.boss, this.raptor,
      [this.player.root, scout, this.drone, this.bridge.root, this.ice.root, ...pods, ...ammo, ...this.drops.map(({ root }) => root), this.io.root, this.skippers[0].root, this.crucibles[0].root])]).then(textures=>{this.surfacesReady=true;return textures;});
    this.enemies = Array.from({ length: 12 }, () => {
      const root = scout.clone();
      return { root, burners: shipBurners(root) };
    });
    this.towline.add(this.towlineGlow, this.towlineCore);
    this.playerMuzzle.root.position.set(0, 0.89, 0.045);
    this.droneMuzzle.root.position.set(0, 0.31, 0.06);
    this.player.root.add(this.playerMuzzle.root);
    this.drone.add(this.droneMuzzle.root);
    this.plane.add(this.player.root, this.drone, this.droneGoal, this.towline, this.boss.root, this.raptor.root, this.cannonMarker, this.stars,
      this.preserveEdges.root, this.shipyard.root, this.backdrops.root, this.bridge.root, this.hive.root, this.ice.root, this.titan.root,
      this.vents.root, this.ventBoss.root, ...this.mortars.map(r=>r.root), ...this.shrimps.map(r=>r.root), ...this.worms.map(r=>r.root), this.io.root, ...this.skippers.map(r=>r.root), ...this.crucibles.map(r=>r.root), ...this.slags.map(r=>r.root), this.leviathan.root, this.cicada.root, ...this.ichthyosaurs.map(r=>r.root), ...this.plesiosaurs.map(r=>r.root),
      ...this.cicadaScouts.map(r=>r.root), ...this.centipedeParts.map(r=>r.root),
      this.hiveBoss.root, ...this.ants.map(({ root }) => root),
      this.pulse, ...this.enemies.map(({ root }) => root), ...this.markers,
      ...ammo, this.combat.root, ...pods, ...this.wingLasers.map(({ root }) => root), ...this.drops.map(({ root }) => root));
  }

  async warmup(signal: AbortSignal, repaint: () => void) {
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const textures = (await this.texturesReady).flat();
    await nextFrame();
    if (signal.aborted) return;

    const camera = new T.OrthographicCamera(-24, 24, 24, -24, 0.1, 240);
    // Without parallel compilation, let each small draw compile its own shaders.
    const compiled = this.renderer.extensions.has('KHR_parallel_shader_compile')
      ? this.renderer.compileAsync(this.scene, camera) : undefined;
    for (const texture of textures) {
      if (!texture) continue;
      await nextFrame();
      if (signal.aborted) return;
      this.renderer.initTexture(texture);
    }
    await compiled;

    // Cache silhouette bounds before the first laser hit, spread across small preflight batches.
    const contactModels = [this.shrimps[0].root,this.worms[0].root,this.mortars[0].root,this.ventBoss.root,this.caldera.root, this.skippers[0].root, this.crucibles[0].root, this.slags[0].root,this.cicadaScouts[0].root, this.centipedeParts[0].root, this.raptor.root, this.enemies[0].root, this.boss.root, this.hiveBoss.root, this.leviathan.root, this.cicada.root, ...this.ichthyosaurs.map(r=>r.root), ...this.plesiosaurs.map(r=>r.root),
      ...this.ants.map(({ root }) => root)];
    for (let i = 0; i < contactModels.length; i += 3) {
      await nextFrame();
      if (signal.aborted) return;
      for (const model of contactModels.slice(i, i + 3)) model.traverse((node) => {
        if (node instanceof T.Mesh && !node.geometry.boundingBox) node.geometry.computeBoundingBox();
      });
    }

    // Use the actual canvas framebuffer so the draws prime the same programs and buffers as play.
    const stage: T.Object3D[] = [this.raptor.root, this.enemies[0].root, this.bridge.root];
    if (this.backdrops.hasPreserve || this.backdrops.hasShipyard) stage.push(this.backdrops.root);
    const boss: T.Object3D[] = [this.cicada.root, this.leviathan.root, this.boss.root, this.cannonMarker, ...this.markers];
    if (!this.backdrops.hasShipyard) boss.push(this.shipyard.root);
    const pods = this.wingPods.map((side) => side.map(({ root }) => root));
    const ordnance = [this.player.root, this.drone, ...Object.values(this.projectiles).map(({ root }) => root), this.combat.root,
      this.playerMuzzle.root, this.droneMuzzle.root, ...this.drops.slice(0, 4).map(({ root }) => root)];
    const marine = [...this.ichthyosaurs, ...this.plesiosaurs].map(r=>r.root);
    const marineBatches = Array.from({length:Math.ceil(marine.length/3)},(_,i)=>marine.slice(i*3,i*3+3));
    const insects = [this.cicadaScouts[0].root, this.centipedeParts[0].root];
    for (const objects of [stage, boss, insects, ...marineBatches, [this.hive.root, this.ants[0].root, this.hiveBoss.root],
      [this.io.root,this.skippers[0].root,...this.crucibles.map(r=>r.root),...this.slags.map(r=>r.root)], [this.ice.root], [this.titan.root], [this.vents.root,this.ventBoss.root,...this.mortars.map(r=>r.root)], [...this.shrimps.map(r=>r.root),...this.worms.map(r=>r.root)], pods[0], [...pods[1], ...this.wingLasers.map(({ root }) => root)], ordnance]) {
      await nextFrame();
      if (signal.aborted) return;
      if (objects.includes(this.ice.root)) this.ice.prime();
      if (objects.includes(this.titan.root)) this.titan.update(0);
      if(objects.includes(this.vents.root)){this.vents.update(VENT_DURATION+VENT_APPROACH,1);this.ventBoss.root.position.set(0,4.2,-12);this.ventBoss.root.rotation.set(0,0,0);}
      if (objects.includes(this.io.root)) { this.io.update(IO_DURATION+IO_APPROACH,1); this.io.prime(true); }
      if (objects === insects) this.centipedeParts[0].prime();
      if (objects === ordnance) {
        for (const batch of Object.values(this.projectiles)) batch.prime();
        this.combat.prime(); this.playerMuzzle.prime(); this.droneMuzzle.prime();
        (Object.keys(wingWeapons) as WingWeapon[]).forEach((weapon, i) => this.drops[i].pose(weapon, 0));
      } else if (objects.includes(this.wingLasers[0].root)) {
        for (const laser of this.wingLasers) laser.prime();
      }
      camera.position.set(0, 0, 95).applyQuaternion(this.plane.quaternion);
      camera.up.set(0, 1, 0).applyQuaternion(this.plane.quaternion);
      camera.lookAt(0, 0, 0);
      const visible = objects.map((object) => object.visible);
      const viewport = this.renderer.getViewport(new T.Vector4());
      for (const object of objects) object.visible = true;
      this.renderer.setViewport(0, 0, 16, 16);
      this.renderer.setScissor(0, 0, 16, 16);
      this.renderer.setScissorTest(true);
      try {
        this.ice.capture(this.renderer, camera);
        this.renderer.render(this.scene, camera);
      } finally {
        objects.forEach((object, index) => { object.visible = visible[index]; });
        this.renderer.setScissorTest(false);
        this.renderer.setViewport(viewport);
        if(objects.includes(this.io.root)) this.io.prime(false);
        repaint();
      }
    }
  }

  resize(width: number, height: number) {
    if (!width || !height) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(width, height, false);
  }

  render(flight: Flight, elapsed = 0) {
    // Let optional images decode before synchronous first-draw shader work can
    // consume their bounded loading deadline. The launch panel shows progress.
    if(!this.surfacesReady)return;
    const newFlight = flight !== this.lastFlight;
    this.lastFlight = flight;
    this.animationTime = newFlight ? 0 : this.animationTime + elapsed;
    if (newFlight) {
      this.iceTime = 0;this.titanTime=0;this.ioTime=0;this.ventTime=0;
      this.seenShots = new WeakSet(); this.seenDrops = new WeakMap(); this.previousDrops = [];
      this.enemyVitals.clear(); this.combat.clear(); this.playerMuzzle.clear(); this.droneMuzzle.clear();
      this.previousBossHealth = flight.bossHealth; this.previousBossLaserDamage = flight.bossLaserDamage;
      this.previousHull = flight.hull; this.bossHitAt = -1;
    }
    if(flight.level==='vents'){
      if(flight.phase==='stage')this.ventTime=flight.time;
      if(flight.phase==='approach')this.ventTime=VENT_DURATION+flight.time;
      if(flight.phase==='boss')this.ventTime=VENT_DURATION+VENT_APPROACH+flight.time;
    }
    if (flight.level === 'io') {
      if(flight.phase==='stage')this.ioTime=flight.time;
      if(flight.phase==='approach')this.ioTime=flight.stageDuration+flight.time;
      if(flight.phase==='boss')this.ioTime=flight.stageDuration+flight.transitionDuration+flight.time;
    }
    if (flight.phase === 'stage') this.swing = 0;
    if (flight.phase === 'approach') this.swing = Math.min(flight.time / flight.transitionDuration, 1);
    if (flight.phase === 'boss') this.swing = 1;
    const eased = this.swing ** 2 * (3 - 2 * this.swing);
    const ioPose=flight.level==='io'?ioFrame(this.ioTime,eased):undefined;
    this.ioPitch=ioPose?.pitch??0;this.ioBank=ioPose?.bank??0;
    const angle = (eased - 1) * Math.PI / 2;
    this.rotation.setFromAxisAngle(this.axis, angle);
    this.plane.quaternion.copy(this.rotation);
    (this.scene.background as T.Color).setHex(flight.level==='vents'?0x041a25:flight.level === 'io' ? 0x020305 : flight.level === 'ice' ? 0x03060c : sceneColor);
    this.keyLight?.color.setHex(flight.level==='titan'?0xffcf93:0xb9e8ff);
    this.skyLight?.color.setHex(flight.level==='titan'?0xffdca4:0xd6e3ff);
    this.skyLight?.groundColor.setHex(flight.level==='titan'?0x543522:0x514873);
    if(flight.level==='vents'){
      this.keyLight?.color.setHex(0xa7dde1);this.skyLight?.color.setHex(0x94cbd4);this.skyLight?.groundColor.setHex(0x072330);
      if(this.keyLight)this.keyLight.intensity=2.4;if(this.skyLight)this.skyLight.intensity=1.5;this.keyLight?.position.set(-5,-4,12);
    } else if(flight.level==='io'){
      this.keyLight?.color.setHex(0xfff0dc);this.skyLight?.color.setHex(0xb9c9e0);this.skyLight?.groundColor.setHex(0x35251c);
      if(this.keyLight)this.keyLight.intensity=.15;if(this.skyLight)this.skyLight.intensity=.48;
      this.ioOrientation.set(-this.ioPitch,this.ioBank,0);this.keyLight?.position.set(-5,-5,12).applyEuler(this.ioOrientation);
    } else {this.keyLight?.position.set(3,5,6);if(this.keyLight)this.keyLight.intensity=2.7;if(this.skyLight)this.skyLight.intensity=1.75;}
    const hive = flight.level === 'broodlock';
    const stageDistance = flight.level==='vents'?VENT_CAMERA_DISTANCE:hive ? HIVE_CAMERA_DISTANCE : flight.level === 'io' ? IO_CAMERA_DISTANCE : flight.level === 'ice' ? ICE_CAMERA_DISTANCE : 95;
    const camera = this.swing === 0 && flight.level === 'preserve' ? this.ortho : this.perspective;
    const distance = T.MathUtils.lerp(stageDistance, BOSS_CAMERA_DISTANCE, eased);
    this.perspective.fov = T.MathUtils.radToDeg(2 * Math.atan(HEIGHT / 2 / distance));
    this.perspective.updateProjectionMatrix();
    if (flight.level === 'titan') {
      // Normalize perspective at the flight plane, then continuously introduce
      // depth foreshortening instead of switching projections on the first frame.
      this.perspective.projectionMatrix.multiplyScalar(1 / distance);
      const p = this.perspective.projectionMatrix.elements, o = this.ortho.projectionMatrix.elements;
      for (let i = 0; i < 16; i++) p[i] = o[i] * (1 - eased) + p[i] * eased;
      this.perspective.projectionMatrixInverse.copy(this.perspective.projectionMatrix).invert();
    }
    camera.position.set(0, 0, distance).applyQuaternion(this.rotation);
    camera.up.set(0, 1, 0).applyQuaternion(this.rotation);
    camera.lookAt(0, 0, 0);

    this.player.root.position.set(flight.player.x, flight.player.y, 0);
    this.player.root.rotation.x = flight.level==='io'?-this.ioPitch:-(flight.level === 'ice' ? ICE_CORRIDOR_PITCH : 1.18) * eased;
    this.player.root.rotation.y = this.ioBank;
    this.player.root.visible = flight.hull > 0 && Math.floor(flight.invulnerable * 12) % 2 === 0;
    const fighterVelocity = this.fighterMotion(flight.player, elapsed, newFlight);
    const fighterSpeed = fighterVelocity.length();
    poseBurners(this.playerBurners, this.animationTime, Math.min(1, 0.36 + fighterSpeed * 0.1 + 0.34 * Math.sin(eased * Math.PI)));
    this.drone.rotation.x = flight.level === 'io' ? -this.ioPitch : flight.level === 'ice' ? -ICE_CORRIDOR_PITCH * eased : 0;
    this.drone.rotation.y = this.ioBank;
    this.drone.position.set(flight.drone.x, flight.drone.y, 0.23);
    this.drone.visible = flight.hull > 0;
    const droneVelocity = this.droneMotion(flight.drone, elapsed, newFlight);
    const droneSpeed = droneVelocity.length();
    if (newFlight) this.drone.rotation.z = 0;
    if (droneSpeed > 0.9) {
      const delta = Math.atan2(-droneVelocity.x, droneVelocity.y) - this.drone.rotation.z;
      const turn = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.drone.rotation.z += turn * (1 - Math.exp(-21 * elapsed));
    }
    poseBurners(this.droneBurners, this.animationTime, Math.min(1, 0.1 + droneSpeed * 0.044));
    this.droneGoal.visible = Boolean(flight.droneTarget) && this.drone.visible;
    if (flight.droneTarget) this.droneGoal.position.set(flight.droneTarget.x, flight.droneTarget.y, 0.03);
    this.towline.visible = flight.towlineLinked;
    if (this.towline.visible) {
      const dx = flight.drone.x - flight.player.x;
      const dy = flight.drone.y - flight.player.y;
      const live = flight.towlineFlash > 0;
      this.towline.position.set((flight.drone.x + flight.player.x) / 2,
        (flight.drone.y + flight.player.y) / 2, 0.17);
      this.towline.rotation.z = Math.atan2(dy, dx);
      this.towline.scale.x = Math.hypot(dx, dy);
      this.towlineGlow.scale.y = live ? 0.28 : 0.1;
      this.towlineGlow.material.opacity = live ? 0.48 : 0.16;
      this.towlineCore.scale.y = live ? 0.09 : 0.026;
      this.towlineCore.material.opacity = live ? 1 : 0.45;
    }
    this.cannonMarker.visible = flight.phase === 'boss';
    this.cannonMarker.position.set(flight.exposedCannonX * BOSS_PROJECTION, flight.bossAimY * BOSS_PROJECTION, 0);
    const activeBoss = flight.level === 'vents'?this.ventBoss:flight.level === 'titan' ? this.cicada : flight.level === 'ice' ? this.leviathan : flight.level === 'broodlock' ? this.hiveBoss : this.boss;
    this.ventBoss.root.visible=this.cicada.root.visible = this.leviathan.root.visible = this.boss.root.visible = this.hiveBoss.root.visible = false;
    this.caldera.root.visible = flight.level === 'io' && flight.bossHealth > 0;
    this.caldera.pose(this.ioTime,flight.ioCollapse,flight.ioLegBroken,flight.cannonWindup);
    activeBoss.root.visible = flight.level !== 'io' && this.swing > 0 && flight.bossHealth > 0;
    activeBoss.root.position.set(0, BOSS_Y, BOSS_DEPTH - 70 * (1 - eased));
    activeBoss.root.rotation.x = 0.9 * (1 - eased);
    if(flight.level==='titan'){
      const point=titanBossPoint(eased);this.cicada.root.visible=flight.bossHealth>0;
      this.cicada.root.position.set(0,point.y,point.z);
      this.cicada.root.rotation.x=TITAN_PITCH-titanFrame(eased).pitch;
    }
    if(flight.level==='vents'){
      const pose=ventBossPose(eased),point=ventWorld(pose.x,pose.y,pose.z,this.ventTime,eased);
      this.ventBoss.root.visible=flight.bossHealth>0;this.ventBoss.root.position.set(point.x,point.y,point.z);
      this.ventBoss.root.rotation.x=VENT_PITCH-ventFrame(this.ventTime,eased).pitch;
    }
    if (activeBoss.root.visible) {
      if(activeBoss === this.leviathan) this.leviathan.pose(eased,flight.cannonWindup,0,0,flight.bossRecoil / BOSS_RECOIL_TIME,flight.phase==='boss'?flight.time:Math.max(0,this.iceTime-flight.stageDuration-TRANSITION_TIME));
      else if(activeBoss===this.cicada)this.cicada.pose(eased,flight.cannonWindup,flight.exposedCannonX,flight.firedCannonX,flight.bossRecoil/BOSS_RECOIL_TIME,flight.phase==='boss'?flight.transitionDuration+flight.time:flight.phase==='approach'?flight.time:0);
      else activeBoss.pose(eased, flight.cannonWindup, flight.exposedCannonX, flight.firedCannonX,flight.bossRecoil / BOSS_RECOIL_TIME);
      if (activeBoss === this.boss) poseBurners(this.bossBurners, this.animationTime, 0.42 + 0.48 * Math.sin(eased * Math.PI));
    }
    if((flight.level==='ice'||flight.level==='titan')&&this.cannonMarker.visible){const contact=this.bossLaserContact[flight.level as 'ice'|'titan'](flight.exposedCannonX,distance);this.cannonMarker.position.set(contact.x,contact.y,0);}
    if(flight.level==='vents'&&this.cannonMarker.visible){const p=this.bossLaserContact.vents(flight.exposedCannonX,distance);this.cannonMarker.position.set(p.x,p.y,0);}
    if(flight.level==='io' && this.cannonMarker.visible){const p=this.bossLaserContact.io(flight.exposedCannonX,distance);this.cannonMarker.position.set(p.x,p.y,0);}
    this.drawScenery(flight, eased, distance, newFlight ? 2 : elapsed, fighterSpeed, droneSpeed);

    const raptor = flight.enemies.find((enemy) => enemy.raptor);
    this.raptor.root.visible = Boolean(raptor);
    if (raptor) {
      this.raptor.root.position.set(raptor.x, raptor.y, 0);
      this.raptor.root.rotation.z = Math.PI;
      this.raptor.pose(raptor.age);
    }
    for (const [index, { root, burners }] of this.enemies.entries()) {
      const enemy = flight.enemies[index];
      root.visible = Boolean(enemy && !enemy.raptor && !enemy.ant && !enemy.marine && !enemy.cicada && !enemy.centipede && !enemy.skipper && !enemy.crucible && !enemy.slag && !enemy.shrimp && enemy.ventAnchor===undefined);
      if (root.visible && enemy) {
        root.position.set(enemy.x, enemy.y, 0);
        root.rotation.z = enemy.ventAnchor!==undefined?Math.PI:Math.PI + 0.3 * Math.cos(enemy.age * 1.55);
        root.scale.setScalar(enemy.ventScale??1);
        poseBurners(burners, enemy.age + index * 0.27, enemy.ventAnchor!==undefined?0:0.55 + 0.16 * Math.sin(enemy.age * 4 + index));
      }
    }
    for (const [index, ant] of this.ants.entries()) {
      const enemy = flight.enemies[index];
      ant.root.visible = Boolean(enemy?.ant);
      if (!ant.root.visible || !enemy) continue;
      ant.root.position.set(enemy.x, enemy.y, 0);
      ant.root.scale.setScalar(antScales[enemy.ant ?? 'worker']);
      ant.root.rotation.z = Math.PI + (enemy.heading ?? 0.05 * Math.cos(enemy.age * 1.55));
      ant.setKind(enemy.ant === 'soldier' ? 'soldier' : 'worker');
      const windup = enemy.ant === 'soldier' ? T.MathUtils.clamp((enemy.age - enemy.fire + 0.55) / 0.55, 0, 1) : 0;
      ant.pose(enemy.age, windup);
    }

    for(const rig of this.ichthyosaurs)rig.root.visible=false;
    for(const rig of this.plesiosaurs)rig.root.visible=false;
    this.marineModels.length=flight.enemies.length;
    let hunters=0,sweepers=0;
    for(const [index,enemy] of flight.enemies.entries()) {
      this.marineModels[index]=undefined;
      if(!enemy.marine)continue;
      const rig=enemy.marine==='ichthyosaur'?this.ichthyosaurs[hunters++]:this.plesiosaurs[sweepers++];
      if(!rig)continue;
      rig.root.visible=true;rig.root.position.set(enemy.x,enemy.y,0);rig.root.rotation.z=Math.PI+(enemy.heading??0);
      const swim=marineMotion(enemy.marine,enemy.age,enemy.lane,enemy.school);
      const charge=T.MathUtils.clamp(1-(enemy.fire-enemy.age)/.55,0,1);
      rig.pose(enemy.age,swim.bank,charge);this.marineModels[index]=rig.root;
    }

    for (const rig of [...this.cicadaScouts, ...this.centipedeParts]) rig.root.visible = false;
    this.insectModels.length = flight.enemies.length;
    let scouts = 0, sections = 0;
    for (const [index, enemy] of flight.enemies.entries()) {
      this.insectModels[index] = undefined;
      const rig = enemy.centipede ? this.centipedeParts[sections++] : enemy.cicada ? this.cicadaScouts[scouts++] : undefined;
      if (!rig) continue;
      rig.root.visible = true;
      rig.root.position.set(enemy.x, enemy.y, enemy.centipede ? -.2 : .04);
      rig.root.rotation.z = -(enemy.heading ?? Math.PI);
      if (enemy.centipede) {
        const link = enemy.centipede;
        (rig as typeof this.centipedeParts[number]).pose(enemy.age, link.slot, link.originalHead, Boolean(link.chain.escape));
      } else if (enemy.cicada) {
        (rig as typeof this.cicadaScouts[number]).pose(enemy.age, cicadaMotion(enemy.age, enemy.lane, enemy.cicada).bank);
      }
      this.insectModels[index] = rig.root;
    }

    this.skipperModels.length=flight.enemies.length;
    for(const rig of this.skippers)rig.root.visible=false;
    let skippers=0;
    for(const [index,enemy]of flight.enemies.entries()){
      this.skipperModels[index]=undefined;if(!enemy.skipper)continue;
      const rig=this.skippers[skippers++];if(!rig)continue;
      const motion=skipperMotion(enemy.age,enemy.lane,enemy.slot);
      rig.root.visible=true;rig.root.position.set(enemy.x,enemy.y,0);rig.root.rotation.z=-motion.heading;
      rig.pose(enemy.age,motion.bank,motion.jet);this.skipperModels[index]=rig.root;
      rig.root.rotation.x-=this.ioPitch;rig.root.rotation.y+=this.ioBank;
    }

    this.crucibleModels.length=flight.enemies.length;
    for(const rig of this.crucibles)rig.root.visible=false;
    for(const rig of this.slags)rig.root.visible=false;
    let carriers=0,slag=0;
    for(const [index,enemy]of flight.enemies.entries()){
      this.crucibleModels[index]=undefined;
      if(!enemy.crucible&&!enemy.slag)continue;
      const rig=enemy.crucible?this.crucibles[carriers++]:this.slags[slag++];if(!rig)continue;
      rig.root.visible=true;rig.root.position.set(enemy.x,enemy.y,0);
      if(enemy.crucible){rig.root.rotation.set(-this.ioPitch,this.ioBank,0);(rig as typeof this.crucibles[number]).pose(enemy.age,crucibleValve(enemy.age,enemy.fire));}
      else (rig as typeof this.slags[number]).pose(enemy.age,enemy.slag?.vx??0);
      this.crucibleModels[index]=rig.root;
    }

    this.mortarModels.length=flight.enemies.length;for(const rig of this.mortars)rig.root.visible=false;let mortar=0;
    for(const[index,enemy]of flight.enemies.entries()){
      this.mortarModels[index]=undefined;if(enemy.ventAnchor===undefined||enemy.ventWorm)continue;
      const rig=this.mortars[mortar++];if(!rig)continue;
      rig.root.visible=true;rig.root.position.set(enemy.x,enemy.y,0);rig.root.scale.setScalar(enemy.ventScale??1);
      rig.pose(enemy.age,enemy.fire,enemy.mortarAngle??0);this.mortarModels[index]=rig.combat;
    }

    this.faunaModels.length=flight.enemies.length;
    for(const rig of this.shrimps)rig.root.visible=false;for(const rig of this.worms)rig.root.visible=false;
    let shrimps=0,worms=0;
    for(const[index,enemy]of flight.enemies.entries()){
      this.faunaModels[index]=undefined;
      const rig=enemy.ventWorm?this.worms[worms++]:enemy.shrimp?this.shrimps[shrimps++]:undefined;if(!rig)continue;
      rig.root.visible=true;rig.root.position.set(enemy.x,enemy.y,0);rig.root.scale.setScalar(enemy.ventScale??1);
      if(enemy.ventWorm){rig.root.rotation.z=0;(rig as typeof this.worms[number]).pose(enemy.age,enemy.fire,enemy.mortarAngle??0);}
      else {rig.root.rotation.z=enemy.heading??0;rig.pose(enemy.age,enemy.fire,0);}
      this.faunaModels[index]=rig.combat;
    }

    this.drawWings(flight, eased, fighterVelocity, flight.level==='io'?distance:flight.level === 'titan' ? (eased > 0 ? distance / eased : undefined) : camera === this.ortho ? undefined : distance);
    for (const [index, model] of this.drops.entries()) {
      const drop = flight.drops[index];
      model.root.visible = Boolean(drop);
      if (drop) {
        if (!this.seenDrops.has(drop)) this.seenDrops.set(drop, this.animationTime);
        model.root.position.set(drop.x, drop.y, 0.22 + Math.sin(this.animationTime * 3) * 0.05);
        model.pose(drop.weapon, this.animationTime, (this.animationTime - this.seenDrops.get(drop)!) / 0.22);
      }
    }
    this.projectiles.ship.draw(flight.shots.filter((shot) => !shot.drone && !shot.wing), this.animationTime);
    this.projectiles.drone.draw(flight.shots.filter((shot) => shot.drone), this.animationTime);
    for (const weapon of ['homing', 'cannon', 'omega'] as const) {
      this.projectiles[weapon].draw(flight.shots.filter((shot) => shot.wing === weapon), this.animationTime);
    }
    this.projectiles.hostile.draw(flight.level === 'vents' || flight.level === 'preserve' || flight.level === 'titan' || flight.level === 'io' ? flight.threats : [], this.animationTime);
    this.projectiles.brine.draw(flight.level === 'ice' ? flight.threats : [], this.animationTime);
    this.projectiles.spore.draw(flight.level === 'broodlock' ? flight.threats : [], this.animationTime);
    this.drawFeedback(flight, elapsed);
    for (const [index, ring] of this.markers.entries()) {
      const marker = flight.markers[index];
      ring.visible = Boolean(marker) && flight.phase === 'boss';
      if (marker) {
        ring.position.set(marker.x, marker.y, 0.08);
        ring.material.opacity = 0.7 + 0.3 * Math.sin(flight.time * 18);
      }
    }

    this.pulse.visible = flight.pulseFlash > 0;
    this.pulse.position.copy(this.player.root.position);
    this.pulse.scale.setScalar(1 + (0.3 - flight.pulseFlash) * 25);
    this.pulse.material.opacity = flight.pulseFlash / 0.3;
    this.ice.capture(this.renderer, camera);
    this.renderer.render(this.scene, camera);
  }

  private drawScenery(flight: Flight, reveal: number, distance: number, elapsed: number, fighterSpeed: number, droneSpeed: number) {
    if (flight.phase === 'stage') this.stageTime = flight.time;
    if (flight.phase === 'approach' || flight.phase === 'boss') this.stageTime = flight.stageDuration;
    const perspectiveDistance = this.swing === 0 && (flight.level === 'vents' || flight.level === 'preserve' || flight.level === 'titan') ? undefined : distance;
    this.vents.root.visible=flight.level==='vents';
    if(this.vents.root.visible){
      this.vents.update(this.ventTime,reveal,flight.bossHealth>0);
      this.io.root.visible=this.stars.visible=this.titan.root.visible=this.ice.root.visible=this.hive.root.visible=this.preserveEdges.root.visible=this.shipyard.root.visible=this.backdrops.root.visible=this.bridge.root.visible=false;
      return;
    }
    this.io.root.visible = flight.level === 'io';
    if(this.io.root.visible){
      this.io.update(this.ioTime,reveal);
      this.stars.visible=this.titan.root.visible=this.ice.root.visible=this.hive.root.visible=this.preserveEdges.root.visible=this.shipyard.root.visible=this.backdrops.root.visible=this.bridge.root.visible=false;
      return;
    }
    this.titan.root.visible = flight.level === 'titan';
    if (this.titan.root.visible) {
      if(flight.phase==='stage')this.titanTime=flight.time;
      if(flight.phase==='approach')this.titanTime=flight.stageDuration+flight.time;
      if(flight.phase==='boss')this.titanTime=flight.stageDuration+flight.transitionDuration+flight.time;
      const coast = Math.min(flight.transitionDuration, Math.max(0, this.titanTime-flight.stageDuration));
      const progress = Math.min(1,flight.hiveProgress + 1.6 / 144 * (coast-coast*coast/(2*flight.transitionDuration)));
      this.titan.update(progress,this.titanTime,reveal,distance);
      this.stars.visible = this.preserveEdges.root.visible = this.shipyard.root.visible = this.backdrops.root.visible =
        this.bridge.root.visible = this.hive.root.visible = this.ice.root.visible = false;
      return;
    }
    this.ice.root.visible = flight.level === 'ice';
    if (this.ice.root.visible) {
      if (flight.phase === 'stage') this.iceTime = flight.time;
      if (flight.phase === 'approach') this.iceTime = flight.stageDuration + flight.time;
      if (flight.phase === 'boss') this.iceTime = flight.stageDuration + TRANSITION_TIME + flight.time;
      this.ice.update(flight.hiveProgress, reveal, this.iceTime, distance);
      this.stars.visible = false; this.stars.position.y = 0;
      this.preserveEdges.root.visible = this.shipyard.root.visible = this.backdrops.root.visible = this.bridge.root.visible = this.hive.root.visible = false;
      return;
    }
    this.hive.root.visible = flight.level === 'broodlock';
    this.stars.visible = flight.level !== 'broodlock';
    if (this.hive.root.visible) {
      this.hive.update(flight.hiveProgress, perspectiveDistance);
      this.preserveEdges.root.visible = this.shipyard.root.visible = this.backdrops.root.visible = this.bridge.root.visible = false;
      return;
    }
    const scroll = this.stageTime * 1.65;
    this.stars.position.y = -(scroll % 12) - reveal * 2;
    const backdropScroll = this.stageTime * 1.2 + reveal * 6;
    const edge = this.backdrops.update(reveal, backdropScroll, perspectiveDistance);
    this.bridge.update(backdropScroll, edge, reveal, perspectiveDistance);
    this.shipyard.update(reveal, !this.backdrops.hasShipyard);

    const wakes = flight.hull > 0 && reveal < 0.7 ? [
      { ...flight.player, strength: Math.min(1.4, 0.93 + fighterSpeed * 0.1) },
      { ...flight.drone, strength: Math.min(1, 0.3 + droneSpeed * 0.05) },
      ...flight.enemies.map((enemy) => ({
        x: enemy.x, y: enemy.y,
        strength: enemy.raptor ? 0.63 + raptorFlight(enemy.age).speed * 0.11 : 0.86,
      })),
    ] : [];
    this.preserveEdges.update(scroll % PRESERVE_LOOP, reveal, !this.backdrops.hasPreserve, elapsed, wakes);
  }

  private drawWings(flight: Flight, reveal: number, velocity: T.Vector2, distance?: number) {
    const fighting = flight.phase === 'stage' || flight.phase === 'boss';
    const throttle = Math.min(1, 0.38 + velocity.length() * 0.12 + 0.24 * Math.sin(reveal * Math.PI));
    for (const [index, wing] of flight.wings.entries()) {
      const laser = this.wingLasers[index];
      const origin = flight.wingOrigin(wing.side);
      for (const pod of this.wingPods[index]) {
        pod.root.visible = flight.hull > 0 && wing.weapon === pod.weapon;
        if (!pod.root.visible) continue;
        const time = this.animationTime + index * 0.47;
        pod.root.position.set(origin.x, origin.y, 0);
        pod.root.rotation.set((flight.level==='io'?-this.ioPitch:-(flight.level === 'ice' ? ICE_CORRIDOR_PITCH : 1.18)*reveal) + 0.09 * Math.sin(time * 6),
          this.ioBank-0.046 * velocity.x + 0.14 * Math.sin(time * 5), 0.08 * Math.sin(time * 4));
        const recoil = fighting ? wing.flash / WING_FLASH_TIME : 0;
        const charge = pod.weapon === 'omega' && fighting ? Math.max(0, 1 - wing.cooldown / 0.28) : 0;
        const activity = wing.beamEnd && fighting ? 0.55 + 0.13 * Math.sin(time * 31) : Math.max(recoil, charge);
        pod.pose(time, throttle, activity, recoil);
      }

      laser.root.visible = fighting && flight.hull > 0 && Boolean(wing.beamEnd);
      if (laser.root.visible && wing.beamEnd) {
        const target = wing.laserTarget;
        let model: T.Object3D | undefined;
        if (target && typeof target !== 'number') {
          const index = flight.enemies.indexOf(target);
          if (index >= 0) model = target.shrimp||target.ventWorm ? this.faunaModels[index] : target.ventAnchor!==undefined ? this.mortarModels[index] : target.crucible || target.slag ? this.crucibleModels[index] : target.skipper ? this.skipperModels[index] : target.centipede || target.cicada ? this.insectModels[index] : target.marine ? this.marineModels[index] : target.raptor ? this.raptor.root : target.ant ? this.ants[index]?.root : this.enemies[index]?.root;
        }
        const end = typeof target === 'number' ? this.bossLaserContact[flight.level](target, distance ?? BOSS_CAMERA_DISTANCE)
          : model ? this.laserContact(origin, wing.beamEnd, model, distance) : wing.beamEnd;
        laser.draw(origin, end, wing.laserHold, this.animationTime, typeof target === 'number' || Boolean(model),
          flight.phase === 'boss' && target === undefined);
      }
    }
  }

  private drawFeedback(flight: Flight, elapsed: number) {
    this.combat.update(elapsed);
    let shipFired = false, droneFired = false, emitted = false;
    for (const shot of flight.shots) {
      if (this.seenShots.has(shot)) continue;
      this.seenShots.add(shot);
      if (!shot.wing) { if (shot.drone) droneFired = true; else shipFired = true; }
    }
    this.playerMuzzle.update(elapsed, shipFired);
    this.droneMuzzle.update(elapsed, droneFired);
    for (const [enemy, previous] of this.enemyVitals) {
      const laserDamage = (enemy.laserDamage ?? 0) - previous.laserDamage;
      if (previous.hp - enemy.hp - laserDamage > 1e-6 && (enemy.hp === 0 || this.animationTime - previous.at > 0.07)) {
        this.combat.emit(enemy.hp === 0 ? 'kill' : 'hit', enemy.ventWorm?faunaMuzzle(enemy):enemy, enemy.hp === 0 ? orange : teal);
        previous.at = this.animationTime; emitted = true;
      }
      previous.hp = enemy.hp;
      previous.laserDamage = enemy.laserDamage ?? 0;
      if (!flight.enemies.includes(enemy)) this.enemyVitals.delete(enemy);
    }
    for (const enemy of flight.enemies) if (!this.enemyVitals.has(enemy)) this.enemyVitals.set(enemy,
      { hp: enemy.hp, laserDamage: enemy.laserDamage ?? 0, at: -1 });
    const bossLaserDamage = flight.bossLaserDamage - this.previousBossLaserDamage;
    if (this.previousBossHealth - flight.bossHealth - bossLaserDamage > 1e-6 && this.animationTime - this.bossHitAt > 0.07) {
      this.combat.emit(flight.bossHealth === 0 ? 'kill' : 'hit', { x: flight.exposedCannonX, y: flight.bossAimY, z: BOSS_DEPTH + BOSS_MUZZLE_Z }, teal);
      this.bossHitAt = this.animationTime; emitted = true;
    }
    if (flight.hull < this.previousHull) {
      this.combat.emit(flight.hull === 0 ? 'kill' : 'hit', flight.player, orange); emitted = true;
    }
    if (flight.phase === 'stage') for (const drop of this.previousDrops) {
      if (!flight.drops.includes(drop) && drop.y > -8.5 && Math.hypot(drop.x - flight.player.x, drop.y - flight.player.y) < 1.6) {
        this.combat.emit('pickup', drop, wingWeapons[drop.weapon].color); emitted = true;
      }
    }
    this.previousDrops = flight.drops;
    this.previousBossHealth = flight.bossHealth; this.previousHull = flight.hull;
    this.previousBossLaserDamage = flight.bossLaserDamage;
    if (emitted) this.combat.update(0);
  }
}
