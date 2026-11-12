import * as T from 'three';
import { BOSS_Y, BOSS_DEPTH, type Flight } from '../game';
export type TextureResult = T.Texture | undefined;
export interface LevelFrame {
  flight: Flight;
  time: number;
  reveal: number;
  animationTime: number;
  distance: number;
  elapsed: number;
  newFlight: boolean;
  fighterSpeed: number;
  droneSpeed: number;
  victory?: { time: number; fighter: Readonly<T.Vector3>; drone: Readonly<T.Vector3> };
}
export interface LevelScene {
  root: T.Group;
  boss: T.Group;
  victoryBoss?: T.Group; // The Wormhole has a second, final boss.
  models: (T.Object3D | undefined)[];
  ready: Promise<TextureResult[]>;
  stageDistance: number;
  fixedCamera?: boolean; // Keep the camera aligned with the flight plane through the approach.
  farDistance?: number;
  background?: number;
  key?: number;
  sky?: number;
  ground?: number;
  friendlyGlow?: number;
  keyIntensity?: number;
  skyIntensity?: number;
  toneMapping?: T.ToneMapping;
  exposure?: number;
  surfaces?: T.Group[];
  applyArmor?: (texture: T.Texture) => void;
  reveal?: (time: number, normal: number) => number;
  orientation?: (time: number, reveal: number) => {
    pitch: number;
    bank: number;
    viewPitch?: number;
  };
  shipPitch?: number;
  dronePitch?: number;
  prepare?: () => void;
  afterWarmup?: () => void;
  warmup: T.Object3D[][];
  contacts: T.Object3D[];
  update: (frame: LevelFrame) => void;
  contact: (x: number, distance: number, flight: Flight) => {
    x: number;
    y: number;
    z?: number;
  };
  capture?: (renderer: T.WebGLRenderer, camera: T.Camera) => void;
  present?: (renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera) => void;
  effects?: (plane: T.Group, sources: readonly T.Mesh[], frame: LevelFrame, renderer: T.WebGLRenderer) => void;
  dispose?: () => void;
}
export interface LevelContext {
  signal: AbortSignal;
  plane: T.Group;
  scene: T.Scene;
  fighter: T.Group;
}
export type LevelFactory = (context: LevelContext) => LevelScene;
export function addRoots(root: T.Group, ...items: (T.Object3D | {
  root: T.Object3D;
})[]) {
  for (const item of items)
    root.add('root' in item ? item.root : item);
}
export function genericBoss(boss: T.Group, f: Flight, reveal: number) {
  boss.visible = reveal > 0 && (f.bossHealth > 0 || f.phase === 'won');
  boss.position.set(0, BOSS_Y, BOSS_DEPTH - 70 * (1 - reveal));
  boss.rotation.x = .9 * (1 - reveal);
}
