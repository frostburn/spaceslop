import * as T from 'three';

type Point = [number, number, number];

export function bismuthGeometry(variant: number) {
  const positions: number[] = [], film: number[] = [], grain: number[] = [];

  function hopper(transform: T.Matrix4, steps: number, seed: number) {
    function square(rx: number, ry: number, x: number, y: number, z: number): Point[] {
      return [[x - rx, y - ry, z], [x + rx, y - ry, z], [x + rx, y + ry, z], [x - rx, y + ry, z]];
    }
    const vertex = new T.Vector3();
    function face(a: Point, b: Point, c: Point, d: Point, band: number) {
      const corners = [a, b, c, d];
      for (const i of [0, 1, 2, 0, 2, 3]) {
        vertex.set(...corners[i]).applyMatrix4(transform);
        positions.push(vertex.x, vertex.y, vertex.z);
        film.push(band + corners[i][0] * .073 + corners[i][1] * .043);
        grain.push(i < 2 ? 0 : 1);
      }
    }

    const back = square(.81, .73, -.10, -.06, -.61);
    const shoulder = square(.96, .86, 0, 0, -.37);
    let rim = square(.96, .86, 0, 0, .55);
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      face(back[i], back[next], shoulder[next], shoulder[i], seed + .31 + i * .083);
      face(shoulder[i], shoulder[next], rim[next], rim[i], seed + .09 + i * .083);
    }
    face(back[3], back[2], back[1], back[0], seed + .51);

    // The outer edges outgrow the center, leaving a closed, stepped recess.
    for (let step = 1; step <= steps; step++) {
      const inset = .145 * step;
      const cx = .039 * step * Math.cos(seed * 12), cy = -.029 * step;
      const front = rim[0][2];
      const floor = square(.96 - inset, .86 - inset, cx, cy, front - .158);
      const lip = square(.983 - inset, .883 - inset, cx, cy, front);
      const bevel = square(.96 - inset, .86 - inset, cx, cy, front - .029);
      const band = seed + .157 * step + .035 * Math.sin(step * 2.2 + seed);
      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        face(rim[i], rim[next], lip[next], lip[i], band + i * .021);
        face(lip[i], lip[next], bevel[next], bevel[i], band + .066 + i * .026);
        face(bevel[i], bevel[next], floor[next], floor[i], band + .103 + i * .030);
      }
      rim = floor;
    }
    face(rim[0], rim[1], rim[2], rim[3], seed + .67);
  }

  const sign = variant === 0 ? 1 : -1;
  const matrix = new T.Matrix4(), turn = new T.Quaternion();
  function cluster(x: number, y: number, z: number, size: number, tilt: T.Euler, steps: number, seed: number) {
    matrix.compose(new T.Vector3(x, y, z), turn.setFromEuler(tilt), new T.Vector3(size, size, size));
    hopper(matrix, steps, seed);
  }
  cluster(-.07 * sign, .09, -.02, .94, new T.Euler(-.27, .28 * sign, .19 * sign), 5, .14 + variant * .21);
  cluster(-.81 * sign, .43, -.08, .43, new T.Euler(.33, -.56 * sign, -.41 * sign), 4, .41 + variant * .18);
  cluster(.69 * sign, -.38, .22, .57, new T.Euler(-.41, .63 * sign, -.37 * sign), 4, .63 + variant * .14);
  cluster(.58 * sign, .61, -.19, .36, new T.Euler(.17, .71 * sign, .56 * sign), 3, .30 + variant * .24);

  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('oxideThickness', new T.Float32BufferAttribute(film, 1));
  geometry.setAttribute('terraceGrain', new T.Float32BufferAttribute(grain, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export const bismuthVaryings = 'varying float oxideBand, growthLine;\n';

export const bismuthCoating = /* glsl */ `
  vec3 viewDir = normalize(vViewPosition);
  float grazing = 1.0 - clamp(dot(viewDir, normal), 0.0, 1.0);
  vec3 reflected = reflect(-viewDir, normal);
  vec3 oxide = .53 + .45 * cos(6.2831853 * (oxideBand - grazing * .28 + vec3(0.0, .75, .42)));
  oxide = mix(vec3(.54,.58,.67), oxide, .88);
  float sheet = exp(-abs(dot(reflected, vec3(-.61,.70,.37))-.34)*5.7);
  float glint = exp(-abs(dot(reflected, vec3(.76,.52,-.38))+.27)*17.0);
  float striae = .5 + .5*cos(growthLine * 43.98 + oxideBand * 9.0);
  float grooves = 1.0 - .17 * smoothstep(.77,.97,striae) * (1.0-smoothstep(.045,.15,fwidth(growthLine)));
  outgoingLight = (outgoingLight*.27 + oxide * (.075 + .46*sheet) + vec3(.71,.80,1.0)*glint*.36) * grooves;
`;
