import type { LevelId } from '../levels';
export const textureFiles = {
  summerMammoth:'encounters/summer-mammoth.png',
  summerIce:'encounters/summer-ice.png',
  summerHydra:'encounters/summer-hydra.png',
  summerLotusFlanks:'encounters/summer-lotus-flanks.png',
  summerLotusWall:'encounters/summer-lotus-wall.png',
  heliostatBackdrop:'encounters/heliostat-uranus-backdrop.png',
  heliostatGuard:'encounters/heliostat-manowar.png',
  boulevardRoad:'encounters/boulevard-asphalt.png',
  ventMortar: 'encounters/vent-barnacle.png',
  ventFauna: 'encounters/vent-fauna.png',
  ventWorm: 'encounters/vent-worm.png',
  ventCrab: 'encounters/vent-crab.png',
  ventAtlas: 'encounters/vent-formations.png',
  ventExtras: 'encounters/vent-formations-extra.png',
  ioBasalt: 'encounters/io-basalt.png',
  ioCeramic: 'encounters/io-ceramic.png',
  armor: 'encounters/interceptor-metal.png',
  feathers: 'encounters/feather-vane.png',
  scales: 'encounters/draconian-scales.png',
  hive: 'encounters/broodlock-foreground.png',
  hiveMask: 'encounters/broodlock-mines-mask.png',
  hiveStars: 'encounters/broodlock-stars.png',
  hiveMines: 'encounters/broodlock-mines.png',
  chitin: 'encounters/ant-chitin.png',
  fungus: 'encounters/broodlock-fungus.png',
  mold: 'encounters/ant-mold.png',
  ice: 'encounters/frostwake-ice.png',
  rock: 'encounters/frostwake-rock.png',
  galaxy: 'encounters/frostwake-galaxy.png',
  marine: 'encounters/marine-hide.png',
  titan: 'encounters/titan-research-ground-10screens.png',
  titanRobot: 'encounters/titan-maintenance-parts.png',
  titanChitin: 'encounters/titan-chitin.png',
} as const;
export type EncounterTexture = keyof typeof textureFiles;

// Study aliases share the catalog's media paths; only the study loader is DEV.
export const studyTextureFiles = {
  heliostatMetal: textureFiles.armor,
  heliostatCeramic: textureFiles.ioCeramic,
  heliostatBackdrop: textureFiles.heliostatBackdrop,
} as const;
export type StudyTexture = keyof typeof studyTextureFiles;

export const levelTextures: Record<LevelId, readonly EncounterTexture[]> = {
  summer:['armor','summerMammoth','summerIce','summerHydra','summerLotusFlanks','summerLotusWall'],
  heliostat:['armor','ioCeramic','heliostatBackdrop','heliostatGuard'],
  boulevard:['armor','boulevardRoad'],
  preserve: ['armor', 'feathers', 'scales'],
  broodlock: ['armor', 'hive', 'hiveMask', 'hiveStars', 'hiveMines', 'chitin', 'fungus', 'mold'],
  ice: ['armor', 'ice', 'rock', 'galaxy', 'marine'],
  titan: ['armor', 'titan', 'titanRobot', 'titanChitin'],
  io: ['armor', 'ioBasalt', 'ioCeramic'],
  vents: ['armor', 'ventAtlas', 'ventExtras', 'ventMortar', 'ventFauna', 'ventWorm', 'ventCrab'],
};
