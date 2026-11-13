import * as T from 'three';
import { BOSS_CAMERA_DISTANCE, HEIGHT } from '../playfield';
import { wallThemes } from './wall-themes';

const sides = 10;
const rows = 22;
const pitch = 9.5;

export function createCruiserWall(apertureY: number) {
  const positions: number[] = [];
  const barycentrics: number[] = [];
  const facets: number[] = [];

  function triangle(corners: readonly number[][], facet: number) {
    for (const [i, [sector, row]] of corners.entries()) {
      positions.push(sector, row, 0);
      barycentrics.push(Number(i === 0), Number(i === 1), Number(i === 2));
      facets.push(facet);
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let side = 0; side < sides; side++) {
      const a = [side, row], b = [side + 1, row], c = [side, row + 1], d = [side + 1, row + 1];
      triangle([a, b, c], 0);
      triangle([b, d, c], 1);
    }
  }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('barycentric', new T.Float32BufferAttribute(barycentrics, 3));
  geometry.setAttribute('facet', new T.Float32BufferAttribute(facets, 1));
  const uniforms = {
    travel: { value: 0 },
    amount: { value: 0 },
    rail: { value: new T.Color(wallThemes.boulevard[2]) },
    hoop: { value: new T.Color(wallThemes.boulevard[1]) },
  };
  const material = new T.ShaderMaterial({
    uniforms,
    // Blend over the full-screen tunnel before any combat objects are drawn.
    blending: T.CustomBlending,
    blendSrc: T.SrcAlphaFactor,
    blendDst: T.OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float travel;
      attribute vec3 barycentric;
      attribute float facet;
      varying vec3 edge;
      varying float face, ring, depth;

      void main() {
        float advance = travel * .79;
        float row = position.y + floor(advance);
        float z = 18.0 - (position.y - fract(advance)) * ${pitch};
        // Stagger successive polygon rings and rotate them progressively down the tunnel.
        float angle = position.x * ${2 * Math.PI / sides}
          + .24 * mod(row, 2.0) + .19 * row + .31 * sin(row * .45);
        float radius = 7.5 + .35 * sin(row * .83);
        float centerY = ${(apertureY * HEIGHT / 2).toFixed(8)} * (1.0 - z / ${BOSS_CAMERA_DISTANCE.toFixed(1)});
        edge = barycentric;
        face = facet;
        ring = row;
        depth = -z;
        gl_Position = projectionMatrix * modelViewMatrix
          * vec4(cos(angle) * radius, centerY + sin(angle) * radius, z, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float amount, travel;
      uniform vec3 rail, hoop;
      varying vec3 edge;
      varying float face, ring, depth;

      void main() {
        vec3 pixels = edge / max(fwidth(edge), vec3(.00001));
        vec3 line = 1.0 - smoothstep(vec3(.06), vec3(.90), pixels);
        // Both faces meeting at an edge draw it in the same color.
        float rib = mix(line.z, line.x, face);
        float spine = mix(line.y, line.z, face);
        float diagonal = mix(line.x, line.y, face);
        float pulse = .68 + .32 * cos(ring * .68 - travel * 1.3);
        vec3 color = hoop * rib * (.62 + .22 * pulse) + rail * spine * .76
          + mix(hoop, rail, .55) * diagonal * .43;
        float stroke = max(max(rib, spine), diagonal);
        vec3 panel = mix(rail, hoop, face * .55) * (.037 + .026 * pulse);
        float fade = 1.0 - smoothstep(104.0, 178.0, depth);
        gl_FragColor = vec4(mix(panel, color, stroke), amount * fade * mix(.18, .85, stroke));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const root = new T.Mesh(geometry, material);
  root.name = 'cruiser-tunnel-tessellation';
  root.frustumCulled = false;
  root.visible = false;
  root.renderOrder = -95;
  return {
    root,
    setAmount(amount: number) {
      root.visible = amount > .001;
      uniforms.amount.value = amount;
    },
    pose(travel: number) { uniforms.travel.value = travel; },
  };
}
