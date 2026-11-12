export const ranks = {
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
// The order is also the row-major order of the optional portrait UI atlas.
export const rankAtlasOrder = Object.keys(ranks) as Rank[];
export const RANK_ATLAS_COLUMNS = 4;
export const RANK_ATLAS_ROWS = 3;
export const RANK_ATLAS_CELL = 128;

export function rankAtlasCell(rank: Rank) {
  const index = rankAtlasOrder.indexOf(rank);
  return { column: index % RANK_ATLAS_COLUMNS, row: Math.floor(index / RANK_ATLAS_COLUMNS) };
}
