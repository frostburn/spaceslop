import * as T from 'three';
import { addRoots, type LevelFactory } from '../level';
import { createBossLaserContact } from '../../laser-contact';
import { loadEncounterTexture } from '../../encounter-texture';
import { createRaptorRig, setFeatherTexture } from '../../encounter-rigs';
import { setFaceTexture } from '../../creature-faces';
import { createPreserveScenery } from '../../preserve-scenery';
import { PRESERVE_DISTANCE, preserveFrame } from '../../preserve-layout';
import { poseBurners, shipBurners } from '../../burners';
import { raptorFlight } from '../../encounters';
import { createScoutRig } from '../../ship-rigs';
import { createGroundskeeperEffects } from '../../groundskeeper-effects';
export const createLevel: LevelFactory = ({ plane, signal }) => {
  const root = new T.Group();
  const scout = createScoutRig();
  const scouts = Array.from({ length: 12 }, () => { const root = scout.clone(); return { root, burners: shipBurners(root) }; });
  const raptors = Array.from({length:3},createRaptorRig);
  const preserve = createPreserveScenery();
  const boss = preserve.boss;
  const effects = createGroundskeeperEffects();
  const models: (T.Object3D | undefined)[] = [];
  addRoots(root, ...raptors, preserve, effects, ...scouts);
  const contact = createBossLaserContact(plane, boss.root);
  const ready = Promise.all([loadEncounterTexture('feathers', texture => { setFeatherTexture(texture); boss.setFeatherTexture(texture); }, undefined, signal), loadEncounterTexture('scales', texture => {
    texture.repeat.set(.62, .68);
    texture.offset.set(.19, .16);
    setFaceTexture(texture);
    boss.setScaleTexture(texture);
    raptors.forEach(raptor => raptor.setScaleTexture(texture));
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
    orientation: (_time, reveal) => preserveFrame(reveal),
    surfaces: [preserve.root, ...scouts.map(r => r.root)],
    warmup: [[scouts[0].root, ...raptors.map(r => r.root), preserve.root], [boss.root, effects.root]],
    prepare() { preserve.prime(true); effects.prime(); },
    afterWarmup: () => preserve.prime(false),
    contacts: [boss.root, ...raptors.map(r => r.root), ...scouts.map(r => r.root)],
    contact,
    update(frame) {
      const { flight, reveal: eased, time, animationTime, elapsed, newFlight, fighterSpeed, droneSpeed } = frame;
      boss.pose(flight.groundskeeperTime, flight.groundskeeperAim, flight.groundskeeperCancelledAt);
      effects.update(flight.groundskeeperTime, flight.groundskeeperAim, flight.groundskeeperCancelledAt, flight.phase === 'boss');
      models.length = flight.enemies.length;
      models.fill(undefined);
      const patrol = flight.enemies.filter(enemy => enemy.raptor);
      for (const [i,raptor] of raptors.entries()) {
        const enemy=patrol[i];raptor.root.visible=Boolean(enemy);
        if (!enemy) continue;
        raptor.root.position.set(enemy.x,enemy.y,0);raptor.root.rotation.z=Math.PI;
        raptor.pose(enemy.age);models[flight.enemies.indexOf(enemy)]=raptor.root;
      }
      for (const [index, { root, burners }] of scouts.entries()) {
        const enemy = flight.enemies[index]; root.visible = Boolean(enemy && !enemy.raptor);
        if (!root.visible || !enemy) continue;
        root.position.set(enemy.x, enemy.y, 0); root.rotation.z = Math.PI + .3 * Math.cos(enemy.age * 1.55); root.scale.setScalar(enemy.ventScale ?? 1);
        poseBurners(burners, enemy.age + index * .27, .55 + .16 * Math.sin(enemy.age * 4 + index)); models[index] = root;
      }
      const reveal = eased;
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
