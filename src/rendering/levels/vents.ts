import * as T from 'three';
import { addRoots, type LevelFactory } from '../level';
import { createBossLaserContact } from '../../laser-contact';
import { loadEncounterTexture } from '../../encounter-texture';
import { BOSS_RECOIL_TIME } from '../../encounters';
import { createVentScenery } from '../../vent-scenery';
import { createVentBoss } from '../../vent-boss';
import { createMortarAssets, createVentMortar } from '../../vent-mortar-rig';
import { createFaunaAssets, createWormAssets, createVentShrimp, createVentWorm } from '../../vent-fauna-rig';
import { MORTAR_POOL } from '../../vent-mortar';
import { ventChallengeMortar, ventChallengeShrimp } from '../../vent-challenge';
import { patternBurstCharge } from '../../challenge-patterns';
import { SHRIMP_POOL, WORM_POOL } from '../../vent-fauna';
import { createBurnerBubbles } from '../../vent-effects';
import { ventCameraRise, ventBossReveal, ventBossPose, ventWorld, ventFrame, VENT_CAMERA_DISTANCE, VENT_PITCH, VENT_DURATION, VENT_APPROACH, ventAnchors, ventAnchorPoint, VENT_SPAWN_LEAD } from '../../vent-layout';
export const createLevel: LevelFactory = ({ plane, scene, signal }) => {
  const root = new T.Group();
  const mortarAssets = createMortarAssets();
  const vents = createVentScenery(mortarAssets, signal);
  const ventBoss = createVentBoss();
  const mortars = Array.from({ length: MORTAR_POOL }, () => createVentMortar(mortarAssets));
  const faunaAssets = createFaunaAssets();
  const wormAssets = createWormAssets();
  const shrimps = Array.from({ length: SHRIMP_POOL }, () => createVentShrimp(faunaAssets));
  const worms = Array.from({ length: WORM_POOL }, () => createVentWorm(wormAssets));
  const bubbles = createBurnerBubbles();
  const mortarModels: (T.Object3D | undefined)[] = [];
  const faunaModels: (T.Object3D | undefined)[] = [];
  const models: (T.Object3D | undefined)[] = [];
  addRoots(root, vents, ventBoss, ...mortars, ...shrimps, ...worms, bubbles);
  vents.root.visible = true;
  bubbles.root.visible = true;
  const contact = createBossLaserContact(plane, ventBoss.root);
  const actors = [...mortars, ...shrimps, ...worms].map(r => r.root);
  const ready = Promise.all([vents.ready, loadEncounterTexture('ventMortar', mortarAssets.setAtlas, undefined, signal), loadEncounterTexture('ventFauna', faunaAssets.setAtlas, undefined, signal), loadEncounterTexture('ventWorm', wormAssets.setAtlas, undefined, signal), loadEncounterTexture('ventCrab', ventBoss.setAtlas, undefined, signal)]).then(t => t.flat());
  return {
    root,
    boss: ventBoss.root,
    models,
    ready,
    stageDistance: VENT_CAMERA_DISTANCE,
    background: 0x041a25,
    key: 0xa7dde1,
    sky: 0x94cbd4,
    ground: 0x072330,
    keyIntensity: 2.4,
    skyIntensity: 1.5,
    reveal: ventCameraRise,
    contacts: [ventBoss.root, ...actors],
    warmup: [[vents.root, ventBoss.root, bubbles.root, ...mortars.map(r => r.root)], [...shrimps, ...worms].map(r => r.root)],
    prepare() {
      vents.update(VENT_DURATION + VENT_APPROACH, 1);
      ventBoss.root.position.set(0, 4.2, -12);
      ventBoss.root.rotation.set(0, 0, 0);
    },
    capture: (renderer, camera) => vents.capture(renderer, scene, camera),
    dispose: () => vents.dispose(),
    contact: (x, d, f) => contact(f.crabCoreOpen ? 0 : x, d),
    effects(plane, sources, frame, renderer) {
      if (frame.newFlight)
        bubbles.reset();
      bubbles.update(plane, sources, frame.newFlight ? 0 : frame.elapsed, frame.animationTime, renderer);
    },
    update({ flight, reveal: eased, time: ventTime }) {
      const challenge = flight.isVentChallenge;
      const pose = ventBossPose(ventBossReveal(ventTime), Math.max(0, ventTime - VENT_DURATION - VENT_APPROACH));
      const point = ventWorld(pose.x, pose.y, pose.z, ventTime, eased);
      ventBoss.root.visible = flight.bossHealth > 0;
      ventBoss.root.position.set(point.x, point.y, point.z);
      ventBoss.root.rotation.x = VENT_PITCH - ventFrame(ventTime, eased).pitch;
      ventBoss.pose(ventBossReveal(ventTime), flight.cannonWindup, flight.crabTargetX, flight.firedCrabTarget, flight.bossRecoil / BOSS_RECOIL_TIME, ventTime, flight.crabBreakPose, flight.crabOpening);
      vents.update(ventTime, eased, flight.bossHealth > 0);
      mortarModels.length = flight.enemies.length;
      for (const rig of mortars)
        rig.root.visible = false;
      let mortar = 0;
      for (const [index, enemy] of flight.enemies.entries()) {
        mortarModels[index] = undefined;
        if (enemy.ventAnchor === undefined || enemy.ventWorm)
          continue;
        const rig = mortars[mortar++];
        if (!rig)
          continue;
        rig.root.visible = true;
        rig.root.position.set(enemy.x, enemy.y, 0);
        rig.root.scale.setScalar(enemy.ventScale ?? 1);
        const charge = challenge ? patternBurstCharge(enemy, ventChallengeMortar.windup) : undefined;
        rig.pose(enemy.age, enemy.fire, enemy.mortarAngle ?? 0, charge);
        mortarModels[index] = rig.combat;
      }
      faunaModels.length = flight.enemies.length;
      for (const rig of shrimps)
        rig.root.visible = false;
      for (const rig of worms)
        rig.root.visible = false;
      let shrimpsCount = 0;
      for (const [index, enemy] of flight.enemies.entries()) {
        faunaModels[index] = undefined;
        const rig = enemy.shrimp ? shrimps[shrimpsCount++] : undefined;
        if (!rig)
          continue;
        rig.root.visible = true;
        rig.root.position.set(enemy.x, enemy.y, 0);
        rig.root.scale.setScalar(enemy.ventScale ?? 1);
        rig.root.rotation.z = enemy.heading ?? 0;
        const charge = challenge ? patternBurstCharge(enemy, ventChallengeShrimp.windup) : undefined;
        rig.pose(enemy.age, enemy.fire, charge);
        faunaModels[index] = rig.combat;
      }
      let wormSlot = 0;
      for (const [anchorIndex, anchor] of ventAnchors.entries()) {
        if (!anchor.worm)
          continue;
        const rig = worms[wormSlot++];
        if (flight.phase !== 'stage' && flight.phase !== 'lost')
          continue;
        if (ventTime < anchor.time - VENT_SPAWN_LEAD)
          continue;
        const point = ventAnchorPoint(anchorIndex, ventTime);
        if (point.y < -11)
          continue;
        rig.root.visible = true;
        rig.root.position.set(point.x, point.y, 0);
        rig.root.scale.setScalar(point.scale);
        rig.root.rotation.z = 0;
        const index = flight.enemies.findIndex(e => e.ventAnchor === anchorIndex);
        const enemy = flight.enemies[index];
        if (enemy) {
          rig.pose(enemy.age, enemy.fire, enemy.mortarAngle ?? 0, enemy.wormReach, enemy.wormBend);
          faunaModels[index] = rig.combat;
        }
        else
          rig.pose(0, 3.6, 0);
        rig.setDisabled(flight.defeatedVentWorms.has(anchorIndex));
      }
      models.length = flight.enemies.length;
      for (let i = 0;i < models.length;i++)
        models[i] = faunaModels[i] ?? mortarModels[i];
    }
  };
};
