import * as T from 'three';
import { denPatrolWarp } from '../den/patrol';
import { createPatrolWarpCard, patrolAtlasFor, patrolBandAngle, patrolBandXs, type PatrolBand } from '../den/patrol-warp';
import { loadEncounterTexture } from '../encounter-texture';
import { createPatrolDifference } from './patrol-difference';
import { bandHasLock, bandLimits, meshFoldsNear, pointLimits, replaceBandPoint, roundPatrolCoordinate, type PatrolBands } from './patrol-registration';
import { tunePatrolHandoff } from './patrol-tuning';
import './patrol-study.css';

type Point = { x: number; y: number };
const halfView = 1.48;
const degrees = Math.PI / 180;
const element = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const range = (id: string) => element<HTMLInputElement>(id);
const output = (id: string) => element<HTMLOutputElement>(id + '-value');
const rounded = roundPatrolCoordinate;

function square(canvas: HTMLCanvasElement) {
  const size = Math.max(1, Math.round(canvas.clientWidth * Math.min(2, devicePixelRatio)));
  if (canvas.width !== size || canvas.height !== size) canvas.width = canvas.height = size;
  return size;
}

function drawMesh(context: CanvasRenderingContext2D, points: readonly Point[], columns: number, selected = -1, paired = false, locked?: ReadonlySet<number>) {
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
    const detail = columns === 7 && (i % columns === 1 || i % columns === 5);
    context.fillStyle = detail ? '#a7aaff' : '#a5f6e4';
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
  const editPose = element<HTMLSelectElement>('edit-pose'), editBand = element<HTMLSelectElement>('edit-band');
  const editPoint = element<HTMLSelectElement>('edit-point'), pointX = range('point-x'), bandY = range('band-y');
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
  let atlas = patrolAtlasFor(1254, 1254), bands: PatrolBands = atlas.rows;
  let locks = bands.map(() => new Set<number>());
  let tuning: AbortController | undefined, tuneTask: Promise<void> | undefined;
  let beforeTune: PatrolBands | undefined;
  let texture: T.Texture | undefined;
  const edited = new Set<number>();
  const sourcePoints: Point[][] = [[], []];
  let manual = false, playing = false, direction = 1, frameId = 0, lastFrame = 0;
  let measuring = false;
  let sampled: { angle: number; bands: typeof bands; time: number } | undefined;
  editBand.replaceChildren(...bands[0].map((_, i) => new Option(String(i + 1), String(i))));
  editBand.value = '12';
  card.setRegistration(atlas);

  function setPointOptions() {
    const { columns } = atlas.grid;
    const names = columns === 7
      ? ['Left margin', 'Left outer detail', 'Left interior', 'Center', 'Right interior', 'Right outer detail', 'Right margin']
      : ['Left margin', 'Left interior', 'Center', 'Right interior', 'Right margin'];
    editPoint.replaceChildren(...names.map((name, i) => new Option(name, String(i))));
    editPoint.value = String(Math.floor(columns / 2));
  }
  setPointOptions();

  const turnAt = () => denPatrolWarp(heading.valueAsNumber * degrees, atlas.rows.length);
  const selected = () => {
    const turn = turnAt();
    return {
      frame: editPose.value === '0' ? turn.first : turn.second,
      band: Number(editBand.value),
      point: Number(editPoint.value),
    };
  };

  function paintSource(context: CanvasRenderingContext2D, frame: number, pane: number, selectedPoint: number) {
    const size = square(context.canvas);
    const [left, top, right, bottom, pivotX, pivotY] = atlas.crops[frame];
    const scale = size / (atlas.width === atlas.height ? 336 : 570);
    const x = size / 2 - pivotX * scale, y = size / 2 - pivotY * scale;
    context.clearRect(0, 0, size, size);
    const image = texture?.image as HTMLImageElement | undefined;
    if (image) {
      const u = image.width / atlas.width, v = image.height / atlas.height;
      context.drawImage(image, left * u, top * v, (right - left) * u, (bottom - top) * v,
        x + left * scale, y + top * scale, (right - left) * scale, (bottom - top) * scale);
    }
    const angle = patrolBandAngle(atlas, frame), cos = Math.cos(angle), sin = Math.sin(angle);
    const points = bands[frame].flatMap(row => patrolBandXs(row, atlas.gutter).map(u => ({
      x: size / 2 + scale * (cos * u - sin * row[0]),
      y: size / 2 + scale * (sin * u + cos * row[0]),
    })));
    sourcePoints[pane] = points;
    drawMesh(context, points, atlas.grid.columns, selectedPoint, pane !== Number(editPose.value), locks[frame]);
  }

  function syncPointControls() {
    const { frame, band, point } = selected();
    const row = bands[frame][band], { columns } = atlas.grid;
    const xs = patrolBandXs(row, atlas.gutter);
    const locked = locks[frame].has(band * columns + point);
    const busy = Boolean(tuning);
    const [minX, maxX] = pointLimits(atlas, row, frame, band, point);
    const [minY, maxY] = bandLimits(atlas, bands[frame], frame, band);
    pointX.min = String(minX);
    pointX.max = String(maxX);
    pointX.disabled = busy || locked || (frame === 0 && point === Math.floor(columns / 2));
    pointX.value = String(xs[point]);
    bandY.min = String(minY);
    bandY.max = String(maxY);
    bandY.disabled = busy || bandHasLock(locks[frame], columns, band);
    bandY.value = String(row[0]);
    output('point-x').value = `${rounded(xs[point])} px`;
    output('band-y').value = `${rounded(row[0])} px`;
    lockPoint.checked = locked;
    for (const field of [heading, play, editPose, editBand, editPoint, lockPoint, tuneScope]) field.disabled = busy;
    const turn = turnAt();
    tune.disabled = tuning ? tuning.signal.aborted : !texture || !difference || turn.first === turn.second;
    reset.disabled = busy || (!edited.has(frame) && !locks[frame].size);
    copy.disabled = busy || !edited.size;
    undoTune.disabled = busy || !beforeTune;
  }

  function measureDifference(angle: number, now: number) {
    if (!difference || tuning || measuring || (sampled?.angle === angle && sampled.bands === bands)) return;
    if (playing && sampled && now - sampled.time < 100) return;
    const sample = { angle, bands, time: now };
    sampled = sample;
    measuring = true;
    const stillActive = () => !controller.signal.aborted && !tuning && showDifference.checked && sampled === sample;
    void difference.measure().then(value => {
      if (stillActive() && (playing || (turnAt().angle === angle && bands === sample.bands)))
        score.value = value === undefined ? 'Match unavailable' : `Match ${value.toFixed(1)}%`;
    }).catch(() => {
      if (stillActive()) score.value = 'Match unavailable';
    }).finally(() => {
      measuring = false;
      if (!controller.signal.aborted && showDifference.checked && (sampled !== sample || turnAt().angle !== angle || bands !== sample.bands))
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
    const { columns } = atlas.grid;
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
    const { band, point } = selected(), active = band * columns + point;
    for (const [pane, index] of [turn.first, turn.second].entries()) {
      const title = pane === 0 ? 'Outgoing' : 'Incoming';
      element(title.toLowerCase()).textContent = `${title} · Pose ${index + 1} · ${Math.round(index * 90 / (atlas.rows.length - 1))}°`;
      paintSource(sources[pane], index, pane, active);
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
      drawMesh(overlay, Array.from({ length: position.count }, (_, i) => project(position.getX(i), position.getY(i))), columns,
        turn.mirror ? band * columns + columns - 1 - point : active);
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

  function commitBands(next: PatrolBands, changedFrame?: number) {
    card.setRegistration(atlas, next);
    if (changedFrame !== undefined && meshFoldsNear(card, changedFrame, bands.length - 1)) throw new Error('Folded mesh');
    bands = next;
    edited.clear();
    bands.forEach((rows, frame) => {
      if (rows !== atlas.rows[frame]) edited.add(frame);
    });
    exportText.hidden = true;
    requestRender();
  }

  function applyBands(frame: number, next: readonly PatrolBand[]) {
    const candidate = [...bands];
    candidate[frame] = next;
    try {
      commitBands(candidate, frame);
      clearTuneHistory();
      status.textContent = texture ? '' : 'Patrol atlas unavailable. Control points are still editable.';
      return true;
    } catch {
      card.setRegistration(atlas, bands);
      status.textContent = 'That edit would fold the mesh or move an anchor outside it.';
      requestRender();
      return false;
    }
  }

  function editCoordinates(event: Event) {
    if (tuning) return;
    setPlaying(false);
    const { frame, band, point } = selected();
    const next = [...bands[frame]], row = next[band];
    const [, ...rest] = row;
    next[band] = event.target === bandY ? [bandY.valueAsNumber, ...rest]
      : replaceBandPoint(atlas, row, frame, point, pointX.valueAsNumber);
    applyBands(frame, next);
  }

  function clearTuneHistory() {
    beforeTune = undefined;
    tuneScore.value = '';
    tuneStatus.textContent = '';
  }

  async function startTune() {
    const { first, second } = turnAt();
    if (!renderer || !texture || !difference || first === second) return;
    const initial = bands;
    const run = new AbortController();
    tuning = run;
    const { band } = selected();
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
        renderer, texture, camera, atlas, initial, locks, first, selectedBand: band,
        wholeHandoff: tuneScope.value === 'all', signal: run.signal,
        onProgress: (next, before, best, completed, total) => {
          measured = true;
          if (next !== bands) {
            commitBands(next);
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
            : bands === initial ? 'No improving move found.' : 'Tuning complete.';
        }
        tuneProgress.hidden = true;
        tune.textContent = 'Tune handoff';
        sampled = undefined;
        score.value = 'Measuring…';
        requestRender();
      }
    }
  }

  for (const field of [pointX, bandY]) field.addEventListener('input', editCoordinates);
  for (const field of [editPose, editBand, editPoint]) field.addEventListener('change', () => setPlaying(false));
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
    const { frame, band, point } = selected();
    const { columns } = atlas.grid;
    const points = frame === 0 ? [point, columns - 1 - point] : [point];
    for (const p of points) {
      const index = band * columns + p;
      if (lockPoint.checked) locks[frame].add(index);
      else locks[frame].delete(index);
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
      commitBands(beforeTune);
      clearTuneHistory();
      tuneStatus.textContent = 'Tuning undone.';
    }
  });
  reset.addEventListener('click', () => {
    const { frame } = selected();
    if (applyBands(frame, atlas.rows[frame])) locks[frame].clear();
  });
  copy.addEventListener('click', async () => {
    exportText.value = JSON.stringify(Object.fromEntries([...edited].map(frame => [frame, bands[frame]])), null, 2);
    try {
      await navigator.clipboard.writeText(exportText.value);
      status.textContent = 'Copied edited bands by zero-based pose index.';
    } catch {
      exportText.hidden = false;
      exportText.select();
    }
  });
  sources.forEach(({ canvas }, pane) => canvas.addEventListener('pointerdown', event => {
    if (tuning) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * canvas.width / rect.width;
    const y = (event.clientY - rect.top) * canvas.height / rect.height;
    let nearest = -1, distance = 12 * canvas.width / rect.width;
    for (const [i, point] of sourcePoints[pane].entries()) {
      const d = Math.hypot(x - point.x, y - point.y);
      if (d < distance) { distance = d; nearest = i; }
    }
    if (nearest < 0) return;
    const { columns } = atlas.grid;
    editPose.value = String(pane);
    editBand.value = String(Math.floor(nearest / columns));
    editPoint.value = String(nearest % columns);
    setPlaying(false);
  }));

  const resize = new ResizeObserver(requestRender);
  resize.observe(sources[0].canvas);
  resize.observe(overlay.canvas);
  void loadEncounterTexture('denPatrol', map => {
    const image = map.image as HTMLImageElement;
    card.setArt(map);
    atlas = patrolAtlasFor(image.width, image.height);
    bands = atlas.rows;
    locks = bands.map(() => new Set<number>());
    clearTuneHistory();
    edited.clear();
    texture = map;
    showDifference.disabled = !difference;
    setPointOptions();
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
