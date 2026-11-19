import { challengeModes } from '../campaign/challenges';
import type { FlightLoadout, FlightShortcut } from '../app/flight-session';
import type { Flight } from '../game';
import { levels, type LevelId } from '../levels';
import { pilots } from '../pilot-data';
import { CONTROL_BOUNDS, STEP } from '../playfield';
import { readWingWeapon, type WingWeapon } from '../wing';

declare const __REPLAY_REVISION__: string | undefined;
export const replayRevision = typeof __REPLAY_REVISION__ === 'string' ? __REPLAY_REVISION__ : undefined;
const format = 'spaceslop-flight-replay';
const version = 1;
const maxFileBytes = 16 * 1024 * 1024;
const phases = ['stage', 'approach', 'boss', 'won', 'lost'] as const;

type Steering = [kind: 'steer' | 'drag', x: number, y: number];
type Command = [tick: number, ...Steering] | [tick: number, kind: 'drone', x: number, y: number] | [tick: number, kind: 'pulse'];
type ReplayLoadout = Omit<FlightLoadout, 'wings'> & { wings: [WingWeapon | null, WingWeapon | null] };
type Summary = {
  phase: Flight['phase']; encounter: LevelId; time: number;
  hull: number; score: number; charges: number; bossHealth: number;
  droneWeapon: Flight['droneWeapon']; leftWing: WingWeapon | null; rightWing: WingWeapon | null;
  leftUpgraded: boolean; rightUpgraded: boolean;
  x: number; y: number; droneX: number; droneY: number;
};
type ReplaySetup = { level: LevelId; loadout: ReplayLoadout; shortcut?: FlightShortcut; seed: number };

export type FlightReplay = ReplaySetup & {
  format: typeof format;
  version: typeof version;
  step: number;
  revision?: string;
  ticks: number;
  commands: Command[];
  milestones: (Summary & { tick: number })[];
  end: Summary;
};

