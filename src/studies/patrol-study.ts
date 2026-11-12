import * as T from 'three';
import { denPatrolWarp } from '../den/patrol';
import {
  createPatrolWarpCard, PATROL_GRID_SIZE as columns, PATROL_VERTEX_COUNT, patrolAtlasFor, patrolGridPoint,
  patrolInteriorIndex, patrolMirrorPoint, type PatrolPoint, type PatrolRegistration,
} from '../den/patrol-warp';
import { loadEncounterTexture } from '../encounter-texture';
import { createPatrolDifference } from './patrol-difference';
import { meshFoldsNear, movePatrolPoint, patrolSourceSpan } from './patrol-registration';
import { tunePatrolHandoff } from './patrol-tuning';
import './patrol-study.css';

type Point = { x: number; y: number };
const halfView = 1.48;
const degrees = Math.PI / 180;
const element = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const range = (id: string) => element<HTMLInputElement>(id);
const output = (id: string) => element<HTMLOutputElement>(id + '-value');
const rounded = (value: number) => Math.round(value * 10) / 10;

function square(canvas: HTMLCanvasElement) {
  const size = Math.max(1, Math.round(canvas.clientWidth * Math.min(2, devicePixelRatio)));
  if (canvas.width !== size || canvas.height !== size) canvas.width = canvas.height = size;
  return size;
}

function drawMesh(context: CanvasRenderingContext2D, points: readonly Point[], selected = -1, paired = false, locked?: ReadonlySet<number>) {
  const grid = context.canvas.width / context.canvas.clientWidth;
  context.beginPath();
  for (const [i, p] of points.entries()) {
    if (i % columns < columns - 1) {
      context.moveTo(p.x, p.y);
      context.lineTo(points[i + 1].x, points[i + 1].y);
    }
    if (i + columns < points.length) {
      context.moveTo(p.x, p.y);
      context.lineTo(points[i + columns].x, points[i + columns].y);
    }
  }
  context.strokeStyle = '#89dedb88';
  context.lineWidth = grid;
  context.stroke();
  for (const [i, p] of points.entries()) {
    context.beginPath();
    context.arc(p.x, p.y, grid * 1.9, 0, 2 * Math.PI);
    context.fillStyle = patrolInteriorIndex(i) < 0 ? '#89a7b3' : '#a5f6e4';
    context.fill();
    if (locked?.has(i)) {
      const radius = grid * (i === selected ? 6 : 3.7);
      context.strokeStyle = '#ffd280';
      context.lineWidth = grid * 1.3;
      context.strokeRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    }
  }
  const point = points[selected];
  if (!point) return;
  context.beginPath();
  context.arc(point.x, point.y, grid * (paired ? 5 : 4), 0, 2 * Math.PI);
  context.strokeStyle = '#10202a';
  context.lineWidth = grid * 3;
  context.stroke();
  if (paired) {
    context.strokeStyle = '#ffd280';
    context.lineWidth = grid * 1.5;
    context.stroke();
  } else {
    context.fillStyle = '#ffd280';
    context.fill();
  }
}

