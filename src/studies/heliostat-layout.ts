import * as T from 'three';

export const LANE_HALF_WIDTH = 3.8;
export const STUDY_DURATION = 18;
export const CAMERA_FOV = 42;

export function cameraPose(progress: number) {
  const t = T.MathUtils.smoothstep(progress, 0, 1);
  return {
    position: new T.Vector3(0, -13 - t * 10, 24 - t * 17),
    target: new T.Vector3(0, 1 + t * 9, -2 + t * 5),
  };
}

/** During the study the hero bay passes the ship, then stops for the swing. */
export function bayTravel(time: number) {
  return -3.6 * T.MathUtils.smoothstep(time, 0, 7);
}

/** Presentation is deterministic: pause and scrub never need a wall clock. */
export function studyFrame(time: number) {
  const t = T.MathUtils.clamp(time, 0, STUDY_DURATION);
  return { time: t, progress: T.MathUtils.smoothstep(t, 5, 14) };
}
