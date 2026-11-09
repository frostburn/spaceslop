import * as T from 'three';

// Tilt the view, not the flight surface. The oblique frustum keeps every point
// on z=0 at its simulation x/y while revealing real height and occlusion.
export function tiltFlightCamera(camera: T.PerspectiveCamera, distance: number, pitch: number, plane: T.Quaternion) {
  const cosine = Math.cos(pitch), tangent = Math.tan(pitch), p = camera.projectionMatrix.elements;
  p[5] /= cosine;
  p[6] = p[10] * tangent;
  p[7] = p[11] * tangent;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.position.set(0, -Math.sin(pitch) * distance, cosine * distance).applyQuaternion(plane);
  camera.up.set(0, cosine, Math.sin(pitch)).applyQuaternion(plane);
  camera.lookAt(0, 0, 0);
}

// The same projection in flight-plane coordinates, for cosmetic laser tracing.
export function flightProjection(distance: number | undefined, pitch: number, target: T.Matrix4) {
  const reciprocal = distance ? 1 / (distance * Math.cos(pitch)) : 0;
  return target.set(1, 0, 0, 0, 0, 1, Math.tan(pitch), 0, 0, 0, 0, 0, 0, 0, -reciprocal, 1);
}
