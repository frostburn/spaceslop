import * as T from 'three';
import { createCicada } from '../../cicada-rig';
import { BOSS_RECOIL_TIME } from '../../encounters';
import { loadEncounterTexture } from '../../encounter-texture';
import { BOSS_CAMERA_DISTANCE, BOSS_DEPTH, BOSS_PROJECTION, BOSS_Y, HEIGHT, WORMHOLE_PITCH } from '../../game';
import { createBossLaserContact } from '../../laser-contact';
import { createTitanChitinSurface } from '../../titan-insect-surfaces';
import { createWormholeReflection, wormholeReflectionPose, type WormholeReflectionPose } from '../../wormhole/reflection';
import { fonsEase, fonsPhase, FONS_APPROACH } from '../../wormhole/fons/combat';
import { createFonsEffects } from '../../wormhole/fons/effects';
import { createFonsEnvironment } from '../../wormhole/fons/environment';
import { createFonsLightning } from '../../wormhole/fons/lightning';
import { createFonsRig } from '../../wormhole/fons/rig';
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
  const attacks = createFonsEffects();
  const environment = createFonsEnvironment(tunnel.root, attacks.rocks);
  attacks.setCrystalEnvironment(environment.crystalTexture);
  const fons = createFonsRig(environment.texture);
  const lightning = createFonsLightning(apertureY * halfHeight);
  let mirror: WormholeReflectionPose;
  const chitin = createTitanChitinSurface();
  const boss = createCicada(chitin.material);
  boss.root.visible = false;
  fons.root.visible = attacks.root.visible = false;
  const amber = new T.Color(0xff974f), cyan = new T.Color(0x65e5da), violet = new T.Color(0xa563ff);
  const rim = new T.DirectionalLight(amber, .8);
  rim.position.set(-2, 6, -14);
  root.add(tunnel.root, boss.root, fons.root, attacks.root, lightning.root, rim);
  const ready = Promise.all([
    loadEncounterTexture('titanChitin', chitin.setTexture, 1, signal),
    loadEncounterTexture('fonsMane', fons.setMane, undefined, signal),
  ]);

  return {
    root,
    boss: boss.root,
    victoryBoss: fons.root,
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
    contacts: [boss.root, fons.root],
    warmup: [[tunnel.root, boss.root], [fons.root, attacks.root, lightning.root, ...fons.ornaments, ...attacks.royalFlashes]],
    prepare() {
      // Prime the rematch at its settled depth before the entrance animates it.
      boss.root.position.set(0, BOSS_Y, BOSS_DEPTH);
      fons.update(0, BOSS_CAMERA_DISTANCE, true);
      attacks.prime();
      lightning.update(-1.8, BOSS_CAMERA_DISTANCE);
      environment.prime();
      reflection.prime();
    },
    capture(renderer, camera) {
      reflection.capture(renderer, mirror);
      environment.capture(renderer, camera, fons.root.visible);
    },
    dispose() {
      tunnel.clearReflection();
      reflection.dispose();
      fons.clearEnvironment();
      attacks.setCrystalEnvironment(null);
      environment.dispose();
    },
    contact: createBossLaserContact(plane, boss.root),
    update({ flight, time, distance, newFlight, victory }) {
      const frame = wormholeFrame(time, flight.stageDuration);
      const fonsTime = flight.fonsTime;
      const finale = flight.isFonsFight ? fonsEase(-FONS_APPROACH, -1.2, fonsTime) : 0;
      frame.echo *= 1 - finale;
      frame.lensStrength += finale * .32 * (1 - fonsEase(-1.2, .8, fonsTime));
      mirror = fighter.visible ? wormholeReflectionPose(fighter.position.x, fighter.position.y, apertureY * halfHeight) : undefined;
      tunnel.pose(frame, mirror);
      fons.root.visible = flight.isFonsFight && fonsTime >= -FONS_APPROACH + .61 && (flight.bossHealth > 0 || victory !== undefined);
      attacks.root.visible = flight.isFonsFight && fonsTime >= -1.7 && flight.bossHealth > 0;
      if (fons.root.visible) {
        fons.setVariant(flight.fonsVariant);
        fons.update(fonsTime, distance, newFlight);
      }
      const storm = attacks.root.visible ? fonsPhase(fonsTime) : undefined;
      const rocks = attacks.root.visible
        ? attacks.update(fonsTime, distance, flight.threats, flight.phase === 'boss' || flight.phase === 'lost', flight.fonsVariant)
        : undefined;
      tunnel.setFons(fonsTime, finale, storm, rocks);
      lightning.root.visible = false;
      const crackle = flight.isFonsFight && fonsTime < 0 ? lightning.update(fonsTime, distance) : 0;
      const shipRadius = Math.hypot(fighter.position.x / halfHeight - frame.lensX, fighter.position.y / halfHeight - apertureY - frame.lensY);
      const waveLight = frame.waveStrength * Math.exp(-8 * Math.abs(frame.waveRadius - shipRadius));
      rim.color.copy(amber).lerp(cyan, finale).lerp(violet, crackle * .68);
      rim.intensity = .54 + frame.echo * 1.65 + waveLight * 1.8 + finale * 1.4 + crackle * .82;
      rim.position.set(frame.lensX * 19 - 2, 6, -14);
      const retreat = flight.isFonsFight && time > flight.stageDuration + WORMHOLE_APPROACH + .60 &&
        fonsTime < -FONS_APPROACH + .72;
      boss.root.visible = retreat || (!flight.isFonsFight && frame.bossVisible && flight.bossHealth > 0);
      if (!boss.root.visible) return;
      if (retreat) {
        const recede = fonsEase(-FONS_APPROACH, -FONS_APPROACH + .72, fonsTime);
        const z = T.MathUtils.lerp(BOSS_DEPTH, -100, recede);
        boss.root.position.set(0, BOSS_Y * (1 - z / distance) * BOSS_PROJECTION, z);
        boss.root.rotation.set(recede * .8, recede * .6, recede * -.78);
        boss.pose(1, 0, 0, 0, 0, time, 1 - recede);
        return;
      }

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
