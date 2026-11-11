import * as T from 'three';
import { createCicada } from '../../cicada-rig';
import { BOSS_RECOIL_TIME } from '../../encounters';
import { loadEncounterTexture } from '../../encounter-texture';
import { BOSS_CAMERA_DISTANCE, BOSS_DEPTH, BOSS_PROJECTION, BOSS_Y, HEIGHT, WORMHOLE_PITCH } from '../../game';
import { createBossLaserContact } from '../../laser-contact';
import { createTitanChitinSurface } from '../../titan-insect-surfaces';
import { createWormholeReflection, wormholeReflectionPose, type WormholeReflectionPose } from '../../wormhole/reflection';
import { wormholeFrame, WORMHOLE_APPROACH } from '../../wormhole/route';
import { createWormholeTunnel } from '../../wormhole/tunnel';
import type { LevelFactory } from '../level';

const halfHeight = HEIGHT / 2;
const apertureY = BOSS_Y * BOSS_PROJECTION / halfHeight;
const headOn = { pitch: WORMHOLE_PITCH, bank: 0 };

export const createLevel: LevelFactory = ({ plane, fighter, signal }) => {
  const root = new T.Group();
  root.name = 'wormhole';
  const reflection = createWormholeReflection(fighter);
  const tunnel = createWormholeTunnel(apertureY, reflection.texture);
  let mirror: WormholeReflectionPose;
  const chitin = createTitanChitinSurface();
  const boss = createCicada(chitin.material);
  boss.root.visible = false;
  const rim = new T.DirectionalLight(0xff974f, .8);
  rim.position.set(-2, 6, -14);
  root.add(tunnel.root, boss.root, rim);
  const ready = loadEncounterTexture('titanChitin', chitin.setTexture, 1, signal).then(texture => [texture]);

  return {
    root,
    boss: boss.root,
    models: [],
    ready,
    stageDistance: BOSS_CAMERA_DISTANCE,
    fixedCamera: true,
    orientation: () => headOn,
    toneMapping: T.ACESFilmicToneMapping,
    key: 0xb6d6ff,
    keyIntensity: 2.45,
    sky: 0x9bb8ee,
    ground: 0x49365b,
    skyIntensity: 1.35,
    friendlyGlow: 1.17,
    contacts: [boss.root],
    warmup: [[tunnel.root, boss.root]],
    prepare() {
      // Prime the rematch at its settled depth before the entrance animates it.
      boss.root.position.set(0, BOSS_Y, BOSS_DEPTH);
      reflection.prime();
    },
    capture(renderer) { reflection.capture(renderer, mirror); },
    dispose() {
      tunnel.clearReflection();
      reflection.dispose();
    },
    contact: createBossLaserContact(plane, boss.root),
    update({ flight, time }) {
      const frame = wormholeFrame(time, flight.stageDuration);
      mirror = fighter.visible ? wormholeReflectionPose(flight.player.x, flight.player.y, apertureY * halfHeight) : undefined;
      tunnel.pose(frame, mirror);
      const shipRadius = Math.hypot(flight.player.x / halfHeight - frame.lensX, flight.player.y / halfHeight - apertureY - frame.lensY);
      const waveLight = frame.waveStrength * Math.exp(-8 * Math.abs(frame.waveRadius - shipRadius));
      rim.intensity = .54 + frame.echo * 1.65 + waveLight * 1.8;
      rim.position.set(frame.lensX * 19 - 2, 6, -14);
      boss.root.visible = frame.bossVisible && flight.bossHealth > 0;
      if (!boss.root.visible) return;

      const z = T.MathUtils.lerp(-145, BOSS_DEPTH, frame.arrival);
      const size = 1 - z / BOSS_CAMERA_DISTANCE;
      // Project the distant boss inside the same aperture, then let it fly
      // towards the player and settle exactly on the familiar vent targets.
      boss.root.position.set(frame.lensX * halfHeight * size, (apertureY + frame.lensY) * halfHeight * size, z);
      boss.root.rotation.set(-.19 * (1 - frame.arrival), -.42 * (1 - frame.arrival), -.16 * (1 - frame.arrival));
      const bossTime = time - flight.stageDuration - WORMHOLE_APPROACH;
      boss.pose(frame.arrival, flight.cannonWindup, flight.exposedCannonX, flight.firedCannonX,
        flight.bossRecoil / BOSS_RECOIL_TIME, bossTime, frame.wingSpread, frame.echo * frame.lensStrength * .46);
    },
  };
};
