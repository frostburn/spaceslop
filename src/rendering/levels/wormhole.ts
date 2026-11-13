import * as T from 'three';
import { loadEncounterTexture } from '../../encounter-texture';
import { BOSS_CAMERA_DISTANCE, BOSS_PROJECTION, BOSS_Y, HEIGHT, WORMHOLE_PITCH } from '../../game';
import { createWormholeReflection, wormholeReflectionPose, type WormholeReflectionPose } from '../../wormhole/reflection';
import { fonsEase, fonsPhase, FONS_APPROACH } from '../../wormhole/fons/combat';
import { createFonsEffects } from '../../wormhole/fons/effects';
import { createFonsEnvironment } from '../../wormhole/fons/environment';
import { createFonsLightning } from '../../wormhole/fons/lightning';
import { createFonsRig } from '../../wormhole/fons/rig';
import { createWormholeBosses, type WormholeBoss } from '../../wormhole/bosses';
import { createCruiserWall } from '../../wormhole/cruiser-wall';
import { wormholeBosses, wormholeFrame } from '../../wormhole/route';
import { createWormholeTunnel } from '../../wormhole/tunnel';
import type { TunnelTheme } from '../../wormhole/wall-themes';
import type { LevelFactory } from '../level';

const halfHeight = HEIGHT / 2;
const apertureY = BOSS_Y * BOSS_PROJECTION / halfHeight;
const headOn = { pitch: WORMHOLE_PITCH, bank: 0 };
const titanEcho = (theme: TunnelTheme) => theme === 'titan' ? 2.72 : theme === 'cruise' ? .80 : .06;

