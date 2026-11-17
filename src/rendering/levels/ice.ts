import * as T from 'three';
import { addRoots, genericBoss, type LevelFactory } from '../level';
import { createBossLaserContact } from '../../laser-contact';
import { loadEncounterTexture } from '../../encounter-texture';
import { BOSS_RECOIL_TIME } from '../../encounters';
import { createIceScenery } from '../../ice-scenery';
import { createMarineRig, createLeviathan, setMarineTexture } from '../../marine-rigs';
import { marineMotion } from '../../marine';
import { patternBurstCharge } from '../../challenge-patterns';
import { iceChallengeHunter, iceChallengeSweeper } from '../../ice-challenge';
import { ICE_CAMERA_DISTANCE, ICE_CORRIDOR_PITCH } from '../../ice-layout';
export const createLevel: LevelFactory = ({ plane, signal }) => {
  const root = new T.Group();
  const ice = createIceScenery(signal);
  const boss = createLeviathan();
  const ichthyosaurs = Array.from({ length: 12 }, () => createMarineRig('ichthyosaur'));
  const plesiosaurs = Array.from({ length: 4 }, () => createMarineRig('plesiosaur'));
  const marineModels: (T.Object3D | undefined)[] = [];
  addRoots(root, ice, boss, ...ichthyosaurs, ...plesiosaurs);
  ice.root.visible = true;
  const ready = Promise.all([ice.ready, loadEncounterTexture('marine', setMarineTexture, 1, signal)]).then(t => t.flat());
  const actors = [...ichthyosaurs, ...plesiosaurs].map(r => r.root);
  return {
    root,
    boss: boss.root,
    models: marineModels,
    ready,
    stageDistance: ICE_CAMERA_DISTANCE,
    background: 0x03060c,
    surfaces: [ice.root],
    shipPitch: ICE_CORRIDOR_PITCH,
    dronePitch: ICE_CORRIDOR_PITCH,
    contacts: [boss.root, ...actors],
    warmup: [[ice.root, boss.root], ...Array.from({ length: Math.ceil(actors.length / 3) }, (_, i) => actors.slice(i * 3, i * 3 + 3))],
    prepare: () => ice.prime(),
    dispose: () => ice.dispose(),
    capture: (renderer, camera) => ice.capture(renderer, camera),
    contact: createBossLaserContact(plane, boss.root),
    update({ flight, reveal: eased, time: iceTime, distance }) {
      genericBoss(boss.root, flight, eased);
      if (boss.root.visible)
        boss.pose(eased, flight.cannonWindup, 0, 0, flight.bossRecoil / BOSS_RECOIL_TIME, Math.max(0, iceTime - flight.stageDuration - flight.transitionDuration), flight.isIceChallenge);
      ice.update(flight.hiveProgress, eased, iceTime, distance);
      for (const rig of ichthyosaurs)
        rig.root.visible = false;
      for (const rig of plesiosaurs)
        rig.root.visible = false;
      marineModels.length = flight.enemies.length;
      let hunters = 0;
      let sweepers = 0;
      for (const [index, enemy] of flight.enemies.entries()) {
        marineModels[index] = undefined;
        if (!enemy.marine)
          continue;
        const rig = enemy.marine === 'ichthyosaur' ? ichthyosaurs[hunters++] : plesiosaurs[sweepers++];
        if (!rig)
          continue;
        rig.root.visible = true;
        rig.root.position.set(enemy.x, enemy.y, 0);
        rig.root.rotation.z = Math.PI + (enemy.heading ?? 0);
        const swim = marineMotion(enemy.marine, enemy.age, enemy.lane, enemy.school);
        const charge = flight.isIceChallenge
          ? patternBurstCharge(enemy, (enemy.marine === 'ichthyosaur' ? iceChallengeHunter : iceChallengeSweeper).windup)
          : T.MathUtils.clamp(1 - (enemy.fire - enemy.age) / .55, 0, 1);
        rig.pose(enemy.age, swim.bank, charge);
        marineModels[index] = rig.root;
      }
    }
  };
};
