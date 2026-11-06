import { IO_DURATION, IO_HP, IO_LEG_HP, IO_APPROACH, IO_INTERVAL, IO_WINDUP, IO_FIRE, IO_TRAVEL, calderaContact, calderaWheel, skipperMotion, ioWaves, smooth01 } from './io-layout';
import { bindCentipede, severCentipede, stepCentipedes, CENTIPEDE_SPACING, type CentipedeLink } from './centipede';
import { cicadaMotion, titanInsectWaves, type CicadaCourse } from './titan-insects';
import { TITAN_ROUTE_DURATION, TITAN_ROUTE_END } from './titan-layout';
import { CICADA_HP, TITAN_ASCENT, CICADA_INTERVAL, CICADA_WINDUP, CICADA_FIRE, CICADA_TRAVEL } from './cicada';
import {
  BOSS_FIRE_AT, BOSS_MUZZLE_Z, BOSS_RECOIL_TIME, BOSS_VOLLEY_INTERVAL, BOSS_WINDUP_AT, raptorFlight,
} from './encounters';
import { marineMotion, marineSpecs, marineBodyHit, schoolDelay, type MarineSchool, type MarineFormation, LEVIATHAN_HP, LEVIATHAN_INTERVAL, LEVIATHAN_WINDUP, LEVIATHAN_FIRE, LEVIATHAN_TRAVEL, type MarineKind } from './marine';
import { levels, type LevelId } from './levels';
import { IceCollision } from './ice-collision';
import { ICE_CAMERA_DISTANCE } from './ice-layout';
import { DRONE_HULL, FIGHTER_HULL, HiveCollision, POD_BOUNDS, POD_HULL } from './hive-collision';
import { HIVE_CAMERA_DISTANCE } from './hive-layout';
import { steerHiveAnt } from './ant-navigation';
import { HEIGHT, WIDTH } from './playfield';
import { CLOSE_CALLS_REQUIRED, HOT_DOCK_COOLDOWN, HOT_DOCK_DISTANCE, type PilotId } from './pilot-data';
import { WING_FLASH_TIME, WING_FORMATION, wingWeapons, type WingProjectile, type WingSide, type WingWeapon } from './wing';

export { HEIGHT, WIDTH } from './playfield';
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
type Shot = Point & {
  z: number; vx: number; vy: number; vz: number;
  drone?: boolean; targetsBoss?: boolean; bossSupport?: boolean; wing?: WingProjectile; pierced?: Set<Enemy>; damage?: number;
};
type Threat = Shot & { graze?: 'near' | 'counted' };
type Enemy = Point & {
  lane: number; age: number; fire: number; hp: number; drop?: WingWeapon; raptor?: boolean; ant?: 'worker' | 'soldier'; marine?: MarineKind; school?: MarineSchool;
  centipede?: CentipedeLink; cicada?: CicadaCourse; skipper?: boolean; slot?: number;
  course?: number; courseAt?: number; heading?: number; laserDamage?: number;
};
type Drop = Point & { weapon: WingWeapon };
type Wing = {
  side: WingSide; weapon?: WingWeapon; cooldown: number; flash: number;
  beamEnd?: Point; laserTarget?: Enemy | number; laserHold: number;
};

const MAX_HULL = 4;
const SHIP_SPEED = 6.5;
const DRONE_SPEED = 4 * SHIP_SPEED;
const DRONE_FIRE_INTERVAL = 0.44;
const TOWLINE_INTERVAL = 1.05;
const TOWLINE_DURATION = 0.2;
const TOWLINE_DAMAGE = 2;
const BOSS_IMPACT_TRAVEL = 0.48;

const wingShots = {
  homing: { interval: 0.72, damage: 0.5, speed: 11, bossTravel: 0.68 },
  cannon: { interval: 0.36, damage: 1, speed: 18, bossTravel: 0.32 },
  omega: { interval: 1.7, damage: 4, speed: 20, bossTravel: 0.36 },
};

type Wave = { time: number; lanes: number[]; carrier?: number; drop?: WingWeapon;
  raptor?: number; ant?: 'worker' | 'soldier'; marine?: MarineKind; formation?: MarineFormation; mirror?: number;
  centipede?: number; cicada?: Omit<CicadaCourse, 'slot' | 'count'>; skipper?: boolean };

const stageWaves: Wave[] = [
  { time: 0.6, lanes: [-2.6, 0, 2.6], carrier: 1, drop: 'homing' },
  { time: 3.6, lanes: [-2, 2], raptor: 0, carrier: 1, drop: 'cannon' },
  { time: 6.6, lanes: [-3, 0, 3], carrier: 0, drop: 'laser' },
  { time: 9.6, lanes: [-1.3, 1.3], carrier: 1, drop: 'omega' },
];

const hiveWaves: Wave[] = [
  { time: 0.8, lanes: [-2.6, 0, 2.6], ant: 'worker', carrier: 1, drop: 'homing' },
  { time: 4.8, lanes: [-1.9, 1.9], ant: 'soldier', carrier: 1, drop: 'cannon' },
  { time: 9.2, lanes: [-3, -0.8, 1.6], ant: 'worker', carrier: 0, drop: 'laser' },
  { time: 13.5, lanes: [-2.4, 1.2], ant: 'soldier', carrier: 0, drop: 'omega' },
  { time: 18.2, lanes: [-2.8, 0, 2.8], ant: 'worker' },
  { time: 22.2, lanes: [-2, 2], ant: 'soldier' },
];

