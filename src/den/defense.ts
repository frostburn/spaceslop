import { HEIGHT, WIDTH } from '../playfield';
import { ellipseEntry } from '../planar-contact';
import { DEN_PLATE_WIDTH, DEN_SCREEN_HEIGHT, DEN_SCREENS } from './route';

type Point = { x: number; y: number };

// Locations in the full cliff plate, ordered from the outer docks to the gantry.
export const denTurretSites = [
  { x: 112, y: 8926 }, // Docking cradle
  { x: 383, y: 7126 }, // Workshop service grate
  { x: 399, y: 5318 }, // Rookery lookout
  { x: 155, y: 3747 }, // Lower bastion door
  { x: 377, y: 2961 }, // Bastion watch balcony
  { x: 96, y: 1417 },  // Gantry control room
] as const;
export const denMineSites = [
  { x: 323, y: 9440 }, { x: 223, y: 8380 }, { x: 337, y: 7760 },
  { x: 272, y: 6880 }, { x: 332, y: 6700 }, { x: 307, y: 5940 },
  { x: 241, y: 4740 }, { x: 350, y: 4440 }, { x: 272, y: 3410 },
  { x: 347, y: 2160 },
] as const;

export const DEN_TURRET_HP = 6;
export const DEN_TURRET_REACH = 1.05;
export const DEN_TURRET_RECOIL = .15;
export const DEN_TURRET_WINDUP = .66;
export const DEN_TURRET_SHOTS = [0, .14, .29] as const;
export const DEN_MINE_TRIGGER = 1.28;
export const DEN_MINE_FUSE = .82;
export const DEN_MINE_BURST = .36;

export type DenTurret = {
  site: number;
  heading: number;
  fireAt: number;
  shot: number;
  locked?: number;
  lastShot: number;
};
export type DenMine = { armedAt?: number; burstAt?: number };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function denDefensePoint(site: Point, scroll: number) {
  return {
    x: (site.x / DEN_PLATE_WIDTH - .5) * WIDTH,
    y: (DEN_SCREENS - site.y / DEN_SCREEN_HEIGHT - scroll - .5) * HEIGHT,
  };
}

export function createDenTurret(site: number): DenTurret {
  return { site, heading: denTurretSites[site].x < DEN_PLATE_WIDTH / 2 ? .40 : -.40,
    fireAt: Infinity, shot: 0, lastShot: -Infinity };
}

export function denTurretSignal(turret: DenTurret, time: number) {
  const recoil = Math.max(0, 1 - (time - turret.lastShot) / .13);
  return {
    charge: turret.shot > 0 ? 1 : clamp(1 - (turret.fireAt - time) / DEN_TURRET_WINDUP, 0, 1),
    recoil,
    flash: recoil * recoil,
  };
}

export function stepDenTurret(turret: DenTurret, point: Point, player: Point, time: number, dt: number) {
  const below = point.y - player.y;
  const visible = point.y <= HEIGHT / 2 - 1.48 && point.y > -HEIGHT / 2 + 1.26;
  const canEngage = visible && below > 1.38;
  const aim = clamp(Math.atan2(player.x - point.x, Math.max(1.38, below)), -1.17, 1.17);
  if (turret.shot === 0) {
    if (!canEngage) {
      turret.fireAt = Infinity;
      turret.locked = undefined;
    } else if (!Number.isFinite(turret.fireAt)) {
      turret.fireAt = time + 1.12;
    }
  }
  if (turret.locked === undefined && time >= turret.fireAt - DEN_TURRET_WINDUP) turret.locked = aim;
  const turn = 4.5 * dt;
  turret.heading += clamp((turret.locked ?? aim) - turret.heading, -turn, turn);
  if (time < turret.fireAt + DEN_TURRET_SHOTS[turret.shot]) return;
  const heading = turret.heading;
  turret.lastShot = time;
  turret.shot++;
  if (turret.shot === DEN_TURRET_SHOTS.length) {
    turret.shot = 0;
    turret.fireAt = time + 3.05;
    turret.locked = undefined;
  }
  const reach = DEN_TURRET_REACH - DEN_TURRET_RECOIL;
  return {
    x: point.x + Math.sin(heading) * reach,
    y: point.y - Math.cos(heading) * reach,
    heading,
  };
}

export function denTurretEntry(a: Point, b: Point, point: Point, heading: number) {
  const pose = { ...point, bank: heading };
  return Math.min(
    ellipseEntry(a, b, pose, .40, .52, .83),
    ellipseEntry(a, b, pose, -.59, .20, .44),
  );
}

export function denMinePose(site: number, mine: DenMine, scroll: number, time: number) {
  const point = denDefensePoint(denMineSites[site], scroll);
  // During the fuse keep the mine's drift identical to its unarmed motion.
  const phase = (mine.burstAt ?? time) * 1.7 + site * 2.4;
  const x = point.x + .12 * Math.sin(phase);
  const y = point.y + .095 * Math.cos(phase * 1.23);
  return { x, y, charge: mine.armedAt === undefined ? 0 : clamp((time - mine.armedAt) / DEN_MINE_FUSE, 0, 1),
    burstAge: mine.burstAt === undefined ? Infinity : time - mine.burstAt };
}

export function stepDenMine(site: number, mine: DenMine, scroll: number, time: number, player: Point) {
  if (mine.burstAt !== undefined) return;
  const pose = denMinePose(site, mine, scroll, time);
  // Leave room below the mine for the remaining scroll during its fuse.
  const visible = pose.y < HEIGHT / 2 - .48 && pose.y > -HEIGHT / 2 + 1.55;
  if (mine.armedAt === undefined && visible && Math.hypot(pose.x - player.x, pose.y - player.y) < DEN_MINE_TRIGGER) {
    mine.armedAt = time;
  }
  if (mine.armedAt !== undefined && time >= mine.armedAt + DEN_MINE_FUSE) {
    mine.burstAt = time;
    return pose;
  }
}
