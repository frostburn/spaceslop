export const CLOSE_CALLS_REQUIRED = 4;
export const HOT_DOCK_DISTANCE = 3;
export const HOT_DOCK_COOLDOWN = 3;

export type PilotLivery = Readonly<{ paint: number; trim: number; frame: number }>;

export const pilots = [
  {
    id: 'vex', name: 'Vex', color: '#88f2ff', perk: 'Close Call',
    livery: { paint: 0x319eaf, trim: 0xa1a9ab, frame: 0x273745 },
    description: `Graze ${CLOSE_CALLS_REQUIRED} enemy shots to earn one extra Pulse.`,
  },
  {
    id: 'brass', name: 'Brass', color: '#ffbd76', perk: 'Reinforcement',
    livery: { paint: 0xbd742f, trim: 0xe9bf84, frame: 0x463234 },
    description: 'Gain one bonus hull from your first surplus weapon pickup each sortie.',
  },
  {
    id: 'glint', name: 'Glint', color: '#dca2f8', perk: 'Hot Dock',
    livery: { paint: 0x9160be, trim: 0xd8b3ef, frame: 0x32274f },
    description: 'Move the drone a long distance to double its next attack.',
  },
] as const;

export type PilotId = typeof pilots[number]['id'];
