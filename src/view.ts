import * as T from 'three';
import { createInterceptorRig, createRaptorRig } from './encounter-rigs';
import { loadEncounterTextures } from './encounter-texture';
import { BOSS_RECOIL_TIME } from './encounters';
import {
  BOSS_CAMERA_DISTANCE, BOSS_CANNON_RADIUS, BOSS_CANNON_X, BOSS_DEPTH, BOSS_PROJECTION,
  BOSS_Y, Flight, HEIGHT, TRANSITION_TIME, WIDTH,
} from './game';
import { createPreserveEdges, PRESERVE_LOOP } from './preserve-edges';
import { createDroneRig, createFighterRig, createScoutRig } from './ship-rigs';
import { wingWeapons, type WingProjectile } from './wing';

const sceneColor = 0x0b1020;
const teal = 0x88f2ff;
const orange = 0xff885d;
const mint = 0xa1ffc5;

export class FlightView {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private plane = new T.Group();
  private ortho = new T.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 0.1, 240);
  private perspective = new T.PerspectiveCamera(38, WIDTH / HEIGHT, 0.1, 240);
  private player = createFighterRig();
  private boss = createInterceptorRig(BOSS_CANNON_X);
  private raptor = createRaptorRig();
  private preserveEdges = createPreserveEdges();
  private drone = createDroneRig();
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
  private enemies: T.Group[];
  private shotMeshes = this.projectiles(teal);
  private droneShots = this.projectiles(mint);
  private threatMeshes = this.projectiles(orange, 0.16);
  private wingProjectiles: Record<WingProjectile, T.InstancedMesh> = {
    homing: this.projectiles(wingWeapons.homing.color, 0.12),
    cannon: this.projectiles(wingWeapons.cannon.color),
    omega: this.projectiles(wingWeapons.omega.color, 0.23),
  };
  private mounts = this.player.hardpoints.map((socket) => {
    const housing = new T.Mesh(new T.BoxGeometry(0.16, 0.28, 0.10),
      new T.MeshStandardMaterial({ color: 0x364252, roughness: 0.48 }));
    const stripe = new T.Mesh(new T.BoxGeometry(0.085, 0.20, 0.023), new T.MeshBasicMaterial());
    stripe.position.z = 0.053;
    housing.add(stripe);
    socket.add(housing);
    return { housing, stripe };
  });
  private wingLasers = Array.from({ length: 2 }, () => new T.Mesh(
    new T.PlaneGeometry(0.1, 1),
    new T.MeshBasicMaterial({ color: wingWeapons.laser.color, transparent: true, opacity: 0.85, depthWrite: false }),
  ));
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
  private swing = 0;
  private scroll = 0;
  private matrix = new T.Matrix4();
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
    loadEncounterTextures(this.boss);
    const scout = createScoutRig();
    this.enemies = Array.from({ length: 12 }, () => scout.clone());
    this.towline.add(this.towlineGlow, this.towlineCore);
    this.plane.add(this.player.root, this.drone, this.droneGoal, this.towline, this.boss.root, this.raptor.root, this.cannonMarker, this.stars, this.preserveEdges,
      this.pulse, this.shotMeshes, this.droneShots, this.threatMeshes, ...this.enemies, ...this.markers,
      ...Object.values(this.wingProjectiles), ...this.wingLasers, ...this.drops);
  }

  resize(width: number, height: number) {
    if (!width || !height) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(width, height, false);
  }

  render(flight: Flight, elapsed = 0) {
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
    this.drone.position.set(flight.drone.x, flight.drone.y, 0.23);
    this.drone.visible = flight.hull > 0;
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
    }
    this.scroll = flight.phase === 'stage' ? (this.scroll + elapsed * 1.65) % 12 : this.scroll;
    this.stars.position.y = -this.scroll;
    this.preserveEdges.visible = this.swing === 0;
    if (flight.phase === 'stage') {
      this.preserveEdges.position.y = -(flight.time * 1.65 % PRESERVE_LOOP);
    }

    const raptor = flight.enemies.find((enemy) => enemy.raptor);
    this.raptor.root.visible = Boolean(raptor);
    if (raptor) {
      this.raptor.root.position.set(raptor.x, raptor.y, 0);
      this.raptor.root.rotation.z = Math.PI;
      this.raptor.pose(raptor.age);
    }
    for (const [index, model] of this.enemies.entries()) {
      const enemy = flight.enemies[index];
      model.visible = Boolean(enemy && !enemy.raptor);
      if (enemy && !enemy.raptor) {
        model.position.set(enemy.x, enemy.y, 0);
        model.rotation.z = Math.PI + 0.3 * Math.cos(enemy.age * 1.55);
      }
    }

    this.drawWings(flight);
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

  private drawWings(flight: Flight) {
    const fighting = flight.phase === 'stage' || flight.phase === 'boss';
    for (const [index, wing] of flight.wings.entries()) {
      const { housing, stripe } = this.mounts[index];
      const laser = this.wingLasers[index];
      const origin = flight.wingOrigin(wing.side);
      housing.visible = Boolean(wing.weapon);
      if (wing.weapon) {
        const charge = wing.weapon === 'omega' && fighting && wing.cooldown < 0.28;
        stripe.material.color.setHex(charge ? 0xffffdf : wingWeapons[wing.weapon].color);
      }

      laser.visible = fighting && Boolean(wing.beamEnd);
      if (wing.beamEnd) {
        const endY = wing.beamEnd.y;
        laser.position.set(origin.x, (origin.y + endY) / 2, 0.16);
        laser.scale.y = Math.abs(endY - origin.y);
        laser.scale.x = 1 + Math.min(wing.laserHold, 0.85);
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
      this.matrix.makeTranslation(shot.x, shot.y, shot.z + 0.12);
      mesh.setMatrixAt(i, this.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
