import * as T from 'three';
import { poseBurners, shipBurners } from './burners';
import { addTowlineEmitters, createDroneRig, createFighterRig } from './ship-rigs';
import type { FlightMode } from './campaign/challenges';
import { PATTERN_HIT_RADIUS } from './challenge-patterns';
import { BOSS_MUZZLE_Z } from './encounters';
import { BOSS_CAMERA_DISTANCE, BOSS_CANNON_RADIUS, BOSS_PROJECTION, BOSS_DEPTH, Flight, HEIGHT, WIDTH } from './game';
import { WING_FLASH_TIME, WING_FORMATION, wingWeapons, type WingWeapon } from './wing';
import { createWingPod } from './wing-pod';
import { createCombatEffects } from './combat-effects';
import { createLaserContactTrace } from './laser-contact';
import { createPowerupGraphic, powerupKinds, repairColor } from './powerup-graphics';
import { createContinuousLaser, createMuzzleFlash, createPatternProjectileBatch, createProjectileBatch, projectileKinds,
  type PatternPalette, type ProjectileKind } from './projectile-graphics';
import { ambusherFeedback } from './preserve-ambusher';
import { faunaMuzzle } from './vent-fauna';
import type { LevelId } from './levels';
import { pilots, type PilotId, type PilotLivery } from './pilot-data';
import { levelLoaders } from './rendering/loaders';
import { type LevelFactory, type LevelScene, type LevelFrame } from './rendering/level';
import { loadCommonTextures } from './rendering/common-textures';
import { tiltFlightCamera } from './rendering/flight-camera';
import { boostFriendlyGlow } from './rendering/friendly-glow';
import { disposeScene } from './rendering/dispose';
import { addVictoryWingShots, createBossDefeat, createVictoryFlares, SALUTE_ANGLE, SALUTE_START, VICTORY_DURATION, victoryFormation, victoryLaserLength } from './rendering/victory';
export async function createFlightView(canvas: HTMLCanvasElement, level: LevelId, signal = new AbortController().signal, pilot?: PilotId, mode: FlightMode = 'regular') {
  const { createLevel } = await levelLoaders[level]();
  signal.throwIfAborted();
  return new FlightView(canvas, level, createLevel, signal, pilots.find(entry => entry.id === pilot)?.livery, mode);
}

