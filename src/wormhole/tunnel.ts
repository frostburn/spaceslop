import * as T from 'three';
import { HEIGHT, WIDTH } from '../playfield';
import type { wormholeFrame } from './route';
import { titanEcho } from './titan-echo';

export function createWormholeTunnel(apertureY: number) {
  const uniforms = {
    travel: { value: 0 },
    lensCenter: { value: new T.Vector2(0, apertureY) },
    lensRadius: { value: .04 },
    lensStrength: { value: 0 },
    echo: { value: 0 },
    waveRadius: { value: .2 },
    waveStrength: { value: 0 },
  };
  const material = new T.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 screen;
      void main() {
        screen = position.xy * vec2(${WIDTH / HEIGHT}, 1.0);
        gl_Position = vec4(position.xy, .999, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 screen;
      uniform vec2 lensCenter;
      uniform float travel, lensRadius, lensStrength, echo, waveRadius, waveStrength;
      ${titanEcho}

      float lobe(float phase, float tightness) {
        return pow(max(0.0, .5 + .5 * cos(phase)), tightness);
      }

      vec3 stars(vec2 ray, float scale, float seed) {
        vec2 grid = ray * scale;
        vec2 cell = floor(grid);
        vec2 center = vec2(cloudHash(cell + seed), cloudHash(cell + seed + 19.1));
        vec2 offset = fract(grid) - (.18 + .64 * center);
        float footprint = min(.19, .32 * length(fwidth(grid)));
        float radius = mix(.026, .089, center.y * center.y);
        float point = 1.0 - smoothstep(radius, radius + footprint + .01, length(offset));
        float light = step(.76, cloudHash(cell + seed - 6.7)) * point;
        vec3 color = mix(vec3(.16, .32, .76), vec3(.94, .77, .54), center.x);
        return color * light * (.23 + .7 * center.y * center.y);
      }

      void main() {
        vec2 delta = screen - lensCenter;
        float lensDistance = length(delta);
        float lensSquared = lensRadius * lensRadius;
        float core = .14 * lensSquared;
        // Ray deflection flips sign inside the critical curve. Sources on the
        // far wall can appear on both sides of the ring without copying a frame.
        float bend = lensStrength * (lensSquared + core) / (dot(delta, delta) + core);
        vec2 ray = screen - delta * bend;

        vec2 axis = vec2(0.0, .335);
        vec2 fromAxis = ray - axis;
        float radius = length(fromAxis);
        float depth = .91 / max(.066, radius);
        float z = travel + depth;
        float angle = atan(fromAxis.y, fromAxis.x + .000001);
        float twist = .37 * z + .46 * sin(.54 * z) + .17 * sin(z * 1.29 + 1.2);
        float theta = angle + twist;
        vec2 turn = vec2(cos(theta), sin(theta));
        float cloud = cloudNoise(turn * 3.8 + vec2(z * .45, z * .27));
        float distanceFade = smoothstep(.058, .265, radius);
        float fine = distanceFade * (1.0 - smoothstep(.08, .46, fwidth(depth)));
        float folded = lobe(3.0 * theta + .68 * sin(z * .88), 2.3);
        float strandPhase = theta * 9.0 + sin(z * 1.13) * .57 + .23 * sin(theta * 5.0 - z);
        float strands = lobe(strandPhase, 16.0) * (.22 + .78 * folded) * fine;
        float threads = lobe(theta * 27.0 + sin(z * 1.6 + theta * 5.0), 22.0) * cloud * fine;
        float wave = lobe(z * 2.7 + .87 * cos(theta * 2.0) + cloud, 12.0) * fine;
        float cold = .5 + .5 * cos(theta + .8 * sin(z * .28));
        vec3 violet = vec3(.11, .032, .27);
        vec3 cyan = vec3(.033, .32, .58);
        vec3 tone = mix(violet, cyan, cold);
        vec3 wall = tone * (.022 + .30 * folded * (.18 + .82 * cloud));
        wall += mix(tone, vec3(.22, .66, .94), .43) * (strands * .27 + threads * .07);
        wall += tone * wave * (.035 + .10 * folded);

        float stripAngle = theta * 2.0 - .53 + .49 * sin(z * .52);
        float strip = smoothstep(.49, .86, cos(stripAngle)) * distanceFade * echo;
        if (strip > .003) {
          float across = clamp(.5 + .61 * sin(stripAngle), 0.0, 1.0);
          vec3 vista = titanVista(vec2(z * .86 + .37 * cos(theta), across));
          wall = mix(wall, vista * (.30 + .25 * folded), strip * .94);
          wall += vec3(.69, .23, .08) * lobe(stripAngle + .71, 58.0) * .14 * echo * fine;
        }

        vec3 color = vec3(.0018, .0032, .012);
        color += wall * distanceFade;
        color += vec3(.039, .12, .21) * exp(-radius * 6.5) * (.65 + .35 * cloud);
        color += (stars(ray + vec2(travel * .0011, 0.0), 31.0, 12.0) +
          .31 * stars(ray, 57.0, 73.0)) * mix(.83, .28, distanceFade);

        float orbit = atan(delta.y, delta.x + .000001);
        float rim = abs(lensDistance - lensRadius * (1.0 + .017 * sin(orbit * 3.0 + travel)));
        float ringShape = .49 + .51 * lobe(orbit * 2.0 - travel * .41, 2.0);
        float width = max(.0012, .74 * fwidth(lensDistance));
        float coreLight = 1.0 - smoothstep(width, width * 3.25, rim);
        float bloom = exp(-rim * 78.0);
        float scatter = exp(-rim * 23.0);
        vec3 lensColor = mix(vec3(.25, .67, 1.0), vec3(1.0, .51, .21), echo);
        color += lensColor * lensStrength * ringShape * (coreLight * 1.9 + .63 * bloom + .17 * scatter);
        color += lensColor * .15 * echo * lensStrength * (1.0 - smoothstep(0.0, lensRadius, lensDistance));
        float shock = exp(-abs(lensDistance - waveRadius) * 36.0);
        color += lensColor * shock * distanceFade * waveStrength * (.13 + .63 * folded);

        // Retain contrast along the flight lane while the walls move around it.
        float lane = (1.0 - smoothstep(.16, .45, abs(screen.x))) * (1.0 - smoothstep(.31, .65, screen.y));
        color *= 1.0 - .34 * lane;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const root = new T.Mesh(new T.PlaneGeometry(2, 2), material);
  root.name = 'wormhole-tunnel';
  root.frustumCulled = false;
  root.renderOrder = -100;
  return {
    root,
    pose(frame: ReturnType<typeof wormholeFrame>) {
      uniforms.travel.value = frame.travel;
      uniforms.lensCenter.value.set(frame.lensX, apertureY + frame.lensY);
      uniforms.lensRadius.value = frame.lensRadius;
      uniforms.lensStrength.value = frame.lensStrength;
      uniforms.echo.value = frame.echo;
      uniforms.waveRadius.value = frame.waveRadius;
      uniforms.waveStrength.value = frame.waveStrength;
    },
  };
}