export const createLevel: LevelFactory = ({ plane, fighter, signal }) => {
  const root = new T.Group();
  root.name = 'wormhole';
  const reflection = createWormholeReflection(fighter);
  const tunnel = createWormholeTunnel(apertureY, reflection.texture);
  const cruiserWall = createCruiserWall(apertureY);
  const attacks = createFonsEffects();
  const environment = createFonsEnvironment(tunnel.root, attacks.rocks);
  attacks.setCrystalEnvironment(environment.crystalTexture);
  const fons = createFonsRig(environment.texture);
  const lightning = createFonsLightning(apertureY * halfHeight);
  let mirror: WormholeReflectionPose;
  let directFinale = false;
  const bosses = createWormholeBosses(plane, signal);
  const encounters = Object.values(bosses.roster);
  let active: WormholeBoss | undefined;
  let retreating: WormholeBoss | undefined;
  fons.root.visible = attacks.root.visible = false;
  const amber = new T.Color(0xff974f), cyan = new T.Color(0x65e5da), violet = new T.Color(0xa563ff);
  const rim = new T.DirectionalLight(amber, .8);
  rim.position.set(-2, 6, -14);
  root.add(tunnel.root, cruiserWall.root, ...encounters.map(({ entrance }) => entrance), bosses.effects,
    fons.root, attacks.root, lightning.root, rim);
  const ready = Promise.all([bosses.ready, loadEncounterTexture('fonsMane', fons.setMane, undefined, signal)])
    .then(([textures, mane]) => [...textures, mane, ...tunnel.textures]);

  return {
    root,
    get boss() { return active?.model ?? fons.root; },
    victoryBoss: fons.root,
    models: bosses.models,
    surfaces: bosses.surfaces,
    applyArmor: bosses.applyArmor,
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
    contacts: [...bosses.contacts, fons.root],
    warmup: [[tunnel.root, cruiserWall.root], ...bosses.warmup, [fons.root, attacks.root, lightning.root, ...fons.ornaments, ...attacks.royalFlashes]],
    prepare() {
      bosses.prepare();
      fons.update(0, BOSS_CAMERA_DISTANCE, true);
      attacks.prime();
      lightning.update(-1.8, BOSS_CAMERA_DISTANCE);
      environment.prime();
      reflection.prime();
    },
    afterWarmup: bosses.afterWarmup,
    capture(renderer, camera) {
      reflection.capture(renderer, mirror);
      environment.capture(renderer, camera, fons.root.visible);
    },
    dispose() {
      bosses.dispose();
      tunnel.clearReflection();
      reflection.dispose();
      fons.clearEnvironment();
      attacks.setCrystalEnvironment(null);
      environment.dispose();
    },
    contact(x, distance, flight) {
      if (active?.contact) {
        if (flight.encounterLevel === 'io') x = flight.ioLegBroken ? 1 : -1;
        if (flight.encounterLevel === 'vents') x = flight.crabCoreOpen ? 0 : flight.crabTargetX;
        return active.contact(x, distance);
      }
      return { x: flight.exposedCannonX, y: flight.bossAimY };
    },
    update(levelFrame) {
      const { flight, time, distance, newFlight, victory } = levelFrame;
      const fonsTime = flight.fonsTime;
      const age = flight.phase === 'stage' ? time - flight.stageDuration : flight.wormholeEncounterTime;
      const frame = wormholeFrame(time, flight.stageDuration, age, flight.isFonsFight);
      const finale = flight.isFonsFight ? fonsEase(-FONS_APPROACH, -1.2, fonsTime) : 0;
      const theme = flight.phase === 'stage' || age < 0 ? 'cruise' : flight.encounterLevel;
      if (newFlight) directFinale = flight.isFonsFight;
      const previous = theme === 'cruise' || directFinale ? 'cruise'
        : wormholeBosses[flight.wormholeBossNumber - 2] ?? 'cruise';
      const blend = flight.isFonsFight ? fonsEase(1.1, 4.1, age) : fonsEase(.36, 2.82, age);
      const light = tunnel.setTheme(previous, theme, blend);
      const tessellation = previous === 'boulevard' ? 1 - blend : theme === 'boulevard' ? blend : 0;
      cruiserWall.setAmount(tessellation);
      cruiserWall.pose(frame.travel);
      frame.echo *= T.MathUtils.lerp(titanEcho(previous), titanEcho(theme), blend) * (1 - finale);
      frame.lensStrength += finale * .32 * (1 - fonsEase(-1.2, .8, fonsTime));
      const incomingPortal = theme === 'heliostat' ? fonsEase(.76, 2.88, age) : 0;
      const outgoingPortal = previous === 'heliostat' ? 1 - fonsEase(.06, 1.32, age) : 0;
      const portalOpening = incomingPortal + outgoingPortal;
      mirror = fighter.visible ? wormholeReflectionPose(fighter.position.x, fighter.position.y, apertureY * halfHeight) : undefined;
      tunnel.pose(frame, mirror);
      tunnel.setRegulatorPortals(time, portalOpening);
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
      tunnel.setFons(flight.fonsVariant, fonsTime, finale, storm, rocks);
      lightning.root.visible = false;
      const crackle = flight.isFonsFight && fonsTime < 0 ? lightning.update(fonsTime, distance) : 0;
      const shipRadius = Math.hypot(fighter.position.x / halfHeight - frame.lensX, fighter.position.y / halfHeight - apertureY - frame.lensY);
      const waveLight = frame.waveStrength * Math.exp(-8 * Math.abs(frame.waveRadius - shipRadius));
      rim.color.copy(light).lerp(amber, .62 * frame.echo).lerp(cyan, finale).lerp(violet, crackle * .68);
      rim.intensity = .62 + frame.echo * 1.1 + waveLight * 1.8 + finale * 1.4 + crackle * .82 + incomingPortal * .36;
      rim.position.set(frame.lensX * 19 - 2, 6, -14);
      const next = flight.phase === 'stage' || flight.encounterLevel === 'wormhole'
        ? undefined : bosses.roster[flight.encounterLevel];
      if (newFlight || next !== active) {
        if (retreating) retreating.entrance.visible = false;
        if (active) active.entrance.visible = false;
        retreating = !newFlight && flight.phase === 'approach' ? active : undefined;
        active = next;
      }
      if (retreating) {
        const recede = fonsEase(0, .76, age);
        retreating.entrance.visible = recede < 1;
        retreating.entrance.position.set(0, BOSS_Y * 2.7 * recede, -92 * recede);
        if (recede === 1) retreating = undefined;
      }
      if (active) {
        active.entrance.visible = frame.arrival > 0 && flight.bossHealth > 0;
        if (active.entrance.visible) {
          active.pose(levelFrame, flight.bossTime);
          const far = 1 - frame.arrival, depth = -112 * far;
          const point = active.model.position;
          const factor = 1 - (point.z + depth) / distance;
          active.entrance.position.set(
            (frame.lensX * halfHeight * factor - point.x) * far,
            ((apertureY + frame.lensY) * halfHeight * factor - point.y) * far,
            depth,
          );
        }
      }
      const feed = theme === 'heliostat' ? incomingPortal * fonsEase(.02, .44, frame.arrival)
        : retreating?.model === bosses.roster.heliostat.model ? outgoingPortal * (1 - fonsEase(0, .76, age)) : 0;
      bosses.updateEffects(levelFrame, feed);
    },
  };
};
