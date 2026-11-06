import * as T from 'three';
import { addRoots, genericBoss, type LevelFactory } from '../level';
import { createBossLaserContact } from '../../laser-contact';
import { loadEncounterTexture } from '../../encounter-texture';
import { BOSS_RECOIL_TIME } from '../../encounters';
import { createInterceptorRig, createRaptorRig, setFeatherTexture } from '../../encounter-rigs';
import { setFaceTexture } from '../../creature-faces';
import { createPreserveScenery } from '../../preserve-scenery';
import { PRESERVE_DISTANCE } from '../../preserve-layout';
import { createShipyard } from '../../shipyard';
import { createShipyardBackdrop } from '../../shipyard-backdrop';
import { poseBurners, shipBurners } from '../../burners';
import { raptorFlight } from '../../encounters';
import { createScoutRig } from '../../ship-rigs';
export const createLevel: LevelFactory = ({ plane, signal }) => {
  const root = new T.Group();
  const scout = createScoutRig();
  const scouts = Array.from({ length: 12 }, () => { const root = scout.clone(); return { root, burners: shipBurners(root) }; });
  const boss = createInterceptorRig(2.4);
  const raptor = createRaptorRig();
  const preserve = createPreserveScenery();
  const shipyard = createShipyard();
  const backdrops = createShipyardBackdrop(signal);
  const burners = shipBurners(boss.root);
  const models: (T.Object3D | undefined)[] = [];
  addRoots(root, boss, raptor, preserve, shipyard, backdrops, ...scouts);
  const contact = createBossLaserContact(plane, boss.root);
  const ready = Promise.all([backdrops.ready, loadEncounterTexture('feathers', setFeatherTexture, undefined, signal), loadEncounterTexture('scales', texture => {
    texture.repeat.set(.62, .68);
    texture.offset.set(.19, .16);
    setFaceTexture(texture);
    boss.setScaleTexture(texture);
    raptor.setScaleTexture(texture);
  }, undefined, signal)]).then(t => t.flat());
  return {
    root,
    boss: boss.root,
    models,
    ready,
    stageDistance: PRESERVE_DISTANCE,
    background: 0x020407,
    key: 0xffedd2,
    sky: 0xc8e0d5,
    ground: 0x25332a,
    keyIntensity: 1.2,
    skyIntensity: 1.2,
    applyArmor: boss.setArmorTexture,
    surfaces: [preserve.root, ...scouts.map(r => r.root)],
    warmup: [[scouts[0].root, raptor.root, preserve.root], [boss.root, shipyard.root, backdrops.root]],
    prepare: () => preserve.prime(true),
    afterWarmup: () => preserve.prime(false),
    contacts: [boss.root, raptor.root, ...scouts.map(r => r.root)],
    contact,
    update(frame) {
      const { flight, reveal: eased, time, animationTime, elapsed, newFlight, fighterSpeed, droneSpeed, distance } = frame;
      genericBoss(boss.root, flight, eased);
      if (boss.root.visible) {
        boss.pose(eased, flight.cannonWindup, flight.exposedCannonX, flight.firedCannonX, flight.bossRecoil / BOSS_RECOIL_TIME);
        poseBurners(burners, animationTime, .42 + .48 * Math.sin(eased * Math.PI));
      }
      models.length = flight.enemies.length;
      models.fill(undefined);
      const enemy = flight.enemies.find((enemy) => enemy.raptor);
      raptor.root.visible = Boolean(enemy);
      if (enemy) {
        raptor.root.position.set(enemy.x, enemy.y, 0);
        raptor.root.rotation.z = Math.PI;
        raptor.pose(enemy.age);
      }
      if (enemy)
        models[flight.enemies.indexOf(enemy)] = raptor.root;
      for (const [index, { root, burners }] of scouts.entries()) {
        const enemy = flight.enemies[index]; root.visible = Boolean(enemy && !enemy.raptor);
        if (!root.visible || !enemy) continue;
        root.position.set(enemy.x, enemy.y, 0); root.rotation.z = Math.PI + .3 * Math.cos(enemy.age * 1.55); root.scale.setScalar(enemy.ventScale ?? 1);
        poseBurners(burners, enemy.age + index * .27, .55 + .16 * Math.sin(enemy.age * 4 + index)); models[index] = root;
      }
      const reveal = eased;
      backdrops.update(reveal, distance);
      shipyard.update(reveal, !backdrops.hasShipyard);
      const wakes = flight.hull > 0 && reveal < 0.7 ? [
        { ...flight.player, strength: Math.min(1.4, 0.93 + fighterSpeed * 0.1) },
        { ...flight.drone, strength: Math.min(1, 0.3 + droneSpeed * 0.05) },
        ...flight.enemies.map((enemy) => ({
          x: enemy.x,
          y: enemy.y,
          strength: enemy.raptor ? 0.63 + raptorFlight(enemy.age).speed * 0.11 : 0.86,
        })),
      ] : [];
      preserve.update(time, reveal, animationTime, elapsed, wakes, newFlight);
    }
  };
};
