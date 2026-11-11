import * as T from 'three';
import { loadEncounterTexture } from '../../encounter-texture';
import { createFleetBossRig } from '../../fleet/boss-rig';
import { FLEET_SAUCER_POOL, FLEET_SAUCER_WINDUP, saucerPose, saucerSize } from '../../fleet/combat';
import { createDistantSaucers } from '../../fleet/distant';
import { createPleiadianCraft } from '../../fleet/pleiadian-craft';
import { createBroadsideRigs, createTractorTraffic } from '../../fleet/props';
import { createFleetPursuit } from '../../fleet/pursuit';
import { CAPITAL_DEPTH, carrierPose, FLEET_CAMERA_DISTANCE, FLEET_DURATION, grayCarriers, tractorPose, tractorSites } from '../../fleet/route';
import { createSaucerFactory } from '../../fleet/saucers';
import { createFleetScenery, fleetLighting } from '../../fleet/scenery';
import { HEIGHT } from '../../playfield';
import { createProjectileBatch } from '../../projectile-graphics';
import type { LevelFactory } from '../level';

export const createLevel: LevelFactory = ({ signal }) => {
  const root = new T.Group();
  root.name = 'fleet-clash';
  const scenery = createFleetScenery(signal);
  const guns = createBroadsideRigs();
  const saucers = createSaucerFactory();
  const pleiadians = createPleiadianCraft(saucers.environment);
  const traffic = createTractorTraffic(pleiadians);
  const pursuit = createFleetPursuit(pleiadians, saucers);
  const boss = createFleetBossRig(saucers);
  boss.root.visible = false;
  const distant = createDistantSaucers(saucers);
  const carriers = grayCarriers.map((site, index) => {
    const tractor = tractorSites.find(pass => pass.carrier === index);
    return { site, tractor, rig: saucers.create(`fleet-gray-capital-${index + 1}`, tractor ? 'tractor' : 'capital') };
  });
  const patrols = Array.from({ length: FLEET_SAUCER_POOL }, () => saucers.create('fleet-gray-saucer'));
  const patrolRoots = patrols.map(rig => rig.root), capitalRoots = carriers.map(({ rig }) => rig.root);
  const bolts = createProjectileBatch('cannon', 0xffae4d);
  bolts.root.name = 'fleet-broadside-bolts';
  root.add(scenery.root, distant.root, guns.root, traffic.root, pursuit.root, ...capitalRoots, ...patrolRoots, bolts.root, boss.root);
  const models: (T.Object3D | undefined)[] = [];

  const ready = Promise.all([
    scenery.maps,
    loadEncounterTexture('fleetSaucer', saucers.setAlloy, 1, signal),
  ]).then(([maps]) => [...maps.map(map => map ?? undefined), ...pleiadians.maps, saucers.environment, saucers.metal ?? undefined]);
  scenery.update(0, 0, FLEET_CAMERA_DISTANCE);

  return {
    root, boss: boss.root, models, ready,
    applyArmor: pleiadians.setAlloy,
    stageDistance: FLEET_CAMERA_DISTANCE,
    fixedCamera: true,
    shipPitch: 0,
    ...fleetLighting,
    friendlyGlow: 1.26,
    contacts: [...patrolRoots, boss.root],
    warmup: [[scenery.root, distant.root, guns.root, traffic.root, pursuit.root, capitalRoots[0], patrolRoots[0], bolts.root, boss.root]],
    prepare() {
      // Warm the actual beam, flash and projectile materials before any encounter triggers.
      scenery.root.traverse(object => { object.visible = true; });
      distant.root.traverse(object => { object.visible = true; });
      guns.root.traverse(object => { object.visible = true; });
      traffic.root.traverse(object => { object.visible = true; });
      pursuit.prime();
      patrols[0].prime();
      bolts.prime();
      boss.pose(0, false, FLEET_CAMERA_DISTANCE);
      boss.prime();
    },
    update({ flight, time, animationTime, distance }) {
      scenery.update(time, animationTime, distance);
      distant.update(time, distance);
      pursuit.update(time, distance);
      boss.root.visible = time >= FLEET_DURATION && flight.bossHealth > 0;
      if (boss.root.visible) boss.pose(flight.fleetBossTime, flight.fleetBossAttack.rapid, distance);
      for (const [part, depth] of [[guns.root, -1.42], [traffic.root, -.59]] as const) {
        const factor = 1 - depth / distance;
        part.position.z = depth;
        part.scale.set(factor, factor, 1);
      }
      guns.update(time);
      traffic.update(time, animationTime);
      for (const { site, tractor, rig } of carriers) {
        const pose = carrierPose(site, time);
        const factor = 1 - CAPITAL_DEPTH / distance;
        rig.root.visible = Math.abs(pose.y) < HEIGHT / 2 + site.radius + 1;
        rig.root.position.set(pose.x * factor, pose.y * factor, CAPITAL_DEPTH);
        rig.root.scale.setScalar(site.radius * factor);
        const power = tractor ? tractorPose(tractor, time)?.charge ?? 0 : 0;
        rig.attitude(pose, 0, 0, power);
      }

      models.length = flight.enemies.length;
      models.fill(undefined);
      for (const rig of patrols) rig.root.visible = false;
      let active = 0;
      for (const [index, enemy] of flight.enemies.entries()) {
        const saucer = enemy.fleet;
        if (!saucer || enemy.age < 0 || enemy.hp <= 0 || Math.abs(enemy.y) > HEIGHT / 2 + 1.2) continue;
        const rig = patrols[active++];
        if (!rig) break;
        const pose = saucerPose(enemy.age, enemy.lane, saucer);
        const charge = saucer.aim ? T.MathUtils.clamp(1 - (enemy.fire - enemy.age) / FLEET_SAUCER_WINDUP, 0, 1) : 0;
        const sinceFire = enemy.age + (saucer.heavy ? 2.25 : 2.7) - enemy.fire;
        const flash = sinceFire >= 0 && sinceFire < .15 ? 1 - sinceFire / .15 : 0;
        rig.root.visible = true;
        rig.root.position.set(enemy.x, enemy.y, -.08);
        rig.root.scale.setScalar(saucerSize(saucer));
        rig.attitude(pose, charge, flash);
        models[index] = rig.root;
      }
      bolts.draw(flight.threats.filter(shot => shot.broadside), animationTime);
    },
    contact: (_x, _distance, flight) => ({ x: flight.exposedCannonX, y: flight.bossAimY }),
  };
};
