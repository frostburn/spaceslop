import * as T from 'three';

export function createShipyard() {
  const yard = new T.Group();
  const station = new T.Group();
  station.position.set(-1.1, 1.7, -27);
  station.rotation.set(0.18, -0.2, 0.15);
  yard.add(station);
  const steel = new T.MeshBasicMaterial({ color: 0x323c50, side: T.DoubleSide, transparent: true, forceSinglePass: true });
  const shadow = new T.MeshBasicMaterial({ color: 0x202737, side: T.DoubleSide, transparent: true, forceSinglePass: true });
  const gaps = [[0.04, 1.28], [1.48, 1.05], [2.71, 1.3], [4.34, 0.73], [5.3, 0.82]];

  for (const [start, span] of gaps) {
    const frame = new T.Mesh(new T.RingGeometry(9.6, 10.8, 32, 1, start, span), shadow);
    frame.scale.y = 1.29;
    station.add(frame);
    for (const radius of [9.62, 10.6]) {
      const rim = new T.Mesh(new T.RingGeometry(radius, radius + 0.13, 32, 1, start, span), steel);
      rim.scale.y = 1.29;
      rim.position.z = 0.12;
      station.add(rim);
    }
  }

  const segments = gaps.flatMap(([start, span]) =>
    Array.from({ length: Math.ceil(span * 14) }, (_, i) => start + (i + 0.5) / 14)
      .filter((angle) => angle < start + span),
  );
  const plating = new T.MeshBasicMaterial({ transparent: true });
  const plates = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), plating, segments.length * 2);
  const colors = [0x374454, 0x485061, 0x53505a, 0x31374a, 0x806039, 0x786253].map((hex) => new T.Color(hex));
  const transform = new T.Object3D();
  segments.forEach((angle, i) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    transform.rotation.z = Math.atan2(1.29 * sin, cos);
    transform.position.set(10.15 * cos, 10.15 * sin * 1.29, 0.18);
    transform.scale.set(1.05, 0.16 + i % 3 * 0.05, 0.16);
    transform.updateMatrix();
    plates.setMatrixAt(i * 2, transform.matrix);
    plates.setColorAt(i * 2, colors[i % 4]);
    transform.position.set(9.85 * cos, 9.85 * sin * 1.29, 0.28);
    transform.scale.set(0.14, 0.09 + (i % 7 === 0 ? 0.1 : 0), 0.09);
    transform.updateMatrix();
    plates.setMatrixAt(i * 2 + 1, transform.matrix);
    plates.setColorAt(i * 2 + 1, colors[i % 7 === 0 ? 4 : 5]);
  });
  station.add(plates);

  const beams = [
    { x: -9.6, y: -8.2, z: -21, angle: 0.19, length: 7.6 },
    { x: 10.8, y: -3.4, z: -23, angle: -0.38, length: 9.5 },
    { x: -8.4, y: 8.9, z: -30, angle: -0.49, length: 8.3 },
    { x: 9.5, y: 12.7, z: -29, angle: 0.54, length: 8.5 },
  ];
  for (const { x, y, z, angle, length } of beams) {
    const dock = new T.Group();
    dock.renderOrder = -4;
    dock.position.set(x, y, z);
    dock.rotation.z = angle;
    const rails = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), plating, 12);
    for (let i = 0; i < 12; i++) {
      const brace = i >= 2;
      transform.position.set(brace ? (i - 6.5) * length / 11 : 0, brace ? 0 : i === 0 ? -0.42 : 0.42, 0);
      transform.rotation.z = brace ? (i % 2 ? 0.84 : -0.84) : 0;
      transform.scale.set(brace ? length / 7.7 : length, brace ? 0.115 : 0.18, 0.15);
      transform.updateMatrix();
      rails.setMatrixAt(i, transform.matrix);
      rails.setColorAt(i, colors[brace ? i % 4 : 1]);
    }
    dock.add(rails);
    yard.add(dock);
  }

  const planetGeometry = new T.SphereGeometry(7.8, 40, 24);
  const normals = planetGeometry.getAttribute('normal');
  const shade = new T.Color();
  const night = new T.Color(0x111324);
  const daylight = new T.Color(0x695f70);
  const lightDirection = new T.Vector3(-0.78, 0.56, 0.08).normalize();
  const shades: number[] = [];
  const normal = new T.Vector3();
  for (let i = 0; i < normals.count; i++) {
    normal.fromBufferAttribute(normals, i);
    const terminator = T.MathUtils.smoothstep(normal.dot(lightDirection), -0.05, 0.94);
    const bands = 0.84 + 0.15 * Math.sin(normal.y * 13 + normal.x * 4);
    shade.copy(night).lerp(daylight, terminator * bands);
    shades.push(shade.r, shade.g, shade.b);
  }
  planetGeometry.setAttribute('color', new T.Float32BufferAttribute(shades, 3));
  const planetMaterial = new T.MeshBasicMaterial({ vertexColors: true, transparent: true });
  const planet = new T.Mesh(planetGeometry, planetMaterial);
  planet.position.set(13.2, -18, -37);
  yard.add(planet);
  yard.renderOrder = -4;
  station.renderOrder = -4;
  return {
    root: yard,
    update(reveal: number, showFallback: boolean) {
      const opacity = T.MathUtils.smoothstep(reveal, 0.05, 0.77);
      yard.visible = showFallback && opacity > 0;
      yard.position.y = 12 * (1 - reveal);
      for (const material of [steel, shadow, plating, planetMaterial]) {
        material.opacity = opacity;
        material.depthWrite = reveal === 1;
      }
    },
  };
}
