import { levels } from '../levels';

export const FLEET_DURATION = levels.fleet.duration;
export const FLEET_APPROACH = 3.5;
export const FLEET_TRENCH_AT = 71;
export const FLEET_SPEED = 1.6;
export const FLEET_CAMERA_DISTANCE = 22;
export const CAPITAL_DEPTH = -8;
export const TRACTOR_MOUNT = [-.86, -.34, .10] as const;

type Point = { x: number; y: number };
export type FleetHull = Point & { width: number };

export const flankShips: readonly FleetHull[] = [
  { x: -4.9, y: 16, width: 18.0 },
  { x: -5.1, y: 56.8, width: 19.2 },
  { x: -4.7, y: 98.2, width: 17.4 },
];

export const trenchShip: FleetHull = { x: 0, y: 144.5, width: 21.5 };

// Positions measured from the top left of the full, uncropped plates.
export const flagshipEngines = {
  broadside: { radius: .032, mounts: [[.422, .932], [.566, .932]] },
  trench: { radius: .043, mounts: [[.235, .929], [.764, .929]] },
} as const;

export const flagshipPorts = [
  [.577, .234], [.563, .346], [.564, .397],
  [.568, .449], [.582, .596], [.578, .645],
] as const;

export const trenchPorts = [
  [.362, .756, 1], [.637, .705, -1], [.366, .65, 1], [.637, .595, -1],
  [.308, .468, 1], [.692, .419, -1], [.378, .365, 1], [.614, .315, -1],
] as const;

export function hullPoint(hull: FleetHull, u: number, v: number) {
  return { x: hull.x + (u - .5) * hull.width, y: hull.y + (.5 - v) * 2 * hull.width };
}

export function fleetScroll(time: number) {
  if (time <= FLEET_DURATION) return FLEET_SPEED * Math.max(0, time);
  const u = Math.min(1, (time - FLEET_DURATION) / FLEET_APPROACH);
  // Integrate the deceleration so the hull passes continuously into the arena.
  return FLEET_SPEED * (FLEET_DURATION + FLEET_APPROACH * (u - u ** 3 + .5 * u ** 4));
}

export function fleetViewY(worldY: number, time: number) {
  return worldY - fleetScroll(time);
}

export function fleetSection(time: number) {
  if (time < 15) return 'Prisoner exchange';
  if (time < FLEET_TRENCH_AT) return 'Broadside corridor';
  return 'Trench run';
}

export function easeFleet(t: number) {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

type Carrier = Point & { radius: number; phase: number };
export const grayCarriers: readonly Carrier[] = [
  { x: 6.58, y: 5.8, radius: 4.45, phase: .1 },
  { x: 7.36, y: 21, radius: 5.2, phase: 1.8 },
  { x: 6.55, y: 37, radius: 3.8, phase: 3.6 },
  { x: 6.68, y: 56.8, radius: 4.6, phase: 5.1 },
  { x: 7.6, y: 73.2, radius: 4.9, phase: 2.3 },
  { x: 6.41, y: 91.6, radius: 4.3, phase: 4.2 },
  { x: 7.55, y: 108, radius: 5.0, phase: .9 },
];

export function carrierPose(carrier: Carrier, time: number) {
  const phase = carrier.phase + time * .51;
  return {
    x: carrier.x + .16 * Math.sin(phase),
    y: fleetViewY(carrier.y, time) + .19 * Math.cos(phase * .83),
    pitch: .77 + .15 * Math.sin(phase * .84),
    bank: .37 + .11 * Math.cos(phase),
    yaw: -.27 + .06 * Math.sin(phase * .68),
  };
}

type SaucerPose = Point & { pitch: number; bank: number; yaw: number; radius: number; depth: number };

export function projectedSaucerMount(pose: SaucerPose, [x, y, z]: readonly [number, number, number]) {
  // The saucer uses ZXY Euler angles. Project its actual emitter into the flight plane.
  const bx = x * Math.cos(pose.bank) + z * Math.sin(pose.bank);
  const bz = z * Math.cos(pose.bank) - x * Math.sin(pose.bank);
  const py = y * Math.cos(pose.pitch) - bz * Math.sin(pose.pitch);
  const pz = y * Math.sin(pose.pitch) + bz * Math.cos(pose.pitch);
  const rx = bx * Math.cos(pose.yaw) - py * Math.sin(pose.yaw);
  const ry = bx * Math.sin(pose.yaw) + py * Math.cos(pose.yaw);
  const distance = FLEET_CAMERA_DISTANCE;
  const scale = 1 - pose.depth / distance;
  const factor = scale * distance / (distance - pose.depth - pz * scale * pose.radius);
  return { x: (pose.x + rx * pose.radius) * factor, y: (pose.y + ry * pose.radius) * factor };
}

export const tractorSites = [
  { carrier: 0, at: 1.2, x: -1.74, duration: 5.9, wreck: false },
  { carrier: 3, at: 33.6, x: -2.35, duration: 6.45, wreck: true },
  { carrier: 5, at: 55.9, x: -2.9, duration: 6.6, wreck: true },
] as const;

export function tractorPose(site: typeof tractorSites[number], time: number) {
  const age = time - site.at;
  if (age < -1.5 || age > site.duration) return;
  const carrier = grayCarriers[site.carrier];
  const source = projectedSaucerMount({ ...carrierPose(carrier, time), radius: carrier.radius, depth: CAPITAL_DEPTH }, TRACTOR_MOUNT);
  const tug = easeFleet((age - .65) / (site.duration - .65));
  const charge = easeFleet(age / .65) * (1 - easeFleet((tug - .92) / .08));
  return {
    source,
    x: site.x + (source.x - site.x) * tug,
    y: source.y - (1 - tug) * (1.65 + .37 * Math.sin(tug * Math.PI)),
    charge,
    visibility: easeFleet((age + 1.5) / .9) * (1 - easeFleet((tug - .88) / .12)),
    angle: site.wreck ? -.42 - 2.4 * tug + .15 * Math.sin(age * 2) : -.15 - .94 * tug,
    tilt: (site.wreck ? .25 : .10) * Math.sin(age * 2.15),
  };
}
