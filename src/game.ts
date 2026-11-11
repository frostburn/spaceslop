import {FROG_HP,FROG_RADIUS,createFrogState,stepFrog,frogHeading,frogTongueHits,type FrogState} from './biolume/frog';
import {groveWaves,groveMotion,groveEnemySize,groveCanAttack,GROVE_SPAWN_LEAD,type GroveCourse} from './biolume/combat';
import {GROVE_APPROACH} from './biolume/route';
import {RAY_HP,RAY_FAN_AT,RAY_SEEKER_AT,RAY_PROJECTION,RAY_ORGAN_RADIUS,RAY_SEEKER_RADIUS,RAY_SEEKER_HP,RAY_SEEKER_POOL,raySignal,rayOrgan,rayBodyEntry,stepRaySeeker,rayOrbEntry,raySeekerBurst,type RaySeeker} from './biolume/lantern-ray';
import { DEN_BURSTS, DEN_CYCLE, DEN_GUNS, DEN_HP, denBodyEntry, denMount, denPose } from './den/combat';
import { DEN_TURRET_HP, createDenTurret, denDefensePoint, denMineSites, denTurretEntry, denTurretSites,
  stepDenMine, stepDenTurret, type DenMine, type DenTurret } from './den/defense';
import { DEN_APPROACH, denScroll } from './den/route';
import { DEN_PATROL_STAGGER, DEN_PATROL_WINDUP, denPatrolCanFire, denPatrolEntry, denPatrolPose, denPatrolScale, denWaves, type DenPatrol } from './den/patrol';
import { HELIOSTAT_HP,HELIOSTAT_APPROACH,HELIOSTAT_INTERVAL,HELIOSTAT_WINDUP,HELIOSTAT_FIRE,HELIOSTAT_CHANNEL,HELIOSTAT_FADE,HELIOSTAT_GUARD_FIRE,HELIOSTAT_SPAWN_LEAD,heliostatWaves,heliostatMotion,heliostatCanAttack,heliostatPlasmaHits,electricSites,electricHits,type HeliostatCourse } from './heliostat/combat';
import {SUMMER_HP,SUMMER_APPROACH} from './summer/layout';
import {createHydraAttack,stepHydraAttack} from './summer/hydra-attack';
import {VORTEX_HP,VORTEX_RADIUS,VORTEX_FIRE,vortexEmission} from './summer/vortex';
import {summerWaves,summerMotion,hydraBeamEntry,type SummerCourse} from './summer/combat';
import {HYDRA_SIDES,HYDRA_HEAD_HP,HYDRA_BOSS_HEAD_HP,HYDRA_BOSS_SIZE,createHydraState,hydraAlive,damageHydraHead,damageRiverHydra,closestRiverHead,nearestHydraHead,hydraContact,hydraBeamContact,hydraBossHead,hydraBossContact,riverHydraHead,type HydraState,type HydraSide} from './summer/hydra-targets';
import {heliostatLockTargets} from './heliostat/combat';
import {crawlerSites,crawlerPose,stepCrawler,crawlerHits,CRAWLER_HP,type CrawlerState} from './heliostat/crawler';
import {mineSites,minePose,triggerMine,mineBurst,MINE_WINDUP,MINE_JUMP,MINE_BURST_TIME,type BoulevardMine} from './boulevard-mines';
import {BOULEVARD_HP,BOULEVARD_APPROACH,BOULEVARD_INTERVAL,BOULEVARD_WINDUP,BOULEVARD_FIRE,BOULEVARD_TRAVEL,BOULEVARD_SPAWN_LEAD,boulevardWaves,boulevardMotion,turnBoulevardTurret,type BoulevardCourse} from './boulevard';
import { AMBUSHER_HP, AMBUSHER_SPAWN_LEAD, AMBUSHER_CORPSE_TIME, ambusherSites, ambusherHome, createAmbusherState, stepAmbusher, ambusherPose, ambusherHulls, ambusherBodyHit, ambusherBeamEntry, ambusherHits, defeatAmbusher, type AmbusherState } from './preserve-ambusher';
import { preserveWaves } from './preserve-waves';
import { FLYER_HP, flyerMotion, flyerBodyHit, flyerBeamEntry, type FlyerCourse } from './preserve-flyer';
import {CRAB_HP,CRAB_CLAW_HP,CRAB_CORE_HP,crabTarget,crabSmooth} from './vent-crab';
import {wormPose,WORM_WINDUP,WORM_REACH} from './vent-worm';
import {SHRIMP_HP,SHRIMP_FIRST_FIRE,SHRIMP_INTERVAL,WORM_HP,WORM_FIRST_ATTACK,WORM_INTERVAL,shrimpMotion,faunaMuzzle,faunaBodyHit,faunaBeamEntry,type ShrimpCourse} from './vent-fauna';
import {MORTAR_HP,MORTAR_RADIUS,MORTAR_FIRST_FIRE,MORTAR_INTERVAL,mortarAim,mortarMuzzle} from './vent-mortar';
import {ventOrbit,VENT_APPROACH,VENT_SPAWN_LEAD,ventWaves,ventAnchorPoint} from './vent-layout';
import { CRUCIBLE_HP, CRUCIBLE_RADIUS, CRUCIBLE_FIRST_POUR, CRUCIBLE_POUR_INTERVAL, CRUCIBLE_MUZZLE_Y, SLAG_RADIUS, crucibleMotion, slagSpeed } from './io-crucible';
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
import { GROUNDSKEEPER_HP, GROUNDSKEEPER_RADIUS, groundskeeperContact, groundskeeperAttack, groundskeeperHits } from './groundskeeper';
import { PRESERVE_APPROACH } from './preserve-layout';
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
  drone?: boolean; targetsBoss?: boolean; bossSupport?: boolean; crabTarget?:number; wing?: WingProjectile; pierced?: Set<Enemy>; damage?: number;
  hydraTarget?:HydraSide;hydraPierced?:Map<Enemy,Set<HydraSide>>;
  planarBossHit?: boolean;
};
type Threat = Shot & { graze?: 'near' | 'counted';planar?:boolean };
type Enemy = Point & {
  den?: DenPatrol;
  denTurret?: DenTurret;
  rayOrb?:RaySeeker;
  grove?:GroveCourse;frog?:FrogState;
  summer?:SummerCourse;
  hydra?:HydraState;hitPoint?:Point&{z?:number};
  crawler?:CrawlerState;
  heliostat?: HeliostatCourse;
  boulevard?: BoulevardCourse;
  mine?: BoulevardMine; interceptorAim?:number; interceptorHeading?:number;
  flyer?: FlyerCourse;
  ambusher?: AmbusherState;
  lane: number; age: number; fire: number; hp: number; drop?: WingWeapon; raptor?: boolean; ant?: 'worker' | 'soldier'; marine?: MarineKind; school?: MarineSchool;
  centipede?: CentipedeLink; cicada?: CicadaCourse; skipper?: boolean; crucible?: boolean; slag?: {vx:number;vy:number}; ventAnchor?:number; ventScale?:number; slot?: number; mortarAngle?:number; ventWorm?:boolean; shrimp?:ShrimpCourse; wormReach?:number; wormBend?:number; wormLocked?:boolean;
  course?: number; courseAt?: number; heading?: number; laserDamage?: number;
};
type Drop = Point & { weapon: WingWeapon };
type Wing = {
  side: WingSide; weapon?: WingWeapon; cooldown: number; flash: number;
  beamEnd?: Point; laserTarget?: Enemy | number; laserHold: number;
  laserHead?:HydraSide;
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
  grove?:Omit<GroveCourse,'slot'>;
  summer?:Omit<SummerCourse,'slot'>;
  heliostat?: Omit<HeliostatCourse,'slot'>;
  boulevard?: Omit<BoulevardCourse,'slot'>;
  flyer?: Omit<FlyerCourse, 'slot' | 'count'>;
  raptor?: number; ant?: 'worker' | 'soldier'; marine?: MarineKind; formation?: MarineFormation; mirror?: number;
  centipede?: number; cicada?: Omit<CicadaCourse, 'slot' | 'count'>; skipper?: boolean; crucible?: boolean; ventAnchor?:number; ventWorm?:boolean; shrimp?:Omit<ShrimpCourse,'slot'> };

const stageWaves: Wave[] = preserveWaves.map(wave => ({ ...wave, lanes: [...wave.lanes] }));

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
const enemyRadius=(enemy:Enemy,ordinary=.52)=>enemy.frog?FROG_RADIUS:enemy.summer?.kind==='vortex'?VORTEX_RADIUS:enemy.summer?.kind==='hydra'?1.2:enemy.heliostat?.kind === 'guard' ? .8 : enemy.crucible?CRUCIBLE_RADIUS:enemy.slag?SLAG_RADIUS:(enemy.ventAnchor!==undefined?MORTAR_RADIUS:ordinary)*(enemy.ventScale??1)*(enemy.boulevard?.heavy?1.2:1);
const near = (a: Point, b: Point, radius: number) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < radius ** 2;

