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
    level: 'broodlock', pilotRank: 'specialist3', officer: 'davi-morel',
    brief: 'Belt Depot Omicron has sent a distress signal. Help the crew clear the loading tunnels.',
    objective: 'Cross the infected hive and take down the Brood Guardian.',
  },
  {
    level: 'io', pilotRank: 'specialist4', officer: 'rhys-vale',
    brief: 'The sulfur works won’t shut down for maintenance. Unless we stop the engine, the whole installation will purge on schedule.',
    objective: 'Follow the sulfur conveyors and disable the Caldera Engine.',
  },
  {
    level: 'vents', pilotRank: 'specialist4', officer: 'ilaria-bellandi',
    brief: 'There’s a survey cable beneath Europa’s ice. Follow it past the black smokers. A giant crab has made its home at the drop.',
    objective: 'Follow the survey cable to the abyss and secure the site.',
  },
  {
    level: 'titan', pilotRank: 'specialist4', officer: 'davi-morel',
    brief: 'The research station is signaling for help. Its uplink keeps replacing the distress calls with a clear-skies report. Get above the haze and bring back the raw transmission.',
    objective: 'Reach the uplink above the clouds and defeat the cicada.',
  },
  {
    level: 'heliostat', pilotRank: 'sergeant', officer: 'sen-orra',
    brief: 'I signed the override so an evacuation fleet could get home. Now the regulator takes orders from a dead station. Go easy. That star heats the entire planetary base.',
    objective: 'Switch the artificial star’s regulator to local control.',
  },
  {
    level: 'ice', pilotRank: 'secondLt', officer: 'rhys-vale',
    brief: 'A distress flare went up in the H₂O mines six minutes ago. Investigate and engage if necessary.',
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
    brief: 'High Command is under attack in Miami. Neutralize the terrorists with extreme prejudice.',
    objective: 'Get through the boulevard and shake the pursuit cruiser.',
  },
  {
    level: 'biolume', pilotRank: 'firstLt', officer: 'leda-tran',
    brief: 'The Grove keeps its traffic off the network. Disable the dark data center.',
    objective: 'Cross the Grove and reach the relay in the Dark Crown.',
  },
  {
    level: 'fleet', pilotRank: 'firstLt', officer: 'malik-adebayo',
    brief: 'We have a ceasefire with the Grays for one prisoner exchange. Both fleets have just received orders to break it in my voice. The flagship’s stern is open if they start shooting.',
    objective: 'Fly through the flagship’s trench and disable the Gray command saucer.',
  },
  {
    level: 'den', pilotRank: 'captain', officer: 'vaelith-oruen',
    brief: 'The Gantry Chief keeps a Draconian rookery above the last gate. Someone’s hacked his command beacon. Bring the mob back in line.',
    objective: 'Reach the chief’s gantry and secure passage to the last gate.',
  },
  {
    level: 'wormhole', pilotRank: 'captain', officer: 'arruv',
    brief: 'The return channel is replaying the forged order in Malik’s voice. Follow the echo to its source and break the override before it answers again.',
    objective: 'Follow the signal through the wormhole and clear the anomaly.',
  },
];

export const missionFor = Object.fromEntries(campaign.map(mission => [mission.level, mission])) as Readonly<Record<LevelId, Mission>>;
