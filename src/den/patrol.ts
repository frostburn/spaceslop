import { HEIGHT, WIDTH } from '../playfield';
import type { WingWeapon } from '../wing';
import { ellipseEntry } from '../planar-contact';
import { stageEnemyTuning } from '../stage-enemy-tuning';

type Point = { x: number; y: number };
type Course = 'launch' | 'cross' | 'weave';
export type DenPatrol = { course: Course; side: -1 | 1; slot: number; heavy: boolean };
type DenWave = Omit<DenPatrol, 'slot' | 'heavy'> & {
  time: number;
  lanes: readonly number[];
  guard?: number;
  drop?: WingWeapon;
};

export const DEN_PATROL_POOL = 10;
const tuning = stageEnemyTuning.den;
export const DEN_PATROL_STAGGER = .58 / tuning.pace;
export const DEN_PATROL_WINDUP = .46;
const guardSpread = [-.36, -.18, 0, .18, .36];

export const denWaves: readonly DenWave[] = [
  { time: 3.0, course: 'launch', side: -1, lanes: [-1.15] },
  { time: 7.4, course: 'weave', side: -1, lanes: [-1.45, 1.7], drop: 'homing' },
  { time: 12.2, course: 'cross', side: 1, lanes: [-1.7, -.25], drop: 'homing' },
  { time: 17.6, course: 'launch', side: -1, lanes: [-2.1, -.25, 1.5], drop: 'cannon' },
  { time: 22.7, course: 'weave', side: 1, lanes: [-1.9, .25, 2.45], drop: 'homing' },
  { time: 28.3, course: 'cross', side: -1, lanes: [.7, 2.5], guard: 1, drop: 'laser' },
  { time: 33.4, course: 'launch', side: 1, lanes: [2.55, .65] },
  { time: 38.5, course: 'weave', side: -1, lanes: [-2.3, .2, 2.5], drop: 'omega' },
  { time: 43.6, course: 'launch', side: -1, lanes: [-2.2, -.9, .55] },
  { time: 48.1, course: 'cross', side: 1, lanes: [-2.4, -.85], guard: 0, drop: 'homing' },
  { time: 53.5, course: 'weave', side: 1, lanes: [-2.55, -.5, 1.8] },
  { time: 58.3, course: 'cross', side: -1, lanes: [-1.3, .5, 2.35], guard: 1, drop: 'cannon' },
  { time: 63.4, course: 'launch', side: 1, lanes: [2.2, 1, -.3] },
  { time: 68.7, course: 'weave', side: -1, lanes: [-2.45, -.8, .8, 2.45], guard: 1, drop: 'laser' },
  { time: 73.5, course: 'cross', side: 1, lanes: [-2.15, -.55, .8] },
  { time: 78.5, course: 'launch', side: -1, lanes: [-1.8, .05, 1.75], guard: 0 },
  { time: 83.6, course: 'cross', side: -1, lanes: [-1.55, .35, 1.85], guard: 1, drop: 'omega' },
  { time: 89.2, course: 'weave', side: 1, lanes: [-2.5, -.85, .85, 2.5], guard: 1 },
  { time: 94, course: 'cross', side: 1, lanes: [-1.55, .6, 2.35], guard: 0 },
];

export function denPatrolScale(patrol: DenPatrol) { return patrol.heavy ? 1.23 : 1; }

export function denPatrolPose(age: number, lane: number, patrol: DenPatrol, pace: number = tuning.pace) {
  const t = Math.max(0, age) * pace;
  const speed = patrol.heavy ? 2.35 : 2.75;
  const weave = patrol.course === 'weave';
  const entry = weave ? 0 : patrol.course === 'cross' ? 2.3 : 1.8;
  const startY = weave ? 9.45 : 6.8 - .3 * patrol.slot;
  const startX = patrol.side * (WIDTH / 2 + 1.5);
  const fall = speed * entry * 2 / Math.PI;
  if (t < entry) {
    const angle = t / entry * Math.PI / 2;
    const vx = (lane - startX) * Math.cos(angle) * Math.PI / (2 * entry);
    const vy = -speed * Math.sin(angle);
    return {
      x: startX + (lane - startX) * Math.sin(angle), y: startY - fall * (1 - Math.cos(angle)),
      heading: Math.atan2(vx, -vy), throttle: .74,
    };
  }
  const motion = (t - entry) * (weave ? 2.15 : 1.8);
  const amplitude = weave ? .78 : .34;
  const direction = lane > 1.7 ? -1 : lane < -1.7 ? 1 : patrol.side;
  const vx = direction * amplitude * Math.sin(motion) * (weave ? 2.15 : 1.8) / 2;
  return {
    x: lane + direction * amplitude * (1 - Math.cos(motion)) / 2, y: startY - fall - speed * (t - entry),
    heading: Math.atan2(vx, speed), throttle: .42 + .12 * Math.cos(motion),
  };
}

export function denPatrolCanFire(pose: ReturnType<typeof denPatrolPose>, patrol: DenPatrol) {
  const radius = 1.14 * denPatrolScale(patrol);
  return Math.abs(pose.x) + radius < WIDTH / 2 && pose.y + radius < HEIGHT / 2 && pose.y > -4.1 && Math.abs(pose.heading) < .63;
}

export function denPatrolVolley(origin: Point, player: Point, patrol: DenPatrol) {
  const interval = (patrol.heavy ? 2.45 : 2.8) * tuning.cadence;
  const { x, y } = origin;
  const aim = Math.atan2(player.x - x, Math.max(1.8, y - player.y));
  const speed = (patrol.heavy ? 4.95 : 4.7) * tuning.shotSpeed;
  const spread = patrol.heavy ? guardSpread : tuning.spread;
  return {
    interval,
    shots: spread.map(offset => {
      const angle = aim + offset;
      return { x, y, z: 0, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed, vz: 0, planar: true };
    }),
  };
}

export function denPatrolWarp(heading: number, poseCount: number) {
  const angle = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, heading));
  const last = poseCount - 1;
  const position = Math.abs(angle) / (Math.PI / 2) * last;
  const first = Math.floor(position), second = Math.min(last, first + 1);
  const fraction = position - first;
  // The neighboring square views are registered over the whole step. Give
  // the wider-spaced legacy views more time to hold their painted silhouettes.
  const t = poseCount > 7 ? fraction : Math.max(0, Math.min(1, (fraction - .3) / .4));
  return { angle, first, second, fraction, blend: t * t * (3 - 2 * t), mirror: angle > 0 };
}

export function denPatrolEntry(a: Point, b: Point, pose: Point & { heading?: number }, patrol: DenPatrol, padding = .05) {
  const size = denPatrolScale(patrol);
  return ellipseEntry(a, b, { ...pose, bank: pose.heading ?? 0 }, -.08 * size, .49 * size + padding, .87 * size + padding);
}
