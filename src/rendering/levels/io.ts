import * as T from 'three';
import { addRoots, type LevelFactory } from '../level';
import { createBossLaserContact } from '../../laser-contact';
import { loadEncounterTexture } from '../../encounter-texture';
import { createIoScenery } from '../../io-scenery';
import { createSkipper } from '../../io-rigs';
import { createCrucible, createSlag } from '../../io-crucible-rig';
import { CRUCIBLE_POOL, SLAG_POOL, crucibleValve } from '../../io-crucible';
import { setIoRockTexture, setIoCeramicTexture } from '../../io-materials';
import { IO_SKIPPER_POOL, IO_CAMERA_DISTANCE, IO_DURATION, IO_APPROACH, ioFrame, skipperMotion } from '../../io-layout';
export const createLevel: LevelFactory = ({ plane, signal }) => {
  const root = new T.Group();
  const io = createIoScenery();
  const boss = io.boss;
  const skippers = Array.from({ length: IO_SKIPPER_POOL }, createSkipper);
  const crucibles = Array.from({ length: CRUCIBLE_POOL }, createCrucible);
  const slags = Array.from({ length: SLAG_POOL }, createSlag);
  const skipperModels: (T.Object3D | undefined)[] = [];
  const crucibleModels: (T.Object3D | undefined)[] = [];
  const models: (T.Object3D | undefined)[] = [];
  addRoots(root, io, ...skippers, ...crucibles, ...slags);
  io.root.visible = true;
  const ready = Promise.all([loadEncounterTexture('ioBasalt', setIoRockTexture, 1, signal), loadEncounterTexture('ioCeramic', setIoCeramicTexture, 1, signal)]);
  const contact = createBossLaserContact(plane, boss.root);
  const actors = [...skippers, ...crucibles, ...slags].map(r => r.root);
  return {
    root,
    boss: boss.root,
    models,
    ready,
    stageDistance: IO_CAMERA_DISTANCE,
    background: 0x020305,
    key: 0xfff0dc,
    sky: 0xb9c9e0,
    ground: 0x35251c,
    keyIntensity: .15,
    skyIntensity: .48,
    orientation: (time, reveal) => ioFrame(time, reveal),
    surfaces: [io.root, skippers[0].root, crucibles[0].root],
    contacts: [boss.root, ...actors],
    warmup: [[io.root, ...actors]],
    prepare() {
      io.update(IO_DURATION + IO_APPROACH, 1);
      io.prime(true);
    },
    afterWarmup: () => io.prime(false),
    contact: (x, d) => contact(x < -1 ? -1 : 1, d),
    update({ flight, reveal: eased, time: ioTime }) {
      const orientation = ioFrame(ioTime, eased);
      const ioPitch = orientation.pitch;
      const ioBank = orientation.bank;
      io.update(ioTime, eased);
      boss.root.visible = flight.bossHealth > 0;
      boss.pose(ioTime, flight.ioCollapse, flight.ioLegBroken, flight.cannonWindup);
      skipperModels.length = flight.enemies.length;
      for (const rig of skippers)
        rig.root.visible = false;
      let skippersCount = 0;
      for (const [index, enemy] of flight.enemies.entries()) {
        skipperModels[index] = undefined;
        if (!enemy.skipper)
          continue;
        const rig = skippers[skippersCount++];
        if (!rig)
          continue;
        const motion = skipperMotion(enemy.age, enemy.lane, enemy.slot);
        rig.root.visible = true;
        rig.root.position.set(enemy.x, enemy.y, 0);
        rig.root.rotation.z = -motion.heading;
        rig.pose(enemy.age, motion.bank, motion.jet);
        skipperModels[index] = rig.root;
        rig.root.rotation.x -= ioPitch;
        rig.root.rotation.y += ioBank;
      }
      crucibleModels.length = flight.enemies.length;
      for (const rig of crucibles)
        rig.root.visible = false;
      for (const rig of slags)
        rig.root.visible = false;
      let carriers = 0;
      let slag = 0;
      for (const [index, enemy] of flight.enemies.entries()) {
        crucibleModels[index] = undefined;
        if (!enemy.crucible && !enemy.slag)
          continue;
        const rig = enemy.crucible ? crucibles[carriers++] : slags[slag++];
        if (!rig)
          continue;
        rig.root.visible = true;
        rig.root.position.set(enemy.x, enemy.y, 0);
        if (enemy.crucible) {
          rig.root.rotation.set(-ioPitch, ioBank, 0);
          (rig as typeof crucibles[number]).pose(enemy.age, crucibleValve(enemy.age, enemy.fire));
        }
        else
          (rig as typeof slags[number]).pose(enemy.age, enemy.slag?.vx ?? 0);
        crucibleModels[index] = rig.root;
      }
      models.length = flight.enemies.length;
      for (let i = 0;i < models.length;i++)
        models[i] = skipperModels[i] ?? crucibleModels[i];
    }
  };
};
