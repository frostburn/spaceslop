export const WIDTH = 9;
export const HEIGHT = 16;
export const STEP = 1 / 60;
export const BOSS_DEPTH = -12;
export const BOSS_Y = 4.2;
export const BOSS_CAMERA_DISTANCE = 22;
export const BOSS_PROJECTION = BOSS_CAMERA_DISTANCE / (BOSS_CAMERA_DISTANCE - BOSS_DEPTH);
export const BOSS_CANNON_X = 2.4;
export const BOSS_CANNON_RADIUS = 0.8;
export const BOSS_HP = 30;
export const TRANSITION_TIME = 1.25;

export type DroneWeapon = 'sentry' | 'towline';

type Phase = 'stage' | 'approach' | 'boss' | 'won' | 'lost';
type Point = { x: number; y: number };
type Shot = Point & { z: number; vx: number; vy: number; vz: number; drone?: boolean; targetsBoss?: boolean };
type Enemy = Point & { lane: number; age: number; fire: number; hp: number };

const SHIP_SPEED = 6.5;
const DRONE_SPEED = 4 * SHIP_SPEED;
const DRONE_FIRE_INTERVAL = 0.44;
const TOWLINE_INTERVAL = 1.05;
const TOWLINE_DURATION = 0.2;
const TOWLINE_DAMAGE = 2;

const stageWaves = [
  { time: 0.6, lanes: [-2.6, 0, 2.6] },
  { time: 3.6, lanes: [-2, 2] },
  { time: 6.6, lanes: [-3, 0, 3] },
  { time: 9.6, lanes: [-1.3, 1.3] },
];

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const near = (a: Point, b: Point, radius: number) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < radius ** 2;

function moveWithinField(point: Point, dx: number, dy: number) {
  point.x = clamp(point.x + dx, -3.95, 3.95);
  point.y = clamp(point.y + dy, -7.1, 6.6);
}

function moveToward(point: Point, target: Point, maxStep: number) {
  const dx = target.x - point.x;
  const dy = target.y - point.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maxStep) {
    point.x = target.x;
    point.y = target.y;
    return true;
  }
  const fraction = maxStep / distance;
  point.x += dx * fraction;
  point.y += dy * fraction;
  return false;
}

function nearSegment(point: Point, start: Point, end: Point, radius: number) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const fraction = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return near(point, { x: start.x + fraction * dx, y: start.y + fraction * dy }, radius);
}

export class Flight {
  phase: Phase = 'stage';
  time = 0;
  player = { x: 0, y: -5.3 };
  drone = { x: -1.15, y: -5.3 };
  droneTarget?: Point;
  hull = 4;
  invulnerable = 0;
  charges = 2;
  score = 0;
  bossHealth = BOSS_HP;
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  threats: Shot[] = [];
  markers: Point[] = [];
  pulseFlash = 0;
  towlineFlash = 0;
  private aim?: Point;
  private nextWave = 0;
  private cooldown = 0;
  private droneCooldown = 0;
  private volley = 0;
  private towlineEnemies = new Set<Enemy>();
  private towlineHitCannon = false;

  readonly droneWeapon: DroneWeapon;

  constructor(droneWeapon: DroneWeapon = 'sentry') {
    this.droneWeapon = droneWeapon;
    if (droneWeapon === 'towline') this.droneCooldown = TOWLINE_INTERVAL;
  }

  get towlineLinked() {
    return this.droneWeapon === 'towline' && !this.droneTarget &&
      (this.phase === 'stage' || this.phase === 'boss') && !near(this.player, this.drone, 0.5);
  }

  get exposedCannonX() {
    return this.volley % 2 === 0 ? -BOSS_CANNON_X : BOSS_CANNON_X;
  }

  deployDrone(x: number, y: number) {
    const target = { x: 0, y: 0 };
    moveWithinField(target, x, y);
    this.droneTarget = target;
  }

  aimBy(dx: number, dy: number) {
    this.aim ??= { ...this.player };
    moveWithinField(this.aim, dx, dy);
  }

  clearAim() {
    this.aim = undefined;
  }

