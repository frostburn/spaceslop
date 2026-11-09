import * as T from 'three';

export const URANUS_RADIUS = 1000;
export const URANUS_TILT = 97.77 * Math.PI / 180;
export const URANUS_POSITION: [number, number, number] = [650, 1800, -1300];
// Main rings, in planetary radii. Widths are slightly enlarged for game scale.
const ringBands = [[1.638,.0011],[1.653,.0011],[1.666,.0012],[1.750,.002],
  [1.787,.002],[1.846,.0015],[1.863,.002],[1.889,.002],[2.002,.006]];

function atmosphereMap() {
  const w = 512, h = 256, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const latitude = (y / (h - 1) - .5) * Math.PI, longitude = x / (w - 1) * Math.PI * 2;
    const latitudeBands = Math.sin(latitude * 24) * 2 + Math.sin(latitude * 53) * .7;
    const clouds = Math.sin(longitude * 7 + Math.sin(latitude * 23)) * Math.cos(latitude) * 1.4;
    const polarCap = T.MathUtils.smoothstep(latitude, .72, 1.2) * 9;
    const value = latitudeBands + clouds + polarCap;
    data.set([111 + value, 180 + value, 187 + value * .8, 255], (y * w + x) * 4);
  }
  const texture = new T.DataTexture(data, w, h); texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = T.RepeatWrapping; texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

/** Geometry and latitudinal surface map use the same equatorial coordinate frame. */
export function createUranus() {
  const root = new T.Group(); root.name = 'uranus-and-equatorial-rings'; root.position.set(...URANUS_POSITION);
  const azimuth = .61;
  const axis = new T.Vector3(Math.sin(URANUS_TILT) * Math.cos(azimuth), Math.sin(URANUS_TILT) * Math.sin(azimuth), Math.cos(URANUS_TILT));
  root.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), axis);
  const geometry = new T.SphereGeometry(URANUS_RADIUS, 112, 64); geometry.rotateX(Math.PI / 2);
  const globe = new T.Mesh(geometry, new T.MeshStandardMaterial({ map: atmosphereMap(), roughness: 1, metalness: 0 }));
  globe.name = 'uranus-globe'; globe.scale.z = .977; root.add(globe);
  const rings = new T.Group(); rings.name = 'uranus-equatorial-rings'; root.add(rings);
  for (let i = 0; i < ringBands.length; i++) {
    const [radius, width] = ringBands[i];
    const material = new T.MeshStandardMaterial({ color: i === 8 ? 0x55504a : 0x343736,
      roughness: 1, metalness: 0, side: T.DoubleSide });
    const ring = new T.Mesh(new T.RingGeometry(radius * URANUS_RADIUS,
      (radius + width) * URANUS_RADIUS, 256), material);
    ring.name = 'uranus-ring-' + i; rings.add(ring);
  }
  return { root, globe, rings, axis };
}

export function createHeliostatSpace() {
  const scene = new T.Scene(); scene.background = new T.Color(0x010309);
  const planet = createUranus(); scene.add(planet.root);
  const sun = new T.DirectionalLight(0xf3f8ff, 2.5);
  sun.position.copy(planet.root.position).add(new T.Vector3(-5000, 3000, 2600));
  sun.target.position.copy(planet.root.position); scene.add(sun, sun.target, new T.AmbientLight(0x8aa7b7, .045));
  const positions: number[] = [], colors: number[] = []; let seed = 94173;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 2300; i++) {
    const z = random() * 2 - 1, angle = random() * Math.PI * 2, radius = Math.sqrt(1 - z * z);
    positions.push(Math.cos(angle) * radius * 20000, Math.sin(angle) * radius * 20000, z * 20000);
    const brightness = .24 + random() ** 4 * .9;
    colors.push(brightness * .81, brightness * .9, brightness);
  }
  const starsGeometry = new T.BufferGeometry(); starsGeometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  starsGeometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  const stars = new T.Points(starsGeometry, new T.PointsMaterial({ size: 1.25, sizeAttenuation: false, vertexColors: true }));
  stars.name = 'spatial-starfield'; scene.add(stars);
  return { scene, planet, stars, update(time: number) { planet.globe.rotation.z = time * .0015; } };
}