// Mulberry32. A flight owns its generator, so rendering and retries cannot consume its draws.
export function replayRandom(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

const rounded = (value: number) => Math.round(value * 10000) / 10000;
function summarize(flight: Flight): Summary {
  const [left, right] = flight.wings;
  return {
    phase: flight.phase, encounter: flight.encounterLevel, time: rounded(flight.time),
    hull: flight.hull, score: flight.score, charges: flight.charges, bossHealth: rounded(flight.bossHealth),
    droneWeapon: flight.droneWeapon, leftWing: left.weapon ?? null, rightWing: right.weapon ?? null,
    leftUpgraded: left.upgraded, rightUpgraded: right.upgraded,
    x: rounded(flight.player.x), y: rounded(flight.player.y),
    droneX: rounded(flight.drone.x), droneY: rounded(flight.drone.y),
  };
}

export function recordFlightReplay(flight: Flight, loadout: FlightLoadout, seed: number, shortcut?: FlightShortcut) {
  const setup: ReplaySetup = {
    level: flight.level, seed, shortcut,
    loadout: { ...loadout, wings: [loadout.wings[0] ?? null, loadout.wings[1] ?? null] },
  };
  const commands: Command[] = [];
  let last = summarize(flight);
  const milestones = [{ tick: 0, ...last }];
  let tick = 0;
  let steering: Steering = ['steer', 0, 0];

  function observe(flight: Flight) {
    const [left, right] = flight.wings;
    if (last.phase === flight.phase && last.encounter === flight.encounterLevel &&
      last.hull === flight.hull && last.charges === flight.charges &&
      last.droneWeapon === flight.droneWeapon && last.leftWing === (left.weapon ?? null) &&
      last.rightWing === (right.weapon ?? null) && last.leftUpgraded === left.upgraded && last.rightUpgraded === right.upgraded) return;
    last = summarize(flight);
    milestones.push({ tick, ...last });
  }
  return {
    get hasFlight() { return tick > 0 || commands.length > 0; },
    steer(x: number, y: number, target: Flight['steeringTarget']) {
      // Resolve keyboard priority and sample the actual drag target once per tick.
      const kind = !x && !y && target ? 'drag' : 'steer';
      if (kind === 'drag' && target) { x = target.x; y = target.y; }
      if (steering[0] === kind && steering[1] === x && steering[2] === y) return;
      steering = [kind, x, y];
      commands.push([tick, ...steering]);
    },
    drone(x: number, y: number) { commands.push([tick, 'drone', x, y]); },
    pulse(flight: Flight) {
      commands.push([tick, 'pulse']);
      observe(flight);
    },
    step(flight: Flight) { tick++; observe(flight); },
    snapshot(flight: Flight): FlightReplay {
      return {
        format, version, step: STEP, revision: replayRevision, ...setup, ticks: tick,
        commands: commands.slice(), milestones: milestones.slice(), end: summarize(flight),
      };
    },
  };
}

export function playFlightReplay(replay: FlightReplay) {
  let tick = 0, cursor = 0;
  let steer: Steering = ['steer', 0, 0];
  let matches: boolean | undefined;

  function applyCommands(flight: Flight) {
    while (replay.commands[cursor]?.[0] === tick) {
      const command = replay.commands[cursor++];
      switch (command[1]) {
        case 'pulse': flight.pulse(); break;
        case 'drone': flight.deployDrone(command[2], command[3]); break;
        default: steer = [command[1], command[2], command[3]];
      }
    }
  }
  const terminal = (flight: Flight) => flight.phase === 'won' || flight.phase === 'lost';
  return {
    get tick() { return tick; },
    get matches() { return matches; },
    get done() { return matches !== undefined; },
    step(flight: Flight) {
      if (matches !== undefined) return;
      applyCommands(flight);
      if (tick < replay.ticks && !terminal(flight)) {
        const [kind, x, y] = steer;
        if (kind === 'drag') flight.steer(0, 0, STEP, { x, y });
        else flight.steer(x, y, STEP);
        flight.step(STEP);
        tick++;
      }
      if (tick < replay.ticks && !terminal(flight)) return;
      // A Pulse or drone placement can occur after the final simulation step.
      applyCommands(flight);
      const result = summarize(flight);
      matches = tick === replay.ticks && cursor === replay.commands.length &&
        (Object.keys(result) as (keyof Summary)[]).every(key => result[key] === replay.end[key]);
    },
  };
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function integer(value: unknown, max: number): value is number {
  return finite(value) && Number.isSafeInteger(value) && value >= 0 && value <= max;
}
function validDrone(value: unknown) { return value === 'sentry' || value === 'towline'; }
function validWing(value: unknown) { return value === null || (typeof value === 'string' && readWingWeapon(value) !== undefined); }

function validSummary(value: unknown): value is Summary {
  return object(value) && phases.some(phase => phase === value.phase) &&
    typeof value.encounter === 'string' && Object.hasOwn(levels, value.encounter) &&
    validDrone(value.droneWeapon) && validWing(value.leftWing) && validWing(value.rightWing) &&
    typeof value.leftUpgraded === 'boolean' && typeof value.rightUpgraded === 'boolean' &&
    ['time', 'hull', 'score', 'charges', 'bossHealth', 'x', 'y', 'droneX', 'droneY'].every(key => finite(value[key]));
}

export function parseFlightReplay(source: string): FlightReplay {
  let data: unknown;
  try { data = JSON.parse(source); }
  catch { throw new Error('This replay file is not valid JSON.'); }
  if (!object(data) || data.format !== format) throw new Error('Choose a Spaceslop replay file.');
  if (data.version !== version || data.step !== STEP) throw new Error('This replay uses an unsupported format or flight clock.');
  const { level, loadout, shortcut, seed, ticks, revision, commands, milestones, end } = data;
  const valid = typeof level === 'string' && Object.hasOwn(levels, level) &&
    object(loadout) && pilots.some(pilot => pilot.id === loadout.pilot) &&
    validDrone(loadout.drone) &&
    (loadout.mode === 'regular' || challengeModes.some(mode => mode === loadout.mode)) &&
    Array.isArray(loadout.wings) && loadout.wings.length === 2 &&
    loadout.wings.every(validWing) &&
    (shortcut === undefined || shortcut === 'boss' || (shortcut === 'trench' && level === 'fleet') ||
      (shortcut === 'fons' && level === 'wormhole')) &&
    integer(seed, 0xffffffff) && integer(ticks, Number.MAX_SAFE_INTEGER) &&
    (revision === undefined || (typeof revision === 'string' && revision.length <= 80)) &&
    Array.isArray(commands) && Array.isArray(milestones) && validSummary(end);
  if (!valid) throw new Error('The replay is missing flight data or uses an invalid loadout.');

  let previous = 0;
  for (const command of commands) {
    if (!Array.isArray(command) || !integer(command[0], ticks) || command[0] < previous) {
      throw new Error('The replay has an invalid command time.');
    }
    const [tick, kind, x, y] = command;
    previous = tick;
    const pair = command.length === 4 && finite(x) && finite(y);
    const validCommand = kind === 'pulse' ? command.length === 2
      : kind === 'steer' ? pair && tick < ticks && Number.isInteger(x) && Number.isInteger(y) && Math.abs(x) <= 2 && Math.abs(y) <= 2
      : (kind === 'drag' || kind === 'drone') && pair && (kind === 'drone' || tick < ticks) &&
        x >= CONTROL_BOUNDS.minX && x <= CONTROL_BOUNDS.maxX &&
        y >= CONTROL_BOUNDS.minY && y <= CONTROL_BOUNDS.maxY;
    if (!validCommand) throw new Error('The replay contains an invalid flight command.');
  }
  if (!milestones.every(mark => object(mark) && integer(mark.tick, ticks) && validSummary(mark))) {
    throw new Error('The replay contains invalid flight milestones.');
  }
  return data as FlightReplay;
}

export async function readFlightReplay(file: File) {
  if (file.size > maxFileBytes) throw new Error('Replay files must be smaller than 16 MB.');
  return parseFlightReplay(await file.text());
}

export function saveFlightReplay(replay: FlightReplay) {
  const file = new Blob([JSON.stringify(replay)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `spaceslop-${replay.level}-${replay.loadout.mode}-${replay.seed.toString(16)}.replay.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function replayClock(ticks: number) {
  const seconds = Math.floor(ticks * STEP);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
