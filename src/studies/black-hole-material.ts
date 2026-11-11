import * as T from 'three';
import {
  bakeLightOrbits, DISK_INNER, DISK_OUTER, ORBIT_COLUMNS, ORBIT_ROWS,
  ORBIT_MAX_IMPACT, ORBIT_MAX_ANGLE, ORBIT_FINE_START, ORBIT_FINE_END,
  ORBIT_FINE_FIRST, ORBIT_FINE_LAST, SHADOW_IMPACT,
} from './black-hole-orbits';

// The inner sample starts inside the bright rim. The outer sample is past
// the image's faded edge. Coordinates survive whole-canvas resizes.
const ART_INNER = .13;
const ART_OUTER = .462;
const number = (n: number) => n.toFixed(9);

export function createBlackHoleMaterial() {
  const orbits = new T.DataTexture(bakeLightOrbits(), ORBIT_COLUMNS, ORBIT_ROWS);
  orbits.minFilter = orbits.magFilter = T.LinearFilter;
  orbits.needsUpdate = true;
  const material = new T.ShaderMaterial({
    uniforms: {
      orbits: {value: orbits},
      diskArt: {value: null as T.Texture | null},
      useArt: {value: false},
      diskRotation: {value: new T.Vector2(1, 0)},
      inclination: {value: T.MathUtils.degToRad(84)},
      frameScale: {value: new T.Vector2(1, 1)},
      mode: {value: 0},
    },
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 screen;
      void main() {
        screen = uv * 2.0 - 1.0;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 screen;
      uniform sampler2D orbits, diskArt;
      uniform bool useArt;
      uniform vec2 diskRotation;
      uniform float inclination;
      uniform vec2 frameScale;
      uniform int mode;
      const float PI = 3.14159265359;
      const float INNER = ${number(DISK_INNER)};
      const float OUTER = ${number(DISK_OUTER)};
      const float ART_INNER = ${number(ART_INNER)};
      const float ART_OUTER = ${number(ART_OUTER)};
      const float MAX_IMPACT = ${number(ORBIT_MAX_IMPACT)};
      const float FINE_START = ${number(ORBIT_FINE_START)};
      const float FINE_END = ${number(ORBIT_FINE_END)};
      const float FINE_FIRST = ${number(ORBIT_FINE_FIRST)};
      const float FINE_LAST = ${number(ORBIT_FINE_LAST)};
      const vec2 TABLE_SIZE = vec2(${number(ORBIT_COLUMNS)}, ${number(ORBIT_ROWS)});

      float inverseRadius(float impact, float angle) {
        float column;
        if (impact < FINE_START) column = impact / FINE_START * FINE_FIRST;
        else if (impact < FINE_END) column = mix(FINE_FIRST, FINE_LAST, (impact - FINE_START) / (FINE_END - FINE_START));
        else column = mix(FINE_LAST, TABLE_SIZE.x - 1.0, (impact - FINE_END) / (MAX_IMPACT - FINE_END));
        float row = angle / ${number(ORBIT_MAX_ANGLE)} * (TABLE_SIZE.y - 1.0);
        vec3 sampleValue = texture2D(orbits, (vec2(column, row) + .5) / TABLE_SIZE).rgb;
        // Reject samples interpolated across a captured or escaped ray.
        return sampleValue.b > .999 ? dot(sampleValue.rg, vec2(65280.0, 255.0)) / 131070.0 : 0.0;
      }

      vec4 plasma(vec2 direction, float radius) {
        // Sample the rotating source in disk coordinates. Ray intersections,
        // the shadow and the approaching side of the disk stay registered.
        direction = vec2(dot(direction, diskRotation),
          dot(direction, vec2(-diskRotation.y, diskRotation.x)));
        float radial = (radius - INNER) / (OUTER - INNER);
        float edge = smoothstep(0.0, .016, radial) * (1.0 - smoothstep(.82, 1.0, radial));
        if (useArt) {
          vec2 uv = vec2(.5) + direction * mix(ART_INNER, ART_OUTER, radial);
          vec4 art = texture2D(diskArt, uv);
          return vec4(art.rgb * 1.8, art.a * edge);
        }
        float azimuth = atan(direction.y, direction.x);
        float filament = .5 + .5 * sin(radial * 226.0 + 3.0 * sin(azimuth * 7.0 + radial * 24.0));
        float turbulence = .5 + .5 * sin(azimuth * 19.0 + radial * 75.0 + sin(radial * 36.0));
        float hot = exp(-5.5 * radial);
        vec3 color = mix(vec3(.33, .034, .009), vec3(3.8, 1.86, .74), hot);
        return vec4(color * (.72 + .36 * filament + .22 * turbulence), edge);
      }

      vec3 projectedDisk(vec2 q) {
        float impact = length(q);
        vec3 color = vec3(.0025, .0035, .007);
        if (mode == 0 && impact < ${number(SHADOW_IMPACT)}) color = vec3(0.0);
        if (impact <= .001 || impact >= MAX_IMPACT) return color;
        float sine = sin(inclination), cosine = cos(inclination);
        vec3 observer = vec3(0.0, -sine, cosine);
        vec3 axis = vec3(q.x, q.y * cosine, q.y * sine) / impact;
        // A ray meets the equatorial plane whenever its radial direction
        // has zero z. Successive intersections are a half orbit apart.
        float first = atan(observer.z, -axis.z);
        for (int crossing = 0; crossing < 3; crossing++) {
          if (mode == 1 && crossing > 0) break;
          float angle = first + float(crossing) * PI;
          float u = mode == 1 ? sin(first) / impact : inverseRadius(impact, angle);
          if (u < 1.0 / OUTER || u > 1.0 / INNER) continue;
          vec2 diskDirection = normalize((observer * cos(angle) + axis * sin(angle)).xy);
          vec4 sampleColor = plasma(diskDirection, 1.0 / u);
          float gain = 1.0;
          if (mode == 0) {
            float angularMomentum = -q.x * sine;
            float shift = sqrt(1.0 - 3.0 * u) / (1.0 - angularMomentum * pow(u, 1.5));
            gain = pow(shift, 3.0) * 1.8;
          }
          return mix(color, sampleColor.rgb * gain, sampleColor.a);
        }
        return color;
      }

      void main() {
        vec2 q = screen * frameScale;
        vec3 color = vec3(.0025, .0035, .007);
        if (mode == 2) {
          vec2 source = q * .5;
          float distance = length(source);
          if (distance > ART_INNER && distance < ART_OUTER) {
            float radius = mix(INNER, OUTER, (distance - ART_INNER) / (ART_OUTER - ART_INNER));
            vec4 sampleColor = plasma(source / distance, radius);
            color = mix(color, sampleColor.rgb, sampleColor.a);
          }
        } else {
          q *= 21.0;
          float impact = length(q);
          float footprint = fwidth(impact);
          // The higher-order image is thinner than a pixel near the critical
          // curve. Filter radially there while leaving the rest a single draw.
          if (mode == 0 && abs(impact - ${number(SHADOW_IMPACT)}) < .24) {
            color = vec3(0.0);
            for (int sampleIndex = 0; sampleIndex < 8; sampleIndex++) {
              float offset = (float(sampleIndex) - 3.5) * footprint / 8.0;
              color += projectedDisk(q * (1.0 + offset / impact)) / 8.0;
            }
          } else color = projectedDisk(q);
        }
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return {material, dispose() { material.dispose(); orbits.dispose(); }};
}