// Ten-screen patrol: varied formations, recovery gaps, and repeat weapon opportunities.
export const iceWaves: Wave[] = [
  { marine: 'ichthyosaur', time: 1, formation: 'pincer', mirror: 1, lanes: [-1.8, 1.8], carrier: 0, drop: 'homing' },
  { marine: 'ichthyosaur', time: 5, formation: 'chevron', mirror: 1, lanes: [-1.8, 0, 1.8], carrier: 2, drop: 'cannon' },
  { time: 9, lanes: [0], marine: 'plesiosaur' },
  { marine: 'ichthyosaur', time: 13, formation: 'loop', mirror: 1, lanes: [0, 0, 0, 0, 0], carrier: 1, drop: 'laser' },
  { marine: 'ichthyosaur', time: 17, formation: 'pincer', mirror: 1, lanes: [-1.8, 1.8], carrier: 1, drop: 'omega' },
  { marine: 'ichthyosaur', time: 22, formation: 'slalom', mirror: 1, lanes: [0, 0, 0] },
  { time: 26, lanes: [-1.4, 1.4], marine: 'plesiosaur', carrier: 0, drop: 'homing' },
  { marine: 'ichthyosaur', time: 30, formation: 'chevron', mirror: 1, lanes: [-1.8, 0, 1.8], carrier: 0, drop: 'cannon' },
  { marine: 'ichthyosaur', time: 34, formation: 'pincer', mirror: 1, lanes: [-1.8, 1.8, -1.8, 1.8] },
  { marine: 'ichthyosaur', time: 39, formation: 'loop', mirror: -1, lanes: [0, 0, 0, 0, 0], carrier: 2, drop: 'laser' },
  { time: 43, lanes: [-1.4, 1.4], marine: 'plesiosaur' },
  { marine: 'ichthyosaur', time: 47, formation: 'slalom', mirror: -1, lanes: [0, 0, 0], carrier: 1, drop: 'omega' },
  { marine: 'ichthyosaur', time: 52, formation: 'pincer', mirror: 1, lanes: [-1.8, 1.8], carrier: 0, drop: 'homing' },
  { marine: 'ichthyosaur', time: 56, formation: 'chevron', mirror: 1, lanes: [-1.8, 0, 1.8], carrier: 2, drop: 'cannon' },
  { time: 60, lanes: [0], marine: 'plesiosaur' },
  { marine: 'ichthyosaur', time: 64, formation: 'loop', mirror: 1, lanes: [0, 0, 0, 0, 0], carrier: 0, drop: 'laser' },
  { marine: 'ichthyosaur', time: 69, formation: 'pincer', mirror: 1, lanes: [-1.8, 1.8, -1.8, 1.8], carrier: 1, drop: 'omega' },
  { marine: 'ichthyosaur', time: 73, formation: 'slalom', mirror: -1, lanes: [0, 0, 0] },
  { time: 77, lanes: [0], marine: 'plesiosaur', carrier: 0, drop: 'homing' },
  { marine: 'ichthyosaur', time: 81, formation: 'chevron', mirror: 1, lanes: [-1.8, 0, 1.8], carrier: 1, drop: 'laser' },
];

