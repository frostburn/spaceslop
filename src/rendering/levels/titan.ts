import * as T from 'three';
import { addRoots, type LevelFactory } from '../level';
import { createBossLaserContact } from '../../laser-contact';
import { loadEncounterTexture } from '../../encounter-texture';
import { BOSS_RECOIL_TIME } from '../../encounters';
import { createTitanScenery } from '../../titan-scenery';
import { createCicada } from '../../cicada-rig';
import { cicadaFlight } from '../../cicada';
import { createCicadaScout, createCentipedeSection } from '../../titan-insect-rigs';
import { CICADA_SCOUT_POOL, cicadaMotion } from '../../titan-insects';
import { CENTIPEDE_POOL } from '../../centipede';
import { titanBossPoint, titanFrame, TITAN_PITCH } from '../../titan-frame';
import { setTitanChitinTexture } from '../../titan-insect-surfaces';
export const createLevel: LevelFactory = ({ plane, signal }) => {
  const root = new T.Group();
  const titan = createTitanScenery(signal);
  const boss = createCicada();
  const cicadaScouts = Array.from({ length: CICADA_SCOUT_POOL }, createCicadaScout);
  const centipedeParts = Array.from({ length: CENTIPEDE_POOL }, createCentipedeSection);
  const insectModels: (T.Object3D | undefined)[] = [];
  addRoots(root, titan, boss, ...cicadaScouts, ...centipedeParts);
  titan.root.visible = true;
  const actors = [...cicadaScouts, ...centipedeParts].map(r => r.root);
  const ready = Promise.all([titan.ready, loadEncounterTexture('titanChitin', setTitanChitinTexture, 1, signal)]).then(t => t.flat());
  return {
    root,
    boss: boss.root,
    models: insectModels,
    ready,
    stageDistance: 95,
    key: 0xffcf93,
    sky: 0xffdca4,
    ground: 0x543522,
    contacts: [boss.root, ...actors],
    warmup: [[titan.root, boss.root], [...actors]],
    prepare() {
      titan.update(0);
      centipedeParts[0].prime();
    },
    contact: createBossLaserContact(plane, boss.root),
    update({ flight, reveal: eased, time: titanTime, distance }) {
      const point = titanBossPoint(eased);
      const motion = cicadaFlight(titanTime - flight.stageDuration - flight.transitionDuration);
      boss.root.visible = flight.bossHealth > 0;
      boss.root.position.set(motion.x, point.y + motion.y, point.z + motion.z);
      boss.root.rotation.set(TITAN_PITCH - titanFrame(eased).pitch, motion.yaw, motion.bank, 'ZYX');
      boss.pose(eased, flight.cannonWindup, flight.exposedCannonX, flight.firedCannonX, flight.bossRecoil / BOSS_RECOIL_TIME, Math.max(0, titanTime - flight.stageDuration));
      const coast = Math.min(flight.transitionDuration, Math.max(0, titanTime - flight.stageDuration));
      const progress = Math.min(1, flight.hiveProgress + 1.6 / 144 * (coast - coast * coast / (2 * flight.transitionDuration)));
      titan.update(progress, titanTime, eased, distance);
      for (const rig of [...cicadaScouts, ...centipedeParts])
        rig.root.visible = false;
      insectModels.length = flight.enemies.length;
      let scouts = 0;
      let sections = 0;
      for (const [index, enemy] of flight.enemies.entries()) {
        insectModels[index] = undefined;
        const rig = enemy.centipede ? centipedeParts[sections++] : enemy.cicada ? cicadaScouts[scouts++] : undefined;
        if (!rig)
          continue;
        rig.root.visible = true;
        rig.root.position.set(enemy.x, enemy.y, enemy.centipede ? -.2 : .04);
        rig.root.rotation.z = -(enemy.heading ?? Math.PI);
        if (enemy.centipede) {
          const link = enemy.centipede;
          (rig as typeof centipedeParts[number]).pose(enemy.age, link.slot, link.originalHead, Boolean(link.chain.escape));
        }
        else if (enemy.cicada) {
          (rig as typeof cicadaScouts[number]).pose(enemy.age, cicadaMotion(enemy.age, enemy.lane, enemy.cicada).bank);
        }
        insectModels[index] = rig.root;
      }
    }
  };
};
