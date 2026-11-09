import * as T from 'three';

export const LANE_HALF_WIDTH = 3.8;
export const ROUTE_DURATION = 100;
export const SWING_DURATION = 8;
export const STUDY_DURATION = ROUTE_DURATION + SWING_DURATION;
export const BAY_SPACING = 28;
export const ROUTE_SPEED = BAY_SPACING / 10;
export const CAMERA_FOV = 42;

export function cameraPose(progress: number) {
  const t = T.MathUtils.smoothstep(progress, 0, 1);
  return {
    position: new T.Vector3(0, -13 - t * 10, 24 - t * 17),
    target: new T.Vector3(0, 1 + t * 9, -2 + t * 5),
  };
}

/** Constant straight flight, followed by a continuous deceleration to rest. */
export function bayTravel(time: number) {
  const t = T.MathUtils.clamp(time,0,STUDY_DURATION), u = T.MathUtils.clamp((t-ROUTE_DURATION)/SWING_DURATION,0,1);
  return -ROUTE_SPEED * (Math.min(t,ROUTE_DURATION) + SWING_DURATION * (u-u*u+u*u*u/3));
}

export const ROUTE_END = -bayTravel(STUDY_DURATION);

export function routeSection(time: number) {
  return time < 20 ? 'Docking spine' : time < 45 ? 'Generator galleries' : time < 70 ? 'Heat exchange'
    : time < 100 ? 'Containment approach' : time < STUDY_DURATION ? 'Camera swing' : 'Stellar collector';
}

export function studyTimeAtSwing(progress: number) {
  const target = T.MathUtils.clamp(progress,0,1); let low=0,high=1;
  if(target===0)return ROUTE_DURATION;if(target===1)return STUDY_DURATION;
  for(let i=0;i<30;i++){const mid=(low+high)/2;if(T.MathUtils.smoothstep(mid,0,1)<target)low=mid;else high=mid;}
  return ROUTE_DURATION + (low+high)*.5*SWING_DURATION;
}

/** Presentation is deterministic: pause and scrub never need a wall clock. */
export function studyFrame(time: number) {
  const t = T.MathUtils.clamp(time, 0, STUDY_DURATION);
  return { time: t, progress: T.MathUtils.smoothstep(t, ROUTE_DURATION, STUDY_DURATION) };
}
