import * as T from 'three';
import { part, pivot } from './rig-geometry';

const plume = new T.LatheGeometry([
  new T.Vector2(0, -1), new T.Vector2(0.18, -0.83), new T.Vector2(0.47, -0.56),
  new T.Vector2(0.8, -0.28), new T.Vector2(1, -0.06), new T.Vector2(0.85, 0),
], 10);

export function burnerMaterial(color: number) {
  return new T.ShaderMaterial({
    uniforms: { jetColor: { value: new T.Color(color) } },
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    vertexShader: `
      varying float vAlong;
      varying vec3 vNormal, vView;
      void main() {
        vec4 eye = modelViewMatrix * vec4(position, 1.0);
        vAlong = uv.y;
        vNormal = normalMatrix * normal;
        vView = -eye.xyz;
        gl_Position = projectionMatrix * eye;
      }
    `,
    fragmentShader: `
      uniform vec3 jetColor;
      varying float vAlong;
      varying vec3 vNormal, vView;
      void main() {
        float center = max(0.0, dot(normalize(vNormal), normalize(vView)));
        float fade = smoothstep(0.0, 0.86, vAlong);
        vec3 heat = mix(jetColor, vec3(1.0, 0.98, 0.87), pow(vAlong, 4.0) * center);
        gl_FragColor = vec4(heat, fade * (0.32 + 0.54 * center));
        #include <colorspace_fragment>
      }
    `,
  });
}

export function addBurner(
  root: T.Group, material: T.ShaderMaterial, x: number, y: number, z: number, radius: number, length: number,
) {
  const nozzle = pivot(root, 'burner_nozzle', x, y, z);
  const flame = part(nozzle, plume, material, 0, 0, 0);
  flame.userData.radius = radius;
  flame.userData.length = length;
  flame.scale.set(radius, length * 0.5, radius);
  return nozzle;
}

export function shipBurners(root: T.Group) {
  const burners: T.Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof T.Mesh && node.geometry === plume) burners.push(node);
  });
  return burners;
}

export function poseBurners(burners: T.Mesh[], time: number, throttle: number) {
  for (const [index, flame] of burners.entries()) {
    const phase = time * 25 + index * 1.7;
    const flicker = Math.sin(phase) * 0.07 + Math.sin(phase * 1.83) * 0.035;
    const width = flame.userData.radius * (0.78 + throttle * 0.22 + flicker);
    const length = flame.userData.length * (0.24 + throttle * 0.76 + flicker);
    flame.scale.set(width, length, width);
  }
}
