import * as T from 'three';
import type { StudyTexture } from './assets/catalog';
import { createBlackHoleMaterial } from './studies/black-hole-material';
import { loadStudyTexture } from './studies/heliostat-assets';
import './black-hole-study.css';

declare const __STUDY_TEXTURES__: Partial<Record<StudyTexture, string>>;

function openBlackHoleStudy() {
  const canvas = document.querySelector<HTMLCanvasElement>('#preview')!;
  const mode = document.querySelector<HTMLSelectElement>('#mode')!;
  const inclination = document.querySelector<HTMLInputElement>('#inclination')!;
  const angle = document.querySelector<HTMLOutputElement>('#angle')!;
  const status = document.querySelector<HTMLElement>('#disk-status')!;
  const error = document.querySelector<HTMLElement>('#error')!;
  let renderer: T.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({canvas, powerPreference: 'low-power'});
  } catch {
    error.textContent = 'This study needs WebGL 2.';
    error.hidden = false;
    return;
  }

  const controller = new AbortController();
  const {signal} = controller;
  const lens = createBlackHoleMaterial();
  const scene = new T.Scene();
  const camera = new T.Camera();
  const geometry = new T.PlaneGeometry(2, 2);
  const quad = new T.Mesh(geometry, lens.material);
  quad.frustumCulled = false;
  scene.add(quad);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  function draw() {
    if (signal.aborted) return;
    const uniforms = lens.material.uniforms;
    uniforms.mode.value = Number(mode.value);
    uniforms.inclination.value = T.MathUtils.degToRad(inclination.valueAsNumber);
    inclination.disabled = mode.value === '2';
    canvas.classList.toggle('lensed', mode.value === '0');
    angle.value = `${inclination.value}°`;
    renderer.render(scene, camera);
  }
  mode.addEventListener('change', draw, {signal});
  inclination.addEventListener('input', draw, {signal});
  function resizeFrame() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height || signal.aborted) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(width, height, false);
    const shortSide = Math.min(width, height);
    lens.material.uniforms.frameScale.value.set(width / shortSide, height / shortSide);
    draw();
  }
  const resize = new ResizeObserver(resizeFrame);
  resize.observe(canvas);
  resizeFrame();

  let startTime: number | undefined;
  renderer.setAnimationLoop(now => {
    startTime ??= now;
    const rotation = (now - startTime) * .00018;
    lens.material.uniforms.diskRotation.value.set(Math.cos(rotation), Math.sin(rotation));
    renderer.render(scene, camera);
  });

  let art: T.Texture | undefined;
  const path = __STUDY_TEXTURES__.blackHoleDisk;
  if (path) void loadStudyTexture(import.meta.env.BASE_URL + path, signal).then(texture => {
    if (!texture) return;
    if (signal.aborted) {
      texture.dispose();
      return;
    }
    art = texture;
    lens.material.uniforms.diskArt.value = art;
    lens.material.uniforms.useArt.value = true;
    status.textContent = 'Raster disk';
    draw();
  });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    controller.abort();
    resize.disconnect();
    renderer.setAnimationLoop(null);
    art?.dispose();
    geometry.dispose();
    lens.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }, {signal});
}

if (import.meta.env.DEV) openBlackHoleStudy();
