export const CLOSE_CALLS_REQUIRED = 4;
export const HOT_DOCK_DISTANCE = 3;
export const HOT_DOCK_COOLDOWN = 3;

export const pilots = [
  {
    id: 'vex', name: 'Vex', color: '#88f2ff', perk: 'Close Call',
    description: `Graze ${CLOSE_CALLS_REQUIRED} enemy shots to earn one extra Pulse.`,
  },
  {
    id: 'brass', name: 'Brass', color: '#ffbd76', perk: 'Field Repair',
    description: 'Replace a wing weapon while damaged to repair one hull per stage.',
  },
  {
    id: 'glint', name: 'Glint', color: '#dca2f8', perk: 'Hot Dock',
    description: 'Move the drone a long distance to double its next attack.',
  },
] as const;

export type PilotId = typeof pilots[number]['id'];
