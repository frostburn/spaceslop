import * as T from 'three';
import { poseBurners, shipBurners } from './burners';
import { createCorridorBridge } from './corridor-bridge';
import { createInterceptorRig, createRaptorRig } from './encounter-rigs';
import { loadEncounterTextures } from './encounter-texture';
import { BOSS_RECOIL_TIME, raptorFlight } from './encounters';
import {
  BOSS_CAMERA_DISTANCE, BOSS_CANNON_RADIUS, BOSS_CANNON_X, BOSS_DEPTH, BOSS_PROJECTION,
  BOSS_Y, Flight, HEIGHT, TRANSITION_TIME, WIDTH,
} from './game';
import { createPreserveEdges, PRESERVE_LOOP } from './preserve-edges';
import { createDroneRig, createFighterRig, createScoutRig } from './ship-rigs';
import { createShipyard } from './shipyard';
import { createStageBackdrops } from './stage-backdrops';
import { WING_FLASH_TIME, wingWeapons, type WingProjectile, type WingWeapon } from './wing';
import { createWingPod } from './wing-pod';

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
  private player = createFighterRig();
  private boss = createInterceptorRig(BOSS_CANNON_X);
  private playerBurners = shipBurners(this.player.root);
  private bossBurners = shipBurners(this.boss.root);
  private raptor = createRaptorRig();
  private preserveEdges = createPreserveEdges();
  private bridge = createCorridorBridge();
  private shipyard = createShipyard();
  private backdrops = createStageBackdrops();
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
  private shotMeshes = this.projectiles(teal);
  private droneShots = this.projectiles(mint);
  private threatMeshes = this.projectiles(orange, 0.16);
  private wingProjectiles: Record<WingProjectile, T.InstancedMesh> = {
    homing: this.projectiles(wingWeapons.homing.color, 0.12),
    cannon: this.projectiles(wingWeapons.cannon.color),
    omega: this.projectiles(wingWeapons.omega.color, 0.23),
  };
  private wingPods = Array.from({ length: 2 }, () => (Object.keys(wingWeapons) as WingWeapon[])
    .map((weapon) => ({ weapon, ...createWingPod(weapon) })));
  private wingLasers = Array.from({ length: 2 }, () => {
    const root = new T.Group();
    const glow = new T.Mesh(new T.PlaneGeometry(0.19, 1), new T.MeshBasicMaterial({
      color: wingWeapons.laser.color, blending: T.AdditiveBlending, transparent: true, opacity: 0.48, depthWrite: false,
    }));
    const core = new T.Mesh(new T.PlaneGeometry(0.052, 1), new T.MeshBasicMaterial({
      color: 0xffdcf7, transparent: true, opacity: 0.96, depthWrite: false,
    }));
    core.position.z = 0.01;
    root.add(glow, core);
    return { root, glow };
  });
  private drops = Array.from({ length: 12 }, () => new T.Mesh(
    new T.OctahedronGeometry(0.38),
    new T.MeshBasicMaterial({ wireframe: true }),
  ));
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
  private swing = 0;
  private stageTime = 0;
  private animationTime = 0;
  private lastFlight?: Flight;
  private fighterMotion = trackMotion();
  private droneMotion = trackMotion();
  private matrix = new T.Matrix4();
  private shotPosition = new T.Vector3();
  private shotRotation = new T.Quaternion();
  private shotScale = new T.Vector3(1, 1.85, 1);
  private forwardAxis = new T.Vector3(0, 0, 1);
  private rotation = new T.Quaternion();
  private axis = new T.Vector3(1, 0, 0);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.scene.background = new T.Color(sceneColor);
    const light = new T.DirectionalLight(0xb9e8ff, 2.7);
    light.position.set(3, 5, 6);
    this.scene.add(this.plane);
    this.plane.add(light, new T.HemisphereLight(0xd6e3ff, 0x514873, 1.75));

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
    this.texturesReady = Promise.all([this.backdrops.ready, loadEncounterTextures(this.boss, this.raptor,
      [this.player.root, scout, this.drone, this.bridge.root, ...pods])]);
    this.enemies = Array.from({ length: 12 }, () => {
      const root = scout.clone();
      return { root, burners: shipBurners(root) };
    });
    this.towline.add(this.towlineGlow, this.towlineCore);
    this.plane.add(this.player.root, this.drone, this.droneGoal, this.towline, this.boss.root, this.raptor.root, this.cannonMarker, this.stars,
      this.preserveEdges.root, this.shipyard.root, this.backdrops.root, this.bridge.root,
      this.pulse, this.shotMeshes, this.droneShots, this.threatMeshes, ...this.enemies.map(({ root }) => root), ...this.markers,
      ...Object.values(this.wingProjectiles), ...pods, ...this.wingLasers.map(({ root }) => root), ...this.drops);
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

    // Use the actual canvas framebuffer so the draws prime the same programs and buffers as play.
    const stage: T.Object3D[] = [this.raptor.root, this.enemies[0].root, this.bridge.root];
    if (this.backdrops.hasPreserve || this.backdrops.hasShipyard) stage.push(this.backdrops.root);
    const boss: T.Object3D[] = [this.boss.root, this.cannonMarker, ...this.markers];
    if (!this.backdrops.hasShipyard) boss.push(this.shipyard.root);
    const pods = this.wingPods.map((side) => side.map(({ root }) => root));
    for (const objects of [stage, boss, pods[0], [...pods[1], ...this.wingLasers.map(({ root }) => root)]]) {
      await nextFrame();
      if (signal.aborted) return;
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
        this.renderer.render(this.scene, camera);
      } finally {
        objects.forEach((object, index) => { object.visible = visible[index]; });
        this.renderer.setScissorTest(false);
        this.renderer.setViewport(viewport);
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
    const newFlight = flight !== this.lastFlight;
    this.lastFlight = flight;
    this.animationTime = newFlight ? 0 : this.animationTime + elapsed;
    if (flight.phase === 'stage') this.swing = 0;
    if (flight.phase === 'approach') this.swing = Math.min(flight.time / TRANSITION_TIME, 1);
    if (flight.phase === 'boss') this.swing = 1;
    const eased = this.swing ** 2 * (3 - 2 * this.swing);
    const angle = (eased - 1) * Math.PI / 2;
    this.rotation.setFromAxisAngle(this.axis, angle);
    this.plane.quaternion.copy(this.rotation);
    const camera = this.swing === 0 ? this.ortho : this.perspective;
    const distance = T.MathUtils.lerp(95, BOSS_CAMERA_DISTANCE, eased);
    this.perspective.fov = T.MathUtils.radToDeg(2 * Math.atan(HEIGHT / 2 / distance));
    this.perspective.updateProjectionMatrix();
    camera.position.set(0, 0, distance).applyQuaternion(this.rotation);
    camera.up.set(0, 1, 0).applyQuaternion(this.rotation);
    camera.lookAt(0, 0, 0);

    this.player.root.position.set(flight.player.x, flight.player.y, 0);
    this.player.root.rotation.x = -1.18 * eased;
    this.player.root.visible = flight.hull > 0 && Math.floor(flight.invulnerable * 12) % 2 === 0;
    const fighterVelocity = this.fighterMotion(flight.player, elapsed, newFlight);
    const fighterSpeed = fighterVelocity.length();
    poseBurners(this.playerBurners, this.animationTime, Math.min(1, 0.36 + fighterSpeed * 0.1 + 0.34 * Math.sin(eased * Math.PI)));
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
    this.cannonMarker.position.set(flight.exposedCannonX * BOSS_PROJECTION, BOSS_Y * BOSS_PROJECTION, 0);
    this.boss.root.visible = this.swing > 0 && flight.bossHealth > 0;
    this.boss.root.position.z = BOSS_DEPTH - 70 * (1 - eased);
    this.boss.root.rotation.x = 0.9 * (1 - eased);
    if (this.boss.root.visible) {
      this.boss.pose(eased, flight.cannonWindup, flight.exposedCannonX, flight.firedCannonX,
        flight.bossRecoil / BOSS_RECOIL_TIME);
      poseBurners(this.bossBurners, this.animationTime, 0.42 + 0.48 * Math.sin(eased * Math.PI));
    }
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
      root.visible = Boolean(enemy && !enemy.raptor);
      if (enemy && !enemy.raptor) {
        root.position.set(enemy.x, enemy.y, 0);
        root.rotation.z = Math.PI + 0.3 * Math.cos(enemy.age * 1.55);
        poseBurners(burners, enemy.age + index * 0.27, 0.55 + 0.16 * Math.sin(enemy.age * 4 + index));
      }
    }

    this.drawWings(flight, eased, fighterVelocity);
    for (const [index, model] of this.drops.entries()) {
      const drop = flight.drops[index];
      model.visible = Boolean(drop);
      if (drop) {
        model.position.set(drop.x, drop.y, 0.22);
        model.rotation.set(flight.time * 2, flight.time * 3, 0.3);
        model.material.color.setHex(wingWeapons[drop.weapon].color);
      }
    }
    this.drawProjectiles(this.shotMeshes, flight.shots.filter((shot) => !shot.drone && !shot.wing));
    this.drawProjectiles(this.droneShots, flight.shots.filter((shot) => shot.drone));
    for (const [weapon, mesh] of Object.entries(this.wingProjectiles)) {
      this.drawProjectiles(mesh, flight.shots.filter((shot) => shot.wing === weapon));
    }
    this.drawProjectiles(this.threatMeshes, flight.threats);
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
    this.renderer.render(this.scene, camera);
  }

  private drawScenery(flight: Flight, reveal: number, distance: number, elapsed: number, fighterSpeed: number, droneSpeed: number) {
    if (flight.phase === 'stage') this.stageTime = flight.time;
    const scroll = this.stageTime * 1.65;
    this.stars.position.y = -(scroll % 12) - reveal * 2;
    const backdropScroll = this.stageTime * 1.2 + reveal * 6;
    const perspectiveDistance = this.swing === 0 ? undefined : distance;
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

  private drawWings(flight: Flight, reveal: number, velocity: T.Vector2) {
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
        pod.root.rotation.set(-1.18 * reveal + 0.09 * Math.sin(time * 6),
          -0.046 * velocity.x + 0.14 * Math.sin(time * 5), 0.08 * Math.sin(time * 4));
        const recoil = fighting ? wing.flash / WING_FLASH_TIME : 0;
        const charge = pod.weapon === 'omega' && fighting ? Math.max(0, 1 - wing.cooldown / 0.28) : 0;
        const activity = wing.beamEnd && fighting ? 0.55 + 0.13 * Math.sin(time * 31) : Math.max(recoil, charge);
        pod.pose(time, throttle, activity, recoil);
      }

      laser.root.visible = fighting && flight.hull > 0 && Boolean(wing.beamEnd);
      if (laser.root.visible && wing.beamEnd) {
        const endY = wing.beamEnd.y;
        laser.root.position.set(origin.x, (origin.y + endY) / 2, 0.035);
        laser.root.scale.y = Math.abs(endY - origin.y);
        laser.root.scale.x = 1 + Math.min(wing.laserHold, 0.85);
        laser.glow.material.opacity = 0.36 + 0.12 * Math.sin(this.animationTime * 32);
      }
    }
  }

  private projectiles(color: number, radius = 0.092) {
    const mesh = new T.InstancedMesh(
      new T.SphereGeometry(radius, 8, 6),
      new T.MeshBasicMaterial({ color }),
      128,
    );
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
  }

  private drawProjectiles(mesh: T.InstancedMesh, shots: Flight['shots']) {
    mesh.count = Math.min(shots.length, 128);
    for (let i = 0; i < mesh.count; i++) {
      const shot = shots[i];
      this.shotPosition.set(shot.x, shot.y, shot.z + 0.12);
      this.shotRotation.setFromAxisAngle(this.forwardAxis, Math.atan2(-shot.vx, shot.vy));
      this.matrix.compose(this.shotPosition, this.shotRotation, this.shotScale);
      mesh.setMatrixAt(i, this.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
