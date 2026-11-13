import * as T from 'three';
import { setAntMoldTexture } from '../ant-mold';
import { createHiveGuardian } from '../ant-rigs';
import { RAY_SEEKER_POOL, type RayOrb } from '../biolume/lantern-ray';
import { createLanternRay, createRaySeekerAssets, createRaySeekerRig } from '../biolume/lantern-ray-rig';
import { BOULEVARD_PITCH } from '../boulevard';
import { createBoulevardMaterials } from '../boulevard-materials';
import { createPursuitCruiser } from '../boulevard-rigs';
import { cicadaFlight } from '../cicada';
import { createCicada } from '../cicada-rig';
import { createDenBiker } from '../den/biker';
import { loadEncounterTexture } from '../encounter-texture';
import { BOSS_RECOIL_TIME } from '../encounters';
import { createFleetBossRig } from '../fleet/boss-rig';
import { createSaucerFactory } from '../fleet/saucers';
import { BOSS_CAMERA_DISTANCE, BOSS_CANNON_X, BOSS_DEPTH, BOSS_Y, type Flight } from '../game';
import { groundskeeperFlight } from '../groundskeeper';
import { createGroundskeeperEffects } from '../groundskeeper-effects';
import { createGroundskeeper } from '../groundskeeper-rig';
import { createHeliostatRegulator } from '../heliostat/boss';
import type { HeliostatArt } from '../heliostat/art';
import { HELIOSTAT_PITCH } from '../heliostat/combat';
import { createHeliostatMaterials } from '../heliostat/materials';
import { createAttackPlasma, createPlasmaResources } from '../heliostat/plasma';
import { setAntChitinTexture, setFungusTexture } from '../hive-materials';
import { calderaPoint, IO_APPROACH, IO_DURATION, IO_PITCH } from '../io-layout';
import { setIoCeramicTexture } from '../io-materials';
import { createCaldera } from '../io-rigs';
import { createBossLaserContact } from '../laser-contact';
import type { LevelId } from '../levels';
import { createLeviathan, setMarineTexture } from '../marine-rigs';
import { PRESERVE_BOSS_PITCH, PRESERVE_WIDTH_SCALE } from '../preserve-layout';
import type { LevelFrame } from '../rendering/level';
import { createHydraAssets, createRiverHydra } from '../summer/hydra';
import { SUMMER_APPROACH, SUMMER_DURATION } from '../summer/layout';
import { createTitanChitinSurface } from '../titan-insect-surfaces';
import { createVentBoss } from '../vent-boss';
import { ventBossPose, ventWorld, VENT_APPROACH, VENT_DURATION } from '../vent-layout';
import { createRegulatorPortalFeeds } from './regulator-portals';

type BossPose = (frame: LevelFrame, time: number) => void;

export type WormholeBoss = {
  entrance: T.Group;
  model: T.Group;
  pose: BossPose;
  contact?: ReturnType<typeof createBossLaserContact>;
};

function regulatorState(flight: Flight) {
  return {
    unstable: flight.heliostatUnstableAge, pattern: flight.heliostatPattern,
    attackTime: flight.heliostatAttackTime, active: flight.heliostatTargets.length === 2,
  };
}

