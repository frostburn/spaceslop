import * as T from 'three';
import { flagshipEngines, hullPoint, type FleetHull } from './route';

export function createFlagshipEngines(clock: { value: number }) {
  // Coordinates are in bore radii, with the nozzle center at the origin.
  const geometry = new T.PlaneGeometry(7, 10).translate(0, -3.8, 0);
  return (hull: FleetHull, trench: boolean, ship: number) => {
    const { radius, mounts } = trench ? flagshipEngines.trench : flagshipEngines.broadside;
    return mounts.map(([u, v], index) => {
      const nozzle = hullPoint(hull, u, v);
      const material = new T.ShaderMaterial({
        uniforms: {
          clock, phase: { value: ship * 2.17 + index * 1.68 },
          cant: { value: (index === 0 ? 1 : -1) * (trench ? 2.0 : .12) },
        },
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: `
          varying vec2 nozzleXY;
          void main() {
            nozzleXY = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform float clock, phase, cant;
          varying vec2 nozzleXY;
          void main() {
            float t = clock + phase;
            float pulse = .86 + .09 * sin(t * 9.1) + .045 * sin(t * 17.2);
            float bore = length(nozzleXY * vec2(1.0, 1.1));
            float throat = (1.0 - smoothstep(.25, 1.03, bore)) * pulse;
            float ring = (bore - .74) * 7.4;
            float rim = exp(-ring * ring)
              * (.60 + .40 * cos(6.0 * atan(nozzleXY.y, nozzleXY.x + .00001) - t * 3.7));
            float along = -nozzleXY.y;
            float plumeLength = 6.8 + .58 * sin(t * 2.7) + .24 * sin(t * 6.1);
            float travel = clamp(along / plumeLength, 0.0, 1.0);
            float flicker = sin(along * 4.2 - t * 15.0) * sin(along * 2.1 - t * 8.3);
            float center = nozzleXY.x - cant * travel - .11 * travel * flicker;
            float width = mix(.69, .31, travel) + .19 * sin(3.1416 * travel);
            float band = .78 + .22 * cos(along * 5.6 - t * 15.3);
            float flow = smoothstep(-.15, .65, along) * (1.0 - smoothstep(.15, 1.0, travel)) * pulse;
            float core = (1.0 - smoothstep(.03, width, abs(center))) * flow * band;
            float glow = (1.0 - smoothstep(width * .25, width * 3.6, abs(center))) * flow;
            float light = core * .87 + throat * .42;
            float alpha = light + glow * .47 + rim * .17;
            if (alpha < .003) discard;
            gl_FragColor = vec4(mix(vec3(.045, .29, 1.0), vec3(.75, .98, 1.0), clamp(light, 0.0, 1.0)), min(alpha, 1.0));
            #include <colorspace_fragment>
          }`,
      });
      const engine = new T.Mesh(geometry, material);
      engine.name = 'fleet-flagship-exhaust';
      engine.position.set(nozzle.x - hull.x, nozzle.y - hull.y, .045);
      engine.scale.setScalar(radius * hull.width);
      return engine;
    });
  };
}