  steer(x: number, y: number, dt: number) {
    const maxStep = SHIP_SPEED * dt;
    const direction = Math.hypot(x, y);
    if (direction > 0) {
      this.clearAim();
      moveWithinField(this.player, x / direction * maxStep, y / direction * maxStep);
      return;
    }

    if (this.aim && moveToward(this.player, this.aim, maxStep)) this.clearAim();
  }

  pulse() {
    if (this.charges === 0 || (this.phase !== 'stage' && this.phase !== 'boss')) return;
    this.charges--;
    this.pulseFlash = 0.3;
    this.threats = [];
    if (this.phase === 'stage') {
      this.score += this.enemies.length * 100;
      this.enemies = [];
    } else {
      this.damageBoss(6);
    }
  }

  step(dt: number) {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.time += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.pulseFlash = Math.max(0, this.pulseFlash - dt);
    if (this.droneTarget && moveToward(this.drone, this.droneTarget, DRONE_SPEED * dt)) {
      this.droneTarget = undefined;
    }
    if (this.phase === 'approach') {
      if (this.time >= TRANSITION_TIME) this.enter('boss');
      return;
    }

    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.cooldown += 0.19;
      this.fire(this.player);
    }
    const boss = this.phase === 'boss';
    if (boss) this.stepBoss();
    else this.stepStage(dt);
    this.stepDroneWeapon(dt);

