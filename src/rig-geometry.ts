import * as T from 'three';

export function part<M extends T.Material>(
  parent: T.Group, geometry: T.BufferGeometry, material: M, x: number, y: number, z: number,
) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

export function pivot(parent: T.Object3D, name: string, x: number, y: number, z: number) {
  const group = new T.Group();
  group.name = name;
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

export function polygon(vertices: [number, number][]) {
  return new T.ShapeGeometry(new T.Shape(vertices.map(([x, y]) => new T.Vector2(x, y))));
}

export function plating(vertices: [number, number][], depth: number, bevel = 0.065) {
  const outline = new T.Shape(vertices.map(([x, y]) => new T.Vector2(x, y)));
  return new T.ExtrudeGeometry(outline, {
    depth, bevelEnabled: true, bevelSegments: 1, bevelSize: bevel, bevelThickness: bevel * 1.15,
  });
}
