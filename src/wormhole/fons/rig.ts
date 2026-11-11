import * as T from 'three';
import { fonsPhase, fonsPose } from './combat';
import { createFonsMane } from './mane';
import { createFonsMantle } from './mantle';

function tusk(side: number, small: boolean) {
  const points = small ? [
    [.44, -1.02, .47], [.49, -1.41, .77], [.77, -1.53, .94], [.98, -1.29, .93], [.99, -.91, .86],
  ] : [
    [.68, -.56, .40], [1.12, -.86, .68], [1.61, -.70, .91], [1.83, -.17, 1.01], [1.71, .50, .91],
  ];
  const curve = new T.CatmullRomCurve3(points.map(([x, y, z]) => new T.Vector3(side * x, y, z)));
  const spans = 32, sides = 14;
  const frame = curve.computeFrenetFrames(spans, false);
  const positions: number[] = [], colors: number[] = [], index: number[] = [];
  const bone = new T.Color(0xb5afa4), patina = new T.Color(0x3b4346), color = new T.Color();
  for (let i = 0; i <= spans; i++) {
    const t = i / spans, center = curve.getPointAt(t);
    const width = (small ? .161 : .263) * Math.max(.014, (1 - t) ** .68);
    for (let j = 0; j < sides; j++) {
      const a = j * Math.PI * 2 / sides;
      const n = frame.normals[i], b = frame.binormals[i], nx = Math.cos(a) * width, bz = Math.sin(a) * width;
      positions.push(center.x + n.x * nx + b.x * bz, center.y + n.y * nx + b.y * bz, center.z + n.z * nx + b.z * bz);
      const striae = .083 * Math.sin(t * 106 + a * 2) + .058 * Math.sin(t * 220 - a * 3);
      color.copy(patina).lerp(bone, T.MathUtils.clamp(.22 + t * .68 + striae, 0, 1));
      colors.push(color.r, color.g, color.b);
      if (i < spans) {
        const v = i * sides + j, next = i * sides + (j + 1) % sides;
        index.push(v, next, v + sides, next, next + sides, v + sides);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

export function createFonsRig(environment: T.Texture) {
  const root = new T.Group();
  root.name = 'fons-inversus';
  const mantle = createFonsMantle(), mane = createFonsMane();
  const sphere = new T.SphereGeometry(1, 48, 36);
  const collar = new T.Mesh(sphere, new T.MeshPhysicalMaterial({
    color: 0x151923, metalness: .71, roughness: .29, clearcoat: .75, emissive: 0x13254a, emissiveIntensity: .28,
  }));
  collar.scale.set(.96, 1.52, .66);
  collar.position.z = -.13;
  const mirrorMaterial = new T.ShaderMaterial({
    uniforms: { surroundings: { value: environment as T.Texture | null }, storm: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 surfaceNormal, eye;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        surfaceNormal = normalMatrix * normal;
        eye = -p.xyz;
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 surfaceNormal, eye;
      uniform sampler2D surroundings;
      uniform float storm;
      void main() {
        vec3 n = normalize(surfaceNormal), v = normalize(eye);
        vec3 reflected = reflect(-v, n);
        vec2 uv = vec2(.50, .56) + reflected.xy * vec2(-.47, .39);
        vec3 scene = texture2D(surroundings, clamp(uv, .002, .998)).rgb;
        vec3 negative = 1.0 - sqrt(clamp(scene * 1.50, 0.0, 1.0));
        float facing = max(0.0, dot(n, v));
        float rim = pow(1.0 - facing, 2.25);
        vec3 color = negative * negative * mix(.16, .78, facing);
        float glint = pow(max(0.0, dot(reflected, normalize(vec3(-.78, .62, .2)))), 30.0);
        float edge = smoothstep(.28, .88, rim);
        color = mix(color, vec3(.022, .054, .093), edge * .72);
        color += vec3(.29, .79, 1.35) * glint * .74;
        color += vec3(.28, .05, .56) * rim * storm * .68;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mirror = new T.Mesh(sphere, mirrorMaterial);
  mirror.name = 'fons-negative-mirror';
  mirror.scale.set(.85, 1.40, .71);
  mirror.position.z = .13;
  const tooth = new T.MeshStandardMaterial({
    vertexColors: true, roughness: .42, metalness: .13, side: T.DoubleSide,
  });
  for (const side of [-1, 1]) for (const small of [false, true]) {
    const mesh = new T.Mesh(tusk(side, small), tooth);
    mesh.name = 'fons-tusk-' + (side < 0 ? 'left-' : 'right-') + (small ? 'inner' : 'outer');
    root.add(mesh);
  }
  root.add(mantle.root, collar, mirror, mane.root);
  return {
    root,
    setMane: mane.setArt,
    update(time: number, distance: number, reset: boolean) {
      const pose = fonsPose(time);
      const projection = 1 - pose.depth / distance;
      root.position.set(pose.x * projection, pose.y * projection, pose.depth);
      root.scale.setScalar(pose.scale * projection);
      root.rotation.set(pose.pitch, pose.yaw, pose.bank);
      mantle.update(time, reset);
      mane.update(time);
      mirrorMaterial.uniforms.storm.value = fonsPhase(time).lift;
    },
    clearEnvironment() { mirrorMaterial.uniforms.surroundings.value = null; },
  };
}