    this.shots = this.shots.filter((shot) => {
      const previousY = shot.y;
      this.advance(shot, dt);
      if (boss) {
        if (shot.z > BOSS_DEPTH) return true;
        const untilImpact = (BOSS_DEPTH - shot.z) / shot.vz;
        const impact = { x: shot.x + shot.vx * untilImpact, y: shot.y + shot.vy * untilImpact };
        if (shot.targetsBoss ||
          (shot.drone && near(impact, { x: this.exposedCannonX, y: BOSS_Y }, BOSS_CANNON_RADIUS))) {
          this.damageBoss(1);
        }
        return false;
      }
      const enemy = this.enemies.find((target) => target.hp > 0 &&
        Math.abs(shot.x - target.x) < 0.52 &&
        shot.y >= target.y - 0.46 && previousY <= target.y + 0.46);
      if (!enemy) return shot.y < 9;
      this.damageEnemy(enemy, 1);
      return false;
    });
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0 && enemy.y > -9);

    this.threats = this.threats.filter((shot) => {
      this.advance(shot, dt);
      if (boss) {
        if (shot.z < 0) return true;
        if (near(shot, this.player, 0.58)) this.hit();
        return false;
      }
      if (near(shot, this.player, 0.44)) {
        this.hit();
        return false;
      }
      return Math.abs(shot.x) < 5 && Math.abs(shot.y) < 9;
    });

    if (this.phase === 'stage' && this.time >= 14) this.enter('approach');
  }

  private stepDroneWeapon(dt: number) {
    if (this.phase !== 'stage' && this.phase !== 'boss') return;
    this.droneCooldown = Math.max(0, this.droneCooldown - dt);
    if (this.droneWeapon === 'sentry') {
      if (!this.droneTarget && this.droneCooldown === 0) {
        this.droneCooldown = DRONE_FIRE_INTERVAL;
        this.fire(this.drone, true);
      }
      return;
    }

    if (!this.towlineLinked) {
      this.towlineFlash = 0;
      return;
    }
    this.towlineFlash = Math.max(0, this.towlineFlash - dt);
    if (this.droneCooldown === 0) {
      this.droneCooldown = TOWLINE_INTERVAL;
      this.towlineFlash = TOWLINE_DURATION;
      this.towlineEnemies.clear();
      this.towlineHitCannon = false;
    }
    if (this.towlineFlash === 0) return;

    if (this.phase === 'boss') {
      const cannon = { x: this.exposedCannonX * BOSS_PROJECTION, y: BOSS_Y * BOSS_PROJECTION };
      if (!this.towlineHitCannon &&
        nearSegment(cannon, this.player, this.drone, BOSS_CANNON_RADIUS * BOSS_PROJECTION)) {
        this.towlineHitCannon = true;
        this.damageBoss(TOWLINE_DAMAGE);
      }
      return;
    }
    for (const enemy of this.enemies) {
      if (enemy.hp > 0 && !this.towlineEnemies.has(enemy) &&
        nearSegment(enemy, this.player, this.drone, 0.52)) {
        this.towlineEnemies.add(enemy);
        this.damageEnemy(enemy, TOWLINE_DAMAGE);
      }
    }
  }

  private stepStage(dt: number) {
    const wave = stageWaves[this.nextWave];
    if (wave && this.time >= wave.time) {
      this.nextWave++;
      this.enemies.push(...wave.lanes.map((lane, index) =>
        ({ x: lane, y: 8.6, lane, age: 0, fire: 1.1 + index * 0.28, hp: 2 })));
    }

    for (const enemy of this.enemies) {
      enemy.age += dt;
      enemy.y -= 2.25 * dt;
      enemy.x = enemy.lane + Math.sin(enemy.age * 1.55) * 0.46;
      if (enemy.age >= enemy.fire) {
        enemy.fire += 2.4;
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const scale = 5.7 / (Math.hypot(dx, dy) || 1);
        this.threats.push({ x: enemy.x, y: enemy.y, z: 0, vx: dx * scale, vy: dy * scale, vz: 0 });
      }
      if (near(enemy, this.player, 0.68)) {
        enemy.hp = 0;
        this.hit();
      }
    }
  }

  private stepBoss() {
    const elapsed = this.time % 2;
    const volley = Math.floor(this.time / 2);
    if (elapsed >= 0.45 && this.markers.length === 0 && elapsed < 1.18) {
      const { x, y } = this.player;
      this.markers = [-1.35, 0, 1.35].map((offset) => ({
        x: clamp(x, -2.6, 2.6) + (this.volley % 2 === 0 ? offset : 0),
        y: clamp(y, -5.9, 5.25) + (this.volley % 2 === 0 ? 0 : offset),
      }));
    }
    if (elapsed >= 1.18 && this.markers.length && this.volley === volley) {
      const duration = 0.48;
      this.threats.push(...this.markers.map((target) => ({
        x: 0, y: BOSS_Y, z: BOSS_DEPTH,
        vx: target.x / duration, vy: (target.y - BOSS_Y) / duration, vz: -BOSS_DEPTH / duration,
      })));
      this.volley++;
    }
    if (elapsed >= 1.68) this.markers = [];
  }

  private fire({ x, y }: Point, drone = false) {
    if (this.phase === 'stage') {
      this.shots.push({ x, y: y + (drone ? 0.3 : 0.45), z: 0, vx: 0, vy: 15, vz: 0, drone });
      return;
    }

    const duration = 0.38;
    const targetsBoss = !drone && Math.abs(x) < 1.65;
    // Drone shots follow the sight line through their launch point, with no lock-on.
    const expansion = 1 / BOSS_PROJECTION - 1;
    const dx = drone ? x * expansion : (targetsBoss ? -x : 0);
    const dy = drone ? y * expansion : (targetsBoss ? BOSS_Y - y : 0);
    this.shots.push({ x, y, z: 0, vx: dx / duration, vy: dy / duration,
      vz: BOSS_DEPTH / duration, targetsBoss, drone });
  }

  private advance(shot: Shot, dt: number) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.z += shot.vz * dt;
  }

  private damageEnemy(enemy: Enemy, damage: number) {
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (enemy.hp === 0) this.score += 100;
  }

  private damageBoss(damage: number) {
    if (this.phase !== 'boss') return;
    this.bossHealth = Math.max(0, this.bossHealth - damage);
    if (this.bossHealth === 0) {
      this.score += 1000;
      this.enter('won');
    }
  }

  private hit() {
    if (this.invulnerable > 0 || (this.phase !== 'stage' && this.phase !== 'boss')) return;
    this.invulnerable = 1.05;
    this.hull--;
    if (this.hull === 0) this.enter('lost');
  }

  private enter(phase: Phase) {
    this.phase = phase;
    this.time = 0;
    if (phase === 'approach') {
      this.shots = [];
      this.threats = [];
      this.enemies = [];
    }
    if (phase === 'boss') {
      this.cooldown = 0;
      this.droneCooldown = this.droneWeapon === 'towline' ? TOWLINE_INTERVAL : 0;
    }
  }
}