function nextWarmupFrame(signal: AbortSignal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>(resolve => {
    const frame = requestAnimationFrame(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    });
    function abort() {
      cancelAnimationFrame(frame);
      resolve();
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

const sceneColor = 0x0b1020;
const teal = 0x88f2ff;
const orange = 0xff885d;
const mint = 0xa1ffc5;
const victoryShipY = -2.25;
const challengeExhaust = {
  'bullet-hell': { core: 0xffc17a, flame: 0xff7a21 },
  hardcore: { core: 0xff9380, flame: 0xff2d1f },
};
const patternPalettes: Partial<Record<LevelId, PatternPalette>> = {
  broodlock: { primary: 0xffa842, accent: 0xef91ff, shape: 'seed' },
  io: { primary: 0xffab36, accent: 0xff6d8a, shape: 'ember' },
  vents: { primary: 0x8deaff, accent: 0xdf99ff, shape: 'pearl' },
  titan: { primary: 0xbd83ff, accent: 0x8dffd7, shape: 'seed' },
  heliostat: { primary: 0xffd05b, accent: 0xff75bd, shape: 'pearl' },
  ice: { primary: 0x839cff, accent: 0xff98d1, shape: 'shard' },
};
function planarProjectileLayer({x, y}: { x: number; y: number }, z: number) {
  const scale = (BOSS_CAMERA_DISTANCE - z) / BOSS_CAMERA_DISTANCE;
  return { x: x * scale, y: y * scale, z };
}
function trackMotion() {
  const previous = new T.Vector2();
  const velocity = new T.Vector2();
  return (point: {
    x: number;
    y: number;
  }, elapsed: number, reset: boolean) => {
    if (reset) {
      velocity.set(0, 0);
    }
    else if (elapsed <= 0) {
      return velocity;
    }
    else {
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
  private ownsRenderer: boolean;
  private previewTime?: number;
  private scene = new T.Scene();
  private plane = new T.Group();
  private ortho = new T.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, .1, 240);
  private perspective = new T.PerspectiveCamera(38, WIDTH / HEIGHT, .1, 240);
  private keyLight?: T.DirectionalLight;
  private skyLight?: T.HemisphereLight;
  private level: LevelScene;
  private defeat: ReturnType<typeof createBossDefeat>;
  private victoryFlares?: ReturnType<typeof createVictoryFlares>;
  private victoryFacing = new T.Quaternion();
  private saluteFacing = new T.Quaternion();
  private saluteRoll = new T.Quaternion();
  private saluteMuzzle = new T.Vector3();
  private saluteDirection = new T.Vector3();
  private saluteFrustum = new T.Frustum();
  private saluteProjection = new T.Matrix4();
  private rollAxis = new T.Vector3(0, 0, 1);
  private disposed = false;
  private levelTime = 0;
  private pitch = 0;
  private bank = 0;
  private viewPitch = 0;
  private player: ReturnType<typeof createFighterRig>;
  private playerBurners: ReturnType<typeof shipBurners>;
  private bubbleSources: T.Mesh[] = [];
  private drone: T.Group;
  private droneYaw = 0;
  private droneBurners: ReturnType<typeof shipBurners>;
  private towlineEmitters: T.Group;
  private droneGoal = new T.Mesh(new T.RingGeometry(0.31, 0.38, 4), new T.MeshBasicMaterial({
    color: mint,
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  }));
  private towline = new T.Group();
  private towlineGlow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({
    color: 0xb49bff,
    transparent: true,
    depthWrite: false
  }));
  private towlineCore = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({
    color: 0xf5eaff,
    transparent: true,
    depthWrite: false
  }));
  private cannonMarker = new T.Mesh(new T.RingGeometry(BOSS_CANNON_RADIUS * BOSS_PROJECTION - 0.06, BOSS_CANNON_RADIUS * BOSS_PROJECTION, 24), new T.MeshBasicMaterial({ color: mint, depthTest: false, depthWrite: false }));
  private projectiles = Object.fromEntries(projectileKinds.map((kind) => [kind, createProjectileBatch(kind)])) as Record<ProjectileKind, ReturnType<typeof createProjectileBatch>>;
  private patternProjectiles?: ReturnType<typeof createPatternProjectileBatch>;
  private dodgeMarker?: T.Group;
  private playerMuzzle = createMuzzleFlash(teal);
  private droneMuzzle = createMuzzleFlash(mint);
  private combat = createCombatEffects();
  private wingPods: ({ weapon: WingWeapon } & ReturnType<typeof createWingPod>)[][];
  private wingLasers = Array.from({ length: 2 }, createContinuousLaser);
  private laserContact = createLaserContactTrace(this.plane);
  private drops = Array.from({ length: 12 }, createPowerupGraphic);
  private markers = Array.from({ length: 5 }, () => new T.Mesh(new T.RingGeometry(0.53, 0.61, 24), new T.MeshBasicMaterial({
    color: 0xffcc78,
    transparent: true,
    depthWrite: false
  })));
  private pulse = new T.Mesh(new T.RingGeometry(0.92, 1, 48), new T.MeshBasicMaterial({
    color: teal,
    transparent: true,
    depthWrite: false
  }));
  private texturesReady: Promise<(T.Texture | undefined)[][]>;
  private surfacesReady = false;
  private swing = 0;
  private animationTime = 0;
  private lastFlight?: Flight;
  private fighterMotion = trackMotion();
  private droneMotion = trackMotion();
  private seenShots = new WeakSet<Flight['shots'][number]>();
  private seenDrops = new WeakMap<Flight['drops'][number], number>();
  private previousDrops: Flight['drops'] = [];
  private enemyVitals = new Map<Flight['enemies'][number], {
    hp: number;
    laserDamage: number;
    at: number;
  }>();
  private previousBossHealth = 30;
  private previousBossLaserDamage = 0;
  private previousHull = 4;
  private bossHitAt = -1;
  private rotation = new T.Quaternion();
  private axis = new T.Vector3(1, 0, 0);
  constructor(canvas: HTMLCanvasElement | T.WebGLRenderer, readonly levelId: LevelId, createLevel: LevelFactory, signal: AbortSignal, livery?: PilotLivery, mode: FlightMode = 'regular') {
    this.ownsRenderer = !(canvas instanceof T.WebGLRenderer);
    this.renderer = canvas instanceof T.WebGLRenderer ? canvas : new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.player = createFighterRig(livery, mode === 'regular' ? undefined : challengeExhaust[mode]);
    const palette = mode === 'regular' ? undefined : patternPalettes[levelId];
    if (palette) {
      this.patternProjectiles = createPatternProjectileBatch(palette);
      this.dodgeMarker = new T.Group();
      this.dodgeMarker.name = 'fighter-dodge-point';
      const rim = new T.Mesh(new T.RingGeometry(PATTERN_HIT_RADIUS - .022, PATTERN_HIT_RADIUS, 32),
        new T.MeshBasicMaterial({ color: 0xdcf9ff, transparent: true, opacity: .64, depthTest: false, depthWrite: false }));
      const center = new T.Mesh(new T.CircleGeometry(.053, 16),
        new T.MeshBasicMaterial({ color: 0xfff4e6, depthTest: false, depthWrite: false }));
      rim.renderOrder = center.renderOrder = 14;
      this.dodgeMarker.add(rim, center);
      this.dodgeMarker.visible = false;
      this.plane.add(this.patternProjectiles.root, this.dodgeMarker);
    }
    this.playerBurners = shipBurners(this.player.root);
    this.drone = createDroneRig(livery);
    this.droneBurners = shipBurners(this.drone);
    this.towlineEmitters = addTowlineEmitters(this.drone, livery);
    this.wingPods = Array.from({ length: 2 }, () => (Object.keys(wingWeapons) as WingWeapon[])
      .map(weapon => ({ weapon, ...createWingPod(weapon, livery) })));
    this.scene.add(this.plane);
    this.level = createLevel({ plane: this.plane, scene: this.scene, fighter: this.player.root, signal });
    if (this.level.ending) this.plane.add(this.level.ending.cockpitFlares.root);
    else this.victoryFlares = createVictoryFlares();
    this.defeat = createBossDefeat(this.level.victoryBoss ?? this.level.boss, this.plane, levelId);
    this.perspective.far = this.level.farDistance ?? 240;
    this.perspective.updateProjectionMatrix();
    this.cannonMarker.renderOrder = 12;
    const p = this.level;
    this.renderer.toneMapping=p.toneMapping??T.NoToneMapping;
    this.renderer.toneMappingExposure=p.exposure??1;
    this.scene.background = new T.Color(p.background ?? sceneColor);
    this.keyLight = new T.DirectionalLight(p.key ?? 0xb9e8ff, p.keyIntensity ?? 2.7);
    this.keyLight.position.set(3, 5, 6);
    this.skyLight = new T.HemisphereLight(p.sky ?? 0xd6e3ff, p.ground ?? 0x514873, p.skyIntensity ?? 1.75);
    this.plane.add(this.keyLight, this.skyLight);
    const pods = this.wingPods.flatMap(side => side.map(({ root }) => root));
    const ammo = Object.values(this.projectiles).map(({ root }) => root);
    for (const rig of [this.player.root, this.drone, ...pods])
      rig.traverse(o => {
        if (o instanceof T.Mesh && !([o.material].flat().some(m => m.transparent))) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    this.bubbleSources = [...this.playerBurners, ...this.droneBurners, ...pods.flatMap(shipBurners)];
    boostFriendlyGlow([this.player.root,this.drone,...pods,
      ...(['ship','drone','homing','cannon','omega'] as const).map(kind=>this.projectiles[kind].root),
      ...this.wingLasers.map(r=>r.root),this.playerMuzzle.root,this.droneMuzzle.root,
      this.towlineGlow,this.towlineCore,this.droneGoal,this.pulse],p.friendlyGlow??1);
    // Start texture timers after synchronous geometry construction has finished.
    this.texturesReady = Promise.all([p.ready, loadCommonTextures([this.player.root, this.drone, ...pods, ...ammo, ...this.drops.map(r => r.root), ...(p.surfaces ?? [])], p.applyArmor, signal)]).then(textures => {
      this.surfacesReady = true;
      return textures;
    });
    this.towline.add(this.towlineGlow, this.towlineCore);
    this.playerMuzzle.root.position.set(0, .89, .045);
    this.droneMuzzle.root.position.set(0, .31, .06);
    if (this.victoryFlares) {
      this.victoryFlares.root.position.set(0, .89, .11);
      this.player.root.add(this.victoryFlares.root);
    }
    this.player.root.add(this.playerMuzzle.root);
    this.drone.add(this.droneMuzzle.root);
    this.plane.add(p.root, this.player.root, this.drone, this.droneGoal, this.towline, this.cannonMarker, this.pulse, ...this.markers, ...ammo, this.combat.root, ...pods, ...this.wingLasers.map(r => r.root), ...this.drops.map(r => r.root));
  }
  async warmup(signal: AbortSignal, repaint: () => void) {
    const textures = (await this.texturesReady).flat();
    await nextWarmupFrame(signal);
    if (signal.aborted)
      return;
    const camera = new T.OrthographicCamera(-24, 24, 24, -24, .1, 240);
    const compiled = this.renderer.extensions.has('KHR_parallel_shader_compile') ? this.renderer.compileAsync(this.scene, camera) : undefined;
    for (const texture of textures) {
      if (!texture)
        continue;
      await nextWarmupFrame(signal);
      if (signal.aborted)
        return;
      this.renderer.initTexture(texture);
    }
    await compiled;
    if (signal.aborted) return;
    const contacts = [...this.level.contacts];
    for (let i = 0;i < contacts.length;i += 3) {
      await nextWarmupFrame(signal);
      if (signal.aborted)
        return;
      for (const model of contacts.slice(i, i + 3))
        model.traverse(node => {
          if (node instanceof T.Mesh && !node.geometry.boundingBox)
            node.geometry.computeBoundingBox();
        });
    }
    const pods = this.wingPods.map(side => side.flatMap(r => [r.root, r.upgrade]));
    const flares = this.level.ending?.cockpitFlares.root ?? this.victoryFlares!.root;
    const ordnance = [this.player.root, this.drone, this.towlineEmitters, ...Object.values(this.projectiles).map(r => r.root), this.combat.root, this.playerMuzzle.root, this.droneMuzzle.root, ...this.drops.slice(0, powerupKinds.length).map(r => r.root), flares];
    if (this.patternProjectiles && this.dodgeMarker) ordnance.push(this.patternProjectiles.root, this.dodgeMarker);
    const lasers = [...pods[1], ...this.wingLasers.map(r => r.root)];
    try {
      this.level.prepare?.();
      for (const objects of [...this.level.warmup, [this.cannonMarker, ...this.markers], pods[0], lasers, ordnance]) {
        await nextWarmupFrame(signal);
        if (signal.aborted)
          return;
        if (objects === ordnance) {
          for (const batch of Object.values(this.projectiles))
            batch.prime();
          this.patternProjectiles?.prime();
          this.combat.prime();
          this.playerMuzzle.prime();
          this.droneMuzzle.prime();
          this.victoryFlares?.pose(VICTORY_DURATION);
          this.level.ending?.cockpitFlares.prime();
          powerupKinds.forEach((kind, i) => this.drops[i].pose(kind, 0));
        }
        if (objects === lasers)
          for (const laser of this.wingLasers)
            laser.prime();
        camera.position.set(0, 0, 95).applyQuaternion(this.plane.quaternion);
        camera.up.set(0, 1, 0).applyQuaternion(this.plane.quaternion);
        camera.lookAt(0, 0, 0);
        const visible = objects.map(o => o.visible);
        const viewport = this.renderer.getViewport(new T.Vector4());
        const scissor = this.renderer.getScissor(new T.Vector4());
        const scissorTest = this.renderer.getScissorTest();
        for (const o of objects)
          o.visible = true;
        this.renderer.setViewport(0, 0, 16, 16);
        this.renderer.setScissor(0, 0, 16, 16);
        this.renderer.setScissorTest(true);
        try {
          this.level.capture?.(this.renderer, camera);
          if (this.level.present) this.level.present(this.renderer, this.scene, camera);
          else this.renderer.render(this.scene, camera);
        }
        finally {
          objects.forEach((o, i) => {
            o.visible = visible[i];
          });
          this.renderer.setScissorTest(scissorTest);
          this.renderer.setScissor(scissor);
          this.renderer.setViewport(viewport);
        }
        repaint();
      }
      if (this.level.ending) {
        await nextWarmupFrame(signal);
        if (signal.aborted) return;
        const scissor = this.renderer.getScissor(new T.Vector4());
        const scissorTest = this.renderer.getScissorTest();
        this.renderer.setScissor(0, 0, 16, 16);
        this.renderer.setScissorTest(true);
        try { this.level.ending.warmup(this.renderer); }
        finally {
          this.renderer.setScissor(scissor);
          this.renderer.setScissorTest(scissorTest);
        }
        repaint();
      }
    }
    finally {
      this.level.afterWarmup?.();
    }
  }
  dispose() {
    if (this.disposed)
      return;
    this.disposed = true;
    // Preparation errors are reported by the session. Teardown still owns
    // the resources it has, even if one of the texture promises rejected.
    void this.texturesReady.catch(() => undefined).then(() => {
      this.level.dispose?.();
      disposeScene(this.scene);
      if (this.ownsRenderer) {
        this.renderer.dispose();
        this.renderer.forceContextLoss();
      }
    });
  }
  resize(width: number, height: number) {
    if (!width || !height)
      return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(width, height, false);
  }
  get victoryDuration() {
    return this.level.ending?.duration ?? VICTORY_DURATION;
  }
  get hasEnding() {
    return this.level.ending !== undefined;
  }
  async readyForPreview() {
    await this.texturesReady;
  }
  previewVictory(flight: Flight, time: number) {
    // The tunnel shot still uses the flight's pooled defeat particles.
    let previous = this.previewTime ?? 0;
    if (this.previewTime === undefined || time < previous) {
      this.lastFlight = undefined;
      this.render(flight, 0, 0, false);
      previous = 0;
    }
    const step = 1 / 60;
    const defeatEnd = 2;
    for (let age = previous + step; age < Math.min(time, defeatEnd); age += step) {
      this.render(flight, step, age, false);
      previous = age;
    }
    this.render(flight, time - previous, time);
    this.previewTime = time;
  }
  render(flight: Flight, elapsed = 0, victoryTime?: number, present = true) {
    if (this.disposed || !this.surfacesReady)
      return;
    if (flight.level !== this.levelId)
      throw new Error('A flight view belongs to one level.');
    victoryTime = flight.phase === 'won' ? victoryTime ?? 0 : undefined;
    const ending = this.level.ending;
    const exitTime = ending && victoryTime !== undefined && victoryTime >= ending.departureAt
      ? victoryTime - ending.departureAt : undefined;
    if (ending && exitTime !== undefined && exitTime >= ending.cutToExterior) {
      if (present) ending.renderExterior(this.renderer, exitTime - ending.cutToExterior);
      return;
    }
    const salute = ending ? undefined : victoryTime;
    const formation = salute === undefined ? 0 : victoryFormation(salute);
    const newFlight = flight !== this.lastFlight;
    this.lastFlight = flight;
    this.animationTime = newFlight ? 0 : this.animationTime + elapsed;
    if (newFlight) {
      this.levelTime = 0;
      this.defeat.reset();
      this.seenShots = new WeakSet();
      this.seenDrops = new WeakMap();
      this.previousDrops = [];
      this.enemyVitals.clear();
      this.combat.clear();
      this.playerMuzzle.clear();
      this.droneMuzzle.clear();
      this.previousBossHealth = flight.bossHealth;
      this.previousBossLaserDamage = flight.bossLaserDamage;
      this.previousHull = flight.hull;
      this.bossHitAt = -1;
    }
    if (flight.phase === 'stage')
      this.levelTime = flight.time;
    if (flight.phase === 'approach')
      this.levelTime = flight.stageDuration + flight.time;
    if (flight.phase === 'boss' || flight.phase === 'won')
      this.levelTime = flight.stageDuration + flight.transitionDuration + flight.bossTime;
    if (flight.level === 'wormhole') this.levelTime = flight.wormholeTime;
    if (flight.phase === 'stage')
      this.swing = 0;
    if (flight.phase === 'approach')
      this.swing = Math.min(flight.time / flight.transitionDuration, 1);
    if (flight.phase === 'boss' || flight.phase === 'won')
      this.swing = 1;
    const normal = this.swing ** 2 * (3 - 2 * this.swing);
    const eased = this.level.reveal?.(this.levelTime, normal) ?? normal;
    const orientation = this.level.orientation?.(this.levelTime, eased);
    this.pitch = orientation?.pitch ?? 0;
    this.bank = orientation?.bank ?? 0;
    this.viewPitch = orientation?.viewPitch ?? 0;
    this.rotation.setFromAxisAngle(this.axis, this.level.fixedCamera ? 0 : (eased - 1) * Math.PI / 2);
    this.plane.quaternion.copy(this.rotation);
    this.keyLight?.position.set(flight.level === 'vents' || orientation ? -5 : 3, flight.level === 'vents' || orientation ? -4 : 5, flight.level === 'vents' || orientation ? 12 : 6);
    if (orientation)
      this.keyLight?.position.set(-5, -5, 12).applyEuler(new T.Euler(-this.pitch, this.bank, 0));
    const stageDistance = this.level.stageDistance;
    const camera = this.perspective;
    const distance = T.MathUtils.lerp(stageDistance, BOSS_CAMERA_DISTANCE, eased);
    this.perspective.fov = T.MathUtils.radToDeg(2 * Math.atan(HEIGHT / 2 / distance));
    this.perspective.updateProjectionMatrix();
    if (flight.level === 'titan') {
      // Normalize perspective at the flight plane, then continuously introduce
      // depth foreshortening instead of switching projections on the first frame.
      this.perspective.projectionMatrix.multiplyScalar(1 / distance);
      const p = this.perspective.projectionMatrix.elements;
      const o = this.ortho.projectionMatrix.elements;
      for (let i = 0;i < 16;i++)
        p[i] = o[i] * (1 - eased) + p[i] * eased;
      this.perspective.projectionMatrixInverse.copy(this.perspective.projectionMatrix).invert();
    }
    if (this.viewPitch) tiltFlightCamera(camera, distance, this.viewPitch, this.rotation);
    else {
      camera.position.set(0, 0, distance).applyQuaternion(this.rotation);
      camera.up.set(0, 1, 0).applyQuaternion(this.rotation);
      camera.lookAt(0, 0, 0);
    }
    if (victoryTime !== undefined) this.victoryFacing.copy(this.plane.quaternion).invert().multiply(camera.quaternion);
    this.player.root.position.set(T.MathUtils.lerp(flight.player.x, 0, formation),
      T.MathUtils.lerp(flight.player.y, victoryShipY, formation), 0);
    this.player.root.rotation.set(orientation ? -this.pitch : -(this.level.shipPitch ?? 1.18) * eased, this.bank, 0);
    if (formation > 0) this.player.root.quaternion.slerp(this.victoryFacing, formation);
    this.player.root.visible = flight.hull > 0 && (victoryTime !== undefined || Math.floor(flight.invulnerable * 12) % 2 === 0);
    if (this.dodgeMarker) {
      this.dodgeMarker.visible = this.player.root.visible && (flight.phase === 'stage' || flight.phase === 'boss');
      this.dodgeMarker.position.set(flight.player.x, flight.player.y, 0);
    }
    if (ending && exitTime !== undefined) {
      ending.poseExit(exitTime, this.player.root, camera);
      this.victoryFacing.copy(this.player.root.quaternion);
    }
    if (ending) ending.cockpitFlares.root.visible = exitTime !== undefined;
    this.victoryFlares?.pose(salute);
    const fighterVelocity = this.fighterMotion(this.player.root.position, elapsed, newFlight);
    const fighterSpeed = fighterVelocity.length();
    const throttle = exitTime === undefined ? Math.min(1, 0.36 + fighterSpeed * 0.1 + 0.34 * Math.sin(eased * Math.PI))
      : T.MathUtils.lerp(.36, 1, T.MathUtils.smoothstep(exitTime, 0, 1.4));
    poseBurners(this.playerBurners, this.animationTime, throttle);
    this.drone.position.set(T.MathUtils.lerp(flight.drone.x, 0, formation),
      T.MathUtils.lerp(flight.drone.y, victoryShipY - 1.4, formation), 0.23);
    this.drone.visible = flight.hull > 0 && exitTime === undefined;
    this.towlineEmitters.visible = flight.droneWeapon === 'towline';
    const droneVelocity = this.droneMotion(this.drone.position, elapsed, newFlight);
    const droneSpeed = droneVelocity.length();
    if (newFlight)
      this.droneYaw = 0;
    if (droneSpeed > 0.9) {
      const delta = Math.atan2(-droneVelocity.x, droneVelocity.y) - this.droneYaw;
      const turn = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.droneYaw += turn * (1 - Math.exp(-21 * elapsed));
    }
    this.drone.rotation.set(orientation ? -this.pitch : -(this.level.dronePitch ?? 0) * eased, this.bank, this.droneYaw);
    if (formation > 0) this.drone.quaternion.slerp(this.victoryFacing, formation);
    poseBurners(this.droneBurners, this.animationTime, Math.min(1, 0.1 + droneSpeed * 0.044));
    this.droneGoal.visible = Boolean(flight.droneTarget) && this.drone.visible;
    if (flight.droneTarget)
      this.droneGoal.position.set(flight.droneTarget.x, flight.droneTarget.y, 0.03);
    this.towline.visible = flight.towlineLinked;
    if (this.towline.visible) {
      const dx = flight.drone.x - flight.player.x;
      const dy = flight.drone.y - flight.player.y;
      const live = flight.towlineFlash > 0;
      this.towline.position.set((flight.drone.x + flight.player.x) / 2, (flight.drone.y + flight.player.y) / 2, 0.17);
      this.towline.rotation.z = Math.atan2(dy, dx);
      this.towline.scale.x = Math.hypot(dx, dy);
      this.towlineGlow.scale.y = live ? 0.28 : 0.1;
      this.towlineGlow.material.opacity = live ? 0.48 : 0.16;
      this.towlineCore.scale.y = live ? 0.09 : 0.026;
      this.towlineCore.material.opacity = live ? 1 : 0.45;
    }
    const levelFrame: LevelFrame = {
      flight,
      time: this.levelTime,
      reveal: eased,
      animationTime: this.animationTime,
      distance,
      elapsed,
      newFlight,
      fighterSpeed,
      droneSpeed,
      victory: victoryTime === undefined ? undefined : {
        time: victoryTime, fighter: this.player.root.position, drone: this.drone.position, exitTime, camera,
      },
    };
    this.level.update(levelFrame);
    this.cannonMarker.visible = flight.phase === 'boss' && !flight.planarBoss;
    if (this.cannonMarker.visible) {
      const p = this.level.contact(flight.exposedCannonX, distance, flight);
      this.cannonMarker.position.set(p.x, p.y, 0);
      this.cannonMarker.scale.setScalar(Math.min(1.25, flight.bossTargetRadius / BOSS_CANNON_RADIUS));
    }
    const saluteShots = this.drawWings(flight, eased, fighterVelocity,
      flight.level === 'titan' ? (eased > 0 ? distance / eased : undefined) : distance, salute, exitTime);
    for (const [index, model] of this.drops.entries()) {
      const drop = flight.drops[index];
      model.root.visible = Boolean(drop);
      if (drop) {
        if (!this.seenDrops.has(drop))
          this.seenDrops.set(drop, this.animationTime);
        model.root.position.set(drop.x, drop.y, 0.22 + Math.sin(this.animationTime * 3) * 0.05);
        model.pose(drop.kind ?? drop.weapon, this.animationTime, (this.animationTime - this.seenDrops.get(drop)!) / 0.22);
      }
    }
    this.drawProjectiles(flight, saluteShots);
    this.drawFeedback(flight, elapsed);
    if (victoryTime !== undefined && this.defeat.pose(victoryTime, (point, tint) => this.combat.emit('defeat', point, tint)))
      this.combat.update(0);
    for (const [index, ring] of this.markers.entries()) {
      const marker = flight.markers[index];
      ring.visible = Boolean(marker) && flight.phase === 'boss';
      if (marker) {
        ring.position.set(marker.x, marker.y, 0.08);
        ring.material.opacity = 0.7 + 0.3 * Math.sin(flight.time * 18);
      }
    }
    const pulse = Math.max(0, flight.pulseFlash - (victoryTime ?? 0));
    this.pulse.visible = pulse > 0;
    this.pulse.position.copy(this.player.root.position);
    this.pulse.scale.setScalar(1 + (0.3 - pulse) * 25);
    this.pulse.material.opacity = pulse / 0.3;
    if (!present) return;
    this.level.effects?.(this.plane, this.bubbleSources, levelFrame, this.renderer);
    this.level.capture?.(this.renderer, camera);
    if (this.level.present) this.level.present(this.renderer, this.scene, camera);
    else this.renderer.render(this.scene, camera);
  }
  private drawWings(flight: Flight, reveal: number, velocity: T.Vector2, distance?: number, victoryTime?: number, exitTime?: number) {
    const fighting = flight.weaponsActive;
    const throttle = Math.min(1, 0.38 + velocity.length() * 0.12 + 0.24 * Math.sin(reveal * Math.PI));
    const formation = victoryTime === undefined ? 0 : victoryFormation(victoryTime);
    const saluteShots: Flight['shots'] | undefined = victoryTime === undefined ? undefined : [];
    if (victoryTime !== undefined && victoryTime >= SALUTE_START) {
      const camera = this.perspective;
      camera.updateMatrixWorld();
      this.plane.updateWorldMatrix(true, false);
      this.saluteProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(this.plane.matrixWorld);
      this.saluteFrustum.setFromProjectionMatrix(this.saluteProjection);
    }
    for (const [index, wing] of flight.wings.entries()) {
      const laser = this.wingLasers[index];
      laser.root.visible = false;
      const origin = flight.wingOrigin(wing.side);
      if (victoryTime !== undefined)
        this.saluteFacing.copy(this.victoryFacing).multiply(this.saluteRoll.setFromAxisAngle(this.rollAxis, -wing.side * SALUTE_ANGLE));
      for (const pod of this.wingPods[index]) {
        pod.root.visible = flight.hull > 0 && wing.weapon === pod.weapon;
        if (!pod.root.visible)
          continue;
        const time = this.animationTime + index * 0.47;
        pod.root.position.set(T.MathUtils.lerp(origin.x, wing.side * WING_FORMATION.x, formation),
          T.MathUtils.lerp(origin.y, victoryShipY + WING_FORMATION.y, formation), 0);
        if (exitTime !== undefined) {
          pod.root.position.set(origin.x - flight.player.x, origin.y - flight.player.y, 0)
            .applyQuaternion(this.victoryFacing).add(this.player.root.position);
        }
        pod.root.rotation.set((this.level.orientation ? -this.pitch : -(this.level.shipPitch ?? 1.18) * reveal) + 0.09 * Math.sin(time * 6), this.bank - 0.046 * velocity.x + 0.14 * Math.sin(time * 5), 0.08 * Math.sin(time * 4));
        if (exitTime !== undefined) pod.root.quaternion.copy(this.victoryFacing);
        else if (formation > 0) pod.root.quaternion.slerp(this.saluteFacing, formation);
        const recoil = fighting ? wing.flash / WING_FLASH_TIME : 0;
        const charge = pod.weapon === 'omega' && fighting ? Math.max(0, 1 - wing.cooldown / 0.28) : 0;
        let activity = wing.beamEnd && fighting ? 0.55 + 0.13 * Math.sin(time * 31) : Math.max(recoil, charge);
        if (saluteShots && victoryTime !== undefined && victoryTime >= SALUTE_START) {
          const muzzle = this.saluteMuzzle.set(0, .08, .085).applyQuaternion(pod.root.quaternion).add(pod.root.position);
          const direction = this.saluteDirection.set(0, 1, 0).applyQuaternion(pod.root.quaternion);
          if (pod.weapon === 'laser') {
            const hold = victoryTime - SALUTE_START;
            const length = victoryLaserLength(this.saluteFrustum, muzzle, direction) * T.MathUtils.smoothstep(hold, 0, .18);
            laser.root.visible = length > 0;
            laser.root.position.copy(muzzle);
            laser.root.quaternion.copy(pod.root.quaternion);
            laser.draw({ x: 0, y: 0 }, { x: 0, y: length }, hold, this.animationTime, false, { upgraded: wing.upgraded });
            activity = .55 + .13 * Math.sin(time * 31);
          } else {
            activity = addVictoryWingShots(saluteShots, pod.weapon, wing.upgraded, victoryTime, muzzle, direction);
          }
        }
        pod.pose(time, throttle, activity, recoil, wing.upgraded);
      }
      if (saluteShots) continue;
      laser.root.visible = fighting && flight.hull > 0 && Boolean(wing.beamEnd);
      if (laser.root.visible && wing.beamEnd) {
        laser.root.position.set(0, 0, 0);
        laser.root.quaternion.identity();
        const target = wing.laserTarget;
        let model: T.Object3D | undefined;
        if (target && typeof target !== 'number') {
          const index = flight.enemies.indexOf(target);
          if (index >= 0)
            model = this.level.models[index];
          if(target.summer?.kind==='hydra'&&wing.laserHead!==undefined)model=model?.getObjectByName('hydra-head-'+wing.laserHead);
        }
        const shieldModel=flight.encounterLevel==='summer'&&flight.phase==='boss'&&target===undefined?this.level.boss:undefined;
        let end = flight.isDen || (typeof target === 'number' && flight.planarBoss) ? wing.beamEnd : typeof target === 'number' ? this.level.contact(target, distance ?? BOSS_CAMERA_DISTANCE, flight)
          : model ? this.laserContact(origin, wing.beamEnd, model, distance, this.viewPitch) : shieldModel?this.laserContact(origin,wing.beamEnd,shieldModel,distance,this.viewPitch):wing.beamEnd;
        if (flight.isFleet && typeof target === 'number') {
          const hullEnd = this.laserContact(origin, { x: origin.x, y: 9 }, this.level.boss, distance);
          if (hullEnd.y < 9 - 1e-5) end = hullEnd;
        }
        if (flight.phase === 'boss' && flight.keepDepthShotsForward && end.y < origin.y) end = wing.beamEnd;
        const contact = typeof target === 'number' || Boolean(model);
        if (flight.isDen) {
          const z = .85;
          laser.root.position.z = z;
          laser.draw(planarProjectileLayer(origin, z), planarProjectileLayer(end, z), wing.laserHold, this.animationTime, contact,
            { upgraded: wing.upgraded });
        } else {
          const shielded = typeof target === 'number' && flight.fonsShielded;
          laser.draw(origin, end, wing.laserHold, this.animationTime, contact && !shielded,
            { blocked: shielded || (flight.phase === 'boss' && target === undefined), upgraded: wing.upgraded });
        }
      }
    }
    return saluteShots;
  }
  private drawProjectiles(flight: Flight, saluteShots?: Flight['shots']) {
    const shots = saluteShots ?? (flight.planarBoss && !flight.isFonsFight && flight.phase !== 'stage' ? flight.shots.map(s => ({ ...s, ...planarProjectileLayer(s, .85) })) : flight.shots);
    this.projectiles.ship.draw(shots.filter((shot) => !shot.drone && !shot.wing), this.animationTime);
    this.projectiles.drone.draw(shots.filter((shot) => shot.drone), this.animationTime);
    for (const weapon of ['homing', 'cannon', 'omega'] as const) {
      this.projectiles[weapon].draw(shots.filter((shot) => shot.wing === weapon), this.animationTime);
    }
    this.patternProjectiles?.draw(flight.threats);
    const threats = this.patternProjectiles ? flight.threats.filter(s => !s.pattern) : flight.threats;
    const hostile = flight.isDen ? threats.map(s => ({ ...s, ...planarProjectileLayer(s, .85) }))
      : flight.level === 'fleet' ? threats.filter(s => !s.broadside) : threats;
    this.projectiles.hostile.draw(flight.encounterLevel !== 'ice' && flight.encounterLevel !== 'broodlock' && !flight.isFonsFight ? hostile : [], this.animationTime);
    this.projectiles.brine.draw(flight.encounterLevel === 'ice' ? threats : [], this.animationTime);
    this.projectiles.spore.draw(flight.encounterLevel === 'broodlock' ? threats : [], this.animationTime);
  }
  private drawFeedback(flight: Flight, elapsed: number) {
    this.combat.update(elapsed);
    let shipFired = false;
    let droneFired = false;
    let emitted = false;
    for (const shot of flight.shots) {
      if (this.seenShots.has(shot))
        continue;
      this.seenShots.add(shot);
      if (!shot.wing) {
        if (shot.drone)
          droneFired = true;
        else
          shipFired = true;
      }
    }
    this.playerMuzzle.update(elapsed, shipFired);
    this.droneMuzzle.update(elapsed, droneFired);
    for (const [enemy, previous] of this.enemyVitals) {
      const laserDamage = (enemy.laserDamage ?? 0) - previous.laserDamage;
      if (previous.hp - enemy.hp - laserDamage > 1e-6 && (enemy.hp === 0 || this.animationTime - previous.at > 0.07)) {
        this.combat.emit(enemy.hp === 0 ? 'kill' : 'hit', enemy.hitPoint??(enemy.ambusher ? ambusherFeedback(enemy.ambusher,flight.time) : enemy.ventWorm ? faunaMuzzle(enemy) : enemy), enemy.hp === 0 ? orange : teal);
        previous.at = this.animationTime;
        emitted = true;
      }
      previous.hp = enemy.hp;
      previous.laserDamage = enemy.laserDamage ?? 0;
      if (!flight.enemies.includes(enemy))
        this.enemyVitals.delete(enemy);
    }
    for (const enemy of flight.enemies)
      if (!enemy.mine && !this.enemyVitals.has(enemy))
        this.enemyVitals.set(enemy, {
          hp: enemy.hp,
          laserDamage: enemy.laserDamage ?? 0,
          at: -1
        });
    const bossLaserDamage = flight.bossLaserDamage - this.previousBossLaserDamage;
    if (flight.phase === 'boss' && this.previousBossHealth - flight.bossHealth - bossLaserDamage > 1e-6 && this.animationTime - this.bossHitAt > 0.07) {
      this.combat.emit('hit', flight.isCicadaFight ? flight.cicadaMuzzle() : flight.encounterLevel==='summer'&&flight.summerLastHit?flight.summerLastHit:flight.isFleet||flight.isFonsFight?
        planarProjectileLayer({ x: flight.exposedCannonX, y: flight.bossAimY }, .85):{
        x: flight.exposedCannonX,
        y: flight.bossAimY,
        z: flight.isDen ? .91 : BOSS_DEPTH + BOSS_MUZZLE_Z
      }, teal);
      this.bossHitAt = this.animationTime;
      emitted = true;
    }
    if (flight.hull < this.previousHull) {
      this.combat.emit(flight.hull === 0 ? 'kill' : 'hit', flight.player, orange);
      emitted = true;
    }
    if (flight.phase === 'stage' || (flight.level === 'wormhole' && flight.phase === 'approach'))
      for (const drop of this.previousDrops) {
        if (!flight.drops.includes(drop) && drop.y > -8.5 && Math.hypot(drop.x - flight.player.x, drop.y - flight.player.y) < 1.6) {
          this.combat.emit('pickup', drop, drop.kind === 'repair' ? repairColor : wingWeapons[drop.weapon].color);
          emitted = true;
        }
      }
    this.previousDrops = flight.drops;
    this.previousBossHealth = flight.bossHealth;
    this.previousHull = flight.hull;
    this.previousBossLaserDamage = flight.bossLaserDamage;
    if (emitted)
      this.combat.update(0);
  }
}
