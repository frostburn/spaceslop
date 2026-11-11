import * as T from 'three';
import type { StudyTexture } from '../../assets/catalog';
import { createDenBiker } from '../../den/biker';
import { createDenScenery } from '../../den/scenery';
import { BOSS_CAMERA_DISTANCE } from '../../game';
import { loadStudyTexture } from '../../studies/heliostat-assets';
import type { LevelFactory } from '../level';

declare const __STUDY_TEXTURES__: Partial<Record<StudyTexture, string>>;

export const createLevel: LevelFactory = ({ signal }) => {
  const scenery = createDenScenery();
  const biker = createDenBiker();
  const root = new T.Group();
  root.name = 'draconian-den-gantry';
  root.add(scenery.root, biker.root);

  async function load(name: StudyTexture, apply: (texture: T.Texture) => void) {
    const path = __STUDY_TEXTURES__[name];
    if (!path) return;
    const map = await loadStudyTexture(import.meta.env.BASE_URL + path, signal);
    if (!map) return;
    if (signal.aborted) { map.dispose(); return; }
    apply(map);
    return map;
  }
  const ready = Promise.all([
    load('blackHoleDisk', scenery.setDisk),
    load('denSky', scenery.setSky),
    load('denGantry', scenery.setPlate),
    load('denBiker', map => {
      map.wrapS = map.wrapT = T.ClampToEdgeWrapping;
      biker.setArt(map);
    }),
  ]).then(([, , , atlas]) => [...scenery.textures, atlas]);

  return {
    root,
    boss: biker.root,
    models: [],
    ready,
    stageDistance: BOSS_CAMERA_DISTANCE,
    fixedCamera: true,
    orientation: (_time, reveal) => ({ pitch: .09 * (1 - reveal), bank: .06 * (1 - reveal), viewPitch: -.08 * (1 - reveal) }),
    key: 0xffc69b,
    sky: 0x9dc3ff,
    ground: 0x4d2844,
    keyIntensity: 2.7,
    skyIntensity: 1.54,
    toneMapping: T.ACESFilmicToneMapping,
    exposure: 1.12,
    contacts: [],
    warmup: [[scenery.root], [biker.root]],
    update({ flight, reveal, animationTime }) {
      scenery.update(reveal, animationTime);
      biker.pose(flight.denBossTime, flight.bossHealth > 0);
    },
    contact: (_x, _distance, flight) => ({ x: flight.exposedCannonX, y: flight.bossAimY, z: .85 }),
  };
};