export function createWormholeBosses(plane: T.Group, signal: AbortSignal) {
  const effects = new T.Group();
  const models: (T.Object3D | undefined)[] = [];
  const warmup: T.Object3D[][] = [];

  // Move the entrance group through the aperture. The rig underneath uses the
  // original combat coordinates so its hit targets and emitters stay registered.
  function boss(model: T.Group, pose: BossPose, planar = false): WormholeBoss {
    const entrance = new T.Group();
    entrance.add(model);
    entrance.visible = false;
    warmup.push([entrance]);
    return { entrance, model, pose, contact: planar ? undefined : createBossLaserContact(plane, model) };
  }

  const guardian = createHiveGuardian(BOSS_CANNON_X);
  guardian.root.name = 'brood-guardian';
  guardian.root.position.set(0, BOSS_Y, BOSS_DEPTH);

  const caldera = createCaldera();
  const engine = calderaPoint(0, 0, 0, 0);
  caldera.root.position.set(engine.x, engine.y, engine.z);
  caldera.root.rotation.x = Math.PI / 2 - IO_PITCH;

  const crab = createVentBoss();

  const chitin = createTitanChitinSurface();
  const cicada = createCicada(chitin.material);

  const heliostatMaterials = createHeliostatMaterials();
  const heliostatArt: HeliostatArt = {};
  const plasmaResources = createPlasmaResources();
  const regulator = createHeliostatRegulator(heliostatMaterials, plasmaResources, false);
  const portalFeeds = createRegulatorPortalFeeds(plasmaResources, regulator.intakes);
  const plasma = createAttackPlasma(plasmaResources);
  regulator.root.position.set(0, BOSS_Y, BOSS_DEPTH);
  regulator.root.rotation.x = -HELIOSTAT_PITCH;
  effects.add(plasma.root, portalFeeds.root);

  const leviathan = createLeviathan();
  leviathan.root.position.set(0, BOSS_Y, BOSS_DEPTH);

  const groundskeeper = createGroundskeeper();
  const groundskeeperEffects = createGroundskeeperEffects();
  const anchor = groundskeeperFlight({ x: 0, y: 0, z: 0 });
  groundskeeper.root.position.set(anchor.x, anchor.y, anchor.z);
  groundskeeper.root.rotation.x = -PRESERVE_BOSS_PITCH;
  groundskeeper.root.scale.x = PRESERVE_WIDTH_SCALE;
  groundskeeperEffects.root.visible = false;
  effects.add(groundskeeperEffects.root);

  const hydraAssets = createHydraAssets();
  const hydra = createRiverHydra(hydraAssets, true);
  hydra.root.position.set(0, BOSS_Y, BOSS_DEPTH);

  const boulevardMaterials = createBoulevardMaterials();
  const cruiser = createPursuitCruiser(boulevardMaterials);
  cruiser.root.position.set(0, BOSS_Y, BOSS_DEPTH);
  cruiser.root.rotation.x = -BOULEVARD_PITCH;

  const ray = createLanternRay();
  const seekerAssets = createRaySeekerAssets();
  const seekers = Array.from({ length: RAY_SEEKER_POOL }, () => createRaySeekerRig(seekerAssets));
  seekers.forEach(({ root }) => { root.visible = false; effects.add(root); });

  const saucers = createSaucerFactory();
  const command = createFleetBossRig(saucers);
  const chief = createDenBiker();
  const roster: Record<Exclude<LevelId, 'wormhole'>, WormholeBoss> = {
    broodlock: boss(guardian.root, ({ flight }) => {
      guardian.pose(1, flight.cannonWindup, flight.exposedCannonX, flight.firedCannonX, flight.bossRecoil / BOSS_RECOIL_TIME);
    }),
    io: boss(caldera.root, ({ flight }, time) => {
      caldera.pose(IO_DURATION + IO_APPROACH + time, flight.ioCollapse, flight.ioLegBroken, flight.cannonWindup);
    }),
    vents: boss(crab.root, ({ flight }, time) => {
      const local = ventBossPose(1, time);
      const clock = VENT_DURATION + VENT_APPROACH + time;
      const point = ventWorld(local.x, local.y, local.z, clock, 1);
      crab.root.position.set(point.x, point.y, point.z);
      crab.pose(1, flight.cannonWindup, flight.crabTargetX, flight.firedCrabTarget, flight.bossRecoil / BOSS_RECOIL_TIME,
        clock, flight.crabBreakPose, flight.crabOpening);
    }),
    titan: boss(cicada.root, ({ flight }, time) => {
      const age = flight.phase === 'approach' ? flight.time - flight.transitionDuration : time;
      const motion = cicadaFlight(age);
      cicada.root.position.set(motion.x, BOSS_Y + motion.y, BOSS_DEPTH + motion.z);
      cicada.root.rotation.set(0, motion.yaw, motion.bank, 'ZYX');
      cicada.pose(1, flight.cannonWindup, flight.exposedCannonX, flight.firedCannonX, flight.bossRecoil / BOSS_RECOIL_TIME, age);
    }),
    heliostat: boss(regulator.root, ({ flight, animationTime }) => {
      heliostatMaterials.updateThermal(animationTime);
      regulator.pose(animationTime, flight.cannonWindup, flight.bossRecoil / BOSS_RECOIL_TIME, regulatorState(flight));
    }),
    ice: boss(leviathan.root, ({ flight }, time) => {
      leviathan.pose(1, flight.cannonWindup, 0, 0, flight.bossRecoil / BOSS_RECOIL_TIME, time);
    }),
    preserve: boss(groundskeeper.root, ({ flight }) => {
      groundskeeper.pose(flight.groundskeeperTime, flight.groundskeeperAim, flight.groundskeeperCancelledAt);
    }),
    summer: boss(hydra.root, ({ flight }, time) => {
      hydra.pose(SUMMER_DURATION + SUMMER_APPROACH + time, flight.cannonWindup, 0, flight.summerHydra, time);
    }),
    boulevard: boss(cruiser.root, ({ flight }, time) => {
      cruiser.pose(time, flight.cannonWindup, flight.bossRecoil / BOSS_RECOIL_TIME);
    }),
    biolume: boss(ray.root, ({ flight }) => ray.pose(flight.rayTime), true),
    fleet: boss(command.root, ({ flight, distance }) => command.pose(flight.fleetBossTime, flight.fleetBossAttack.rapid, distance), true),
    den: boss(chief.root, ({ flight }) => chief.pose(flight.denBossTime, true), true),
  };

  const ready = Promise.all([
    loadEncounterTexture('chitin', setAntChitinTexture, 1.2, signal),
    loadEncounterTexture('fungus', setFungusTexture, 1.1, signal),
    loadEncounterTexture('mold', setAntMoldTexture, undefined, signal),
    loadEncounterTexture('ioCeramic', texture => {
      setIoCeramicTexture(texture);
      heliostatArt.heliostatCeramic = texture.clone();
      heliostatArt.heliostatCeramic.needsUpdate = true;
      heliostatMaterials.setArt(heliostatArt, true);
    }, 1, signal),
    loadEncounterTexture('ventCrab', crab.setAtlas, undefined, signal),
    loadEncounterTexture('titanChitin', chitin.setTexture, 1, signal),
    loadEncounterTexture('marine', setMarineTexture, 1, signal),
    loadEncounterTexture('feathers', groundskeeper.setFeatherTexture, undefined, signal),
    loadEncounterTexture('scales', texture => {
      texture.repeat.set(.62, .68);
      texture.offset.set(.19, .16);
      groundskeeper.setScaleTexture(texture);
    }, undefined, signal),
    loadEncounterTexture('summerHydra', hydraAssets.setAtlas, undefined, signal),
    loadEncounterTexture('biolumeBoss', ray.setArt, undefined, signal),
    loadEncounterTexture('fleetSaucer', saucers.setAlloy, 1, signal),
    loadEncounterTexture('denBiker', chief.setArt, undefined, signal),
  ]).then(textures => [...textures, saucers.environment, saucers.metal ?? undefined, boulevardMaterials.chrome.envMap ?? undefined]);

  let restoreRegulator: (() => void) | undefined;
  return {
    roster, effects, models, ready,
    contacts: [...Object.values(roster).map(({ model }) => model), ...seekers.map(({ root }) => root)],
    surfaces: [cruiser.root],
    warmup: [...warmup, [plasma.root, portalFeeds.root, groundskeeperEffects.root, seekers[0].root]],
    prepare() {
      restoreRegulator = regulator.prime();
      plasma.prime();
      portalFeeds.update(0, BOSS_CAMERA_DISTANCE, 1, 0, { unstable: 0, pattern: 0, attackTime: 0 });
      groundskeeperEffects.prime();
      chief.pose(1.55, true);
      command.prime();
    },
    afterWarmup() {
      restoreRegulator?.();
      restoreRegulator = undefined;
      plasma.root.visible = portalFeeds.root.visible = groundskeeperEffects.root.visible = false;
    },
    applyArmor(texture: T.Texture) {
      const metal = texture.clone();
      metal.repeat.set(1, 1);
      metal.needsUpdate = true;
      heliostatArt.heliostatMetal = metal;
      heliostatMaterials.setArt(heliostatArt, true);
    },
    updateEffects({ flight, time, animationTime, distance }: LevelFrame, portalFeed: number) {
      const battle = flight.phase === 'boss' || flight.phase === 'lost';
      plasma.update(flight.heliostatAttackTime, animationTime, flight.heliostatTargets, battle && flight.encounterLevel === 'heliostat', flight.heliostatPattern);
      if (portalFeed > .002)
        portalFeeds.update(time, distance, portalFeed, flight.cannonWindup, regulatorState(flight));
      else portalFeeds.root.visible = false;
      groundskeeperEffects.root.visible = battle && flight.encounterLevel === 'preserve';
      if (groundskeeperEffects.root.visible)
        groundskeeperEffects.update(flight.groundskeeperTime, flight.groundskeeperAim, flight.groundskeeperCancelledAt, true);
      models.length = flight.enemies.length;
      models.fill(undefined);
      for (const seeker of seekers) seeker.root.visible = false;
      let next = 0;
      for (const [index, enemy] of flight.enemies.entries()) {
        if (!enemy.rayOrb || enemy.hp <= 0) continue;
        const seeker = seekers[next++];
        seeker.root.visible = true;
        seeker.pose(enemy as RayOrb);
        models[index] = seeker.root;
      }
    },
    dispose() {
      heliostatMaterials.releaseTextures();
      boulevardMaterials.roadMap.dispose();
    },
  };
}
