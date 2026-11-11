import * as T from 'three';
import { poseBurners, shipBurners } from '../burners';
import { HEIGHT, WIDTH } from '../playfield';
import { createProjectileBatch } from '../projectile-graphics';
import type { createPleiadianCraft } from './pleiadian-craft';
import { FLEET_TRENCH_AT } from './route';
import type { createSaucerFactory } from './saucers';

export const FLEET_PURSUIT_AT = FLEET_TRENCH_AT - 7;
const PURSUIT_DURATION = 8.4;
const lanes = [-1, 1] as const;
const formation = [
  { lane: -1, delay: .82, offset: -.51 }, { lane: 1, delay: .97, offset: .42 },
  { lane: -1, delay: 1.47, offset: .30 }, { lane: 1, delay: 1.61, offset: -.28 },
] as const;

export function pursuitSaucer(age: number, lane: -1 | 1) {
  return {
    x: .32 + 1.47 * Math.sin(age * .82 - .91) + lane * .98 + .32 * Math.sin(age * 1.49 + lane * .6),
    y: -10.55 + age * 3.28 + lane * .40 + .19 * Math.sin(age * .9 + lane),
    pitch: .33 + .23 * Math.sin(age * 2.16 + lane),
    bank: .21 * Math.cos(age * 1.79 + lane),
    yaw: .29 * Math.sin(age * 1.1 + lane),
  };
}

export function pursuitFighter(age: number, index: number) {
  const { lane, delay, offset } = formation[index];
  const past = pursuitSaucer(age - delay, lane), target = pursuitSaucer(age, lane);
  const x = past.x + offset + .13 * Math.sin(age * 2.2 + index);
  const y = past.y + .11 * Math.cos(age * 2.6 + index);
  const heading = Math.atan2(x - target.x, target.y - y);
  return { x, y, heading, bank: .26 * Math.sin(age * 2.05 + index) - heading * .34,
    pitch: .16 + .14 * Math.cos(age * 1.8 + index * .9) };
}

const bursts = formation.flatMap(({ lane }, index) => [2.36, 2.52, 3.93, 4.09].map(offset => {
  const at = offset + index * .125, duration = .26 + index * .073;
  const fighter = pursuitFighter(at, index), target = pursuitSaucer(at + duration, lane);
  const x = fighter.x - .53 * Math.sin(fighter.heading), y = fighter.y + .53 * Math.cos(fighter.heading);
  return { at, duration, x, y, vx: (target.x + lane * .33 - x) / duration, vy: (target.y - y) / duration };
}));

function inView({ x, y }: { x: number; y: number }) {
  return Math.abs(x) < WIDTH / 2 + 1 && Math.abs(y) < HEIGHT / 2 + 1;
}

export function createFleetPursuit(craft: ReturnType<typeof createPleiadianCraft>, saucers: ReturnType<typeof createSaucerFactory>) {
  const root = new T.Group();
  root.name = 'fleet-pursuit';
  const prey = lanes.map(() => saucers.create('fleet-pursuit-saucer'));
  const fighters = formation.map(() => {
    const ship = craft.create('fighter');
    ship.name = 'fleet-pleiadian-pursuer';
    return { ship, burners: shipBurners(ship) };
  });
  const tracers = createProjectileBatch('drone', 0x91bff4);
  tracers.root.name = 'fleet-pursuit-tracers';
  root.add(...prey.map(rig => rig.root), ...fighters.map(({ ship }) => ship), tracers.root);

  return {
    root,
    prime() {
      root.traverse(node => { node.visible = true; });
      tracers.prime();
    },
    update(time: number, distance: number) {
      const age = time - FLEET_PURSUIT_AT;
      root.visible = age >= 0 && age < PURSUIT_DURATION;
      if (!root.visible) return;
      const depth = -5.2;
      root.position.z = depth;
      root.scale.setScalar(1 - depth / distance);

      for (const [index, rig] of prey.entries()) {
        const pose = pursuitSaucer(age, lanes[index]);
        rig.root.visible = inView(pose);
        rig.root.position.set(pose.x, pose.y, 0);
        rig.root.scale.setScalar(.48);
        rig.attitude(pose, 0, 0);
      }
      for (const [index, { ship, burners }] of fighters.entries()) {
        const pose = pursuitFighter(age, index);
        ship.visible = inView(pose);
        ship.position.set(pose.x, pose.y, 0);
        ship.scale.setScalar(.83);
        ship.rotation.set(pose.pitch, pose.bank, pose.heading, 'ZXY');
        poseBurners(burners, age + index * .29, .69 + .25 * Math.sin(age * 3.5 + index));
      }
      tracers.draw(bursts.flatMap(({ at, duration, x, y, vx, vy }) => {
        const travel = age - at;
        if (travel < 0 || travel > duration) return [];
        return [{ x: x + vx * travel, y: y + vy * travel, z: .16, vx, vy, vz: 0, drone: true }];
      }), time);
    },
  };
}