function start() {
  const controller = new AbortController();
  const card = createPatrolWarpCard();
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-halfView, halfView, halfView, -halfView, .1, 10);
  camera.position.z = 5;
  scene.add(card.root);
  const preview = element<HTMLCanvasElement>('preview');
  const overlay = element<HTMLCanvasElement>('mesh').getContext('2d')!;
  const sources = ['pose-a', 'pose-b'].map(id => element<HTMLCanvasElement>(id).getContext('2d')!);
  const heading = range('heading'), blend = range('blend'), showMesh = range('show-mesh');
  const showDifference = range('show-difference'), score = element<HTMLOutputElement>('match-score');
  const previewTitle = element('preview-title'), viewport = overlay.canvas.parentElement!;
  const play = element<HTMLButtonElement>('play'), follow = element<HTMLButtonElement>('follow');
  const editPose = element<HTMLSelectElement>('edit-pose'), editPoint = element<HTMLSelectElement>('edit-point');
  const pointX = range('point-x'), pointY = range('point-y');
  const reset = element<HTMLButtonElement>('reset-pose'), copy = element<HTMLButtonElement>('copy-edits');
  const lockPoint = range('lock-point'), tuneScope = element<HTMLSelectElement>('tune-scope');
  const tune = element<HTMLButtonElement>('tune-start'), undoTune = element<HTMLButtonElement>('tune-undo');
  const tuneProgress = element<HTMLProgressElement>('tune-progress');
  const tuneScore = element<HTMLOutputElement>('tune-score'), tuneStatus = element('tune-status');
  const exportText = element<HTMLTextAreaElement>('export'), status = element('status');
  let renderer: T.WebGLRenderer | undefined;
  try {
    renderer = new T.WebGLRenderer({ canvas: preview, antialias: true, alpha: true });
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
  } catch {
    preview.replaceWith(Object.assign(document.createElement('p'), { textContent: 'The live blend needs WebGL 2.' }));
  }
  const difference = renderer && createPatrolDifference(renderer, scene, camera, card.root);
  let atlas = patrolAtlasFor(1254, 1254), registration: PatrolRegistration = atlas.interiors;
  let locks = registration.map(() => new Set<number>());
  let tuning: AbortController | undefined, tuneTask: Promise<void> | undefined;
  let beforeTune: PatrolRegistration | undefined;
  let texture: T.Texture | undefined;
  const edited = new Set<number>();
  const sourcePoints: Point[][] = [[], []];
  let manual = false, playing = false, direction = 1, frameId = 0, lastFrame = 0;
  let measuring = false;
  let sampled: { angle: number; registration: typeof registration; time: number } | undefined;
  editPoint.replaceChildren(...Array.from({ length: PATROL_VERTEX_COUNT }, (_, i) =>
    new Option(`R${Math.floor(i / columns) + 1} C${i % columns + 1}${patrolInteriorIndex(i) < 0 ? ' · edge' : ''}`, String(i))));
  editPoint.value = String(2 * columns + 4);
  card.setRegistration(atlas);

  const turnAt = () => denPatrolWarp(heading.valueAsNumber * degrees, atlas.crops.length);
  const selected = () => {
    const turn = turnAt();
    return {
      frame: editPose.value === '0' ? turn.first : turn.second,
      point: Number(editPoint.value),
    };
  };

  function paintSource(context: CanvasRenderingContext2D, frame: number, pane: number, selectedPoint: number) {
    const size = square(context.canvas);
    const [left, top, right, bottom, pivotX, pivotY] = atlas.crops[frame];
    const scale = size / patrolSourceSpan(atlas);
    const x = size / 2 - pivotX * scale, y = size / 2 - pivotY * scale;
    context.clearRect(0, 0, size, size);
    const image = texture?.image as HTMLImageElement | undefined;
    if (image) {
      const u = image.width / atlas.width, v = image.height / atlas.height;
      context.drawImage(image, left * u, top * v, (right - left) * u, (bottom - top) * v,
        x + left * scale, y + top * scale, (right - left) * scale, (bottom - top) * scale);
    }
    const points = Array.from({ length: PATROL_VERTEX_COUNT }, (_, point) => {
      const [u, v] = patrolGridPoint(atlas.crops[frame], registration[frame], point);
      return { x: x + (left + u) * scale, y: y + (top + v) * scale };
    });
    sourcePoints[pane] = points;
    drawMesh(context, points, selectedPoint, pane !== Number(editPose.value), locks[frame]);
  }

  function syncPointControls() {
    const { frame, point } = selected(), crop = atlas.crops[frame];
    const [x, y] = patrolGridPoint(crop, registration[frame], point);
    const fixed = patrolInteriorIndex(point) < 0, locked = locks[frame].has(point);
    const busy = Boolean(tuning);
    pointX.max = String(crop[2] - crop[0]);
    pointY.max = String(crop[3] - crop[1]);
    pointX.value = String(x);
    pointY.value = String(y);
    pointX.disabled = pointY.disabled = busy || fixed || locked;
    output('point-x').value = `${rounded(x)} px`;
    output('point-y').value = `${rounded(y)} px`;
    lockPoint.checked = fixed || locked;
    lockPoint.disabled = busy || fixed;
    for (const field of [heading, play, editPose, editPoint, tuneScope]) field.disabled = busy;
    const turn = turnAt();
    tune.disabled = tuning ? tuning.signal.aborted : !texture || !difference || turn.first === turn.second;
    reset.disabled = busy || (!edited.has(frame) && !locks[frame].size);
    copy.disabled = busy || !edited.size;
    undoTune.disabled = busy || !beforeTune;
  }

  function measureDifference(angle: number, now: number) {
    if (!difference || tuning || measuring || (sampled?.angle === angle && sampled.registration === registration)) return;
    if (playing && sampled && now - sampled.time < 100) return;
    const sample = { angle, registration, time: now };
    sampled = sample;
    measuring = true;
    const stillActive = () => !controller.signal.aborted && !tuning && showDifference.checked && sampled === sample;
    void difference.measure().then(value => {
      if (stillActive() && (playing || (turnAt().angle === angle && registration === sample.registration)))
        score.value = value === undefined ? 'Match unavailable' : `Match ${value.toFixed(1)}%`;
    }).catch(() => {
      if (stillActive()) score.value = 'Match unavailable';
    }).finally(() => {
      measuring = false;
      if (!controller.signal.aborted && showDifference.checked && (sampled !== sample || turnAt().angle !== angle || registration !== sample.registration))
        requestRender();
    });
  }

  function render(now: number) {
    frameId = 0;
    if (playing) {
      const next = heading.valueAsNumber + Math.min(.05, (now - lastFrame) / 1000) * 32 * direction;
      heading.value = String(T.MathUtils.clamp(next, -90, 90));
      if (next >= 90 || next <= -90) direction *= -1;
    }
    lastFrame = now;
    const turn = turnAt();
    if (!manual) blend.value = String(Math.round(turn.blend * 100));
    const weight = manual ? blend.valueAsNumber / 100 : turn.blend;
    output('heading').value = `${heading.valueAsNumber.toFixed(1)}°`;
    output('blend').value = `${Math.round(weight * 100)}%`;
    const comparing = Boolean(difference && texture && showDifference.checked);
    blend.disabled = comparing;
    follow.disabled = comparing || !manual;
    previewTitle.textContent = comparing ? 'Difference preview' : 'Blend preview';
    viewport.classList.toggle('difference', comparing);
    score.hidden = !comparing;
    const { point } = selected();
    for (const [pane, index] of [turn.first, turn.second].entries()) {
      const title = pane === 0 ? 'Outgoing' : 'Incoming';
      element(title.toLowerCase()).textContent = `${title} · Pose ${index + 1} · ${Math.round(index * 90 / (atlas.crops.length - 1))}°`;
      paintSource(sources[pane], index, pane, point);
    }
    const mounts = card.pose(turn.angle, weight);
    if (renderer) {
      const size = Math.max(1, Math.round(preview.clientWidth * Math.min(2, devicePixelRatio)));
      if (preview.width !== size || preview.height !== size) renderer.setSize(size, size, false);
      if (comparing && difference) {
        difference.render();
        measureDifference(turn.angle, now);
      } else renderer.render(scene, camera);
    }
    const meshVisible = showMesh.checked || !texture;
    overlay.canvas.style.visibility = meshVisible ? '' : 'hidden';
    if (meshVisible) {
      const size = square(overlay.canvas);
      overlay.clearRect(0, 0, size, size);
      const cos = Math.cos(turn.angle), sin = Math.sin(turn.angle), scale = size / (2 * halfView);
      const project = (x: number, y: number) => ({
        x: size / 2 + scale * (cos * x - sin * y),
        y: size / 2 - scale * (sin * x + cos * y),
      });
      const position = card.root.geometry.attributes.position;
      drawMesh(overlay, Array.from({ length: position.count }, (_, i) => project(position.getX(i), position.getY(i))),
        turn.mirror ? patrolMirrorPoint(point) : point);
      for (const mount of mounts ?? []) {
        const p = project(mount.x, mount.y);
        overlay.beginPath();
        overlay.arc(p.x, p.y, 4 * size / overlay.canvas.clientWidth, 0, 2 * Math.PI);
        overlay.strokeStyle = '#ffb55c';
        overlay.stroke();
      }
    }
    syncPointControls();
    if (playing) requestRender();
  }

  function requestRender() {
    if (!frameId) frameId = requestAnimationFrame(render);
  }

  function setPlaying(value: boolean) {
    playing = value;
    lastFrame = performance.now();
    play.textContent = value ? 'Pause turn' : 'Play turn';
    requestRender();
  }

  function commitRegistration(next: PatrolRegistration, changedFrame?: number) {
    card.setRegistration(atlas, next);
    if (changedFrame !== undefined && meshFoldsNear(card, changedFrame, registration.length - 1)) throw new Error('Folded mesh');
    registration = next;
    edited.clear();
    registration.forEach((rows, frame) => {
      if (rows !== atlas.interiors[frame]) edited.add(frame);
    });
    exportText.hidden = true;
    requestRender();
  }

  function applyPose(frame: number, next: readonly PatrolPoint[], quiet = false) {
    const candidate = [...registration];
    candidate[frame] = next;
    try {
      commitRegistration(candidate, frame);
      clearTuneHistory();
      status.textContent = texture ? '' : 'Patrol atlas unavailable. Control points are still editable.';
      return true;
    } catch {
      card.setRegistration(atlas, registration);
      if (!quiet) status.textContent = 'That edit would fold the mesh or move an anchor outside it.';
      requestRender();
      return false;
    }
  }

  function editCoordinates(event: Event) {
    if (tuning) return;
    const { frame, point } = selected();
    if (patrolInteriorIndex(point) < 0 || locks[frame].has(point)) return;
    setPlaying(false);
    const [x, y] = patrolGridPoint(atlas.crops[frame], registration[frame], point);
    const next = movePatrolPoint(atlas, frame, registration[frame], point,
      event.target === pointX ? pointX.valueAsNumber : x, event.target === pointY ? pointY.valueAsNumber : y);
    if (next !== registration[frame]) applyPose(frame, next);
  }

  function clearTuneHistory() {
    beforeTune = undefined;
    tuneScore.value = '';
    tuneStatus.textContent = '';
  }

  async function startTune() {
    const { first, second } = turnAt();
    if (!renderer || !texture || !difference || first === second) return;
    const initial = registration;
    const run = new AbortController();
    tuning = run;
    const { point } = selected();
    setPlaying(false);
    showDifference.checked = true;
    sampled = undefined;
    score.value = 'Tuning…';
    tuneStatus.textContent = '';
    tuneScore.value = '';
    tuneProgress.removeAttribute('value');
    tuneProgress.hidden = false;
    tune.textContent = 'Stop tuning';
    syncPointControls();
    let finished = false, measured = false;
    try {
      await tunePatrolHandoff({
        renderer, texture, camera, atlas, initial, locks, first, selectedPoint: point,
        wholeHandoff: tuneScope.value === 'all', signal: run.signal,
        onProgress: (next, before, best, completed, total) => {
          measured = true;
          if (next !== registration) {
            commitRegistration(next);
            beforeTune = initial;
          }
          tuneProgress.max = total;
          tuneProgress.value = completed;
          tuneScore.value = `Handoff match ${before.toFixed(2)}% → ${best.toFixed(2)}%`;
        },
      });
      finished = true;
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error);
        tuneStatus.textContent = 'The handoff could not be measured.';
      }
    } finally {
      tuning = undefined;
      if (!controller.signal.aborted) {
        if (finished) {
          tuneStatus.textContent = run.signal.aborted ? 'Tuning stopped.' : !measured ? 'All points in the search area are locked.'
            : registration === initial ? 'No improving move found.' : 'Tuning complete.';
        }
        tuneProgress.hidden = true;
        tune.textContent = 'Tune handoff';
        sampled = undefined;
        score.value = 'Measuring…';
        requestRender();
      }
    }
  }

  for (const field of [pointX, pointY]) field.addEventListener('input', editCoordinates);
  for (const field of [editPose, editPoint]) field.addEventListener('change', () => setPlaying(false));
  heading.addEventListener('input', () => setPlaying(false));
  blend.addEventListener('input', () => { manual = true; requestRender(); });
  follow.addEventListener('click', () => { manual = false; requestRender(); });
  play.addEventListener('click', () => setPlaying(!playing));
  showMesh.addEventListener('change', requestRender);
  showDifference.addEventListener('change', () => {
    sampled = undefined;
    score.value = tuning ? 'Tuning…' : 'Measuring…';
    requestRender();
  });
  lockPoint.addEventListener('change', () => {
    const { frame, point } = selected();
    if (patrolInteriorIndex(point) < 0) return;
    const points = frame === 0 ? [point, patrolMirrorPoint(point)] : [point];
    for (const p of points) {
      if (lockPoint.checked) locks[frame].add(p);
      else locks[frame].delete(p);
    }
    clearTuneHistory();
    setPlaying(false);
  });
  tune.addEventListener('click', () => {
    if (tuning) {
      tuning.abort();
      tune.disabled = true;
    } else tuneTask = startTune();
  });
  undoTune.addEventListener('click', () => {
    if (!tuning && beforeTune) {
      commitRegistration(beforeTune);
      clearTuneHistory();
      tuneStatus.textContent = 'Tuning undone.';
    }
  });
  reset.addEventListener('click', () => {
    const { frame } = selected();
    if (applyPose(frame, atlas.interiors[frame])) locks[frame].clear();
  });
  copy.addEventListener('click', async () => {
    exportText.value = JSON.stringify(Object.fromEntries([...edited].map(frame => [frame, registration[frame]])), null, 2);
    try {
      await navigator.clipboard.writeText(exportText.value);
      status.textContent = 'Copied the 36 interior points of each edited pose, in crop-local pixels.';
    } catch {
      exportText.hidden = false;
      exportText.select();
    }
  });
  sources.forEach(({ canvas }, pane) => {
    let drag: {
      pointer: number; frame: number; point: number; interior: readonly PatrolPoint[];
      start: Point; origin: PatrolPoint; last: Point; moved: boolean;
    } | undefined;

    function canvasPosition(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left - canvas.clientLeft) * canvas.width / canvas.clientWidth,
        y: (event.clientY - rect.top - canvas.clientTop) * canvas.height / canvas.clientHeight,
      };
    }

    canvas.addEventListener('pointerdown', event => {
      if (tuning || drag || !event.isPrimary || event.button !== 0) return;
      const start = canvasPosition(event);
      let nearest = -1, distance = 12 * canvas.width / canvas.clientWidth;
      for (const [i, point] of sourcePoints[pane].entries()) {
        const d = Math.hypot(start.x - point.x, start.y - point.y);
        if (d < distance) { distance = d; nearest = i; }
      }
      if (nearest < 0) return;
      editPose.value = String(pane);
      editPoint.value = String(nearest);
      const { frame } = selected();
      setPlaying(false);
      if (patrolInteriorIndex(nearest) < 0 || locks[frame].has(nearest)) {
        status.textContent = patrolInteriorIndex(nearest) < 0 ? 'The edge of the grid is fixed.' : 'This point is locked.';
        return;
      }
      const interior = registration[frame], origin = patrolGridPoint(atlas.crops[frame], interior, nearest);
      drag = { pointer: event.pointerId, frame, point: nearest, interior, start, origin, last: { x: origin[0], y: origin[1] }, moved: false };
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', event => {
      if (!drag || drag.pointer !== event.pointerId || tuning) return;
      const { frame, point, interior, start, origin, last } = drag;
      if (selected().frame !== frame || locks[frame].has(point)) return;
      const position = canvasPosition(event), scale = patrolSourceSpan(atlas) / canvas.width;
      const dx = position.x - start.x, dy = position.y - start.y;
      if (!drag.moved && Math.hypot(dx, dy) < 2 * canvas.width / canvas.clientWidth) return;
      drag.moved = true;
      const target = { x: origin[0] + dx * scale, y: origin[1] + dy * scale };
      const attempt = ({ x, y }: Point) => {
        const next = movePatrolPoint(atlas, frame, interior, point, x, y);
        return next === registration[frame] || applyPose(frame, next, true);
      };
      if (attempt(target)) {
        drag.last = target;
        return;
      }
      // A fast pointer motion can land past the valid region. Keep the
      // farthest valid position along that move instead of dropping the drag.
      let lower = 0, upper = 1;
      for (let i = 0; i < 7; i++) {
        const t = (lower + upper) / 2;
        const step = { x: T.MathUtils.lerp(last.x, target.x, t), y: T.MathUtils.lerp(last.y, target.y, t) };
        if (attempt(step)) {
          lower = t;
          drag.last = step;
        } else upper = t;
      }
      status.textContent = 'Drag limited by the mesh or an anchor.';
    });

    canvas.addEventListener('lostpointercapture', () => { drag = undefined; });
  });

  const resize = new ResizeObserver(requestRender);
  resize.observe(sources[0].canvas);
  resize.observe(overlay.canvas);
  void loadEncounterTexture('denPatrol', map => {
    const image = map.image as HTMLImageElement;
    card.setArt(map);
    atlas = patrolAtlasFor(image.width, image.height);
    registration = atlas.interiors;
    locks = registration.map(() => new Set<number>());
    clearTuneHistory();
    edited.clear();
    texture = map;
    showDifference.disabled = !difference;
  }, undefined, controller.signal).then(() => {
    if (controller.signal.aborted) return;
    status.textContent = texture ? '' : 'Patrol atlas unavailable. Control points are still editable.';
    requestRender();
  });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    controller.abort();
    tuning?.abort();
    resize.disconnect();
    cancelAnimationFrame(frameId);
    const dispose = () => {
      texture?.dispose();
      card.root.geometry.dispose();
      card.root.material.dispose();
      difference?.dispose();
      renderer?.dispose();
    };
    if (tuning && tuneTask) void tuneTask.finally(dispose);
    else dispose();
  });
  requestRender();
}

if (import.meta.env.DEV) start();