// Five breakable crawlers alternate with aerial chevrons, sweeps and dives.
export const titanWaves: Wave[] = titanInsectWaves;

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
  drone = { x: -1.15, y: -6.15 };
  droneTarget?: Point;
  hull = MAX_HULL;
  invulnerable = 0;
  charges = 2;
  score = 0;
  bossHealth = BOSS_HP;
  bossLaserDamage = 0;
  firedCannonX = 0;
  bossRecoil = 0;
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  threats: Threat[] = [];
  markers: Point[] = [];
  pulseFlash = 0;
  towlineFlash = 0;
  drops: Drop[] = [];
  wings: [Wing, Wing] = [
    { side: -1, cooldown: 0, flash: 0, laserHold: 0 },
    { side: 1, cooldown: 0, flash: 0, laserHold: 0 },
  ];
  pickupTime = 0;
  pickupMessage = '';
  perkTime = 0;
  perkMessage = '';
  private closeCalls = 0;
  private repairUsed = false;
  private droneLaunch?: Point;
  private stageProgress = 0;
  private obstacles?: HiveCollision | IceCollision;
  private hotDockReady = false;
  private hotDockCooldown = 0;
  private towlineDamage = TOWLINE_DAMAGE;
  private aim?: Point;
  private nextWave = 0;
  private cooldown = 0;
  private droneCooldown = 0;
  private volley = 0;
  private ioCollapseAge = -1;
  private towlineEnemies = new Set<Enemy>();
  private towlineHitCannon = false;

  readonly droneWeapon: DroneWeapon;
  readonly pilot: PilotId;

  constructor(
    droneWeapon: DroneWeapon = 'sentry',
    loadout: readonly (WingWeapon | undefined)[] = [],
    pilot: PilotId = 'vex',
    readonly level: LevelId = 'preserve',
  ) {
    this.droneWeapon = droneWeapon;
    this.pilot = pilot;
    if (level === 'io') this.bossHealth=IO_HP;
    if (level === 'titan') this.bossHealth=CICADA_HP;
    if (level === 'broodlock') this.obstacles = new HiveCollision();
    if (level === 'ice') { this.obstacles = new IceCollision(); this.bossHealth=LEVIATHAN_HP; }
    if (droneWeapon === 'towline') this.droneCooldown = TOWLINE_INTERVAL;
    for (const [index, wing] of this.wings.entries()) {
      const weapon = loadout[index];
      if (weapon) this.equip(wing, weapon);
    }
  }

  get transitionDuration() { return this.level === 'io' ? IO_APPROACH : this.level === 'titan' ? TITAN_ASCENT : TRANSITION_TIME; }

  get bossMaxHealth() { return this.level === 'io' ? IO_HP : this.level === 'titan' ? CICADA_HP : this.level === 'ice' ? LEVIATHAN_HP : BOSS_HP; }

  get ioLegBroken() { return this.ioCollapseAge >= 0; }
  get ioCollapse() { return this.ioLegBroken ? smooth01(this.ioCollapseAge / 1.2) : 0; }
  get bossAimY() { return this.level === 'io' ? calderaContact(this.ioCollapse,this.ioLegBroken).y : BOSS_Y; }

  get stageDuration() { return levels[this.level].duration; }

  get hiveProgress() {
    if (this.phase === 'stage') return clamp(this.time / (this.level==='titan'?TITAN_ROUTE_DURATION:this.stageDuration), 0, 1);
    if (this.phase === 'approach' || this.phase === 'boss' || this.phase === 'won') return this.level==='titan'?TITAN_ROUTE_END:1;
    return this.stageProgress;
  }

  private prepareObstacles() {
    if (!this.obstacles) return;
    const reveal = this.phase === 'stage' ? 0 : this.phase === 'approach' ? clamp(this.time / TRANSITION_TIME, 0, 1) : 1;
    const eased = reveal * reveal * (3 - 2 * reveal);
    const distance = this.level === 'ice' ? ICE_CAMERA_DISTANCE : HIVE_CAMERA_DISTANCE;
    this.obstacles.update(this.hiveProgress, distance + (BOSS_CAMERA_DISTANCE - distance) * eased);
  }

  get perkReadout() {
    switch (this.pilot) {
      case 'vex':
        return this.closeCalls >= CLOSE_CALLS_REQUIRED
          ? 'Close Call · Pulse earned' : `Close Call · ${this.closeCalls}/${CLOSE_CALLS_REQUIRED} grazes`;
      case 'brass':
        return this.repairUsed ? 'Field Repair · Used' : 'Field Repair · Available';
      case 'glint':
        if (this.hotDockReady) return 'Hot Dock · Charged';
        return this.hotDockCooldown > 0 ? 'Hot Dock · Cooling down' : 'Hot Dock · Awaiting redeploy';
    }
  }

  get towlineLinked() {
    return this.droneWeapon === 'towline' && !this.droneTarget &&
      (this.phase === 'stage' || this.phase === 'boss') && !near(this.player, this.drone, 0.5);
  }

  get exposedCannonX() {
    return this.level === 'io' ? calderaContact(this.ioCollapse,this.ioLegBroken).x : this.level === 'ice' ? 0 : this.volley % 2 === 0 ? -BOSS_CANNON_X : BOSS_CANNON_X;
  }

  wingOrigin(side: WingSide) {
    const desiredX = this.player.x + side * WING_FORMATION.x;
    const x = clamp(desiredX, -WIDTH / 2 + 0.38, WIDTH / 2 - 0.38);
    const tuck = Math.abs(desiredX - x);
    const origin = { x, y: Math.min(HEIGHT / 2 - 0.24, this.player.y + WING_FORMATION.y + tuck * 0.95) };
    this.obstacles?.move(origin, 0, 0, POD_HULL, POD_BOUNDS);
    return origin;
  }

  get cannonWindup() {
    if (this.phase !== 'boss' || this.volley !== Math.floor(this.time / (this.level === 'io' ? IO_INTERVAL : this.level === 'titan' ? CICADA_INTERVAL : this.level === 'ice' ? LEVIATHAN_INTERVAL : BOSS_VOLLEY_INTERVAL))) return 0;
    const interval = this.level === 'io' ? IO_INTERVAL : this.level === 'titan' ? CICADA_INTERVAL : this.level === 'ice' ? LEVIATHAN_INTERVAL : BOSS_VOLLEY_INTERVAL;
    const elapsed = this.time % interval;
    if(this.level === 'io') return elapsed < IO_FIRE ? clamp((elapsed-IO_WINDUP)/(IO_FIRE-IO_WINDUP),0,1) : 0;
    if(this.level === 'titan') return clamp((elapsed-CICADA_WINDUP)/(CICADA_FIRE-CICADA_WINDUP),0,1);
    if(this.level === 'ice') return clamp((elapsed-LEVIATHAN_WINDUP)/(LEVIATHAN_FIRE-LEVIATHAN_WINDUP),0,1);
    return clamp((elapsed - BOSS_WINDUP_AT) / (BOSS_FIRE_AT - BOSS_WINDUP_AT), 0, 1);
  }

  deployDrone(x: number, y: number) {
    const target = { x: 0, y: 0 };
    moveWithinField(target, x, y);
    this.droneTarget = target;
    this.droneLaunch = { ...this.drone };
  }

  aimBy(dx: number, dy: number) {
    this.aim ??= { ...this.player };
    moveWithinField(this.aim, dx, dy);
  }

  clearAim() {
    this.aim = undefined;
  }

  steer(x: number, y: number, dt: number) {
    this.prepareObstacles();
    const maxStep = SHIP_SPEED * dt;
    const direction = Math.hypot(x, y);
    if (direction > 0) {
      this.clearAim();
      if (this.obstacles) this.obstacles.move(this.player, x / direction * maxStep, y / direction * maxStep, FIGHTER_HULL);
      else moveWithinField(this.player, x / direction * maxStep, y / direction * maxStep);
      return;
    }

    if (this.aim) {
      const next = { ...this.player };
      const reached = moveToward(next, this.aim, maxStep);
      const blocked = this.obstacles?.move(this.player, next.x - this.player.x, next.y - this.player.y, FIGHTER_HULL);
      if (!this.obstacles) Object.assign(this.player, next);
      if (reached || blocked) this.clearAim();
    }
  }

  pulse() {
    if (this.charges === 0 || (this.phase !== 'stage' && this.phase !== 'boss')) return;
    this.charges--;
    this.pulseFlash = 0.3;
    this.threats = [];
    if (this.phase === 'stage') {
      for (const enemy of this.enemies) {
        if (enemy.hp > 0) this.damageEnemy(enemy, enemy.hp);
      }
      this.enemies = [];
    } else {
      this.damageBoss(6);
    }
  }

  step(dt: number) {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.time += dt;
    if (this.level === 'io' && this.ioLegBroken && this.phase === 'boss') this.ioCollapseAge += dt;
    if (this.phase === 'stage') this.stageProgress = this.hiveProgress;
    this.prepareObstacles();
    if (this.obstacles?.move(this.player, 0, 0, FIGHTER_HULL)) this.clearAim();
    this.obstacles?.move(this.drone, 0, 0, DRONE_HULL);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.pulseFlash = Math.max(0, this.pulseFlash - dt);
    this.pickupTime = Math.max(0, this.pickupTime - dt);
    this.bossRecoil = Math.max(0, this.bossRecoil - dt);
    this.perkTime = Math.max(0, this.perkTime - dt);
    this.hotDockCooldown = Math.max(0, this.hotDockCooldown - dt);
    let droneDone = false;
    if (this.droneTarget) {
      const next = { ...this.drone };
      droneDone = moveToward(next, this.droneTarget, DRONE_SPEED * dt);
      const blocked = this.obstacles?.move(this.drone, next.x - this.drone.x, next.y - this.drone.y, DRONE_HULL);
      if (!this.obstacles) Object.assign(this.drone, next);
      droneDone ||= Boolean(blocked);
    }
    if (droneDone) {
      this.droneTarget = undefined;
      if (this.pilot === 'glint' && this.droneLaunch && !near(this.drone, this.droneLaunch, HOT_DOCK_DISTANCE) &&
        !this.hotDockReady && this.hotDockCooldown === 0) {
        this.hotDockReady = true;
        this.announcePerk('Hot Dock ready');
      }
      this.droneLaunch = undefined;
    }
    if (this.phase === 'approach') {
      if (this.time >= this.transitionDuration) this.enter('boss');
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
    for (const wing of this.wings) this.stepWing(wing, boss, dt);

    this.shots = this.shots.filter((shot) => {
      const previous = { x: shot.x, y: shot.y };
      if (shot.wing === 'homing') this.guideMissile(shot, boss, dt);
      this.advance(shot, dt);
      if (boss) {
        if (shot.z > BOSS_DEPTH) return true;
        const untilImpact = (BOSS_DEPTH - shot.z) / shot.vz;
        const impact = { x: shot.x + shot.vx * untilImpact, y: shot.y + shot.vy * untilImpact };
        const lockedTarget = shot.targetsBoss && (this.level !== 'io' || shot.bossSupport === !this.ioLegBroken);
        if (lockedTarget ||
          ((shot.drone || shot.wing) && near(impact, { x: this.exposedCannonX, y: this.bossAimY }, BOSS_CANNON_RADIUS))) {
          this.damageBoss(shot.damage ?? 1);
        }
        return false;
      }
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0 || shot.pierced?.has(enemy)) continue;
        const hit = enemy.marine ? marineBodyHit(enemy as Enemy & {marine: MarineKind}, previous, shot) : shot.wing === 'homing'
          ? nearSegment(enemy, previous, shot, .52)
          : Math.abs(shot.x - enemy.x) < .52 &&
            shot.y >= enemy.y - .46 && previous.y <= enemy.y + .46;
        if (!hit) continue;
        this.damageEnemy(enemy, shot.damage ?? 1);
        if (!shot.pierced) return false;
        shot.pierced.add(enemy);
      }
      return shot.y < 9 && Math.abs(shot.x) < 5;
    });
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0 && enemy.y > -9 && (!enemy.centipede || Math.abs(enemy.x) < 5.8));

    this.threats = this.threats.filter((shot) => {
      this.advance(shot, dt);
      if (boss) {
        if (shot.z < 0) return true;
        if (near(shot, this.player, 0.58)) this.hit();
        else if (near(shot, this.player, 1.05)) this.recordGraze();
        return false;
      }
      if (near(shot, this.player, 0.44)) {
        this.hit();
        return false;
      }
      const inField = Math.abs(shot.x) < 5 && Math.abs(shot.y) < 9;
      this.trackGraze(shot, inField);
      return inField;
    });

    if (this.phase === 'stage') {
      this.collectDrops(dt);
      if (this.time >= this.stageDuration) this.enter('approach');
    }
  }

  private trackGraze(shot: Threat, inField: boolean) {
    if (this.pilot !== 'vex' || this.closeCalls >= CLOSE_CALLS_REQUIRED || shot.graze === 'counted') return;
    if (this.invulnerable > 0) {
      shot.graze = undefined;
    } else if (inField && near(shot, this.player, 0.9)) {
      shot.graze = 'near';
    } else if (shot.graze === 'near') {
      shot.graze = 'counted';
      this.recordGraze();
    }
  }

  private recordGraze() {
    if (this.pilot !== 'vex' || this.invulnerable > 0 || this.closeCalls >= CLOSE_CALLS_REQUIRED) return;
    this.closeCalls++;
    if (this.closeCalls === CLOSE_CALLS_REQUIRED) {
      this.charges++;
      this.announcePerk('Close Call · +1 Pulse');
    }
  }

  private announcePerk(message: string) {
    this.perkMessage = message;
    this.perkTime = 1.6;
  }

  private droneDamage(base: number) {
    if (!this.hotDockReady) return base;
    this.hotDockReady = false;
    this.hotDockCooldown = HOT_DOCK_COOLDOWN;
    this.announcePerk('Hot Dock · Double damage');
    return base * 2;
  }

  private equip(wing: Wing, weapon: WingWeapon) {
    wing.weapon = weapon;
    wing.cooldown = weapon === 'omega' ? wingShots.omega.interval : 0;
    wing.flash = 0;
    wing.beamEnd = undefined;
    wing.laserTarget = undefined;
    wing.laserHold = 0;
  }

  private collectDrops(dt: number) {
    this.drops = this.drops.filter((drop) => {
      drop.y -= 3.35 * dt;
      if (!near(drop, this.player, 0.78)) return drop.y > -9;
      const nearbyWing = this.wings[drop.x <= this.player.x ? 0 : 1];
      const wing = nearbyWing.weapon ? (this.wings.find((slot) => !slot.weapon) ?? nearbyWing) : nearbyWing;
      if (this.pilot === 'brass' && wing.weapon && !this.repairUsed && this.hull < MAX_HULL) {
        this.hull++;
        this.repairUsed = true;
        this.announcePerk('Field Repair · +1 Hull');
      }
      this.equip(wing, drop.weapon);
      this.pickupMessage = `${wing.side < 0 ? 'Left' : 'Right'} wing · ${wingWeapons[drop.weapon].name}`;
      this.pickupTime = 1.6;
      return false;
    });
  }

  private stepWing(wing: Wing, boss: boolean, dt: number) {
    if (!wing.weapon || (this.phase !== 'stage' && this.phase !== 'boss')) return;
    const origin = this.wingOrigin(wing.side);
    if (wing.weapon === 'laser') {
      this.stepLaser(wing, origin, boss, dt);
      return;
    }
    wing.cooldown = Math.max(0, wing.cooldown - dt);
    wing.flash = Math.max(0, wing.flash - dt);
    if (wing.cooldown > 0) return;
    const spec = wingShots[wing.weapon];
    wing.cooldown = spec.interval;
    wing.flash = WING_FLASH_TIME;
    const duration = spec.bossTravel;
    this.shots.push({
      ...origin, z: 0, wing: wing.weapon, damage: spec.damage,
      vx: boss ? origin.x * (1 / BOSS_PROJECTION - 1) / duration : 0,
      vy: boss ? (this.bossAimY - origin.y) / duration : spec.speed,
      vz: boss ? BOSS_DEPTH / duration : 0,
      pierced: wing.weapon === 'omega' ? new Set<Enemy>() : undefined,
    });
  }

  private stepLaser(wing: Wing, origin: Point, boss: boolean, dt: number) {
    let enemy: Enemy | undefined;
    let target: Enemy | number | undefined;
    let endY = 8;
    if (boss) {
      endY = this.bossAimY * BOSS_PROJECTION;
      if (Math.abs(origin.x - this.exposedCannonX * BOSS_PROJECTION) < BOSS_CANNON_RADIUS * BOSS_PROJECTION) {
        target = this.exposedCannonX;
      }
    } else {
      for (const candidate of this.enemies) {
        if (candidate.hp > 0 && (candidate.marine ? marineBodyHit(candidate as Enemy & {marine: MarineKind}, origin, {x: origin.x, y: 9})
          : Math.abs(candidate.x - origin.x) < .43 && candidate.y >= origin.y) && (!enemy || candidate.y < enemy.y)) {
          enemy = candidate;
        }
      }
      target = enemy;
      if (enemy) endY = enemy.y + (enemy.marine ? marineSpecs[enemy.marine].halfLength : 0);
    }
    wing.beamEnd = { x: origin.x, y: endY };
    wing.laserHold = target !== undefined && target === wing.laserTarget ? wing.laserHold + dt : 0;
    wing.laserTarget = target;
    const damage = (1 + 2.5 * Math.min(wing.laserHold / 0.85, 1)) * dt;
    if (enemy) this.damageEnemy(enemy, damage, true);
    if (boss && target !== undefined) this.damageBoss(damage, true);
  }

  private guideMissile(shot: Shot, boss: boolean, dt: number) {
    if (boss) {
      const remaining = Math.max(dt, (BOSS_DEPTH - shot.z) / shot.vz);
      const steer = Math.min(1, 10 * dt);
      shot.vx += ((this.exposedCannonX - shot.x) / remaining - shot.vx) * steer;
      return;
    }

    let closest: Enemy | undefined;
    let distance = 36;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || enemy.y <= shot.y) continue;
      const squared = (enemy.x - shot.x) ** 2 + (enemy.y - shot.y) ** 2;
      if (squared < distance) {
        closest = enemy;
        distance = squared;
      }
    }
    const heading = Math.atan2(shot.vx, shot.vy);
    const target = closest ? Math.atan2(closest.x - shot.x, closest.y - shot.y) : 0;
    const angle = heading + clamp(target - heading, -4.8 * dt, 4.8 * dt);
    shot.vx = Math.sin(angle) * wingShots.homing.speed;
    shot.vy = Math.cos(angle) * wingShots.homing.speed;
  }

  private stepDroneWeapon(dt: number) {
    if (this.phase !== 'stage' && this.phase !== 'boss') return;
    this.droneCooldown = Math.max(0, this.droneCooldown - dt);
    if (this.droneWeapon === 'sentry') {
      if (!this.droneTarget && this.droneCooldown === 0) {
        this.droneCooldown = DRONE_FIRE_INTERVAL;
        this.fire(this.drone, true, this.droneDamage(1));
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
      this.towlineDamage = this.droneDamage(TOWLINE_DAMAGE);
      this.towlineEnemies.clear();
      this.towlineHitCannon = false;
    }
    if (this.towlineFlash === 0) return;

    if (this.phase === 'boss') {
      const cannon = { x: this.exposedCannonX * BOSS_PROJECTION, y: this.bossAimY * BOSS_PROJECTION };
      if (!this.towlineHitCannon &&
        nearSegment(cannon, this.player, this.drone, BOSS_CANNON_RADIUS * BOSS_PROJECTION)) {
        this.towlineHitCannon = true;
        this.damageBoss(this.towlineDamage);
      }
      return;
    }
    for (const enemy of this.enemies) {
      if (enemy.hp > 0 && !this.towlineEnemies.has(enemy) &&
        (enemy.marine ? marineBodyHit(enemy as Enemy & {marine: MarineKind}, this.player, this.drone) : nearSegment(enemy, this.player, this.drone, .52))) {
        this.towlineEnemies.add(enemy);
        this.damageEnemy(enemy, this.towlineDamage);
      }
    }
  }

  private stepStage(dt: number) {
    const wave: Wave | undefined = (this.level === 'broodlock' ? hiveWaves : this.level === 'ice' ? iceWaves : this.level === 'io' ? ioWaves : this.level === 'titan' ? titanWaves : stageWaves)[this.nextWave];
    if (wave && this.time >= wave.time) {
      this.nextWave++;
      if (wave.centipede) {
        const parts: Enemy[] = Array.from({ length: wave.centipede }, (_, i) => ({
          x: wave.lanes[0], y: 8.6 + i * CENTIPEDE_SPACING, lane: wave.lanes[0], age: 0,
          fire: i === 0 ? 1.6 : Infinity, hp: i === 0 ? 4 : 2, heading: Math.PI,
          drop: i === wave.carrier ? wave.drop : undefined,
        }));
        bindCentipede(parts);
        this.enemies.push(...parts);
      } else this.enemies.push(...wave.lanes.map((lane, index) => {
        const school = wave.formation ? {formation: wave.formation, slot: index, count: wave.lanes.length, mirror: wave.mirror ?? 1} : undefined;
        const course = wave.cicada ? { ...wave.cicada, slot: index, count: wave.lanes.length } : undefined;
        const start = wave.skipper ? skipperMotion(0,lane,index) : course ? cicadaMotion(0, lane, course) : wave.marine ? marineMotion(wave.marine, 0, lane, school) : {x: lane, y: 8.6};
        return {
          x: start.x, y: start.y, lane, age: 0, school, cicada: course, skipper: wave.skipper, slot: index,
          fire: schoolDelay(school) + (wave.marine === 'plesiosaur' ? 1.8 : wave.ant === 'soldier' ? 1.6 : 1.1) + index * 0.28,
          hp: wave.marine ? marineSpecs[wave.marine].hp : wave.ant === 'soldier' ? 5 : 2, ant: wave.ant, marine: wave.marine,
          drop: index === wave.carrier ? wave.drop : undefined,
          raptor: index === wave.raptor,
        };
      }));
    }

    stepCentipedes(this.enemies, dt);
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.age += dt;
      const motion = enemy.raptor ? raptorFlight(enemy.age) : undefined;
      if (enemy.skipper) {
        const p=skipperMotion(enemy.age,enemy.lane,enemy.slot); enemy.x=p.x; enemy.y=p.y; enemy.heading=p.heading;
      } else if (enemy.centipede) {
        // Shared chain motion above keeps each plate connected.
      } else if (enemy.cicada) {
        const course = cicadaMotion(enemy.age, enemy.lane, enemy.cicada);
        enemy.x = course.x; enemy.y = course.y; enemy.heading = course.heading;
      } else if (enemy.marine) {
        const swim = marineMotion(enemy.marine,enemy.age,enemy.lane,enemy.school);
        const previous = marineMotion(enemy.marine,enemy.age-dt,enemy.lane,enemy.school);
        enemy.x=swim.x; enemy.y+=swim.y-previous.y; enemy.heading=swim.heading;
      } else if (enemy.ant && this.obstacles instanceof HiveCollision) steerHiveAnt(enemy, this.obstacles, this.stageDuration, dt);
      else {
        enemy.y -= (motion?.speed ?? 2.25) * dt;
        if (!motion || motion.pose === 'glide') enemy.x = enemy.lane + Math.sin(enemy.age * 1.55) * 0.46;
      }
      if (this.level === 'ice' && this.obstacles && enemy.y < 9) {
        const hull = enemy.marine ? [{x:0,y:0,radius:marineSpecs[enemy.marine].radius}] : enemy.raptor ? [{ x: 0, y: 0, radius: 1.05 }] : DRONE_HULL;
        this.obstacles.move(enemy, 0, 0, hull, { minX: -2.4, maxX: 2.4, minY: -10, maxY: 10 });
      }
      if (!motion && (!enemy.centipede || (enemy.centipede.slot === 0 && !enemy.centipede.chain.escape)) && enemy.age >= enemy.fire && enemy.y < 8) {
        enemy.fire += enemy.centipede ? 3.5 : enemy.cicada ? 3 : enemy.marine === 'plesiosaur' ? 3.2 : enemy.ant === 'soldier' ? 3.1 : 2.4;
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const angle = Math.atan2(dx, dy);
        const speed = enemy.marine ? (enemy.marine === 'plesiosaur' ? 4 : 5) : enemy.ant ? 4.6 : 5.7;
        const spread = enemy.marine === 'plesiosaur' ? [-.3,-.15,0,.15,.3] : enemy.ant === 'soldier' ? [-0.24, 0, 0.24] : [0];
        for (const offset of spread) {
          const muzzle = enemy.marine ? marineSpecs[enemy.marine].halfLength : 0;
          this.threats.push({ x: enemy.x + Math.sin(enemy.heading ?? 0)*muzzle, y: enemy.y - Math.cos(enemy.heading ?? 0)*muzzle, z: 0,
            vx: Math.sin(angle + offset) * speed, vy: Math.cos(angle + offset) * speed, vz: 0 });
        }
      }
      if (enemy.marine ? marineBodyHit(enemy as Enemy & {marine: MarineKind},this.player,this.player,.2-marineSpecs[enemy.marine].radius*.2) : near(enemy, this.player, 0.68)) {
        enemy.hp = 0;
        if (enemy.centipede) severCentipede(enemy);
        this.hit();
      }
    }
  }

  private stepBoss() {
    if(this.level === 'io') { this.stepCaldera(); return; }
    if(this.level === 'titan') { this.stepCicada(); return; }
    if(this.level === 'ice') { this.stepLeviathan(); return; }
    const elapsed = this.time % BOSS_VOLLEY_INTERVAL;
    const volley = Math.floor(this.time / BOSS_VOLLEY_INTERVAL);
    if (elapsed >= BOSS_WINDUP_AT && this.markers.length === 0 && elapsed < BOSS_FIRE_AT) {
      const { x, y } = this.player;
      this.markers = [-1.35, 0, 1.35].map((offset) => ({
        x: clamp(x, -2.6, 2.6) + (this.volley % 2 === 0 ? offset : 0),
        y: clamp(y, -5.9, 5.25) + (this.volley % 2 === 0 ? 0 : offset),
      }));
    }
    if (elapsed >= BOSS_FIRE_AT && this.markers.length && this.volley === volley) {
      const x = this.exposedCannonX;
      const z = BOSS_DEPTH + BOSS_MUZZLE_Z;
      this.firedCannonX = x;
      this.bossRecoil = BOSS_RECOIL_TIME;
      this.threats.push(...this.markers.map((target) => ({
        x, y: this.bossAimY, z,
        vx: (target.x - x) / BOSS_IMPACT_TRAVEL, vy: (target.y - this.bossAimY) / BOSS_IMPACT_TRAVEL,
        vz: -z / BOSS_IMPACT_TRAVEL,
      })));
      this.volley++;
    }
    if (elapsed >= BOSS_FIRE_AT + BOSS_IMPACT_TRAVEL + 0.02) this.markers = [];
  }

  private stepCaldera() {
    const elapsed=this.time%IO_INTERVAL,volley=Math.floor(this.time/IO_INTERVAL);
    if(elapsed>=IO_WINDUP && elapsed<IO_FIRE && !this.markers.length){
      const x=clamp(this.player.x,-2.4,2.4),y=clamp(this.player.y,-5.8,5.1);
      this.markers=[-1.5,0,1.5].map(offset=>({x:x+(this.ioLegBroken?offset*.55:offset),y:y+(this.ioLegBroken?offset:0)}));
    }
    if(elapsed>=IO_FIRE && this.markers.length && this.volley===volley){
      const origin=calderaWheel(IO_DURATION+IO_APPROACH+this.time,this.ioCollapse);
      this.firedCannonX=origin.x;this.bossRecoil=BOSS_RECOIL_TIME;
      this.threats.push(...this.markers.map(target=>({...origin,vx:(target.x-origin.x)/IO_TRAVEL,vy:(target.y-origin.y)/IO_TRAVEL,vz:-origin.z/IO_TRAVEL})));
      this.volley++;
    }
    if(elapsed>IO_FIRE+IO_TRAVEL+.05)this.markers=[];
  }

  private stepCicada() {
    const elapsed=this.time%CICADA_INTERVAL, volley=Math.floor(this.time/CICADA_INTERVAL);
    if(elapsed>=CICADA_WINDUP && elapsed<CICADA_FIRE && !this.markers.length){
      const x=clamp(this.player.x,-2.5,2.5),y=clamp(this.player.y,-5.8,5.1);
      this.markers=[-1.4,0,1.4].map(offset=>({x:x+(volley%2===0?offset:0),y:y+(volley%2===0?0:offset)}));
    }
    if(elapsed>=CICADA_FIRE && this.markers.length && this.volley===volley){
      const x=this.exposedCannonX,z=BOSS_DEPTH+BOSS_MUZZLE_Z;
      this.firedCannonX=x;this.bossRecoil=BOSS_RECOIL_TIME;
      this.threats.push(...this.markers.map(target=>({x,y:this.bossAimY,z,vx:(target.x-x)/CICADA_TRAVEL,vy:(target.y-this.bossAimY)/CICADA_TRAVEL,vz:-z/CICADA_TRAVEL})));
      this.volley++;
    }
    if(elapsed>CICADA_FIRE+CICADA_TRAVEL+.05)this.markers=[];
  }

  private stepLeviathan() {
    const elapsed=this.time%LEVIATHAN_INTERVAL, volley=Math.floor(this.time/LEVIATHAN_INTERVAL);
    if(elapsed>=LEVIATHAN_WINDUP && elapsed<LEVIATHAN_FIRE && !this.markers.length) {
      const x=clamp(this.player.x,-2.6,2.6),y=clamp(this.player.y,-5.9,5.25);
      this.markers=[-1.35,0,1.35].map(offset=>({x:x+(volley%2===0?offset:0),y:y+(volley%2===0?0:offset)}));
    }
    if(elapsed>=LEVIATHAN_FIRE && this.markers.length && this.volley===volley) {
      const z=BOSS_DEPTH+BOSS_MUZZLE_Z;
      this.firedCannonX=0;this.bossRecoil=BOSS_RECOIL_TIME;
      this.threats.push(...this.markers.map(target=>({x:0,y:this.bossAimY,z,
        vx:target.x/LEVIATHAN_TRAVEL,vy:(target.y-this.bossAimY)/LEVIATHAN_TRAVEL,vz:-z/LEVIATHAN_TRAVEL})));
      this.volley++;
    }
    if(elapsed>LEVIATHAN_FIRE+LEVIATHAN_TRAVEL+.05)this.markers=[];
  }

  private fire({ x, y }: Point, drone = false, damage = 1) {
    if (this.phase === 'stage') {
      this.shots.push({ x, y: y + (drone ? 0.3 : 0.45), z: 0, vx: 0, vy: 15, vz: 0, drone, damage });
      return;
    }

    const duration = 0.38;
    const targetsBoss = !drone && Math.abs(x) < 1.65;
    // Drone shots follow the sight line through their launch point, with no lock-on.
    const expansion = 1 / BOSS_PROJECTION - 1;
    const dx = drone ? x * expansion : (targetsBoss ? (this.level === 'io' ? this.exposedCannonX : 0) - x : 0);
    const dy = drone ? y * expansion : (targetsBoss ? this.bossAimY - y : 0);
    this.shots.push({ x, y, z: 0, vx: dx / duration, vy: dy / duration,
      vz: BOSS_DEPTH / duration, targetsBoss, bossSupport: this.level === 'io' ? !this.ioLegBroken : undefined, drone, damage });
  }

  private advance(shot: Shot, dt: number) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.z += shot.vz * dt;
  }

  private damageEnemy(enemy: Enemy, damage: number, laser = false) {
    if (enemy.hp <= 0) return;
    const before = enemy.hp;
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (laser) enemy.laserDamage = (enemy.laserDamage ?? 0) + before - enemy.hp;
    if (enemy.hp === 0) {
      if (enemy.centipede) severCentipede(enemy);
      this.score += 100;
      if (enemy.drop) this.drops.push({ x: enemy.x, y: enemy.y, weapon: enemy.drop });
    }
  }

  private damageBoss(damage: number, laser = false) {
    if (this.phase !== 'boss') return;
    const before = this.bossHealth;
    this.bossHealth = Math.max(0, this.bossHealth - damage);
    if (this.level === 'io' && !this.ioLegBroken && this.bossHealth <= IO_HP-IO_LEG_HP) {
      this.bossHealth = IO_HP-IO_LEG_HP;
      this.ioCollapseAge = 0;
      for(const wing of this.wings){wing.laserHold=0;wing.laserTarget=undefined;}
      this.pickupMessage = 'Support broken · Machinery exposed'; this.pickupTime=2.4;
    }
    if (laser) this.bossLaserDamage += before - this.bossHealth;
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
    if (phase === 'approach' || phase === 'won') {
      this.shots = [];
      this.threats = [];
      this.enemies = [];
      this.drops = [];
      for (const wing of this.wings) {
        wing.flash = 0;
        wing.beamEnd = undefined;
        wing.laserTarget = undefined;
        wing.laserHold = 0;
      }
    }
    if (phase === 'boss') {
      this.cooldown = 0;
      this.droneCooldown = this.droneWeapon === 'towline' ? TOWLINE_INTERVAL : 0;
    }
  }
}
