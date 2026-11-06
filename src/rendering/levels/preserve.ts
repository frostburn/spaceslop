import * as T from 'three';
import { addRoots, genericBoss, type LevelFactory } from '../level';
import { createBossLaserContact } from '../../laser-contact';
import { loadEncounterTexture } from '../../encounter-texture';
import { BOSS_RECOIL_TIME } from '../../encounters';
import { createInterceptorRig, createRaptorRig, setFeatherTexture } from '../../encounter-rigs';
import { setFaceTexture } from '../../creature-faces';
import { createPreserveEdges, PRESERVE_LOOP } from '../../preserve-edges';
import { createCorridorBridge } from '../../corridor-bridge';
import { createShipyard } from '../../shipyard';
import { createStageBackdrops } from '../../stage-backdrops';
import { poseBurners, shipBurners } from '../../burners';
import { raptorFlight } from '../../encounters';
import { createScoutRig } from '../../ship-rigs';
import { createStars } from '../stars';
export const createLevel: LevelFactory = ({ plane, signal }) => {
  const root = new T.Group();
  const scout = createScoutRig();
  const scouts = Array.from({ length: 12 }, () => { const root = scout.clone(); return { root, burners: shipBurners(root) }; });
  const boss = createInterceptorRig(2.4);
  const raptor = createRaptorRig();
  const preserveEdges = createPreserveEdges();
  const bridge = createCorridorBridge();
  const shipyard = createShipyard();
  const backdrops = createStageBackdrops(signal);
  const stars = createStars();
  const burners = shipBurners(boss.root);
  const models: (T.Object3D | undefined)[] = [];
  addRoots(root, boss, raptor, preserveEdges, bridge, shipyard, backdrops, stars, ...scouts);
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
    stageDistance: 95,
    applyArmor: boss.setArmorTexture,
    surfaces: [bridge.root, ...scouts.map(r => r.root)],
    warmup: [[scouts[0].root, raptor.root, preserveEdges.root, bridge.root], [boss.root, shipyard.root, backdrops.root]],
    contacts: [boss.root, raptor.root, ...scouts.map(r => r.root)],
    contact,
    update(frame) {
      const { flight, reveal: eased, time, animationTime, elapsed: frameElapsed, newFlight, fighterSpeed, droneSpeed, distance } = frame;
      const elapsed = newFlight ? 2 : frameElapsed;
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
      const stageTime = Math.min(time, flight.stageDuration);
      const reveal = eased;
      const perspectiveDistance = eased === 0 ? undefined : distance;
      const scroll = stageTime * 1.65;
      stars.position.y = -(scroll % 12) - reveal * 2;
      const backdropScroll = stageTime * 1.2 + reveal * 6;
      const edge = backdrops.update(reveal, backdropScroll, perspectiveDistance);
      bridge.update(backdropScroll, edge, reveal, perspectiveDistance);
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
      preserveEdges.update(scroll % PRESERVE_LOOP, reveal, !backdrops.hasPreserve, elapsed, wakes);
    }
  };
};
