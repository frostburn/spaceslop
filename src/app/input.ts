import type { Flight } from '../game';
import { WIDTH, HEIGHT } from '../playfield';
const directions: Record<string, readonly [
  number,
  number
]> = {
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, 1],
  KeyW: [0, 1],
  ArrowDown: [0, -1],
  KeyS: [0, -1],
};
interface InputContext {
  flight: () => Flight;
  active: () => boolean;
  pause: () => void;
  pulse: () => void;
}
export function bindFlightInput(canvas: HTMLCanvasElement, context: InputContext, signal: AbortSignal) {
  const keys = new Set<string>();
  let pointer: {
    id: number;
    x: number;
    y: number;
    dragging: boolean;
  } | undefined;
  function reset() {
    if (pointer && canvas.hasPointerCapture(pointer.id))
      canvas.releasePointerCapture(pointer.id);
    pointer = undefined;
    keys.clear();
    context.flight().clearAim();
  }
  canvas.addEventListener('pointerdown', event => {
    if (!context.active() || context.flight().phase === 'won' || pointer || event.button !== 0)
      return;
    const { left, top, width, height } = canvas.getBoundingClientRect();
    if (!width || !height)
      return;
    canvas.setPointerCapture(event.pointerId);
    context.flight().deployDrone(((event.clientX - left) / width - .5) * WIDTH, (.5 - (event.clientY - top) / height) * HEIGHT);
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragging: false
    };
  }, { signal });
  canvas.addEventListener('pointermove', event => {
    if (pointer?.id !== event.pointerId)
      return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height)
      return;
    const dx = event.clientX - pointer.x;
    const dy = pointer.y - event.clientY;
    if (!pointer.dragging) {
      if (Math.hypot(dx, dy) < 5)
        return;
      pointer.dragging = true;
      context.flight().clearAim();
    }
    context.flight().aimBy(dx * WIDTH / width, dy * HEIGHT / height);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }, { signal });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
    canvas.addEventListener(type, event => {
      if (pointer?.id !== event.pointerId)
        return;
      if (type !== 'pointerup' && pointer.dragging)
        context.flight().clearAim();
      pointer = undefined;
    }, { signal });
  window.addEventListener('keydown', event => {
    if (!context.active())
      return;
    if (event.code === 'Escape') {
      event.preventDefault();
      context.pause();
    }
    else if (event.code === 'Space' && !event.repeat) {
      event.preventDefault();
      context.pulse();
    }
    else if (Object.hasOwn(directions, event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  }, { signal });
  window.addEventListener('keyup', event => keys.delete(event.code), { signal });
  return {
    reset, steer(dt: number) {
      let x = 0;
      let y = 0;
      for (const key of keys) {
        x += directions[key][0];
        y += directions[key][1];
      }
      context.flight().steer(x, y, dt);
    }
  };
}
