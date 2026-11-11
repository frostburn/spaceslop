import * as T from 'three';
import { denNestPoint, denNests } from './route';

export function createDenNests() {
  const art = new T.MeshBasicMaterial({ color: 0xb6a490, alphaTest: .29, alphaToCoverage: true });
  const card = new T.PlaneGeometry(1, 1);
  const shadowShape = new T.PlaneGeometry(1.14, .76);
  const shadowMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv;
      void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, .46 * (1.0 - smoothstep(.26, 1.0, length(vUv * 2.0 - 1.0)))); }`,
  });
  const straw = new T.MeshBasicMaterial({ color: 0x67452b });
  const shell = new T.MeshStandardMaterial({ color: 0x9d7e5a, roughness: .91 });
  const bowl = new T.TorusGeometry(.32, .083, 7, 23).scale(1.25, .82, 1);
  const egg = new T.SphereGeometry(1, 12, 8);
  const nests = denNests.map(site => {
    const root = new T.Group(), fallback = new T.Group();
    root.name = 'draconian-egg-nest';
    const mesh = new T.Mesh(card, art);
    const shadow = new T.Mesh(shadowShape, shadowMaterial);
    shadow.position.set(.025, -.045, -.05);
    mesh.visible = false;
    fallback.add(new T.Mesh(bowl, straw));
    for (const [x, y, size] of [[-.18, .06, .116], [.08, .10, .15], [.15, -.10, .11], [-.07, -.12, .13]]) {
      const body = new T.Mesh(egg, shell);
      body.position.set(x, y, .055);
      body.scale.set(size * .77, size, size * .56);
      body.rotation.z = x * 3;
      fallback.add(body);
    }
    root.rotation.z = site.angle;
    root.add(mesh, fallback, shadow);
    return { root, mesh, fallback, site };
  });
  return {
    roots: nests.map(nest => nest.root),
    setArt(map: T.Texture) {
      art.map = map;
      art.needsUpdate = true;
      for (const nest of nests) { nest.mesh.visible = true; nest.fallback.visible = false; }
    },
    update(scroll: number, distance: number) {
      const z = -.28;
      for (const { root, site } of nests) {
        const point = denNestPoint(site, scroll, distance, z);
        root.position.set(point.x, point.y, z);
        root.visible = Math.abs(point.y) < 9.3;
        root.scale.setScalar(point.scale * site.width);
      }
    },
  };
}
