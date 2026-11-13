import * as T from 'three';

export const JELLY_DONUT_PERIOD = 8;

export function createJellyDonuts(count: number) {
  const profile = [
    [.35, -.03], [.38, -.095], [.50, -.12], [.58, -.08], [.61, -.025],
    [.61, .025], [.58, .085], [.52, .11], [.50, .098], [.48, .116],
    [.40, .126], [.37, .103], [.35, .055], [.35, -.03],
  ].map(([radius, height]) => new T.Vector2(radius, height));
  const segments = 72;
  const geometry = new T.LatheGeometry(profile, segments).rotateX(Math.PI / 2);
  const silver = new T.Color(0xb9c5cf), darkSteel = new T.Color(0x323e4c);
  const band = new T.Color();
  const colors: number[] = [];
  for (let i = 0; i <= segments; i++) {
    // Three inset marks in the face make the circular disc's spin visible.
    const mark = 1 - T.MathUtils.smoothstep(Math.abs(i % 24 - 12), 2, 4);
    for (const [radius, height] of profile) {
      const groove = radius === .50 && height > 0;
      const inset = height > .09 ? mark * .9 : 0;
      band.copy(silver).lerp(darkSteel, Math.max(groove ? .52 : 0, inset));
      colors.push(band.r, band.g, band.b);
    }
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  const rotor = new T.Mesh(geometry, new T.MeshStandardMaterial({
    vertexColors: true, metalness: .67, roughness: .31,
  }));
  rotor.name = 'jelly-donut-disc';
  const lens = new T.Mesh(new T.SphereGeometry(.22, 24, 12), new T.MeshStandardMaterial({
    color: 0xde1531, emissive: 0xd70824, emissiveIntensity: .62, roughness: .29,
  }));
  lens.name = 'jelly-donut-core';
  lens.scale.z = .53;
  return Array.from({ length: count }, () => {
    const root = new T.Group();
    root.name = 'jelly-donut';
    const disc = rotor.clone();
    root.add(disc, lens.clone());
    return {
      root,
      pose(time: number, direction = 1, offset = 0) {
        const cycle = 2 * Math.PI * time / JELLY_DONUT_PERIOD + offset;
        // Keep the motion continuous when scrubbing or wrapping the eight-second preview.
        const spin = 2 * cycle + .82 * Math.sin(4 * cycle) + .22 * Math.sin(11 * cycle);
        disc.rotation.set(
          .29 * Math.sin(3 * cycle) + .10 * Math.sin(9 * cycle),
          .28 * Math.sin(5 * cycle + .7),
          direction * spin,
        );
        disc.position.set(.035 * Math.sin(5 * cycle), .035 * Math.cos(3 * cycle), 0);
      },
    };
  });
}
