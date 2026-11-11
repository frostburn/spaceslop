import * as T from 'three';
import { poseBurners, shipBurners } from './burners';
import { createDroneRig, createFighterRig } from './ship-rigs';
import { BOSS_MUZZLE_Z } from './encounters';
import { BOSS_CAMERA_DISTANCE, BOSS_CANNON_RADIUS, BOSS_PROJECTION, BOSS_DEPTH, Flight, HEIGHT, WIDTH } from './game';
import { WING_FLASH_TIME, wingWeapons, type WingWeapon } from './wing';
import { createWingPod } from './wing-pod';
import { createCombatEffects } from './combat-effects';
import { createLaserContactTrace } from './laser-contact';
import { createPowerupGraphic } from './powerup-graphics';
import { createContinuousLaser, createMuzzleFlash, createProjectileBatch, projectileKinds, type ProjectileKind } from './projectile-graphics';
import { ambusherFeedback } from './preserve-ambusher';
import { faunaMuzzle } from './vent-fauna';
import type { LevelId } from './levels';
import { levelLoaders } from './rendering/loaders';
import { type LevelFactory, type LevelScene, type LevelFrame } from './rendering/level';
import { loadCommonTextures } from './rendering/common-textures';
import { tiltFlightCamera } from './rendering/flight-camera';
import { boostFriendlyGlow } from './rendering/friendly-glow';
import { disposeScene } from './rendering/dispose';
export async function createFlightView(canvas: HTMLCanvasElement, level: LevelId, signal = new AbortController().signal) {
  const { createLevel } = await levelLoaders[level]();
  signal.throwIfAborted();
  return new FlightView(canvas, level, createLevel, signal);
}
const sceneColor = 0x0b1020;
const teal = 0x88f2ff;
const orange = 0xff885d;
const mint = 0xa1ffc5;
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
  private scene = new T.Scene();
  private plane = new T.Group();
  private ortho = new T.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, .1, 240);
  private perspective = new T.PerspectiveCamera(38, WIDTH / HEIGHT, .1, 240);
  private keyLight?: T.DirectionalLight;
  private skyLight?: T.HemisphereLight;
  private level: LevelScene;
  private disposed = false;
  private levelTime = 0;
  private pitch = 0;
  private bank = 0;
  private viewPitch = 0;
  private player = createFighterRig();
  private playerBurners = shipBurners(this.player.root);
  private bubbleSources: T.Mesh[] = [];
  private drone = createDroneRig();
  private droneBurners = shipBurners(this.drone);
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
  private playerMuzzle = createMuzzleFlash(teal);
  private droneMuzzle = createMuzzleFlash(mint);
  private combat = createCombatEffects();
  private wingPods = Array.from({ length: 2 }, () => (Object.keys(wingWeapons) as WingWeapon[])
    .map((weapon) => ({ weapon, ...createWingPod(weapon) })));
  private wingLasers = Array.from({ length: 2 }, createContinuousLaser);
  private laserContact = createLaserContactTrace(this.plane);
  private drops = Array.from({ length: 12 }, createPowerupGraphic);
  private markers = Array.from({ length: 3 }, () => new T.Mesh(new T.RingGeometry(0.53, 0.61, 24), new T.MeshBasicMaterial({
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
  constructor(canvas: HTMLCanvasElement, readonly levelId: LevelId, createLevel: LevelFactory, signal: AbortSignal) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.scene.add(this.plane);
    this.level = createLevel({ plane: this.plane, scene: this.scene, fighter: this.player.root, signal });
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
    this.player.root.add(this.playerMuzzle.root);
    this.drone.add(this.droneMuzzle.root);
    this.plane.add(p.root, this.player.root, this.drone, this.droneGoal, this.towline, this.cannonMarker, this.pulse, ...this.markers, ...ammo, this.combat.root, ...pods, ...this.wingLasers.map(r => r.root), ...this.drops.map(r => r.root));
  }
  async warmup(signal: AbortSignal, repaint: () => void) {
    const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const textures = (await this.texturesReady).flat();
    await nextFrame();
    if (signal.aborted)
      return;
    const camera = new T.OrthographicCamera(-24, 24, 24, -24, .1, 240);
    const compiled = this.renderer.extensions.has('KHR_parallel_shader_compile') ? this.renderer.compileAsync(this.scene, camera) : undefined;
    for (const texture of textures) {
      if (!texture)
        continue;
      await nextFrame();
      if (signal.aborted)
        return;
      this.renderer.initTexture(texture);
    }
    await compiled;
    const contacts = [...this.level.contacts];
    for (let i = 0;i < contacts.length;i += 3) {
      await nextFrame();
      if (signal.aborted)
        return;
      for (const model of contacts.slice(i, i + 3))
        model.traverse(node => {
          if (node instanceof T.Mesh && !node.geometry.boundingBox)
            node.geometry.computeBoundingBox();
        });
    }
    const pods = this.wingPods.map(side => side.map(r => r.root));
    const ordnance = [this.player.root, this.drone, ...Object.values(this.projectiles).map(r => r.root), this.combat.root, this.playerMuzzle.root, this.droneMuzzle.root, ...this.drops.slice(0, 4).map(r => r.root)];
    const lasers = [...pods[1], ...this.wingLasers.map(r => r.root)];
    this.level.prepare?.();
    for (const objects of [...this.level.warmup, [this.cannonMarker, ...this.markers], pods[0], lasers, ordnance]) {
      await nextFrame();
      if (signal.aborted)
        return;
      if (objects === ordnance) {
        for (const batch of Object.values(this.projectiles))
          batch.prime();
        this.combat.prime();
        this.playerMuzzle.prime();
        this.droneMuzzle.prime();
        (Object.keys(wingWeapons) as WingWeapon[]).forEach((weapon, i) => this.drops[i].pose(weapon, 0));
      }
      if (objects === lasers)
        for (const laser of this.wingLasers)
          laser.prime();
      camera.position.set(0, 0, 95).applyQuaternion(this.plane.quaternion);
      camera.up.set(0, 1, 0).applyQuaternion(this.plane.quaternion);
      camera.lookAt(0, 0, 0);
      const visible = objects.map(o => o.visible);
      const viewport = this.renderer.getViewport(new T.Vector4());
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
        this.renderer.setScissorTest(false);
        this.renderer.setViewport(viewport);
        repaint();
      }
    }
    this.level.afterWarmup?.();
  }
  dispose() {
    if (this.disposed)
      return;
    this.disposed = true;
    void this.texturesReady.finally(() => {
      this.level.dispose?.();
      disposeScene(this.scene);
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    });
  }
  resize(width: number, height: number) {
    if (!width || !height)
      return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(width, height, false);
  }
  render(flight: Flight, elapsed = 0) {
    if (this.disposed || !this.surfacesReady)
      return;
    if (flight.level !== this.levelId)
      throw new Error('A flight view belongs to one level.');
    const newFlight = flight !== this.lastFlight;
    this.lastFlight = flight;
    this.animationTime = newFlight ? 0 : this.animationTime + elapsed;
    if (newFlight) {
      this.levelTime = 0;
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
    if (flight.phase === 'boss')
      this.levelTime = flight.stageDuration + flight.transitionDuration + flight.time;
    if (flight.level === 'wormhole') this.levelTime = flight.wormholeTime;
    if (flight.phase === 'stage')
      this.swing = 0;
    if (flight.phase === 'approach')
      this.swing = Math.min(flight.time / flight.transitionDuration, 1);
    if (flight.phase === 'boss')
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
    this.player.root.position.set(flight.player.x, flight.player.y, 0);
    this.player.root.rotation.x = orientation ? -this.pitch : -(this.level.shipPitch ?? 1.18) * eased;
    this.player.root.rotation.y = this.bank;
    this.player.root.visible = flight.hull > 0 && Math.floor(flight.invulnerable * 12) % 2 === 0;
    const fighterVelocity = this.fighterMotion(flight.player, elapsed, newFlight);
    const fighterSpeed = fighterVelocity.length();
    poseBurners(this.playerBurners, this.animationTime, Math.min(1, 0.36 + fighterSpeed * 0.1 + 0.34 * Math.sin(eased * Math.PI)));
    this.drone.rotation.x = orientation ? -this.pitch : -(this.level.dronePitch ?? 0) * eased;
    this.drone.rotation.y = this.bank;
    this.drone.position.set(flight.drone.x, flight.drone.y, 0.23);
    this.drone.visible = flight.hull > 0;
    const droneVelocity = this.droneMotion(flight.drone, elapsed, newFlight);
    const droneSpeed = droneVelocity.length();
    if (newFlight)
      this.drone.rotation.z = 0;
    if (droneSpeed > 0.9) {
      const delta = Math.atan2(-droneVelocity.x, droneVelocity.y) - this.drone.rotation.z;
      const turn = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.drone.rotation.z += turn * (1 - Math.exp(-21 * elapsed));
    }
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
      droneSpeed
    };
    this.level.update(levelFrame);
    this.cannonMarker.visible = flight.phase === 'boss' && !flight.planarBoss;
    if (this.cannonMarker.visible) {
      const p = this.level.contact(flight.exposedCannonX, distance, flight);
      this.cannonMarker.position.set(p.x, p.y, 0);
      this.cannonMarker.scale.setScalar(Math.min(1.25, flight.bossTargetRadius / BOSS_CANNON_RADIUS));
    }
    this.drawWings(flight, eased, fighterVelocity, flight.level === 'titan' ? (eased > 0 ? distance / eased : undefined) : distance);
    for (const [index, model] of this.drops.entries()) {
      const drop = flight.drops[index];
      model.root.visible = Boolean(drop);
      if (drop) {
        if (!this.seenDrops.has(drop))
          this.seenDrops.set(drop, this.animationTime);
        model.root.position.set(drop.x, drop.y, 0.22 + Math.sin(this.animationTime * 3) * 0.05);
        model.pose(drop.weapon, this.animationTime, (this.animationTime - this.seenDrops.get(drop)!) / 0.22);
      }
    }
    this.drawProjectiles(flight);
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
    this.level.effects?.(this.plane, this.bubbleSources, levelFrame, this.renderer);
    this.level.capture?.(this.renderer, camera);
    if (this.level.present) this.level.present(this.renderer, this.scene, camera);
    else this.renderer.render(this.scene, camera);
  }
  private drawWings(flight: Flight, reveal: number, velocity: T.Vector2, distance?: number) {
    const fighting = flight.weaponsActive;
    const throttle = Math.min(1, 0.38 + velocity.length() * 0.12 + 0.24 * Math.sin(reveal * Math.PI));
    for (const [index, wing] of flight.wings.entries()) {
      const laser = this.wingLasers[index];
      const origin = flight.wingOrigin(wing.side);
      for (const pod of this.wingPods[index]) {
        pod.root.visible = flight.hull > 0 && wing.weapon === pod.weapon;
        if (!pod.root.visible)
          continue;
        const time = this.animationTime + index * 0.47;
        pod.root.position.set(origin.x, origin.y, 0);
        pod.root.rotation.set((this.level.orientation ? -this.pitch : -(this.level.shipPitch ?? 1.18) * reveal) + 0.09 * Math.sin(time * 6), this.bank - 0.046 * velocity.x + 0.14 * Math.sin(time * 5), 0.08 * Math.sin(time * 4));
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
          if (index >= 0)
            model = this.level.models[index];
          if(target.summer?.kind==='hydra'&&wing.laserHead!==undefined)model=model?.getObjectByName('hydra-head-'+wing.laserHead);
        }
        const shieldModel=flight.level==='summer'&&flight.phase==='boss'&&target===undefined?this.level.boss:undefined;
        let end = flight.isDen || (typeof target === 'number' && flight.planarBoss) ? wing.beamEnd : typeof target === 'number' ? this.level.contact(target, distance ?? BOSS_CAMERA_DISTANCE, flight)
          : model ? this.laserContact(origin, wing.beamEnd, model, distance, this.viewPitch) : shieldModel?this.laserContact(origin,wing.beamEnd,shieldModel,distance,this.viewPitch):wing.beamEnd;
        if (flight.isFleet && typeof target === 'number') {
          const hullEnd = this.laserContact(origin, { x: origin.x, y: 9 }, this.level.boss, distance);
          if (hullEnd.y < 9 - 1e-5) end = hullEnd;
        }
        const contact = typeof target === 'number' || Boolean(model);
        if (flight.isDen) {
          const z = .85;
          laser.root.position.z = z;
          laser.draw(planarProjectileLayer(origin, z), planarProjectileLayer(end, z), wing.laserHold, this.animationTime, contact);
        } else {
          laser.draw(origin, end, wing.laserHold, this.animationTime, contact, flight.phase === 'boss' && target === undefined);
        }
      }
    }
  }
  private drawProjectiles(flight: Flight) {
    const shots = flight.planarBoss ? flight.shots.map(s => ({ ...s, ...planarProjectileLayer(s, .85) })) : flight.shots;
    this.projectiles.ship.draw(shots.filter((shot) => !shot.drone && !shot.wing), this.animationTime);
    this.projectiles.drone.draw(shots.filter((shot) => shot.drone), this.animationTime);
    for (const weapon of ['homing', 'cannon', 'omega'] as const) {
      this.projectiles[weapon].draw(shots.filter((shot) => shot.wing === weapon), this.animationTime);
    }
    const hostile = flight.isDen ? flight.threats.map(s => ({ ...s, ...planarProjectileLayer(s, .85) }))
      : flight.level === 'fleet' ? flight.threats.filter(s => !s.broadside) : flight.threats;
    this.projectiles.hostile.draw(flight.level !== 'ice' && flight.level !== 'broodlock' && !flight.isFonsFight ? hostile : [], this.animationTime);
    this.projectiles.brine.draw(flight.level === 'ice' ? flight.threats : [], this.animationTime);
    this.projectiles.spore.draw(flight.level === 'broodlock' ? flight.threats : [], this.animationTime);
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
    if (this.previousBossHealth - flight.bossHealth - bossLaserDamage > 1e-6 && this.animationTime - this.bossHitAt > 0.07) {
      this.combat.emit(flight.bossHealth === 0 ? 'kill' : 'hit', flight.level==='summer'&&flight.summerLastHit?flight.summerLastHit:flight.isFleet||flight.isFonsFight?
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
    if (flight.phase === 'stage')
      for (const drop of this.previousDrops) {
        if (!flight.drops.includes(drop) && drop.y > -8.5 && Math.hypot(drop.x - flight.player.x, drop.y - flight.player.y) < 1.6) {
          this.combat.emit('pickup', drop, wingWeapons[drop.weapon].color);
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
