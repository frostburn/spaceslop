import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { poseBurners, shipBurners } from './burners';
import { createInterceptorRig, createRaptorRig } from './encounter-rigs';
import { loadEncounterTextures } from './encounter-texture';
import {
  BOSS_FIRE_AT, BOSS_RECOIL_TIME, BOSS_VOLLEY_INTERVAL, BOSS_WINDUP_AT, RAPTOR_FLARE_END, raptorFlight,
} from './encounters';
import { BOSS_CANNON_X, TRANSITION_TIME } from './game';
import { createDroneRig, createFighterRig, createScoutRig } from './ship-rigs';
import './workshop.css';

function element<T extends HTMLElement>(id: string) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

function openWorkshop(renderer: T.WebGLRenderer, canvas: HTMLCanvasElement) {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(39, 1, 0.05, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  scene.background = new T.Color(0x0b1020);
  const light = new T.DirectionalLight(0xb9e8ff, 2.7);
  light.position.set(3, 5, 6);
  scene.add(light, new T.HemisphereLight(0xd6e3ff, 0x514873, 1.75));

  const raptor = createRaptorRig();
  const interceptor = createInterceptorRig(BOSS_CANNON_X);
  const interceptorBurners = shipBurners(interceptor.root);
  loadEncounterTextures(interceptor, raptor);
  raptor.root.rotation.z = Math.PI;
  const scout = createScoutRig();
  scout.rotation.z = Math.PI;

  function shipAsset(root: T.Group) {
    const burners = shipBurners(root);
    poseBurners(burners, 1, 1);
    return {
      root,
      duration: 2,
      bounds: new T.Box3().setFromObject(root),
      pose(time: number) {
        const throttle = Math.sin(time * Math.PI / 2) ** 2;
        poseBurners(burners, time, throttle);
        return throttle > 0.6 ? 'boost' : 'cruise';
      },
    };
  }

  const assets = {
    fighter: shipAsset(createFighterRig().root),
    scout: shipAsset(scout),
    drone: shipAsset(createDroneRig()),
    raptor: {
      root: raptor.root,
      duration: RAPTOR_FLARE_END,
      pose(time: number) {
        raptor.pose(time);
        return raptorFlight(time).pose;
      },
    },
    interceptor: {
      root: interceptor.root,
      duration: TRANSITION_TIME + BOSS_VOLLEY_INTERVAL + BOSS_FIRE_AT + BOSS_RECOIL_TIME,
      pose(time: number) {
        const reveal = Math.min(1, time / TRANSITION_TIME);
        const eased = reveal ** 2 * (3 - 2 * reveal);
        const fight = Math.max(0, time - TRANSITION_TIME);
        const cycle = Math.floor(fight / BOSS_VOLLEY_INTERVAL);
        const elapsed = fight % BOSS_VOLLEY_INTERVAL;
        const cannon = cycle % 2 === 0 ? -BOSS_CANNON_X : BOSS_CANNON_X;
        const fired = elapsed >= BOSS_FIRE_AT;
        const windup = fired ? 0 : Math.max(0, (elapsed - BOSS_WINDUP_AT) / (BOSS_FIRE_AT - BOSS_WINDUP_AT));
        const recoil = fired ? Math.max(0, 1 - (elapsed - BOSS_FIRE_AT) / BOSS_RECOIL_TIME) : 0;
        interceptor.pose(eased, windup, fired ? -cannon : cannon, fired ? cannon : 0, recoil);
        poseBurners(interceptorBurners, time, 0.42 + 0.48 * Math.sin(eased * Math.PI));
        if (reveal < 1) return 'reveal';
        if (recoil > 0) return 'recoil';
        return windup > 0 ? 'windup' : 'ready';
      },
    },
  };
  for (const asset of Object.values(assets)) scene.add(asset.root);
  const assetSelect = element<HTMLSelectElement>('asset');
  const timeline = element<HTMLInputElement>('timeline');
  const play = element<HTMLButtonElement>('play');
  const motion = element('motion-controls');
  const pose = element<HTMLOutputElement>('pose');
  const wireframe = element<HTMLInputElement>('wireframe');
  let selected: (typeof assets)[keyof typeof assets] = assets.raptor;
  let time = 0;
  let playing = false;
  const gameView = new T.Vector3(0, 0, 1);
  const angleView = new T.Vector3(0.68, 0.42, 1);
  const sideView = new T.Vector3(1, 0, 0);
  let cameraView = gameView;

  function updatePose() {
    const label = selected.pose(time);
    if (pose.value !== label) pose.value = label;
  }

  function fitCamera(direction: T.Vector3) {
    cameraView = direction;
    const box = 'bounds' in selected ? selected.bounds : new T.Box3().setFromObject(selected.root);
    const bounds = box.getBoundingSphere(new T.Sphere());
    const vertical = T.MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const distance = bounds.radius * 1.07 / Math.sin(Math.min(horizontal, vertical));
    controls.target.copy(bounds.center);
    camera.position.copy(direction).normalize().multiplyScalar(distance).add(bounds.center);
    controls.minDistance = bounds.radius * 0.5;
    controls.maxDistance = distance * 3;
    controls.update();
  }

  function setPlaying(active: boolean) {
    playing = active;
    play.textContent = active ? 'Pause' : 'Play';
  }

  function selectAsset() {
    const key = assetSelect.value;
    selected = Object.hasOwn(assets, key) ? assets[key as keyof typeof assets] : assets.raptor;
    for (const asset of Object.values(assets)) asset.root.visible = asset === selected;
    time = 0;
    motion.hidden = selected.duration === 0;
    timeline.max = String(selected.duration);
    timeline.value = '0';
    setPlaying(false);
    updatePose();
    fitCamera(gameView);
  }

  assetSelect.addEventListener('change', selectAsset);
  element('game-view').addEventListener('click', () => fitCamera(gameView));
  element('angle-view').addEventListener('click', () => fitCamera(angleView));
  element('side-view').addEventListener('click', () => fitCamera(sideView));
  play.addEventListener('click', () => setPlaying(!playing));
  timeline.addEventListener('input', () => {
    setPlaying(false);
    time = timeline.valueAsNumber;
    updatePose();
  });
  wireframe.addEventListener('change', () => {
    scene.traverse((node) => {
      if (!(node instanceof T.Mesh)) return;
      for (const material of [node.material].flat() as T.Material[]) {
        if ('wireframe' in material) material.wireframe = wireframe.checked;
      }
    });
  });

  function resize() {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    fitCamera(cameraView);
  }

  selectAsset();
  resize();
  new ResizeObserver(resize).observe(canvas);

  let previous = performance.now();
  renderer.setAnimationLoop((now) => {
    if (playing) {
      time = (time + Math.min((now - previous) / 1000, 0.1)) % selected.duration;
      timeline.value = String(time);
      updatePose();
    }
    previous = now;
    controls.update();
    renderer.render(scene, camera);
  });
}

if (import.meta.env.DEV) {
  const canvas = element<HTMLCanvasElement>('preview');
  let renderer: T.WebGLRenderer | undefined;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
  } catch {
    element('viewer-error').hidden = false;
  }
  if (renderer) openWorkshop(renderer, canvas);
}
