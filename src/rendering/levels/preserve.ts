import { createAmbusherMaterials, createPoolAmbusher } from '../../preserve-ambusher-rig';
import { AMBUSHER_POOL, ambusherPose } from '../../preserve-ambusher';
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
import { preserveLighting } from '../../preserve-lighting';
export const createLevel: LevelFactory = ({ plane, signal }) => {
  const root = new T.Group();
  const scout = createScoutRig();
  const scouts = Array.from({ length: 12 }, () => { const root = scout.clone(); return { root, burners: shipBurners(root) }; });
  const raptors = Array.from({length:3},createRaptorRig);
  const ambusherMaterials=createAmbusherMaterials(),ambushers=Array.from({length:AMBUSHER_POOL},()=>createPoolAmbusher(ambusherMaterials));
  const preserve = createPreserveScenery();
  const boss = preserve.boss;
  const effects = createGroundskeeperEffects();
  const models: (T.Object3D | undefined)[] = [];
  addRoots(root, ...ambushers, ...raptors, preserve, effects, ...scouts);
  const contact = createBossLaserContact(plane, boss.root);
  const ready = Promise.all([loadEncounterTexture('feathers', texture => { setFeatherTexture(texture); boss.setFeatherTexture(texture); }, undefined, signal), loadEncounterTexture('scales', texture => {
    texture.repeat.set(.62, .68);
    texture.offset.set(.19, .16);
    setFaceTexture(texture);
    boss.setScaleTexture(texture);
    ambusherMaterials.setScales(texture);
    raptors.forEach(raptor => raptor.setScaleTexture(texture));
  }, undefined, signal)]).then(t => t.flat());
  return {
    root,
    boss: boss.root,
    models,
    ready,
    stageDistance: PRESERVE_DISTANCE,
    background: 0x020407,
    ...preserveLighting,
    orientation: (_time, reveal) => preserveFrame(reveal),
    surfaces: [preserve.root, ...scouts.map(r => r.root)],
    warmup: [[scouts[0].root, ...raptors.map(r => r.root), ...ambushers.map(r=>r.root), preserve.root], [boss.root, effects.root]],
    prepare() { preserve.prime(true); effects.prime(); ambushers.forEach(r=>r.prime(true)); },
    afterWarmup() {preserve.prime(false);ambushers.forEach(r=>r.prime(false));},
    contacts: [boss.root, ...ambushers.map(r=>r.root), ...raptors.map(r => r.root), ...scouts.map(r => r.root)],
    contact,
    update(frame) {
      const { flight, reveal: eased, time, animationTime, elapsed, newFlight, fighterSpeed, droneSpeed } = frame;
      boss.pose(flight.groundskeeperTime, flight.groundskeeperAim, flight.groundskeeperCancelledAt);
      effects.update(flight.groundskeeperTime, flight.groundskeeperAim, flight.groundskeeperCancelledAt, flight.phase === 'boss');
      models.length = flight.enemies.length;
      models.fill(undefined);
      const hunters=flight.enemies.filter(enemy=>enemy.ambusher);
      for(const[i,rig]of ambushers.entries()){
        const enemy=hunters[i];rig.root.visible=Boolean(enemy);
        if(enemy?.ambusher){rig.pose(ambusherPose(enemy.ambusher,time));if(enemy.hp>0)models[flight.enemies.indexOf(enemy)]=rig.animal;}
      }
      const patrol = flight.enemies.filter(enemy => enemy.raptor);
      for (const [i,raptor] of raptors.entries()) {
        const enemy=patrol[i];raptor.root.visible=Boolean(enemy);
        if (!enemy) continue;
        raptor.root.position.set(enemy.x,enemy.y,0);raptor.root.rotation.z=Math.PI;
        raptor.pose(enemy.age);models[flight.enemies.indexOf(enemy)]=raptor.root;
      }
      const ships=flight.enemies.filter(enemy=>!enemy.raptor&&!enemy.ambusher);
      for (const [index, { root, burners }] of scouts.entries()) {
        const enemy = ships[index]; root.visible = Boolean(enemy);
        if (!root.visible || !enemy) continue;
        root.position.set(enemy.x, enemy.y, 0); root.rotation.z = Math.PI + .3 * Math.cos(enemy.age * 1.55); root.scale.setScalar(enemy.ventScale ?? 1);
        poseBurners(burners, enemy.age + index * .27, .55 + .16 * Math.sin(enemy.age * 4 + index)); models[flight.enemies.indexOf(enemy)] = root;
      }
      const reveal = eased;
      const wakes = flight.hull > 0 && reveal < 0.7 ? [
        { ...flight.player, strength: Math.min(1.4, 0.93 + fighterSpeed * 0.1) },
        { ...flight.drone, strength: Math.min(1, 0.3 + droneSpeed * 0.05) },
        ...flight.enemies.filter(enemy=>!enemy.ambusher).map((enemy) => ({
          x: enemy.x,
          y: enemy.y,
          strength: enemy.raptor ? 0.63 + raptorFlight(enemy.age).speed * 0.11 : 0.86,
        })),
      ] : [];
      preserve.update(time, reveal, animationTime, elapsed, wakes, newFlight);
    }
  };
};
