import * as T from 'three';
import { denPatrolWarp } from '../den/patrol';
import { createPatrolWarpCard, patrolAtlasFor, patrolBandAngle, patrolBandXs, type PatrolBand } from '../den/patrol-warp';
import { loadEncounterTexture } from '../encounter-texture';
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

function drawMesh(context: CanvasRenderingContext2D, points: readonly Point[], columns: number, selected = -1) {
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
    context.arc(p.x, p.y, grid * (i === selected ? 4 : 1.9), 0, 2 * Math.PI);
    const detail = columns === 7 && (i % columns === 1 || i % columns === 5);
    context.fillStyle = i === selected ? '#ffd280' : detail ? '#a7aaff' : '#a5f6e4';
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
  const play = element<HTMLButtonElement>('play'), follow = element<HTMLButtonElement>('follow');
  const editPose = element<HTMLSelectElement>('edit-pose'), editBand = element<HTMLSelectElement>('edit-band');
  const editPoint = element<HTMLSelectElement>('edit-point'), pointX = range('point-x'), bandY = range('band-y');
  const reset = element<HTMLButtonElement>('reset-pose'), copy = element<HTMLButtonElement>('copy-edits');
  const exportText = element<HTMLTextAreaElement>('export'), status = element('status');
  let renderer: T.WebGLRenderer | undefined;
  try {
    renderer = new T.WebGLRenderer({ canvas: preview, antialias: true, alpha: true });
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
  } catch {
    preview.replaceWith(Object.assign(document.createElement('p'), { textContent: 'The live blend needs WebGL 2.' }));
  }
  let atlas = patrolAtlasFor(1254, 1254), bands = [...atlas.rows];
  let texture: T.Texture | undefined;
  const edited = new Set<number>();
  const sourcePoints: Point[][] = [[], []];
  let manual = false, playing = false, direction = 1, frameId = 0, lastFrame = 0;
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
    drawMesh(context, points, atlas.grid.columns, selectedPoint);
  }

  function syncPointControls() {
    const { frame, band, point } = selected();
    const row = bands[frame][band], base = atlas.rows[frame][band];
    const xs = patrolBandXs(row, atlas.gutter), originalX = patrolBandXs(base, atlas.gutter)[point];
    pointX.min = String(rounded(Math.min(xs[point], Math.max(originalX - 28, (xs[point - 1] ?? -Infinity) + .2))));
    pointX.max = String(rounded(Math.max(xs[point], Math.min(originalX + 28, (xs[point + 1] ?? Infinity) - .2))));
    pointX.disabled = frame === 0 && point === Math.floor(atlas.grid.columns / 2);
    pointX.value = String(xs[point]);
    bandY.min = String(rounded(Math.max(base[0] - 18, (bands[frame][band - 1]?.[0] ?? -Infinity) + .2)));
    bandY.max = String(rounded(Math.min(base[0] + 18, (bands[frame][band + 1]?.[0] ?? Infinity) - .2)));
    bandY.value = String(row[0]);
    output('point-x').value = `${rounded(xs[point])} px`;
    output('band-y').value = `${rounded(row[0])} px`;
    reset.disabled = !edited.has(frame);
    copy.disabled = !edited.size;
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
    follow.disabled = !manual;
    const { band, point } = selected(), active = band * columns + point;
    for (const [pane, index] of [turn.first, turn.second].entries()) {
      const title = pane === 0 ? 'Outgoing' : 'Incoming';
      element(title.toLowerCase()).textContent = `${title} · Pose ${index + 1} · ${Math.round(index * 90 / (atlas.rows.length - 1))}°`;
      paintSource(sources[pane], index, pane, Number(editPose.value) === pane ? active : -1);
    }
    const mounts = card.pose(turn.angle, weight);
    if (renderer) {
      const size = Math.max(1, Math.round(preview.clientWidth * Math.min(2, devicePixelRatio)));
      if (preview.width !== size || preview.height !== size) renderer.setSize(size, size, false);
      renderer.render(scene, camera);
    }
    const size = square(overlay.canvas);
    overlay.clearRect(0, 0, size, size);
    if (showMesh.checked || !texture) {
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

  function meshFoldsNear(frame: number) {
    const { index, attributes: { position } } = card.root.geometry;
    const last = bands.length - 1;
    for (const sign of [-1, 1]) {
      for (let t = Math.max(0, frame - 1); t <= Math.min(last, frame + 1); t += .125) {
        card.pose(sign * t * (Math.PI / 2) / last);
        for (let i = 0; i < index!.count; i += 3) {
          const a = index!.getX(i), b = index!.getX(i + 1), c = index!.getX(i + 2);
          const ax = position.getX(a), ay = position.getY(a);
          if ((position.getX(b) - ax) * (position.getY(c) - ay) -
              (position.getY(b) - ay) * (position.getX(c) - ax) <= 0) return true;
        }
      }
    }
    return false;
  }

  function applyBands(frame: number, next: readonly PatrolBand[]) {
    const candidate = [...bands];
    candidate[frame] = next;
    try {
      card.setRegistration(atlas, candidate);
      if (meshFoldsNear(frame)) throw new Error('Folded mesh');
      bands = candidate;
      if (next === atlas.rows[frame]) edited.delete(frame);
      else edited.add(frame);
      exportText.hidden = true;
      status.textContent = texture ? '' : 'Patrol atlas unavailable. Control points are still editable.';
    } catch {
      card.setRegistration(atlas, bands);
      status.textContent = 'That edit would fold the mesh or move an anchor outside it.';
    }
    requestRender();
  }

  function editCoordinates() {
    setPlaying(false);
    const { frame, band, point } = selected();
    const { columns } = atlas.grid, center = Math.floor(columns / 2);
    const next = [...bands[frame]], xs = patrolBandXs(next[band], atlas.gutter);
    xs[point] = pointX.valueAsNumber;
    if (frame === 0) xs[columns - 1 - point] = -xs[point];
    const base = [bandY.valueAsNumber, rounded(xs[0] + atlas.gutter), xs[center],
      rounded(xs[columns - 1] - atlas.gutter), xs[center - 1], xs[center + 1]] as const;
    next[band] = columns === 7 ? [...base, xs[1], xs[5]] : base;
    applyBands(frame, next);
  }

  for (const field of [pointX, bandY]) field.addEventListener('input', editCoordinates);
  for (const field of [editPose, editBand, editPoint]) field.addEventListener('change', () => setPlaying(false));
  heading.addEventListener('input', () => setPlaying(false));
  blend.addEventListener('input', () => { manual = true; requestRender(); });
  follow.addEventListener('click', () => { manual = false; requestRender(); });
  play.addEventListener('click', () => setPlaying(!playing));
  showMesh.addEventListener('change', requestRender);
  reset.addEventListener('click', () => { const { frame } = selected(); applyBands(frame, atlas.rows[frame]); });
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
    bands = [...atlas.rows];
    edited.clear();
    texture = map;
    setPointOptions();
  }, undefined, controller.signal).then(() => {
    if (controller.signal.aborted) return;
    status.textContent = texture ? '' : 'Patrol atlas unavailable. Control points are still editable.';
    requestRender();
  });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    controller.abort();
    resize.disconnect();
    cancelAnimationFrame(frameId);
    texture?.dispose();
    card.root.geometry.dispose();
    card.root.material.dispose();
    renderer?.dispose();
  });
  requestRender();
}

if (import.meta.env.DEV) start();
