import { createHeliostatView, type StudyOptions } from './studies/heliostat-view';
import { loadStudyArt } from './studies/heliostat-assets';
import { studyFrame, STUDY_DURATION } from './studies/heliostat-layout';

if (import.meta.env.DEV) {
  const canvas = document.querySelector<HTMLCanvasElement>('#preview')!;
  const slider = document.querySelector<HTMLInputElement>('#swing')!;
  const play = document.querySelector<HTMLButtonElement>('#play')!;
  const clock = document.querySelector<HTMLOutputElement>('#clock')!;
  const angle = document.querySelector<HTMLOutputElement>('#angle')!;
  const assets = document.querySelector<HTMLParagraphElement>('#assets')!;
  const error = document.querySelector<HTMLParagraphElement>('#error')!;
  const lifetime = new AbortController(), { signal } = lifetime;
  let raf = 0, time = 0, progress = 0, playing = false, last = 0;
  let observer: ResizeObserver | undefined, view: ReturnType<typeof createHeliostatView> | undefined;
  let preparation: Promise<void> = Promise.resolve();
  const options: StudyOptions = { artwork: true, sky: true, distant: true, corridor: true, wireframe: false };

  const stop = () => { playing = false; play.textContent = 'Play study'; play.setAttribute('aria-pressed', 'false'); };
  function draw() {
    view?.draw(time, progress);
    angle.value = `${Math.round(progress * 100)}%`;
    clock.value = `${time.toFixed(1)} s · ${progress < .01 ? 'Flight' : progress > .99 ? 'Head-on' : 'Swing'}`;
    document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(button => {
      button.setAttribute('aria-pressed', String(Math.abs(Number(button.dataset.pose) - progress) < .005));
    });
  }
  function cleanup() {
    if (signal.aborted) return;
    lifetime.abort(); cancelAnimationFrame(raf); observer?.disconnect();
    void preparation.finally(() => view?.dispose());
  }
  window.addEventListener('pagehide', cleanup, { signal });
  // pagehide releases GPU state, including when the browser caches this page.
  const restore = (event: PageTransitionEvent) => { if (event.persisted) location.reload(); };
  window.addEventListener('pageshow', restore);
  import.meta.hot?.dispose(() => { cleanup(); window.removeEventListener('pageshow', restore); });
  try {
    view = createHeliostatView(canvas);
    slider.addEventListener('input', () => { stop(); progress = slider.valueAsNumber; draw(); }, { signal });
    document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(button => {
      button.addEventListener('click', () => { stop(); progress = Number(button.dataset.pose); slider.value = String(progress); draw(); }, { signal });
    });
    for (const id of Object.keys(options) as (keyof StudyOptions)[]) {
      document.querySelector<HTMLInputElement>('#' + id)!.addEventListener('change', event => {
        options[id] = (event.target as HTMLInputElement).checked; view?.setOptions(options); draw();
      }, { signal });
    }
    play.addEventListener('click', () => {
      if (playing) stop();
      else { if (time >= STUDY_DURATION) time = 0; playing = true; play.textContent = 'Pause'; play.setAttribute('aria-pressed', 'true'); }
    }, { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }, { signal });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); stop(); error.hidden = false;
      error.textContent = 'Graphics context lost. Reload the study to recreate its scene.';
    }, { signal });
    observer = new ResizeObserver(draw); observer.observe(canvas); draw();
    function animate(now: number) {
      if (signal.aborted) return;
      if (playing) {
        time = Math.min(STUDY_DURATION, time + Math.min(.05, (now - last) / 1000));
        progress = studyFrame(time).progress; slider.value = String(progress); draw();
        if (time >= STUDY_DURATION) stop();
      }
      last = now; raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);
    preparation = loadStudyArt(signal).then(async art => {
      if (signal.aborted) return;
      view!.setArt(art); draw();
      assets.textContent = `${Object.keys(art).length}/3 artwork files loaded · missing files use solid procedural stand-ins.`;
      await view!.warmup();
    }).catch(reason => {
      if (signal.aborted) return;
      assets.textContent = 'Artwork unavailable · procedural stand-ins active.';
      console.warn('Uranus study artwork preparation:', reason);
    });
  } catch (reason) {
    cleanup(); error.hidden = false; error.textContent = 'Unable to start the WebGL study. Reload to try again.';
    console.error(reason);
  }
} else document.body.textContent = 'The Uranus corridor study is available only in Vite dev mode.';
