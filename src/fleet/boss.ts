import { ellipseEntry } from '../planar-contact';
import { easeFleet, FLEET_APPROACH, projectedSaucerMount } from './route';

type Point = { x: number; y: number };
type Port = 0 | 1 | 2;

export const FLEET_BOSS_HP = 108;
export const FLEET_BOSS_CYCLE = 7.25;
export const FLEET_BOSS_MOUNTS = [
  [-.61, .37, -.216], [.61, .37, -.216], [0, 0, -.363],
] as const;

const locks = [.53, 1.64] as const;
const bursts: readonly { at: number; port: Port; echo?: boolean; rapid?: boolean }[] = [
  { at: 1.42, port: 0 }, { at: 1.64, port: 0, echo: true },
  { at: 2.53, port: 1 }, { at: 2.75, port: 1, echo: true },
  { at: 4.62, port: 2 }, { at: 5.20, port: 2, echo: true },
  { at: 5.75, port: 2, rapid: true },
];

export function fleetBossPose(time: number) {
  const t = Math.max(0, time);
  const arrival = easeFleet(1 + time / FLEET_APPROACH);
  return {
    x: .91 * Math.sin(t * .67) + .23 * Math.sin(t * 1.13),
    y: 3.23 + (1 - arrival) * 9.85 + .24 * Math.sin(t * .84),
    pitch: .54 + 1.85 * arrival + .095 * Math.sin(t * .76),
    bank: .115 * Math.sin(t * .68),
    yaw: -.07 + .10 * Math.sin(t * .58),
    radius: 3.13,
    depth: -4.65,
  };
}

export function fleetBossTarget(time: number) {
  return projectedSaucerMount(fleetBossPose(time), FLEET_BOSS_MOUNTS[2]);
}

export function fleetBossEntry(time: number, a: Point, b: Point) {
  const pose = fleetBossPose(time);
  const left = projectedSaucerMount(pose, [-.99, 0, 0]);
  const right = projectedSaucerMount(pose, [.99, 0, 0]);
  const near = projectedSaucerMount(pose, [0, .99, 0]);
  const far = projectedSaucerMount(pose, [0, -.99, 0]);
  const dx = right.x - left.x, dy = right.y - left.y;
  const width = Math.hypot(dx, dy);
  const height = Math.abs((far.y - near.y) * dx - (far.x - near.x) * dy) / width;
  return ellipseEntry(a, b, {
    x: (left.x + right.x + near.x + far.x) / 4,
    y: (left.y + right.y + near.y + far.y) / 4,
    bank: Math.atan2(dy, dx),
  }, 0, width / 2, height / 2 + .23);
}

export function fleetBossSignal(time: number, port: Port, rapid: boolean) {
  if (time < 0) return { charge: 0, flash: 0 };
  const phase = time % FLEET_BOSS_CYCLE;
  const windup = port === 2 ? 1.15 : .89;
  let charge = 0, flash = 0;
  for (const burst of bursts) {
    if (burst.port !== port || (burst.rapid && !rapid)) continue;
    const until = burst.at - phase;
    if (until > 0) charge = Math.max(charge, easeFleet(1 - until / windup));
    else if (until > -.17) flash = Math.max(flash, 1 + until / .17);
  }
  return { charge, flash };
}

export function createFleetBossAttack() {
  return { cycle: -1, rapid: false, aim: [undefined, undefined] as [Point | undefined, Point | undefined] };
}

type Attack = ReturnType<typeof createFleetBossAttack>;
type Bolt = Point & { z: number; vx: number; vy: number; vz: number; planar: true };

export function stepFleetBoss(attack: Attack, time: number, dt: number, player: Point, health: number) {
  const cycle = Math.floor(time / FLEET_BOSS_CYCLE);
  if (attack.cycle !== cycle) {
    attack.cycle = cycle;
    attack.rapid = health <= FLEET_BOSS_HP / 2;
    attack.aim[0] = attack.aim[1] = undefined;
  }
  const phase = time - cycle * FLEET_BOSS_CYCLE, before = phase - dt;
  for (const port of [0, 1] as const) {
    if (before < locks[port] && phase >= locks[port]) attack.aim[port] = { ...player };
  }

  const shots: Bolt[] = [];
  for (const { at, port, echo, rapid } of bursts) {
    if (at <= before || at > phase || (rapid && !attack.rapid)) continue;
    const origin = projectedSaucerMount(fleetBossPose(cycle * FLEET_BOSS_CYCLE + at), FLEET_BOSS_MOUNTS[port]);
    if (port === 2) {
      const count = 16, speed = rapid ? 5.45 : echo ? 4.8 : 4.45;
      const angle = (cycle % 3) * .12 + (rapid ? .072 : echo ? Math.PI / count : 0);
      for (let i = 0; i < count; i++) {
        const a = angle + 2 * Math.PI * i / count;
        shots.push({ ...origin, z: 0, vx: speed * Math.sin(a), vy: -speed * Math.cos(a), vz: 0, planar: true });
      }
    } else {
      const aim = attack.aim[port] ?? player;
      const angle = Math.atan2(aim.x - origin.x, Math.max(1.9, origin.y - aim.y));
      const speed = attack.rapid ? 6.15 : 5.55, edge = echo ? 1.5 : 2;
      for (let i = -edge; i <= edge; i++) {
        const a = angle + i * .22;
        shots.push({ ...origin, z: 0, vx: speed * Math.sin(a), vy: -speed * Math.cos(a), vz: 0, planar: true });
      }
    }
  }
  return shots;
}
