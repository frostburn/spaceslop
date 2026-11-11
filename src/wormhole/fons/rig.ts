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
  const spans = 42, sides = 18;
  const rootWidth = small ? .168 : .271;
  const frame = curve.computeFrenetFrames(spans, false);
  const positions: number[] = [], colors: number[] = [], index: number[] = [];
  const bone = new T.Color(0xe1cca3), root = new T.Color(0x997b58), color = new T.Color();
  for (let i = 0; i <= spans; i++) {
    const t = i / spans, center = curve.getPointAt(t);
    const width = rootWidth * Math.max(.010, (1 - t) ** .69);
    for (let j = 0; j < sides; j++) {
      const a = j * Math.PI * 2 / sides;
      const flute = .055 * Math.sin(a * 4.0 + t * 3.0) + .035 * Math.sin(a * 7.0 - t * 5.0);
      const n = frame.normals[i], b = frame.binormals[i];
      const nx = Math.cos(a) * width * (1 + flute), bz = Math.sin(a) * width * (.90 + flute);
      positions.push(center.x + n.x * nx + b.x * bz, center.y + n.y * nx + b.y * bz, center.z + n.z * nx + b.z * bz);
      const grain = .08 * Math.sin(a * 9 + t * 2.2) + .063 * Math.sin(t * 73 + a * 2.7);
      color.copy(root).lerp(bone, T.MathUtils.clamp(.25 + t * .67 + grain + flute, 0, 1));
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
  const base = curve.getPointAt(0);
  const axis = curve.getPointAt(small ? .20 : .13).sub(base).normalize();
  return { geometry, base, axis, rootWidth };
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
  const surroundings = { value: environment as T.Texture | null };
  const mirrorMaterial = new T.ShaderMaterial({
    uniforms: { surroundings, storm: { value: 0 } },
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
    vertexColors: true, roughness: .71, emissive: 0xb4865c, emissiveIntensity: .07,
  });
  tooth.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 bonePoint;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nbonePoint = position;');
    shader.fragmentShader = 'varying vec3 bonePoint;\n' + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 pore = bonePoint * vec3(57.0, 71.0, 49.0);
      float seed = fract(sin(dot(floor(pore),vec3(17.43,79.23,43.79)))*43758.5453);
      float pit = 1.0 - smoothstep(.13, .40, length(fract(pore)-.5));
      float grain = .5+.5*sin(bonePoint.x*71.0+bonePoint.y*61.0+2.0*sin(bonePoint.z*45.0));
      diffuseColor.rgb *= 1.0 - pit * seed * .24 - grain * .09;
    `);
  };
  const platinum = new T.MeshPhysicalMaterial({ color: 0xe4e6ec, metalness: .95, roughness: .19, clearcoat: .64 });
  platinum.onBeforeCompile = shader => {
    shader.uniforms.platinumSky = surroundings;
    shader.fragmentShader = 'uniform sampler2D platinumSky;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 metalRay = reflect(-normalize(vViewPosition), normal);
      vec2 metalUV = clamp(vec2(.50,.56) + metalRay.xy * vec2(-.44,.38), .002, .998);
      vec3 reflectedSky = texture2D(platinumSky,metalUV).rgb;
      float strip = exp(-abs(dot(metalRay,vec3(.73,.57,-.37))-.34)*18.0);
      float fill = exp(-abs(dot(metalRay,vec3(-.42,.74,.52))+.31)*7.0);
      outgoingLight += vec3(.08,.10,.13) + reflectedSky*.63 + vec3(.99,1.02,1.08)*(strip*1.47 + fill*.24);
      #include <opaque_fragment>
    `);
  };
  const cuff = new T.LatheGeometry([
    [1.00, -.28], [1.37, -.20], [1.50, -.04], [1.51, .16], [1.38, .34],
    [1.24, .50], [1.23, .62], [1.37, .72], [1.34, .90], [1.22, 1.0], [.94, 1.0],
  ].map(([r, y]) => new T.Vector2(r, y)), 36);
  const up = new T.Vector3(0, 1, 0);
  for (const side of [-1, 1]) for (const small of [false, true]) {
    const { geometry, base, axis, rootWidth } = tusk(side, small);
    const name = (side < 0 ? 'left-' : 'right-') + (small ? 'inner' : 'outer');
    const mesh = new T.Mesh(geometry, tooth);
    mesh.name = 'fons-tusk-' + name;
    const mount = new T.Mesh(cuff, platinum);
    mount.name = 'fons-platinum-mount-' + name;
    mount.position.copy(base);
    mount.quaternion.setFromUnitVectors(up, axis);
    mount.scale.set(rootWidth, small ? .245 : .335, rootWidth);
    root.add(mesh, mount);
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
    clearEnvironment() { surroundings.value = null; },
  };
}
