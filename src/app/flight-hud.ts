import { groveSection } from '../biolume/route';
import { boulevardSection } from '../boulevard';
import { DEN_SCREENS, denSection } from '../den/route';
import { fleetSection } from '../fleet/route';
import type { Flight } from '../game';
import { iceSection } from '../ice-layout';
import { IO_SCREENS, ioSection } from '../io-layout';
import { levels, type LevelId } from '../levels';
import { summerSection } from '../summer/layout';
import { titanSection } from '../titan-layout';
import { ventSection } from '../vent-layout';
import { wingWeapons } from '../wing';
import { fonsAttackCue } from '../wormhole/fons/attacks';
import { FONS_RAIN_END, fonsPhase } from '../wormhole/fons/combat';
import { fonsNames } from '../wormhole/fons/variants';
import { wormholeBosses } from '../wormhole/route';

const approachLabels: Partial<Record<LevelId, string>> = {
  wormhole: 'SUPPLIES',
  fleet: 'BREACH APPROACH',
  den: 'GANTRY APPROACH',
  biolume: 'DARK CROWN',
  summer: 'LOTUS PALACE',
  heliostat: 'COLLECTOR APPROACH',
  boulevard: 'SUNSET PLAZA',
  vents: 'ABYSSAL DROP',
  io: 'CALDERA APPROACH',
  titan: 'ASCENT',
};
const resultLabels = { boss: 'BOSS', won: 'CLEAR', lost: 'SIGNAL LOST' };

type Section = { label: string; title: string };

function numberedSection(label: string, progress: number, count: number) {
  return `${label} · ${Math.min(count, 1 + Math.floor(progress * count))}/${count}`;
}

function sectorSection(flight: Flight, boss: string): Section {
  const { level, phase, time, stageDuration } = flight;
  const onRoute = phase === 'stage';
  const sector = levels[level].sector;
  const label = onRoute ? sector : phase === 'approach' ? approachLabels[level] ?? 'CONTACT' : resultLabels[phase];
  const route = (title: string, progress = flight.hiveProgress, count = 10) =>
    ({ label: onRoute ? numberedSection(sector, progress, count) : label, title });
  switch (level) {
    case 'wormhole':
      if (phase === 'approach' || phase === 'boss')
        return { label: `${label} · ${flight.wormholeBossNumber}/${wormholeBosses.length}`, title: boss };
      return { label, title: levels[level].name };
    case 'fleet':
      if (onRoute) {
        const title = fleetSection(time);
        return { label: title.toUpperCase(), title };
      }
      return { label, title: levels[level].name };
    case 'den':
      return route(denSection(onRoute ? time : stageDuration), flight.hiveProgress, DEN_SCREENS);
    case 'biolume':
      return route(groveSection(onRoute ? time : stageDuration), time / stageDuration);
    case 'boulevard':
      return route(boulevardSection(time), time / stageDuration);
    case 'summer':
      return route(summerSection(time));
    case 'heliostat':
      return route(levels[level].name);
    case 'vents':
      return route(onRoute ? ventSection(time) : levels[level].name);
    case 'io':
      return route(onRoute ? ioSection(time) : levels[level].name, flight.hiveProgress, IO_SCREENS);
    case 'titan':
      return route(titanSection(flight.hiveProgress));
    case 'ice':
      return route(iceSection(flight.hiveProgress));
    default:
      return { label, title: levels[level].name };
  }
}

const defaultTip = 'Tap for drone · Drag to steer';
const cyanCoreTip = 'Target the cyan core · Move after the amber aim lock.';
const bossTips: Partial<Record<LevelId, string>> = {
  den: 'Watch the engines · Dodge the sweeping bursts',
  fleet: 'Move after the side guns light up · Thread the rings',
  biolume: 'Shoot seeking lanterns · Dodge their burst · Fire straight into the ray.',
  heliostat: cyanCoreTip,
  boulevard: cyanCoreTip,
  preserve: 'Dodge the claw windups. Pulse interrupts an attack. Fire into the belly.',
  ice: 'Tap the mouth marker. Dodge amber rings.',
  titan: 'Tap the glowing thorax vent. Dodge amber rings.',
  summer: 'Destroy all three hydra heads. Dodge amber rings.',
};
const cyanTowlineTip = 'Sweep the arc across the cyan core.';
const towlineTips: Partial<Record<LevelId, string>> = {
  den: 'Sweep the arc across the bike.',
  fleet: 'Sweep the arc across the saucer.',
  biolume: 'Sweep the arc through seekers or the ray.',
  heliostat: cyanTowlineTip,
  boulevard: cyanTowlineTip,
  ice: 'Sweep the arc across the mouth marker.',
  io: 'Sweep the arc across the cyan support, then exposed machinery.',
  titan: 'Sweep the arc across the glowing thorax vent.',
};

