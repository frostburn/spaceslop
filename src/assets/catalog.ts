import type { LevelId } from '../levels';
import { missionFor, type OfficerId } from '../campaign/missions';

export const rankInsigniaFile = 'officers/rank-insignia.png';
export const officerPortraitFile = (id: OfficerId) => `officers/${id}.png`;
export const levelBriefingFiles = (id: LevelId) => [officerPortraitFile(missionFor[id].officer), rankInsigniaFile];

export const textureFiles = {
  fonsMane: 'encounters/fons-mane.png',
  fleetSky: 'encounters/fleet-starfield.png',
  fleetPlanets: 'encounters/fleet-planet-pair.png',
  fleetFlagship: 'encounters/fleet-pleiadian-flagship.png',
  fleetTrench: 'encounters/fleet-pleiadian-trench.png',
  fleetSaucer: 'encounters/fleet-saucer-alloy.png',
  denCliff: 'encounters/draconian-cliffside.webp',
  denDisk: 'encounters/draconian-accretion-disk.png',
  denBiker: 'encounters/draconian-biker-atlas.png',
  denGantry: 'encounters/draconian-gantry.png',
  denSky: 'encounters/draconian-galactic-center.png',
  denPatrol: 'encounters/draconian-patrol-turns.png',
  denProps: 'encounters/draconian-cliff-props.png',
  denDefenses: 'encounters/draconian-defenses.png',
  biolumeBackdrop:'encounters/biolume-backdrop.webp',
  biolumeForeground:'encounters/biolume-foreground.webp',
  biolumeEnemy:'encounters/biolume-glider.png',
  biolumePods:'encounters/biolume-study-atlas.png',
  biolumeBoss:'encounters/biolume-lantern-ray.png',
  biolumeFrog:'encounters/biolume-frog-atlas.png',
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
  blackHoleDisk: textureFiles.denDisk,
  biolumeBackdrop:'encounters/biolume-study-backdrop.png',
  biolumeForeground:'encounters/biolume-study-foreground.png',
  biolumeEnemy:'encounters/biolume-glider.png',
  biolumePods:'encounters/biolume-study-atlas.png',
  heliostatMetal: textureFiles.armor,
  heliostatCeramic: textureFiles.ioCeramic,
  heliostatBackdrop: textureFiles.heliostatBackdrop,
} as const;
export type StudyTexture = keyof typeof studyTextureFiles;

export const levelTextures: Record<LevelId, readonly EncounterTexture[]> = {
  wormhole: ['armor', 'titanChitin', 'fonsMane'],
  fleet: ['armor', 'fleetSky', 'fleetPlanets', 'fleetFlagship', 'fleetTrench', 'fleetSaucer'],
  den: ['armor', 'denCliff', 'denDisk', 'denBiker', 'denGantry', 'denSky', 'denPatrol', 'denProps', 'denDefenses'],
  biolume:['armor','biolumeBackdrop','biolumeForeground','biolumeEnemy','biolumePods','biolumeBoss','biolumeFrog'],
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
