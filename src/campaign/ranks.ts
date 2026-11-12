export const ranks = {
  specialist3: { name: 'Specialist 3', short: 'SPC3' },
  specialist4: { name: 'Specialist 4', short: 'SPC4' },
  sergeant: { name: 'Sergeant', short: 'SGT' },
  secondLt: { name: 'Second Lieutenant', short: '2LT' },
  firstLt: { name: 'First Lieutenant', short: '1LT' },
  captain: { name: 'Captain', short: 'CAPT' },
  major: { name: 'Major', short: 'MAJ' },
  colonel: { name: 'Colonel', short: 'COL' },
  brigadier: { name: 'Brigadier General', short: 'BRIG GEN' },
  solarMarshal: { name: 'Solar Marshal', short: 'SOLAR MARSHAL' },
  sectorMarshal: { name: 'Sector Marshal', short: 'SECTOR MARSHAL' },
  galacticMarshal: { name: 'Galactic Marshal', short: 'GALACTIC MARSHAL' },
} as const;

export type Rank = keyof typeof ranks;
// Specialist 3 is drawn in code so existing atlas cells keep their positions.
export const rankAtlasOrder: Rank[] = (Object.keys(ranks) as Rank[]).filter(rank => rank !== 'specialist3');
export const RANK_ATLAS_COLUMNS = 4;
export const RANK_ATLAS_ROWS = 3;
export const RANK_ATLAS_CELL = 128;

export function rankAtlasCell(rank: Rank) {
  const index = rankAtlasOrder.indexOf(rank);
  if (index < 0) return undefined;
  return { column: index % RANK_ATLAS_COLUMNS, row: Math.floor(index / RANK_ATLAS_COLUMNS) };
}
