import * as T from 'three';
import { createDenBiker } from '../../den/biker';
import { createDenCliffProps } from '../../den/cliff-props';
import { createDenDefenses } from '../../den/defense-rig';
import { DEN_PATROL_POOL, DEN_PATROL_WINDUP, denPatrolPose, denPatrolScale } from '../../den/patrol';
import { createDenPatrols } from '../../den/patrol-rig';
import { DEN_DURATION, DEN_SCREENS, denScroll } from '../../den/route';
import { createDenScenery } from '../../den/scenery';
import { loadEncounterTexture } from '../../encounter-texture';
import { BOSS_CAMERA_DISTANCE, HEIGHT } from '../../game';
import type { LevelFactory } from '../level';
import { disposePlateTiles, loadScrollPlate } from '../scroll-plate';

export const createLevel: LevelFactory = ({ signal }) => {
  const scenery = createDenScenery();
  const boss = createDenBiker();
  const patrols = createDenPatrols(DEN_PATROL_POOL);
  const props = createDenCliffProps();
  const defenses = createDenDefenses();
  const root = new T.Group();
  root.name = 'draconian-den';
  const patrolRoots = patrols.rigs.map(rig => rig.root);
  root.add(scenery.root, props.root, defenses.root, ...patrolRoots, boss.root);
  const models: (T.Object3D | undefined)[] = [];

  const ready = Promise.all([
    loadScrollPlate('denCliff', DEN_SCREENS, signal),
    loadEncounterTexture('denDisk', scenery.setDisk, undefined, signal),
    loadEncounterTexture('denSky', scenery.setSky, undefined, signal),
    loadEncounterTexture('denGantry', scenery.setPlate, undefined, signal),
    loadEncounterTexture('denBiker', boss.setArt, undefined, signal),
    loadEncounterTexture('denPatrol', patrols.setArt, undefined, signal),
    loadEncounterTexture('denProps', props.setArt, undefined, signal),
    loadEncounterTexture('denDefenses', defenses.setArt, undefined, signal),
  ]).then(([tiles, , , , chiefArt, patrolArt, propArt, defenseArt]) => {
    if (signal.aborted) { disposePlateTiles(tiles); return []; }
    scenery.setCliff(tiles);
    scenery.update(0, 0, 0);
    return [...scenery.textures, props.fallback, chiefArt, patrolArt, propArt, defenseArt];
  });

  return {
    root,
    boss: boss.root,
    models,
    ready,
    stageDistance: BOSS_CAMERA_DISTANCE,
    fixedCamera: true,
    orientation: (_time, reveal) => {
      const swing = Math.sin(Math.PI * reveal) ** 2;
      return { pitch: .09 * swing, bank: .06 * swing, viewPitch: -.08 * swing };
    },
    key: 0xffc69b,
    sky: 0x9dc3ff,
    ground: 0x4d2844,
    keyIntensity: 2.7,
    skyIntensity: 1.54,
    toneMapping: T.ACESFilmicToneMapping,
    exposure: 1.12,
    contacts: [],
    prepare() { props.prime(); defenses.prime(); },
    warmup: [[scenery.root, props.root], patrolRoots, [defenses.root], [boss.root]],
    update(frame) {
      const { flight, time, reveal, animationTime } = frame;
      const scroll = denScroll(time);
      if (time >= DEN_DURATION) {
        boss.pose(flight.denBossTime, flight.bossHealth > 0);
        boss.root.position.y += (DEN_SCREENS - scroll) * HEIGHT;
      } else boss.root.visible = false;

      models.length = flight.enemies.length;
      models.fill(undefined);
      for (const rig of patrols.rigs) rig.root.visible = false;
      let index = 0;
      for (const [i, enemy] of flight.enemies.entries()) {
        if (!enemy.den || enemy.hp <= 0 || enemy.age < 0) continue;
        const rig = patrols.rigs[index++];
        if (!rig) break;
        const pose = denPatrolPose(enemy.age, enemy.lane, enemy.den);
        const charge = Math.max(0, 1 - (enemy.fire - enemy.age) / DEN_PATROL_WINDUP);
        rig.pose(enemy.x, enemy.y, pose.heading, denPatrolScale(enemy.den), pose.throttle, charge, animationTime + index * .13);
        models[i] = rig.root;
      }
      scenery.update(scroll, reveal, animationTime);
      props.update(scroll, frame);
      defenses.update(scroll, time, flight, models);
    },
    contact: (_x, _distance, flight) => ({ x: flight.exposedCannonX, y: flight.bossAimY, z: .85 }),
    dispose: scenery.dispose,
  };
};