function denTargetEntry(a: Point, b: Point, enemy: Enemy) {
  if (enemy.den) return denPatrolEntry(a, b, enemy, enemy.den);
  if (enemy.denTurret) return denTurretEntry(a, b, enemy, enemy.denTurret.heading);
  return Infinity;
}

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
  summerHydra=createHydraState(HYDRA_BOSS_HEAD_HP);
  summerLastHit?:Point&{z:number};
  private summerAttack=createHydraAttack();
  private summerFinalTime=0;
  groundskeeperAim = { x: 0, y: -5.3 };
  groundskeeperCancelledAt = -100;
  private groundskeeperAimCycle = -1;
  private groundskeeperFinalTime = 0;
  crabClawHealth=[CRAB_CLAW_HP,CRAB_CLAW_HP];
  private crabBreakTimes=[-1,-1];
  bossLaserDamage = 0;
  firedCannonX = 0;
  firedCrabTarget=0;
  bossRecoil = 0;
  enemies: Enemy[] = [];
  readonly denMines: DenMine[];
  defeatedVentWorms=new Set<number>();
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
  private nextDenTurret = 0;
  private nextMine = 0;
  private nextAmbusher = 0;
  private cooldown = 0;
  private droneCooldown = 0;
  private volley = 0;
  private heliostatAimCycle = -1;
  private heliostatCancelledCycle = -1;
  private heliostatFinalTime = 0;
  private nextCrawler=0;
  private rayFanCycle=-1;
  private raySeekerCycle=-1;
  private rayFinalTime=0;
  private denFinalTime = 0;
  private heliostatEscalationAt=Infinity;
  private heliostatEscalationCycle=Infinity;
  private heliostatLockedPattern=0;
  private ioCollapseAge = -1;
  private towlineEnemies = new Set<Enemy>();
  private towlineHitCannon = false;
  private towlineHydraHits=new Map<Enemy,Set<HydraSide>>();
  private towlineBossHeads=new Set<HydraSide>();

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
    this.denMines = level === 'den' ? denMineSites.map(() => ({})) : [];
    if(level==='biolume')this.bossHealth=RAY_HP;
    if(level==='summer')this.bossHealth=SUMMER_HP;
    if (level === 'heliostat')this.bossHealth=HELIOSTAT_HP;
    if (level === 'boulevard')this.bossHealth=BOULEVARD_HP;
    if (level === 'preserve') this.bossHealth = GROUNDSKEEPER_HP;
    if (level === 'vents')this.bossHealth=CRAB_HP;
    if (level === 'io') this.bossHealth=IO_HP;
    if (level === 'titan') this.bossHealth=CICADA_HP;
    if (level === 'broodlock') this.obstacles = new HiveCollision();
    if (level === 'ice') { this.obstacles = new IceCollision(); this.bossHealth=LEVIATHAN_HP; }
    if (droneWeapon === 'towline') this.droneCooldown = TOWLINE_INTERVAL;
    for (const [index, wing] of this.wings.entries()) {
      const weapon = loadout[index];
      if (weapon) this.equip(wing, weapon);
    }
    if (this.isDen) this.bossHealth = DEN_HP;
  }

  get isDen() { return this.level === 'den'; }
  get planarBoss() { return this.level === 'biolume' || this.isDen; }
  get weaponsActive() { return this.phase === 'stage' || this.phase === 'boss' || (this.isDen && this.phase === 'approach'); }
  get denBossTime() {
    if (this.phase === 'approach') return this.time - DEN_APPROACH;
    return this.phase === 'boss' ? this.time : this.denFinalTime;
  }

  private planarBossEntry(a: Point, b: Point) {
    return this.isDen ? denBodyEntry(this.denBossTime, a, b) : rayBodyEntry(this.rayTime, a, b);
  }

  get heliostatAttackTime(){return this.phase==='boss'?this.time:this.heliostatFinalTime;}
  get heliostatPattern(){return this.heliostatLockedPattern;}
  get heliostatUnstable(){return Number.isFinite(this.heliostatEscalationAt);}
  get heliostatUnstableAge(){return Math.max(0,this.heliostatAttackTime-this.heliostatEscalationAt);}
  get heliostatTargets(){return this.heliostatAimCycle===Math.floor(this.heliostatAttackTime/HELIOSTAT_INTERVAL)&&this.heliostatCancelledCycle!==this.heliostatAimCycle?this.markers:[];}

  get transitionDuration() { if (this.isDen) return DEN_APPROACH; if(this.level==='biolume')return GROVE_APPROACH; if(this.level==='summer')return SUMMER_APPROACH;if(this.level==='heliostat')return HELIOSTAT_APPROACH;if(this.level==='boulevard')return BOULEVARD_APPROACH;return this.level === 'preserve' ? PRESERVE_APPROACH : this.level === 'vents' ? VENT_APPROACH : this.level === 'io' ? IO_APPROACH : this.level === 'titan' ? TITAN_ASCENT : TRANSITION_TIME; }

  get bossMaxHealth() { if (this.isDen) return DEN_HP; if(this.level==='biolume')return RAY_HP;if(this.level==='summer')return SUMMER_HP;if(this.level==='heliostat')return HELIOSTAT_HP;if(this.level==='boulevard')return BOULEVARD_HP;return this.level === 'preserve' ? GROUNDSKEEPER_HP : this.level === 'vents' ? CRAB_HP : this.level === 'io' ? IO_HP : this.level === 'titan' ? CICADA_HP : this.level === 'ice' ? LEVIATHAN_HP : BOSS_HP; }
  get bossTargetRadius() { if(this.level==='biolume')return RAY_ORGAN_RADIUS/RAY_PROJECTION;if(this.level==='summer')return .48*HYDRA_BOSS_SIZE;if(this.level==='boulevard'||this.level==='heliostat')return 1.25;return this.level === 'preserve' ? GROUNDSKEEPER_RADIUS : BOSS_CANNON_RADIUS; }
  get summerTargetHead(){return nearestHydraHead(this.summerHydra,this.player.x/BOSS_PROJECTION,true);}
  get summerHeadsAlive(){return this.summerHydra.hp.filter(hp=>hp>0).length;}
  get summerBossTime(){return this.phase==='boss'?this.time:this.summerFinalTime;}
  get groundskeeperTime() {
    // Negative time is a quiet idle, continuous through the camera approach.
    if (this.phase === 'stage') return this.time - this.stageDuration - this.transitionDuration;
    if (this.phase === 'approach') return this.time - this.transitionDuration;
    return this.phase === 'boss' ? this.time : this.groundskeeperFinalTime;
  }

  get crabTargetX(){return crabTarget(this.crabClawHealth,this.volley);}
  get crabOffsetX(){return this.phase==='boss'?ventOrbit(this.time).offsetX:0;}
  get crabCoreOpen(){return this.crabClawHealth.every(hp=>hp<=0);}
  get crabBreakPose(){return this.crabBreakTimes.map(t=>t<0?0:crabSmooth((this.time-t)/.8));}
  get crabOpening(){return this.crabCoreOpen?crabSmooth((this.time-Math.max(...this.crabBreakTimes))/.8):0;}

  get ioLegBroken() { return this.ioCollapseAge >= 0; }
  get ioCollapse() { return this.ioLegBroken ? smooth01(this.ioCollapseAge / 1.2) : 0; }
  get bossAimY() {
    if (this.isDen) return denPose(this.denBossTime).y;
    if(this.level==='biolume')return rayOrgan(this.rayTime,raySignal(this.rayTime).side).y/RAY_PROJECTION;
    if(this.level==='summer')return hydraBossHead(this.time,this.summerTargetHead).y;
    if (this.level === 'preserve') { const p = groundskeeperContact(this.groundskeeperTime, this.groundskeeperAim, this.groundskeeperCancelledAt); return p.y * 34 / (22 - p.z); }
    return this.level === 'io' ? calderaContact(this.ioCollapse,this.ioLegBroken).y : BOSS_Y;
  }

  get rayTime(){return this.phase==='stage'?this.time-this.stageDuration-this.transitionDuration:this.phase==='approach'?this.time-this.transitionDuration:this.phase==='boss'?this.time:this.rayFinalTime;}

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
    if (this.isDen) return denPose(this.denBossTime).x;
    if(this.level==='biolume')return rayOrgan(this.rayTime,raySignal(this.rayTime).side).x/RAY_PROJECTION;
    if(this.level==='summer')return hydraBossHead(this.time,this.summerTargetHead).x;
    if (this.level === 'preserve'||this.level==='boulevard'||this.level==='heliostat') return 0;
    return this.level==='vents'?this.crabTargetX+this.crabOffsetX:this.level === 'io' ? calderaContact(this.ioCollapse,this.ioLegBroken).x : this.level === 'ice' ? 0 : this.volley % 2 === 0 ? -BOSS_CANNON_X : BOSS_CANNON_X;
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
    if(this.level==='biolume'){const s=raySignal(this.rayTime);return this.phase==='boss'?Math.max(s.fan,s.seeker):0;}
    if(this.level==='heliostat'){if(this.heliostatCancelledCycle===Math.floor(this.time/HELIOSTAT_INTERVAL))return 0;const t=this.time%HELIOSTAT_INTERVAL;return this.phase==='boss'&&t<HELIOSTAT_FIRE?clamp((t-HELIOSTAT_WINDUP)/(HELIOSTAT_FIRE-HELIOSTAT_WINDUP),0,1):0;}
    if(this.level==='boulevard'){const t=this.time%BOULEVARD_INTERVAL;return this.phase==='boss'&&t<BOULEVARD_FIRE?clamp((t-BOULEVARD_WINDUP)/(BOULEVARD_FIRE-BOULEVARD_WINDUP),0,1):0;}
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
    if(this.level==='biolume'&&this.phase==='boss')for(const enemy of this.enemies)if(enemy.rayOrb)enemy.hp=0;
    if (this.phase === 'stage') {
      for (const enemy of this.enemies) {
        if (enemy.hp > 0 && !enemy.mine) this.damageEnemy(enemy, enemy.hp);
      }
      this.enemies = this.enemies.filter(enemy=>enemy.mine||enemy.ambusher?.defeatedAt!==undefined);
    } else {
      if (this.level === 'preserve') this.groundskeeperCancelledAt = this.time;
      if(this.level==='heliostat'){this.heliostatCancelledCycle=Math.floor(this.time/HELIOSTAT_INTERVAL);this.markers=[];}
      if(this.level==='summer'){for(const side of HYDRA_SIDES)this.damageBoss(6,false,side);}
      else this.damageBoss(6);
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
      if (this.time >= this.transitionDuration) { this.enter('boss'); return; }
      if (!this.isDen) return;
    }

    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.cooldown += 0.19;
      this.fire(this.player);
    }
    const boss = this.phase === 'boss';
    if (boss) this.stepBoss(dt);
    else if (this.phase === 'stage') this.stepStage(dt);
    this.stepDroneWeapon(dt);
    for (const wing of this.wings) this.stepWing(wing, boss, dt);

    this.shots = this.shots.filter((shot) => {
      const previous = { x: shot.x, y: shot.y,z:shot.z };
      if (shot.wing === 'homing') this.guideMissile(shot, boss, dt);
      this.advance(shot, dt);
      if(boss&&this.level==='biolume'){
        const a=previous,b=shot;
        for(;;){let enemy:Enemy|undefined,first=Infinity;
          for(const candidate of this.enemies){if(!candidate.rayOrb||candidate.hp<=0||shot.pierced?.has(candidate))continue;const t=rayOrbEntry(candidate as Enemy&{rayOrb:RaySeeker},a,b);if(t<first){first=t;enemy=candidate;}}
          if(!enemy)break;this.damageEnemy(enemy,shot.damage??1);if(!shot.pierced)return false;shot.pierced.add(enemy);
        }
      }
      if (boss && this.planarBoss) {
        if (!shot.planarBossHit && Number.isFinite(this.planarBossEntry(previous, shot))) {
          this.damageBoss(shot.damage ?? 1);
          shot.planarBossHit = true;
          if (!shot.pierced) return false;
        }
        return shot.y<10&&Math.abs(shot.x)<5;
      }
      if (boss) {
        if (shot.z > BOSS_DEPTH) return true;
        const untilImpact = (BOSS_DEPTH - shot.z) / shot.vz;
        const impact = { x: shot.x + shot.vx * untilImpact, y: shot.y + shot.vy * untilImpact };
        if(this.level==='summer'){
          const hit=hydraBossContact(this.summerHydra,this.time,impact);
          if(hit&&(shot.hydraTarget===undefined||shot.hydraTarget===hit.side))this.damageBoss(shot.damage??1,false,hit.side);
          return false;
        }
        const lockedTarget = shot.targetsBoss && (this.level !== 'io' || shot.bossSupport === !this.ioLegBroken) && (this.level!=='vents'||shot.crabTarget===this.crabTargetX);
        if (lockedTarget ||
          ((shot.drone || shot.wing) && near(impact, { x: this.exposedCannonX, y: this.bossAimY }, this.bossTargetRadius))) {
          this.damageBoss(shot.damage ?? 1);
        }
        return false;
      }
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0 || enemy.mine || (shot.pierced?.has(enemy)&&enemy.summer?.kind!=='hydra')) continue;
        if(enemy.summer?.kind==='hydra'){
          const hit=hydraContact(enemy,this.time,previous,shot,.05,shot.hydraPierced?.get(enemy));if(!hit)continue;
          this.damageEnemy(enemy,shot.damage??1,false,hit.side);
          if(!shot.pierced)return false;
          const hits=shot.hydraPierced??=new Map(),heads=hits.get(enemy)??new Set<HydraSide>();heads.add(hit.side);hits.set(enemy,heads);continue;
        }
        const hit = enemy.den || enemy.denTurret ? Number.isFinite(denTargetEntry(previous, shot, enemy)) : enemy.flyer ? flyerBodyHit({...enemy,flyer:enemy.flyer},previous,shot) : enemy.ambusher ? ambusherBodyHit(enemy.ambusher,this.time,previous,shot) : enemy.shrimp||enemy.ventWorm ? faunaBodyHit(enemy,previous,shot) : enemy.marine ? marineBodyHit(enemy as Enemy & {marine: MarineKind}, previous, shot) : shot.wing === 'homing'
          ? nearSegment(enemy, previous, shot, enemyRadius(enemy))
          : Math.abs(shot.x - enemy.x) < enemyRadius(enemy) &&
            shot.y >= enemy.y - enemyRadius(enemy,.46) && previous.y <= enemy.y + enemyRadius(enemy,.46);
        if (!hit) continue;
        this.damageEnemy(enemy, shot.damage ?? 1);
        if (!shot.pierced) return false;
        shot.pierced.add(enemy);
      }
      return shot.y < 9 && Math.abs(shot.x) < 5;
    });
    this.enemies = this.enemies.filter((enemy) => (enemy.hp > 0 || enemy.mine?.burstAt!==undefined&&this.time-enemy.mine.burstAt<MINE_BURST_TIME || enemy.ambusher?.defeatedAt!==undefined && this.time-enemy.ambusher.defeatedAt<AMBUSHER_CORPSE_TIME) && (enemy.ambusher ? ambusherHome(enemy.ambusher.site,this.time).y > -12 : enemy.y > (enemy.heliostat?.kind==='guard'?-10.6:-9)) && (!enemy.centipede || Math.abs(enemy.x) < 5.8) && (!(enemy.crucible || enemy.slag) || Math.abs(enemy.x)<6.8) && (!enemy.slag || (enemy.y<10 && enemy.age<10)));

    this.threats = this.threats.filter((shot) => {
      this.advance(shot, dt);
      if (boss && !this.planarBoss && !shot.planar) {
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
      if (this.time >= this.stageDuration) this.enter(this.level==='biolume'?'boss':'approach');
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
    if (!wing.weapon || !this.weaponsActive) return;
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
    boss &&= !this.planarBoss;
    const duration = spec.bossTravel;
    this.shots.push({
      ...origin, z: 0, wing: wing.weapon, damage: spec.damage,
      vx: boss ? origin.x * (1 / BOSS_PROJECTION - 1) / duration : 0,
      vy: boss ? (this.bossAimY - origin.y) / duration : spec.speed,
      vz: boss ? BOSS_DEPTH / duration : 0,
      pierced: wing.weapon === 'omega' ? new Set<Enemy>() : undefined,
      hydraTarget:boss&&this.level==='summer'&&wing.weapon==='homing'?nearestHydraHead(this.summerHydra,origin.x/BOSS_PROJECTION,true):undefined,
    });
  }

  private stepLaser(wing: Wing, origin: Point, boss: boolean, dt: number) {
    let enemy: Enemy | undefined;
    let target: Enemy | number | undefined;
    let head:HydraSide|undefined;
    let endY = 8;
    if(boss&&this.level==='summer'){
      const native={x:origin.x/BOSS_PROJECTION,y:origin.y/BOSS_PROJECTION};
      const hit=hydraBossContact(this.summerHydra,this.time,native,{x:native.x,y:15});
      head=hit?.side;target=head;endY=hit?hydraBossHead(this.time,hit.side).y*BOSS_PROJECTION:8;
    }else if (boss && this.planarBoss) {
      const t = this.planarBossEntry(origin, { x: origin.x, y: 10 });
      if(Number.isFinite(t)){target=0;endY=origin.y+(10-origin.y)*t;}
    }else if (boss) {
      endY = this.bossAimY * BOSS_PROJECTION;
      if (Math.abs(origin.x - this.exposedCannonX * BOSS_PROJECTION) < this.bossTargetRadius * BOSS_PROJECTION) {
        target = this.exposedCannonX;
      }
    } else if (this.isDen) {
      let first = Infinity;
      for (const candidate of this.enemies) {
        if (candidate.hp <= 0) continue;
        const t = denTargetEntry(origin, { x: origin.x, y: 9 }, candidate);
        if (t < first) { first = t; enemy = candidate; }
      }
      if (enemy) { target = enemy; endY = origin.y + (9 - origin.y) * first; }
    } else {
      let firstContact=Infinity;
      for (const candidate of this.enemies) {
        if(candidate.mine)continue;
        const entry=candidate.summer?.kind==='hydra'?hydraBeamEntry(candidate,this.time,origin):candidate.flyer?flyerBeamEntry({...candidate,flyer:candidate.flyer},origin):candidate.ambusher?ambusherBeamEntry(candidate.ambusher,this.time,origin):candidate.shrimp||candidate.ventWorm?faunaBeamEntry(candidate,origin):candidate.y;
        if (candidate.hp > 0 && (candidate.summer?.kind==='hydra' ? Number.isFinite(entry) : candidate.flyer ? Number.isFinite(entry) : candidate.ambusher ? ambusherBodyHit(candidate.ambusher,this.time,origin,{x:origin.x,y:9}) : candidate.shrimp||candidate.ventWorm ? faunaBodyHit(candidate,origin,{x:origin.x,y:9}) : candidate.marine ? marineBodyHit(candidate as Enemy & {marine: MarineKind}, origin, {x: origin.x, y: 9})
          : Math.abs(candidate.x - origin.x) < enemyRadius(candidate,.43) && candidate.y >= origin.y) && entry<firstContact) {
          enemy = candidate;firstContact=entry;
        }
      }
      target = enemy;
      if(enemy?.summer?.kind==='hydra')head=hydraBeamContact(enemy,this.time,origin)?.side;
      if (enemy) endY = enemy.summer?.kind==='hydra' || enemy.ambusher || enemy.ventWorm || enemy.flyer ? 9 : enemy.y + (enemy.shrimp ? 1.4 : enemy.marine ? marineSpecs[enemy.marine].halfLength : 0);
    }
    if(boss&&this.level==='biolume')for(const candidate of this.enemies){
      if(!candidate.rayOrb||candidate.hp<=0)continue;const dx=candidate.x-origin.x;
      if(Math.abs(dx)>RAY_SEEKER_RADIUS)continue;
      const entry=candidate.y-Math.sqrt(RAY_SEEKER_RADIUS**2-dx*dx);
      if(candidate.y+RAY_SEEKER_RADIUS<origin.y||entry>endY)continue;
      enemy=candidate;target=candidate;endY=Math.max(origin.y,entry);
    }
    wing.beamEnd = { x: origin.x, y: endY };
    wing.laserHold = target !== undefined && target === wing.laserTarget && head===wing.laserHead ? wing.laserHold + dt : 0;
    wing.laserTarget = target;
    wing.laserHead=head;
    const damage = (1 + 2.5 * Math.min(wing.laserHold / 0.85, 1)) * dt;
    if (enemy) this.damageEnemy(enemy, damage, true,head);
    if (boss && typeof target==='number') this.damageBoss(damage, true,head);
  }

  private guideMissile(shot: Shot, boss: boolean, dt: number) {
    boss &&= !this.planarBoss;
    if (boss) {
      const remaining = Math.max(dt, (BOSS_DEPTH - shot.z) / shot.vz);
      const steer = Math.min(1, 10 * dt);
      if(this.level==='summer'&&(shot.hydraTarget===undefined||!hydraAlive(this.summerHydra,shot.hydraTarget)))shot.hydraTarget=nearestHydraHead(this.summerHydra,shot.x,true);
      const x=this.level==='summer'?hydraBossHead(this.time,shot.hydraTarget!).x:this.exposedCannonX;
      shot.vx += ((x - shot.x) / remaining - shot.vx) * steer;
      return;
    }

    let closest: Point | undefined;
    let distance = 36;
    for (const enemy of this.enemies) {
      if(enemy.hp<=0||enemy.mine)continue;
      if(enemy.summer?.kind==='hydra'){
        const head=closestRiverHead(enemy,this.time,shot,distance);if(head){closest=head.point;distance=head.distance;}
        continue;
      }
      if (enemy.hp <= 0 || enemy.mine || enemy.y <= shot.y || (enemy.ambusher && !ambusherHulls(enemy.ambusher,this.time).length)) continue;
      const squared = (enemy.x - shot.x) ** 2 + (enemy.y - shot.y) ** 2;
      if (squared < distance) {
        closest = enemy;
        distance = squared;
      }
    }
    if(!closest&&this.level==='biolume'&&this.phase==='boss')closest=rayOrgan(this.rayTime,raySignal(this.rayTime).side);
    if (!closest && this.isDen && this.phase === 'boss') {
      const pose = denPose(this.denBossTime);
      if (shot.y < pose.y) closest = pose;
    }
    const heading = Math.atan2(shot.vx, shot.vy);
    const target = closest ? Math.atan2(closest.x - shot.x, closest.y - shot.y) : 0;
    const angle = heading + clamp(target - heading, -4.8 * dt, 4.8 * dt);
    shot.vx = Math.sin(angle) * wingShots.homing.speed;
    shot.vy = Math.cos(angle) * wingShots.homing.speed;
  }

  private stepDroneWeapon(dt: number) {
    if (!this.weaponsActive) return;
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
      this.towlineHydraHits.clear();this.towlineBossHeads.clear();
      this.towlineHitCannon = false;
    }
    if (this.towlineFlash === 0) return;

    if(this.level==='biolume'&&this.phase==='boss')for(const enemy of this.enemies){
      if(enemy.rayOrb&&enemy.hp>0&&!this.towlineEnemies.has(enemy)&&nearSegment(enemy,this.player,this.drone,RAY_SEEKER_RADIUS)){
        this.towlineEnemies.add(enemy);this.damageEnemy(enemy,this.towlineDamage);
      }
    }

    if (this.phase === 'boss') {
      if (this.planarBoss) {
        if (!this.towlineHitCannon && Number.isFinite(this.planarBossEntry(this.player, this.drone))) {
          this.towlineHitCannon = true;
          this.damageBoss(this.towlineDamage);
        }
        return;
      }
      if(this.level==='summer'){
        const start={x:this.player.x/BOSS_PROJECTION,y:this.player.y/BOSS_PROJECTION},end={x:this.drone.x/BOSS_PROJECTION,y:this.drone.y/BOSS_PROJECTION};
        let hit;while((hit=hydraBossContact(this.summerHydra,this.time,start,end,0,this.towlineBossHeads))){this.towlineBossHeads.add(hit.side);this.damageBoss(this.towlineDamage,false,hit.side);}
        return;
      }
      const cannon = { x: this.exposedCannonX * BOSS_PROJECTION, y: this.bossAimY * BOSS_PROJECTION };
      if (!this.towlineHitCannon &&
        nearSegment(cannon, this.player, this.drone, this.bossTargetRadius * BOSS_PROJECTION)) {
        this.towlineHitCannon = true;
        this.damageBoss(this.towlineDamage);
      }
      return;
    }
    for (const enemy of this.enemies) {
      if(enemy.hp>0&&enemy.summer?.kind==='hydra'){
        const heads=this.towlineHydraHits.get(enemy)??new Set<HydraSide>();this.towlineHydraHits.set(enemy,heads);
        let hit;while((hit=hydraContact(enemy,this.time,this.player,this.drone,.05,heads))){heads.add(hit.side);this.damageEnemy(enemy,this.towlineDamage,false,hit.side);}
        continue;
      }
      if (enemy.hp > 0 && !enemy.mine && !this.towlineEnemies.has(enemy) &&
        (enemy.den || enemy.denTurret ? Number.isFinite(denTargetEntry(this.player, this.drone, enemy)) : enemy.flyer ? flyerBodyHit({...enemy,flyer:enemy.flyer},this.player,this.drone) : enemy.ambusher ? ambusherBodyHit(enemy.ambusher,this.time,this.player,this.drone) : enemy.shrimp||enemy.ventWorm ? faunaBodyHit(enemy,this.player,this.drone) : enemy.marine ? marineBodyHit(enemy as Enemy & {marine: MarineKind}, this.player, this.drone) : nearSegment(enemy, this.player, this.drone, enemyRadius(enemy)))) {
        this.towlineEnemies.add(enemy);
        this.damageEnemy(enemy, this.towlineDamage);
      }
    }
  }

  private stepStage(dt: number) {
    if (this.isDen) {
      if (this.time < this.stageDuration) {
        this.stepDenPatrols(dt);
        if (this.phase === 'stage') this.stepDenDefenses(dt);
      }
      return;
    }
    if(this.level==='heliostat')while(this.nextCrawler<crawlerSites.length){
      const crawler={site:this.nextCrawler},p=crawlerPose(crawler,this.time);if(p.physicalY>23)break;
      this.nextCrawler++;if(p.y<-10)continue;
      this.enemies.push({x:p.x,y:p.y,lane:p.x,age:0,fire:Infinity,hp:CRAWLER_HP,crawler,drop:crawler.site%2?'omega':'laser'});
    }
    if(this.level==='heliostat')for(let site=0;site<electricSites.length;site++)if(electricHits(site,this.time,this.time-dt,this.player))this.hit();
    // Mines are invulnerable scenery hazards; hp is only their active/spent flag.
    if(this.level==='boulevard')while(this.nextMine<mineSites.length){const mine={site:this.nextMine},p=minePose(mine,this.time);if(p.physicalY>28)break;this.nextMine++;this.enemies.push({x:p.x,y:p.y,lane:p.x,age:0,fire:Infinity,hp:1,mine});}
    if(this.level==='preserve')while(this.nextAmbusher<ambusherSites.length){
      const site=this.nextAmbusher,home=ambusherHome(site,this.time);if(home.y>AMBUSHER_SPAWN_LEAD)break;this.nextAmbusher++;
      if(home.y<-12)continue;
      const ambusher=createAmbusherState(site),pose=ambusherPose(ambusher,this.time);
      this.enemies.push({x:pose.head.x,y:pose.head.y,lane:home.x,age:0,fire:Infinity,hp:AMBUSHER_HP,ambusher,drop:ambusherSites[site].drop as WingWeapon});
    }
    const wave: Wave | undefined = (this.level==='biolume'?groveWaves:this.level==='summer'?summerWaves:this.level==='heliostat'?heliostatWaves:this.level==='boulevard'?boulevardWaves:this.level === 'broodlock' ? hiveWaves : this.level === 'ice' ? iceWaves : this.level === 'vents' ? ventWaves : this.level === 'io' ? ioWaves : this.level === 'titan' ? titanWaves : stageWaves)[this.nextWave];
    if (wave && this.time >= wave.time-(wave.grove?GROVE_SPAWN_LEAD:wave.summer?3:wave.heliostat?HELIOSTAT_SPAWN_LEAD:wave.boulevard?BOULEVARD_SPAWN_LEAD:0)) {
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
        const grove=wave.grove?{...wave.grove,slot:index}:undefined;
        const summer=wave.summer?{...wave.summer,slot:index}:undefined;
        const heliostat=wave.heliostat?{...wave.heliostat,slot:index}:undefined;
        const boulevard=wave.boulevard?{...wave.boulevard,slot:index}:undefined;
        const flyer = wave.flyer && index !== wave.raptor ? { ...wave.flyer, slot: index - (wave.raptor !== undefined && index > wave.raptor ? 1 : 0), count: wave.lanes.length - (wave.raptor !== undefined ? 1 : 0) } : undefined;
        const school = wave.formation ? {formation: wave.formation, slot: index, count: wave.lanes.length, mirror: wave.mirror ?? 1} : undefined;
        const shrimp=wave.shrimp?{...wave.shrimp,slot:index}:undefined;
        const course = wave.cicada ? { ...wave.cicada, slot: index, count: wave.lanes.length } : undefined;
        const courseAge=grove||boulevard||heliostat||summer?this.time-wave.time-dt:0;
        const start = grove?groveMotion(courseAge,lane,grove):summer?summerMotion(courseAge,lane,summer,this.time):heliostat?heliostatMotion(courseAge,lane,heliostat):boulevard?boulevardMotion(courseAge,lane,boulevard):flyer ? flyerMotion(0,lane,flyer) : shrimp ? shrimpMotion(0,lane,shrimp) : wave.ventAnchor!==undefined ? ventAnchorPoint(wave.ventAnchor,this.time) : wave.crucible ? crucibleMotion(0,lane) : wave.skipper ? skipperMotion(0,lane,index) : course ? cicadaMotion(0, lane, course) : wave.marine ? marineMotion(wave.marine, 0, lane, school) : {x: lane, y: 8.6};
        return {
          x: start.x, y: start.y, lane, hydra:summer?.kind==='hydra'?createHydraState():undefined, age: grove||boulevard||heliostat||summer?courseAge:wave.ventAnchor!==undefined?-VENT_SPAWN_LEAD:0, grove,frog:grove?.kind==='frog'?createFrogState(lane):undefined,summer,heliostat,boulevard,flyer, school, cicada: course, skipper: wave.skipper, crucible: wave.crucible, ventAnchor:wave.ventAnchor, ventWorm:wave.ventWorm, shrimp, slot: index,
          fire: grove?2.15+index*.3:summer?(summer.kind==='vortex'?VORTEX_FIRE:summer.kind==='hydra'?2.7:1.8+index*.25):heliostat?(heliostat.kind==='guard'?HELIOSTAT_GUARD_FIRE+index*.35:1.85+index*.25):boulevard?1.7+index*.22:flyer ? Infinity : shrimp ? SHRIMP_FIRST_FIRE+index*.25 : wave.ventWorm ? WORM_FIRST_ATTACK : wave.ventAnchor!==undefined ? MORTAR_FIRST_FIRE : wave.crucible ? CRUCIBLE_FIRST_POUR : schoolDelay(school) + (wave.marine === 'plesiosaur' ? 1.8 : wave.ant === 'soldier' ? 1.6 : 1.1) + index * 0.28,
          hp: grove?(grove.kind==='frog'?FROG_HP:grove.kind==='sentry'?6:grove.kind==='skimmer'?2:3):summer?(summer.kind==='vortex'?VORTEX_HP:summer.kind==='hydra'?HYDRA_HEAD_HP*3:summer.kind==='drone'?4:2):heliostat?(heliostat.kind==='guard'?8:3):boulevard?(boulevard.formation==='intercept'?5:boulevard.heavy?6:3):flyer ? FLYER_HP : shrimp ? SHRIMP_HP : wave.ventWorm ? WORM_HP : wave.ventAnchor!==undefined ? MORTAR_HP : wave.crucible ? CRUCIBLE_HP : wave.marine ? marineSpecs[wave.marine].hp : wave.ant === 'soldier' ? 5 : 2, ant: wave.ant, marine: wave.marine,
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
      if(enemy.crawler){
        const p=stepCrawler(enemy.crawler,this.time,this.player);enemy.x=p.x;enemy.y=p.y;
        if(crawlerHits(enemy.crawler,this.time,this.time-dt,this.player))this.hit();
      } else if(enemy.mine){
        const p=triggerMine(enemy.mine,this.time,this.player);enemy.x=p.x;enemy.y=p.y;
        if(p.elapsed>=MINE_WINDUP+MINE_JUMP){enemy.mine.burstAt=this.time;enemy.hp=0;this.threats.push(...mineBurst(p.x,p.y));continue;}
      } else if (enemy.ambusher) {
        stepAmbusher(enemy.ambusher,this.time,this.player,dt);
        const p=ambusherPose(enemy.ambusher,this.time);enemy.x=p.head.x;enemy.y=p.head.y;
      } else if(enemy.grove){
        const p=groveMotion(enemy.age,enemy.lane,enemy.grove);enemy.x=p.x;enemy.y=p.y;enemy.heading=p.heading;
        if(enemy.frog){stepFrog(enemy.frog,enemy,this.player,enemy.age,groveCanAttack(enemy.age,enemy.lane,enemy.grove));enemy.heading=frogHeading(enemy.frog,enemy.age);if(frogTongueHits(enemy.frog,enemy,enemy.age,this.player))this.hit();}
      } else if(enemy.heliostat){
        const p=heliostatMotion(enemy.age,enemy.lane,enemy.heliostat);enemy.x=p.x;enemy.y=p.y;enemy.heading=p.heading;
      } else if(enemy.summer){
        const p=summerMotion(enemy.age,enemy.lane,enemy.summer,this.time);enemy.x=p.x;enemy.y=p.y;enemy.heading=p.heading;
        if(enemy.summer.kind==='vortex'&&enemy.y<6.5&&enemy.y>-5)while(enemy.age+1e-8>=enemy.fire){const emission=vortexEmission(enemy.fire,enemy.x,enemy.y,enemy.summer.mirror);this.threats.push(...emission.shots);enemy.fire=emission.next;}
      } else if(enemy.boulevard){
        const p=boulevardMotion(enemy.age,enemy.lane,enemy.boulevard);enemy.x=p.x;enemy.y=p.y;enemy.heading=p.heading;
        if(enemy.boulevard.formation==='intercept'&&enemy.y<8&&enemy.age>=enemy.fire-.65&&enemy.interceptorAim===undefined)enemy.interceptorAim=Math.atan2(this.player.x-enemy.x,this.player.y-enemy.y);
        if(enemy.boulevard.formation==='intercept')enemy.interceptorHeading=turnBoulevardTurret(enemy.interceptorHeading??Math.PI-p.heading,enemy.interceptorAim??Math.atan2(this.player.x-enemy.x,this.player.y-enemy.y),dt);
      } else if (enemy.flyer) {
        const p=flyerMotion(enemy.age,enemy.lane,enemy.flyer);enemy.x=p.x;enemy.y=p.y;enemy.heading=p.heading;
      } else if (enemy.ventAnchor!==undefined) {
        const p=ventAnchorPoint(enemy.ventAnchor,this.time);enemy.x=p.x;enemy.y=p.y;enemy.ventScale=p.scale;
        if(enemy.ventWorm){
          const pose=wormPose(enemy.age,enemy.fire,enemy.wormReach,enemy.wormBend);
          if(pose.phase==='hidden')enemy.wormLocked=false;
          if(!enemy.wormLocked){
            enemy.mortarAngle=mortarAim(enemy,this.player);
            enemy.wormReach=clamp(Math.hypot(this.player.x-enemy.x,this.player.y-enemy.y)/(enemy.ventScale??1)+.8,3,WORM_REACH);
            enemy.wormBend=enemy.x>0?.85:-.85;
            if(enemy.age>=enemy.fire-WORM_WINDUP)enemy.wormLocked=true;
          }
          if(enemy.age>=enemy.fire)enemy.fire+=WORM_INTERVAL;
        }else{
          enemy.mortarAngle=mortarAim(enemy,this.player);
          if(enemy.age>=enemy.fire&&enemy.y<8){
            const origin=mortarMuzzle(enemy,enemy.mortarAngle);
            for(const spread of [-.18,0,.18])this.threats.push({...origin,z:0,vx:Math.sin(enemy.mortarAngle+spread)*3.8,vy:-Math.cos(enemy.mortarAngle+spread)*3.8,vz:0});
            enemy.fire+=MORTAR_INTERVAL;
          }
        }
      } else if (enemy.shrimp) {
        const p=shrimpMotion(enemy.age,enemy.lane,enemy.shrimp);enemy.x=p.x;enemy.y=p.y;enemy.heading=p.heading;
        if(enemy.age>=enemy.fire&&enemy.y<8){
          const origin=faunaMuzzle(enemy),angle=Math.atan2(this.player.x-origin.x,origin.y-this.player.y);
          for(const spread of [-.065,.065])this.threats.push({...origin,z:0,vx:Math.sin(angle+spread)*4.8,vy:-Math.cos(angle+spread)*4.8,vz:0});
          enemy.fire+=SHRIMP_INTERVAL;
        }
      } else if (enemy.crucible) {
        const p=crucibleMotion(enemy.age,enemy.lane);enemy.x=p.x;enemy.y=p.y;
        if(enemy.age>=enemy.fire){
          enemy.fire+=CRUCIBLE_POUR_INTERVAL;
          const y=enemy.y+CRUCIBLE_MUZZLE_Y,angle=Math.atan2(this.player.x-enemy.x,this.player.y-y);
          for(const spread of [-.28,0,.28])this.enemies.push({x:enemy.x,y,lane:0,age:0,fire:Infinity,hp:1,
            slag:{vx:Math.sin(angle+spread)*3.4,vy:Math.cos(angle+spread)*3.4}});
        }
      } else if (enemy.slag) {
        const speed=slagSpeed(enemy.age);enemy.x+=enemy.slag.vx*speed*dt;enemy.y+=enemy.slag.vy*speed*dt;
      } else if (enemy.skipper) {
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
      if (!enemy.frog && enemy.summer?.kind!=='vortex' && !enemy.mine && !enemy.flyer && !enemy.ambusher && !enemy.shrimp && enemy.ventAnchor===undefined && !enemy.crucible && !enemy.slag && !motion && (!enemy.centipede || (enemy.centipede.slot === 0 && !enemy.centipede.chain.escape)) && enemy.age >= enemy.fire && enemy.y < 8 && (!enemy.grove||groveCanAttack(enemy.age,enemy.lane,enemy.grove)) && (!enemy.heliostat||heliostatCanAttack(enemy.age,enemy.lane,enemy.heliostat))) {
        enemy.fire += enemy.grove?(enemy.grove.kind==='sentry'?3.1:2.8):enemy.heliostat?.kind==='guard'?3.2:enemy.boulevard?.formation==='intercept'?2.8:enemy.boulevard?3.4:enemy.centipede ? 3.5 : enemy.cicada ? 3 : enemy.marine === 'plesiosaur' ? 3.2 : enemy.ant === 'soldier' ? 3.1 : 2.4;
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const angle = enemy.interceptorAim ?? Math.atan2(dx, dy);
        const speed = enemy.grove?4.6:enemy.marine ? (enemy.marine === 'plesiosaur' ? 4 : 5) : enemy.ant ? 4.6 : 5.7;
        const spread = enemy.grove?.kind==='sentry'?[-.2,0,.2]:enemy.summer?.kind==='hydra'?[-.25,0,.25]:enemy.heliostat?.kind==='guard'?[-.19,0,.19]:enemy.boulevard?.formation==='intercept'?[-.12,0,.12]:enemy.boulevard?.heavy?[-.18,0,.18]:enemy.marine === 'plesiosaur' ? [-.3,-.15,0,.15,.3] : enemy.ant === 'soldier' ? [-0.24, 0, 0.24] : [0];
        for (const offset of spread) {
          const muzzle = enemy.grove?groveEnemySize(enemy.grove)*.95:enemy.heliostat?.kind === 'guard' ? .85 : enemy.marine ? marineSpecs[enemy.marine].halfLength : 0;
          const head=enemy.summer?.kind==='hydra'?riverHydraHead(enemy,this.time,Math.sign(offset)):undefined;
          if(head&&!hydraAlive(enemy.hydra,Math.sign(offset) as HydraSide))continue;
          this.threats.push({ x: enemy.x + (head?.x??Math.sin(enemy.heading ?? 0)*muzzle), y: enemy.y + (head?head.y-.65:-Math.cos(enemy.heading ?? 0)*muzzle), z: 0,
            vx: Math.sin(angle + offset) * speed, vy: Math.cos(angle + offset) * speed, vz: 0 });
        }
        enemy.interceptorAim=undefined;
      }
      if(enemy.mine)continue;
      if(enemy.summer?.kind==='hydra'){
        const head=hydraContact(enemy,this.time,this.player,this.player,.16);
        if(head){this.damageEnemy(enemy,(enemy.hydra?.hp[head.side+1]??enemy.hp/3),false,head.side);this.hit();}
        continue;
      }
      if(enemy.ambusher){
        if(ambusherHits(enemy.ambusher,this.time,this.time-dt,this.player))this.hit();
      } else if (enemy.flyer ? flyerBodyHit({...enemy,flyer:enemy.flyer},this.player,this.player,.16) : enemy.shrimp||enemy.ventWorm ? faunaBodyHit(enemy,this.player,this.player,.16) : enemy.marine ? marineBodyHit(enemy as Enemy & {marine: MarineKind},this.player,this.player,.2-marineSpecs[enemy.marine].radius*.2) : near(enemy, this.player, enemyRadius(enemy)+.16)) {
        if(!enemy.ventWorm)enemy.hp = 0;
        if (enemy.centipede) severCentipede(enemy);
        this.hit();
      }
    }
  }

  private stepDenDefenses(dt: number) {
    const scroll = denScroll(this.time);
    while (this.nextDenTurret < denTurretSites.length) {
      const point = denDefensePoint(denTurretSites[this.nextDenTurret], scroll);
      if (point.y > 9.6) break;
      const site = this.nextDenTurret++;
      if (point.y <= -9) continue;
      this.enemies.push({ ...point, lane: point.x, age: 0, fire: Infinity,
        hp: DEN_TURRET_HP, denTurret: createDenTurret(site) });
    }
    for (const enemy of this.enemies) {
      const turret = enemy.denTurret;
      if (!turret || enemy.hp <= 0) continue;
      const point = denDefensePoint(denTurretSites[turret.site], scroll);
      enemy.x = point.x;
      enemy.y = point.y;
      enemy.age += dt;
      const muzzle = stepDenTurret(turret, point, this.player, this.time, dt);
      if (!muzzle) continue;
      this.threats.push({ x: muzzle.x, y: muzzle.y, z: 0, vx: Math.sin(muzzle.heading) * 5.8,
        vy: -Math.cos(muzzle.heading) * 5.8, vz: 0, planar: true });
    }
    for (const [site, mine] of this.denMines.entries()) {
      const burst = stepDenMine(site, mine, scroll, this.time, this.player);
      if (!burst) continue;
      for (const shot of mineBurst(burst.x, burst.y, 10, 4, (site % 2) * Math.PI / 10))
        this.threats.push({ ...shot, planar: true });
    }
  }

  private stepDenPatrols(dt: number) {
    const wave = denWaves[this.nextWave];
    if (wave && this.time >= wave.time) {
      this.nextWave++;
      for (const [slot, lane] of wave.lanes.entries()) {
        const den: DenPatrol = { course: wave.course, side: wave.side, slot, heavy: slot === wave.guard };
        const age = this.time - wave.time - slot * DEN_PATROL_STAGGER - dt;
        const pose = denPatrolPose(age, lane, den);
        this.enemies.push({ x: pose.x, y: pose.y, heading: pose.heading, lane, age, den, fire: Infinity,
          hp: den.heavy ? 7 : 3, drop: slot === (wave.guard ?? 0) ? wave.drop : undefined });
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy.den || enemy.hp <= 0) continue;
      enemy.age += dt;
      const pose = denPatrolPose(enemy.age, enemy.lane, enemy.den);
      enemy.x = pose.x;
      enemy.y = pose.y;
      enemy.heading = pose.heading;
      if (enemy.age < 0) continue;
      if (Number.isFinite(denPatrolEntry(this.player, this.player, enemy, enemy.den, .23))) this.hit();
      if (this.phase !== 'stage') return;
      if (!denPatrolCanFire(pose, enemy.den)) { enemy.fire = Infinity; continue; }
      if (!Number.isFinite(enemy.fire)) enemy.fire = enemy.age + DEN_PATROL_WINDUP;
      if (enemy.age < enemy.fire) continue;
      enemy.fire = enemy.age + (enemy.den.heavy ? 2.45 : 2.8);
      const reach = .82 * denPatrolScale(enemy.den);
      const x = enemy.x + Math.sin(pose.heading) * reach, y = enemy.y - Math.cos(pose.heading) * reach;
      const aim = Math.atan2(this.player.x - x, Math.max(1.8, y - this.player.y));
      for (const spread of enemy.den.heavy ? [-.22, 0, .22] : [0]) {
        const angle = aim + spread, speed = enemy.den.heavy ? 4.95 : 4.7;
        this.threats.push({ x, y, z: 0, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed, vz: 0, planar: true });
      }
    }
  }

  private stepBoss(dt: number) {
    if (this.isDen) {
      this.stepDenBoss(dt);
      return;
    }
    if(this.level==='biolume'){this.stepLanternRay(dt);return;}
    if(this.level==='summer'){this.stepSummerHydra();return;}
    if(this.level==='heliostat'){this.stepHeliostat();return;}
    if (this.level === 'preserve') {
      const attack = groundskeeperAttack(this.time);
      if (attack.warning && this.groundskeeperAimCycle !== attack.cycle) {
        this.groundskeeperAim = { x: clamp(this.player.x, -3.5, 3.5), y: clamp(this.player.y, -6.8, 5.5) };
        this.groundskeeperAimCycle = attack.cycle;
      }
      if (groundskeeperHits(this.time, this.time - dt, this.groundskeeperAim, this.player, this.groundskeeperCancelledAt)) this.hit();
      return;
    }
    if(this.level==='boulevard'){this.stepBoulevard();return;}
    if(this.level === 'io') { this.stepCaldera(); return; }
    if(this.level === 'titan') { this.stepCicada(); return; }
    if(this.level === 'ice') { this.stepLeviathan(); return; }
    const elapsed = this.time % BOSS_VOLLEY_INTERVAL;
    const volley = Math.floor(this.time / BOSS_VOLLEY_INTERVAL);
    if (elapsed >= BOSS_WINDUP_AT && this.markers.length === 0 && elapsed < BOSS_FIRE_AT) {
      const { x, y } = this.player;
      this.markers = (this.level==='vents'&&this.crabCoreOpen?[-1.7,-.85,0,.85,1.7]:[-1.35, 0, 1.35]).map((offset) => ({
        x: clamp(x, -2.6, 2.6) + (this.volley % 2 === 0 ? offset : 0),
        y: clamp(y, -5.9, 5.25) + (this.volley % 2 === 0 ? 0 : offset),
      }));
    }
    if (elapsed >= BOSS_FIRE_AT && this.markers.length && this.volley === volley) {
      const x = this.exposedCannonX;
      const z = BOSS_DEPTH + BOSS_MUZZLE_Z;
      this.firedCannonX = x;if(this.level==='vents')this.firedCrabTarget=this.crabTargetX;
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

  private stepLanternRay(dt:number){
    const s=raySignal(this.time),origin=rayOrgan(this.time,s.side);
    if(s.phase>=.65&&s.phase<RAY_FAN_AT&&this.rayFanCycle!==s.cycle&&!this.markers.length)this.markers=[{x:this.player.x,y:this.player.y}];
    if(s.phase>=RAY_FAN_AT&&this.rayFanCycle!==s.cycle){
      const target=this.markers[0]??this.player,angle=Math.atan2(target.x-origin.x,origin.y-target.y);
      for(const spread of[-.36,-.18,0,.18,.36])this.threats.push({...origin,z:0,vx:Math.sin(angle+spread)*4.6,vy:-Math.cos(angle+spread)*4.6,vz:0,planar:true});
      this.rayFanCycle=s.cycle;this.volley=s.cycle+1;this.firedCannonX=this.exposedCannonX;this.bossRecoil=BOSS_RECOIL_TIME;this.markers=[];
    }
    if(s.phase>=RAY_SEEKER_AT&&this.raySeekerCycle!==s.cycle){
      const sides=this.bossHealth<RAY_HP/2?[-s.side,s.side]:[-s.side];
      for(const side of sides){if(this.enemies.filter(e=>e.rayOrb&&e.hp>0).length>=RAY_SEEKER_POOL)break;
        const p=rayOrgan(this.time,side);this.enemies.push({...p,lane:p.x,age:0,fire:Infinity,hp:RAY_SEEKER_HP,rayOrb:{heading:Math.atan2(this.player.x-p.x,p.y-this.player.y),previousX:p.x,previousY:p.y}});
      }
      this.raySeekerCycle=s.cycle;this.bossRecoil=BOSS_RECOIL_TIME;
    }
    for(const enemy of this.enemies){if(!enemy.rayOrb||enemy.hp<=0)continue;
      enemy.age+=dt;stepRaySeeker(enemy as Enemy&{rayOrb:RaySeeker},this.player,dt);
      if(enemy.age>8||Math.abs(enemy.x)>5.2||Math.abs(enemy.y)>9.5)enemy.hp=0;
      else if(enemy.age>.35&&near(enemy,this.player,RAY_SEEKER_RADIUS+.16)){enemy.hp=0;this.hit();}
    }
  }

  private stepSummerHydra(){
    stepHydraAttack(this.summerAttack,this.time,this.player,this.summerHydra,BOSS_DEPTH,BOSS_IMPACT_TRAVEL);
    this.volley=this.summerAttack.volley;this.markers=this.summerAttack.markers;this.threats.push(...this.summerAttack.shots);
    if(this.summerAttack.fired)this.bossRecoil=BOSS_RECOIL_TIME;
  }

  private stepHeliostat(){
    const cycle=Math.floor(this.time/HELIOSTAT_INTERVAL),t=this.time%HELIOSTAT_INTERVAL;
    if(!this.heliostatUnstable&&this.bossHealth<HELIOSTAT_HP/2){
      this.heliostatEscalationAt=this.time;this.heliostatEscalationCycle=cycle+1;
      this.pickupMessage='Magnetic lens unstable · Alternating channels';this.pickupTime=3;
    }
    if(this.heliostatCancelledCycle===cycle)return;
    if(cycle!==this.heliostatAimCycle&&t>=HELIOSTAT_WINDUP&&t<HELIOSTAT_FIRE){
      this.heliostatAimCycle=cycle;
      this.heliostatLockedPattern=cycle>=this.heliostatEscalationCycle?(cycle%2?1:-1):0;
      this.markers=heliostatLockTargets(this.player,this.heliostatPattern);
    }
    if(heliostatPlasmaHits(this.time,this.heliostatTargets,this.player,this.heliostatPattern))this.hit();
    if(t>HELIOSTAT_FIRE+HELIOSTAT_CHANNEL+HELIOSTAT_FADE+(this.heliostatPattern ? .55 : 0)+.02)this.markers=[];
  }

  private stepBoulevard(){
    const t=this.time%BOULEVARD_INTERVAL,cycle=Math.floor(this.time/BOULEVARD_INTERVAL);
    if(t>=BOULEVARD_WINDUP&&t<BOULEVARD_FIRE&&!this.markers.length){
      const gap=Math.max(-2.4,Math.min(2.4,this.player.x));
      this.markers=[{x:gap,y:this.player.y}];
    }
    if(t>=BOULEVARD_FIRE&&this.markers.length&&this.volley===cycle){
      const locked=this.markers[0],z=BOSS_DEPTH+BOSS_MUZZLE_Z;
      for(const side of[-1,1])for(const offset of[-1.8,-.9,0,.9,1.8]){
        const x=side*2.4,y=BOSS_Y-.3,targetX=locked.x+offset+(cycle%2?.45:0);
        this.threats.push({x,y,z,vx:(targetX-x)/BOULEVARD_TRAVEL,vy:(locked.y-y)/BOULEVARD_TRAVEL,vz:-z/BOULEVARD_TRAVEL});
      }
      this.firedCannonX=0;this.bossRecoil=BOSS_RECOIL_TIME;this.volley++;
    }
    if(t>BOULEVARD_FIRE+BOULEVARD_TRAVEL+.05)this.markers=[];
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

  private stepDenBoss(dt: number) {
    const cycle = Math.floor(this.time / DEN_CYCLE);
    for (const [index, at] of DEN_BURSTS.entries()) {
      const firedAt = cycle * DEN_CYCLE + at;
      if (firedAt <= this.time - dt || firedAt > this.time) continue;
      const pose = denPose(firedAt);
      const gun = DEN_GUNS[(cycle + index) % DEN_GUNS.length];
      const origin = denMount(pose, gun);
      const direction = Math.atan2(this.player.x - origin.x, Math.min(-2, this.player.y - origin.y));
      const pellets = this.bossHealth <= DEN_HP / 2 ? 3 : 2;
      const speed = index === DEN_BURSTS.length - 1 ? 6.7 : 5.1;
      for (let i = -pellets; i <= pellets; i++) {
        const angle = direction + i * .17;
        this.threats.push({ ...origin, z: 0, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed, vz: 0, planar: true });
      }
    }
  }

  private fire({ x, y }: Point, drone = false, damage = 1) {
    if (this.phase === 'stage' || this.planarBoss) {
      this.shots.push({ x, y: y + (drone ? 0.3 : 0.45), z: 0, vx: 0, vy: 15, vz: 0, drone, damage });
      return;
    }

    const duration = 0.38;
    const targetsBoss = !drone && Math.abs(x) < 1.65;
    // Preserve horizontal drone placement while advancing visibly toward boss depth.
    const expansion = 1 / BOSS_PROJECTION - 1;
    const dx = drone ? x * expansion : (targetsBoss ? (this.level === 'io'||this.level==='vents'||this.level==='summer' ? this.exposedCannonX : 0) - x : 0);
    const dy = drone || targetsBoss ? this.bossAimY - y : 0;
    this.shots.push({ x, y, z: 0, vx: dx / duration, vy: dy / duration,
      vz: BOSS_DEPTH / duration, targetsBoss, bossSupport: this.level === 'io' ? !this.ioLegBroken : undefined, crabTarget:this.level==='vents'?this.crabTargetX:undefined,hydraTarget:this.level==='summer'&&targetsBoss?this.summerTargetHead:undefined, drone, damage });
  }

  private advance(shot: Shot, dt: number) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.z += shot.vz * dt;
  }

  private damageEnemy(enemy: Enemy, damage: number, laser = false,head?:HydraSide) {
    if (enemy.hp <= 0 || enemy.mine) return;
    const before = enemy.hp;
    if(enemy.summer?.kind==='hydra')damageRiverHydra(enemy,this.time,damage,head,laser);
    else enemy.hp = Math.max(0, enemy.hp - damage);
    if (laser) enemy.laserDamage = (enemy.laserDamage ?? 0) + before - enemy.hp;
    if (enemy.hp === 0) {
      if(enemy.rayOrb){this.threats.push(...raySeekerBurst(enemy,enemy.rayOrb.heading));this.score+=25;return;}
      if(enemy.ambusher)defeatAmbusher(enemy.ambusher,this.time);
      if(enemy.ventWorm&&enemy.ventAnchor!==undefined)this.defeatedVentWorms.add(enemy.ventAnchor);
      if (enemy.centipede) severCentipede(enemy);
      this.score += enemy.ambusher?200:enemy.crucible?300:enemy.slag?10:enemy.ventWorm?250:enemy.denTurret||enemy.ventAnchor!==undefined?150:enemy.shrimp?125:100;
      if (enemy.drop) this.drops.push({ x: enemy.x, y: enemy.y, weapon: enemy.drop });
    }
  }

  private damageBoss(damage: number, laser = false,head:HydraSide=this.summerTargetHead) {
    if (this.phase !== 'boss') return;
    const before = this.bossHealth;
    if(this.level==='summer'){
      if(!hydraAlive(this.summerHydra,head))return;
      damageHydraHead(this.summerHydra,head,damage,this.time);this.bossHealth=this.summerHydra.hp.reduce((sum,hp)=>sum+hp,0);
      if(!laser){const point=hydraBossHead(this.time,head);this.summerLastHit={...point,z:BOSS_DEPTH+1.1};}
      if(!hydraAlive(this.summerHydra,head)){
        const index=this.summerAttack.heads.indexOf(head);if(index>=0){this.summerAttack.heads.splice(index,1);this.markers.splice(index,1);}
        this.pickupMessage=(head===0?'Central':head<0?'Left':'Right')+' head destroyed';this.pickupTime=2;
        for(const wing of this.wings)if(wing.laserHead===head){wing.laserHold=0;wing.laserTarget=undefined;}
      }
    }else if(this.level==='vents'&&!this.crabCoreOpen){
      const index=this.crabTargetX<0?0:1;this.crabClawHealth[index]=Math.max(0,this.crabClawHealth[index]-damage);
      this.bossHealth=CRAB_CORE_HP+this.crabClawHealth[0]+this.crabClawHealth[1];
      if(this.crabClawHealth[index]===0){this.crabBreakTimes[index]=this.time;this.pickupMessage=this.crabCoreOpen?'Claws disabled · Gill chamber exposed':index===0?'Crusher joint broken':'Cutter joint broken';this.pickupTime=2.4;for(const wing of this.wings){wing.laserHold=0;wing.laserTarget=undefined;}}
    }else this.bossHealth = Math.max(0, this.bossHealth - damage);
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
    if (this.isDen && this.phase === 'boss' && (phase === 'won' || phase === 'lost')) this.denFinalTime = this.time;
    if(this.level==='biolume'&&this.phase==='boss'&&(phase==='won'||phase==='lost'))this.rayFinalTime=this.time;
    if(this.level==='summer'&&this.phase==='boss'&&(phase==='won'||phase==='lost'))this.summerFinalTime=this.time;
    if(this.level==='heliostat'&&this.phase==='boss'&&(phase==='won'||phase==='lost'))this.heliostatFinalTime=this.time;
    if (this.level === 'preserve' && this.phase === 'boss' && (phase === 'won' || phase === 'lost')) this.groundskeeperFinalTime = this.time;
    this.phase = phase;
    this.time = 0;
    if (phase === 'approach' || phase === 'won') {
      if (!this.isDen || phase === 'won') this.shots = [];
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
    if (phase === 'boss'&&this.level!=='biolume') {
      this.cooldown = 0;
      this.droneCooldown = this.droneWeapon === 'towline' ? TOWLINE_INTERVAL : 0;
    }
  }
}
