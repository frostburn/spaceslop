import * as T from 'three';
import { addRoots, genericBoss, type LevelFactory } from '../level';
import { createBossLaserContact } from '../../laser-contact';
import { loadEncounterTexture } from '../../encounter-texture';
import { BOSS_RECOIL_TIME } from '../../encounters';
import { CHALLENGE_ANT_PACE, CHALLENGE_ANT_WINDUP } from '../../broodlock/challenge';
import { patternBurstCharge } from '../../challenge-patterns';
import { createHiveScenery } from '../../hive-scenery';
import { createAntRig, createHiveGuardian } from '../../ant-rigs';
import { setAntChitinTexture, setFungusTexture } from '../../hive-materials';
import { setAntMoldTexture } from '../../ant-mold';
import { antScales } from '../../ant-navigation';
import { HIVE_CAMERA_DISTANCE } from '../../hive-layout';
export const createLevel: LevelFactory = ({ plane, signal }) => {
  const root = new T.Group();
  const hive = createHiveScenery(signal);
  const boss = createHiveGuardian(2.4);
  const ants = Array.from({ length: 12 }, () => createAntRig());
  const models: (T.Object3D | undefined)[] = [];
  addRoots(root, hive, boss, ...ants);
  hive.root.visible = true;
  const ready = Promise.all([hive.ready, loadEncounterTexture('chitin', setAntChitinTexture, 1.2, signal), loadEncounterTexture('fungus', setFungusTexture, 1.1, signal), loadEncounterTexture('mold', setAntMoldTexture, undefined, signal)]).then(t => t.flat());
  return {
    root,
    boss: boss.root,
    models,
    ready,
    stageDistance: HIVE_CAMERA_DISTANCE,
    fixedCamera: true,
    shipPitch: 0,
    contacts: [boss.root, ...ants.map(r => r.root)],
    warmup: [[hive.root, boss.root, ...ants.map(r => r.root)]],
    contact: createBossLaserContact(plane, boss.root),
    update({ flight, reveal: eased, distance }) {
      genericBoss(boss.root, flight, eased);
      if (boss.root.visible)
        boss.pose(eased, flight.cannonWindup, flight.exposedCannonX, flight.firedCannonX, flight.bossRecoil / BOSS_RECOIL_TIME);
      hive.update(flight.hiveProgress, distance);
      models.length = flight.enemies.length;
      models.fill(undefined);
      const pace = flight.isBroodlockChallenge ? CHALLENGE_ANT_PACE : 1;
      for (const [index, ant] of ants.entries()) {
        const enemy = flight.enemies[index];
        ant.root.visible = Boolean(enemy?.ant);
        if (!ant.root.visible || !enemy)
          continue;
        ant.root.position.set(enemy.x, enemy.y, 0);
        ant.root.scale.setScalar(antScales[enemy.ant ?? 'worker']);
        ant.root.rotation.z = Math.PI + (enemy.heading ?? 0.05 * Math.cos(enemy.age * 1.55));
        ant.setKind(enemy.ant === 'soldier' ? 'soldier' : 'worker');
        const windup = flight.isBroodlockChallenge ? patternBurstCharge(enemy, CHALLENGE_ANT_WINDUP)
          : enemy.ant === 'soldier' ? T.MathUtils.clamp(1 + (enemy.age - enemy.fire) / .55, 0, 1) : 0;
        ant.pose(enemy.age * pace, windup);
        models[index] = ant.root;
      }
    }
  };
};
