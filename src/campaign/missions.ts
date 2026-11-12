import type { LevelId } from '../levels';
import type { Rank } from './ranks';

export const officers = {
  'rhys-vale': { name: 'Rhys Vale', rank: 'captain' },
  'davi-morel': { name: 'Davi Morel', rank: 'firstLt' },
  'ilaria-bellandi': { name: 'Ilaria Bellandi', rank: 'major' },
  'sen-orra': { name: 'Sen Orra', rank: 'solarMarshal' },
  'rhea-mensah': { name: 'Rhea Mensah', rank: 'colonel' },
  'leda-tran': { name: 'Leda Tran', rank: 'major' },
  'malik-adebayo': { name: 'Malik Adebayo', rank: 'brigadier' },
  'vaelith-oruen': { name: 'Vaelith Oruen', rank: 'sectorMarshal' },
  arruv: { name: 'Arruv', rank: 'galacticMarshal' },
} as const satisfies Record<string, { name: string; rank: Rank }>;

export type OfficerId = keyof typeof officers;

type Mission = {
  level: LevelId;
  pilotRank: Rank;
  officer: OfficerId;
  brief: string;
  objective: string;
};

export const campaign: readonly Mission[] = [
  {
    level: 'broodlock', pilotRank: 'specialist4', officer: 'rhys-vale',
    brief: 'The depot has closed the quarantine ticket twice. The crew keeps reopening it. They’re still knocking from inside the loading tunnels.',
    objective: 'Cross the infected hive and take down the Brood Guardian.',
  },
  {
    level: 'io', pilotRank: 'specialist4', officer: 'davi-morel',
    brief: 'The evacuation hauler is listed as empty. I can see people in the cab. The sulfur works will purge on schedule unless we stop the engine.',
    objective: 'Follow the sulfur conveyors and disable the Caldera Engine.',
  },
  {
    level: 'vents', pilotRank: 'specialist4', officer: 'ilaria-bellandi',
    brief: 'There’s a cable under Europa’s ice with a chart from before the jump network. Follow it past the black smokers. The Sovereign has made a home at the drop.',
    objective: 'Follow the survey cable to the abyss and recover the route chart.',
  },
  {
    level: 'titan', pilotRank: 'specialist4', officer: 'rhys-vale',
    brief: 'Europa’s chart puts the false distress calls through this station. The uplink keeps replacing them with a clear-skies report. Get above the haze and carry the raw recording out.',
    objective: 'Reach the uplink above the clouds and defeat the cicada.',
  },
  {
    level: 'heliostat', pilotRank: 'sergeant', officer: 'sen-orra',
    brief: 'I signed the override so an evacuation fleet could get home. Now the regulator takes orders from a dead station. Bring it down gently. That star heats the workers’ quarters.',
    objective: 'Take the artificial star’s regulator to local control.',
  },
  {
    level: 'ice', pilotRank: 'secondLt', officer: 'rhys-vale',
    brief: 'The relief tender arrived at noon, officially. Its distress flare went up six minutes ago. Fly close enough to read the hull and bring back its recorder.',
    objective: 'Cross the ice field and clear the Leviathan from the salvage lane.',
  },
  {
    level: 'preserve', pilotRank: 'secondLt', officer: 'rhea-mensah',
    brief: 'The manifest lists an empty station. There are footprints in the loading bay. The garden crew has opened one door by hand. Fly straight under the port girder.',
    objective: 'Open a rescue lane through the preserve to the Groundskeeper.',
  },
  {
    level: 'summer', pilotRank: 'firstLt', officer: 'rhea-mensah',
    brief: 'The evacuees are waiting under the palace dome. Their receipts put them on three different worlds. Get me one witness who can tell us where they actually came from.',
    objective: 'Follow the thaw river to the lotus palace and clear its approach.',
  },
  {
    level: 'boulevard', pilotRank: 'firstLt', officer: 'leda-tran',
    brief: 'Customs has listed your ship as stolen. Glint’s docking pass is good until midnight. The sun here is decorative. The deadline is real.',
    objective: 'Get through the customs boulevard and shake the pursuit cruiser.',
  },
  {
    level: 'biolume', pilotRank: 'firstLt', officer: 'leda-tran',
    brief: 'The Grove keeps its traffic off the network. Watch the leaves over the blackwater. Three flashes, then a pause. The courier has the exchange coordinates.',
    objective: 'Cross the Grove and reach the relay in the Dark Crown.',
  },
  {
    level: 'fleet', pilotRank: 'firstLt', officer: 'malik-adebayo',
    brief: 'We have a ceasefire with the Grays for one prisoner exchange. Both fleets have just received orders to break it in my voice. The flagship’s stern is open if they start shooting.',
    objective: 'Fly through the flagship’s trench and disable the Gray command saucer.',
  },
  {
    level: 'den', pilotRank: 'captain', officer: 'vaelith-oruen',
    brief: 'The Gantry Chief keeps a Draconian rookery above the last gate. He sees the override in your transponder. Get close enough to show him whose signature is on it.',
    objective: 'Reach the chief’s gantry and secure passage to the last gate.',
  },
  {
    level: 'wormhole', pilotRank: 'captain', officer: 'arruv',
    brief: 'The return channel is replaying the Titan call. Follow the echo to the source and break the override before it answers again. One last clearance. This one comes from me.',
    objective: 'Follow Titan’s echo through the wormhole and defeat Fons Inversus.',
  },
];

export const missionFor = Object.fromEntries(campaign.map(mission => [mission.level, mission])) as Readonly<Record<LevelId, Mission>>;