function bossTip(flight: Flight) {
  const towline = flight.droneWeapon === 'towline';
  const encounter = flight.encounterLevel;
  if (flight.isBroodlockChallenge) return towline ? 'Sweep the arc across the green cannon. Dodge the follow-up fan.'
    : 'Tap the green cannon. Dodge both spore fans.';
  if (flight.isIoChallenge) return flight.ioLegBroken ? 'Target the exposed machinery. Dodge the third sweep.'
    : 'Break the cyan support. Move after the wheel locks on.';
  if (flight.isFonsFight) {
    const storm = fonsPhase(flight.fonsTime);
    if (storm.rain || storm.warning > 0) return 'Stay in the wake of a falling crystal';
    if (storm.shielded) return storm.age < FONS_RAIN_END ? 'Fons shielded · Find cover' : 'Cloak opening';
    if (storm.wrap > 0 && storm.age < FONS_RAIN_END) return 'Cloak closing · Find cover';
    if (storm.openingRifts) return 'Wall rifts opening · Watch for falling cover';
    return fonsAttackCue(storm.age, flight.fonsVariant) ??
      (towline ? 'Sweep the arc across the mirror' : 'Fire into the mirror · Dodge the sweeps');
  }
  if (encounter === 'vents') {
    if (towline) return flight.crabCoreOpen ? 'Sweep the arc across the exposed gills.' : 'Sweep the arc across a glowing claw joint.';
    return flight.crabCoreOpen ? 'Tap the gill chamber. Dodge amber rings.' : 'Tap the glowing joint. Break both claws.';
  }
  if (towline) return towlineTips[encounter] ?? 'Sweep the arc across the green cannon.';
  if (encounter === 'io') return flight.ioLegBroken ? 'Machinery exposed · Dodge the wheel shots.' : 'Break the cyan front support.';
  return bossTips[encounter] ?? 'Tap the green cannon. Dodge amber rings.';
}

function flightTip(flight: Flight, active: boolean) {
  if (active && flight.perkTime > 0) return flight.perkMessage;
  if (active && flight.pickupTime > 0) return flight.pickupMessage;
  if (active && flight.phase === 'stage') {
    const equipment = flight.wings.flatMap((wing) => wing.weapon
      ? [`${wing.side < 0 ? 'L' : 'R'} ${wingWeapons[wing.weapon].short}${wing.upgraded ? ' II' : ''}`]
      : []);
    if (flight.droneWeapon === 'towline') equipment.push('Towline');
    if (equipment.length) return equipment.join(' · ');
    if (flight.drops.length) return 'Fly through the drop to equip it';
  }
  if (flight.level === 'wormhole' && flight.phase === 'approach') {
    const repair = flight.drops.some(drop => drop.kind === 'repair');
    const weapons = flight.drops.some(drop => drop.weapon);
    if (repair) return weapons ? 'Collect the weapons and hull repair' : 'Collect the hull repair';
    return weapons ? 'Collect weapon drops before the next fight' : 'Boss approaching';
  }
  if (flight.phase === 'boss') return bossTip(flight);
  return flight.droneWeapon === 'towline' ? 'Park the drone · Sweep the arc' : defaultTip;
}

export function flightReadout(flight: Flight, active: boolean, preparing: boolean, offlineReady: boolean) {
  const encounter = flight.encounterLevel;
  const boss = flight.isFonsFight ? fonsNames[flight.fonsVariant].toUpperCase() : levels[encounter].boss;
  const heads = encounter === 'summer' ? flight.summerHeadsAlive : undefined;
  return {
    sector: sectorSection(flight, boss),
    boss: heads === undefined ? boss : `${boss} · ${heads} ${heads === 1 ? 'HEAD' : 'HEADS'}`,
    showBoss: flight.phase === 'boss' || (flight.level === 'wormhole' && flight.phase === 'approach'),
    tip: flight.phase === 'won' ? '' : preparing ? 'Preparing graphics…'
      : !active && offlineReady ? 'Level ready offline' : flightTip(flight, active),
  };
}
