import * as T from 'three';
import { loadEncounterTexture } from '../encounter-texture';
import { HEIGHT, WIDTH } from '../playfield';
import { fallbackFleetPlanets, fallbackFleetSky } from './placeholder';
import { FLEET_CAMERA_DISTANCE } from './route';

export function placeFleetPlate(distance: number, depth: number, mesh: T.Mesh, x = 0, y = 0) {
  const factor = 1 - depth / distance;
  mesh.position.set(x * factor, y * factor, depth);
  mesh.scale.setScalar(factor);
}

export function createFleetSky(signal: AbortSignal) {
  const root = new T.Group();
  const skyFallback = fallbackFleetSky(), pairFallback = fallbackFleetPlanets();
  const sky = new T.MeshBasicMaterial({ map: skyFallback, depthWrite: false, toneMapped: false });
  const uniforms = {
    map: { value: pairFallback as T.Texture },
    globe: { value: new T.Vector3(122 / 320, 1 - 120 / 320, 92 / 320) },
    moon: { value: new T.Vector3(245 / 320, 1 - 243 / 320, 43 / 320) },
    sun: { value: new T.Vector3() },
  };
  const pair = new T.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      varying vec2 artUV;
      void main() {
        artUV = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 globe, moon, sun;
      varying vec2 artUV;
      vec3 sphericalShade(vec3 disc) {
        vec2 p = (artUV - disc.xy) / disc.z;
        float r2 = dot(p, p);
        vec3 normal = normalize(vec3(p, sqrt(max(0.0, 1.0 - r2))));
        float day = smoothstep(-.17, .62, dot(normal, sun));
        vec3 shadow = mix(vec3(.07, .105, .17), vec3(.34, .45, .66), smoothstep(.99, 1.08, r2));
        return mix(vec3(1.0), mix(shadow, vec3(1.0), day), 1.0 - smoothstep(1.10, 1.26, r2));
      }
      void main() {
        vec4 art = texture2D(map, artUV);
        if (art.a < .015) discard;
        gl_FragColor = vec4(art.rgb * sphericalShade(globe) * sphericalShade(moon), art.a);
        #include <colorspace_fragment>
      }`,
  });

  const stars = new T.Mesh(new T.PlaneGeometry(WIDTH, HEIGHT), sky);
  stars.name = 'fleet-starfield';
  stars.renderOrder = -20;
  placeFleetPlate(FLEET_CAMERA_DISTANCE, -125, stars);
  const planets = new T.Mesh(new T.PlaneGeometry(12, 12), pair);
  planets.name = 'fleet-drifting-planets';
  planets.renderOrder = -15;
  root.add(stars, planets);

  const maps = Promise.all([
    loadEncounterTexture('fleetSky', texture => {
      sky.map = texture;
      sky.needsUpdate = true;
      skyFallback.dispose();
    }, undefined, signal),
    loadEncounterTexture('fleetPlanets', texture => {
      uniforms.map.value = texture;
      // Disc centers and radii registered in the original square artwork.
      uniforms.globe.value.set(.381, .599, .306);
      uniforms.moon.value.set(.757, .224, .151);
      pairFallback.dispose();
    }, undefined, signal),
  ]).then(() => [sky.map, uniforms.map.value]);

  return {
    root, maps,
    update(time: number) {
      const roll = -.13 + .0067 * time;
      planets.rotation.z = roll;
      placeFleetPlate(FLEET_CAMERA_DISTANCE, -94, planets,
        -.45 + 1.6 * Math.sin(time * .032 - .4), -2.35 + 1.05 * Math.cos(time * .024 + 1));
      // Convert the fixed upper-left key into the rotating image's UV frame.
      const c = Math.cos(roll), s = Math.sin(roll);
      uniforms.sun.value.set(-.67 * c + .58 * s, .67 * s + .58 * c, .46).normalize();
    },
  };
}
