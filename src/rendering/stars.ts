import * as T from 'three';
export function createStars() {
  const points = Array.from({ length: 220 }, (_, i) => [((i * 67 % 223) / 223 - .5) * 26, ((i * 97 % 227) / 227 - .5) * 48, -2 - i % 15]).flat();
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  const root = new T.Points(g, new T.PointsMaterial({ color: 0x607796, size: .07 }));
  root.frustumCulled = false;
  return root;
}
