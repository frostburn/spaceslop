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
  recordSteering?: (x: number, y: number, target: Flight['steeringTarget']) => void;
  recordDrone?: (x: number, y: number) => void;
}
const DRAG_THRESHOLD_PX = 5;

export function bindFlightInput(canvas: HTMLCanvasElement, context: InputContext, signal: AbortSignal) {
  const keys = new Set<string>();
  let pointer: {
    id: number;
    x: number;
    y: number;
    dragging: boolean;
    steered: boolean;
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
    canvas.setPointerCapture(event.pointerId);
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
      steered: false
    };
  }, { signal });
  function movePointer(event: PointerEvent) {
    if (pointer?.id !== event.pointerId)
      return;
    const dx = event.clientX - pointer.x;
    const dy = pointer.y - event.clientY;
    if (!dx && !dy) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    if (!pointer.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX)
        return;
      pointer.dragging = true;
      context.flight().clearAim();
    }
    context.flight().aimBy(dx * WIDTH / width, dy * HEIGHT / height);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }
  canvas.addEventListener('pointermove', movePointer, { signal });
  canvas.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    movePointer(event);
    if (!pointer.dragging) {
      const { left, top, width, height } = canvas.getBoundingClientRect();
      if (width && height) {
        const flight = context.flight();
        flight.deployDrone(((pointer.x - left) / width - .5) * WIDTH, (.5 - (pointer.y - top) / height) * HEIGHT);
        if (import.meta.env.DEV && flight.droneTarget) {
          context.recordDrone?.(flight.droneTarget.x, flight.droneTarget.y);
        }
      }
    } else if (pointer.steered) {
      context.flight().clearAim();
    }
    pointer = undefined;
  }, { signal });
  for (const type of ['pointercancel', 'lostpointercapture'] as const)
    canvas.addEventListener(type, event => {
      if (pointer?.id !== event.pointerId)
        return;
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
    else if (event.code === 'Space' && (event.target === canvas || event.target === document.body)) {
      event.preventDefault();
      if (!event.repeat) context.pulse();
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
      const flight = context.flight();
      if (import.meta.env.DEV) context.recordSteering?.(x, y, flight.steeringTarget);
      flight.steer(x, y, dt);
      if (pointer?.dragging) {
        pointer.steered = true;
      } else {
        // A swipe entirely between ticks gets just this one speed-limited step.
        flight.clearAim();
      }
    }
  };
}
