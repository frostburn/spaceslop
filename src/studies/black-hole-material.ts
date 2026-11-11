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

export function createBlackHoleMaterial(sky?: T.Texture) {
  const escapeAngles = sky ? new Uint8Array(ORBIT_COLUMNS * 4) : undefined;
  const orbits = new T.DataTexture(bakeLightOrbits(escapeAngles), ORBIT_COLUMNS, ORBIT_ROWS);
  const exits = escapeAngles ? new T.DataTexture(escapeAngles, ORBIT_COLUMNS, 1) : null;
  const tables = exits ? [orbits, exits] : [orbits];
  for (const table of tables) {
    table.minFilter = table.magFilter = T.LinearFilter;
    table.needsUpdate = true;
  }
  const material = new T.ShaderMaterial({
    defines: sky ? { LENSED_SKY: 1 } : {},
    uniforms: {
      orbits: {value: orbits},
      exits: {value: exits},
      skyArt: {value: sky ?? null},
      skyGain: {value: .65},
      skyOffset: {value: new T.Vector2()},
      skyFocalLength: {value: 18},
      skyRoll: {value: 0},
      diskArt: {value: null as T.Texture | null},
      useArt: {value: false},
      diskRotation: {value: new T.Vector2(1, 0)},
      diskRoll: {value: 0},
      diskGain: {value: 1},
      inclination: {value: T.MathUtils.degToRad(84)},
      frameScale: {value: new T.Vector2(1, 1)},
      lensCenter: {value: new T.Vector2()},
      lensExtent: {value: 21},
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
      uniform float inclination, diskGain, diskRoll;
      uniform vec2 frameScale, lensCenter;
      uniform float lensExtent;
      uniform int mode;
      const float PI = 3.14159265359;
      const float INNER = ${number(DISK_INNER)};
      const float OUTER = ${number(DISK_OUTER)};
      const float ART_INNER = ${number(ART_INNER)};
      const float ART_OUTER = ${number(ART_OUTER)};
      const float MAX_IMPACT = ${number(ORBIT_MAX_IMPACT)};
      const float SHADOW = ${number(SHADOW_IMPACT)};
      const float FINE_START = ${number(ORBIT_FINE_START)};
      const float FINE_END = ${number(ORBIT_FINE_END)};
      const float FINE_FIRST = ${number(ORBIT_FINE_FIRST)};
      const float FINE_LAST = ${number(ORBIT_FINE_LAST)};
      const vec2 TABLE_SIZE = vec2(${number(ORBIT_COLUMNS)}, ${number(ORBIT_ROWS)});

      float orbitColumn(float impact) {
        if (impact < FINE_START) return impact / FINE_START * FINE_FIRST;
        if (impact < FINE_END) return mix(FINE_FIRST, FINE_LAST, (impact - FINE_START) / (FINE_END - FINE_START));
        return mix(FINE_LAST, TABLE_SIZE.x - 1.0, (impact - FINE_END) / (MAX_IMPACT - FINE_END));
      }

      float inverseRadius(float impact, float angle) {
        float row = angle / ${number(ORBIT_MAX_ANGLE)} * (TABLE_SIZE.y - 1.0);
        vec3 sampleValue = texture2D(orbits, (vec2(orbitColumn(impact), row) + .5) / TABLE_SIZE).rgb;
        // Reject samples interpolated across a captured or escaped ray.
        return sampleValue.b > .999 ? dot(sampleValue.rg, vec2(65280.0, 255.0)) / 131070.0 : 0.0;
      }

      #ifdef LENSED_SKY
      uniform sampler2D exits, skyArt;
      uniform float skyGain, skyFocalLength, skyRoll;
      uniform vec2 skyOffset;

      float weakBend(float impact) {
        return 4.0 / impact + 15.0 * PI / (4.0 * impact * impact);
      }

      vec3 lensedSky(vec2 q, float impact, float footprint) {
        float bend = 0.0;
        float visible = 1.0;
        if (mode == 0) {
          float column = orbitColumn(clamp(impact, SHADOW + .002, MAX_IMPACT));
          vec3 exitAngle = texture2D(exits, vec2((column + .5) / TABLE_SIZE.x, .5)).rgb;
          visible = step(.999, exitAngle.b) * smoothstep(SHADOW - .5 * footprint, SHADOW + .5 * footprint, impact);
          bend = dot(exitAngle.rg, vec2(65280.0, 255.0)) / 65535.0 * ${number(ORBIT_MAX_ANGLE)} - PI;
          if (impact > MAX_IMPACT) {
            bend = weakBend(impact) + (bend - weakBend(MAX_IMPACT)) * pow(MAX_IMPACT / impact, 3.0);
          }
        }
        // Stereographic framing opens up the panorama independently of the
        // disk scale. Deflect the wider viewing ray in its orbital plane.
        float angle = 2.0 * atan(impact / skyFocalLength) - bend;
        vec3 ray = vec3(q / max(impact, .001) * sin(angle), cos(angle));
        float rollC = cos(skyRoll), rollS = sin(skyRoll);
        ray.xy = mat2(rollC, rollS, -rollS, rollC) * ray.xy;
        float c = cos(skyOffset.y), s = sin(skyOffset.y);
        ray.yz = vec2(c * ray.y + s * ray.z, c * ray.z - s * ray.y);
        vec2 skyUV = vec2(atan(ray.x, ray.z) / (2.0 * PI) + skyOffset.x, asin(clamp(ray.y, -1.0, 1.0)) / PI) + .5;
        // Use the actual footprint in the warped sky. Longitude is periodic,
        // so a wrap across the seam must not read as a whole panorama per pixel.
        vec2 dx = dFdx(skyUV), dy = dFdy(skyUV);
        dx.x -= round(dx.x);
        dy.x -= round(dy.x);
        return textureGrad(skyArt, skyUV, dx, dy).rgb * (visible * skyGain);
      }
      #endif

      vec4 plasma(vec2 direction, float radius, float lod, float radialSpan) {
        // Sample the rotating source in disk coordinates. Ray intersections,
        // the shadow and the approaching side of the disk stay registered.
        direction = vec2(dot(direction, diskRotation),
          dot(direction, vec2(-diskRotation.y, diskRotation.x)));
        float radial = (radius - INNER) / (OUTER - INNER);
        float edge = smoothstep(0.0, .016, radial) * (1.0 - smoothstep(.82, 1.0, radial));
        if (useArt) {
          vec2 uv = vec2(.5) + direction * mix(ART_INNER, ART_OUTER, radial);
          #ifdef LENSED_SKY
          vec4 art = textureLod(diskArt, uv, lod);
          // Resolve narrow spiral filaments in disk space even where the
          // lensed image magnifies a small patch of the source raster.
          float phi = atan(direction.y, direction.x);
          float phase = radial * 158.0 - phi * 3.0 + 1.9 * sin(phi * 7.0 + radial * 18.0);
          float strands = pow(.5 + .5 * cos(phase), 2.0);
          float finer = .5 + .5 * sin(radial * 335.0 - phi * 11.0 + sin(phase));
          float contrast = 1.0 - smoothstep(.007, .037, radialSpan);
          float grain = 1.0 - smoothstep(.003, .015, radialSpan);
          art.rgb *= .92 + contrast * .52 * (strands - .375) + grain * .21 * (finer - .5);
          #else
          vec4 art = texture2D(diskArt, uv);
          #endif
          return vec4(art.rgb * 1.8, art.a * edge);
        }
        float azimuth = atan(direction.y, direction.x);
        float filament = .5 + .5 * sin(radial * 226.0 + 3.0 * sin(azimuth * 7.0 + radial * 24.0));
        float turbulence = .5 + .5 * sin(azimuth * 19.0 + radial * 75.0 + sin(radial * 36.0));
        float hot = exp(-5.5 * radial);
        vec3 color = mix(vec3(.33, .034, .009), vec3(3.8, 1.86, .74), hot);
        return vec4(color * (.72 + .36 * filament + .22 * turbulence), edge);
      }

      vec3 projectedDisk(vec2 q, vec3 color, float footprint) {
        float impact = length(q);
        #ifndef LENSED_SKY
        if (mode == 0 && impact < SHADOW) color = vec3(0.0);
        #endif
        if (impact <= .001 || impact >= MAX_IMPACT) return color;
        float rollC = cos(diskRoll), rollS = sin(diskRoll);
        q = mat2(rollC, -rollS, rollS, rollC) * q;
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
          float lod = .24 + 1.6 * (1.0 - smoothstep(.02, .43, abs(impact - SHADOW)));
          float radialSpan = 0.0;
          #ifdef LENSED_SKY
          if (useArt) {
            float nextImpact = min(MAX_IMPACT, impact + footprint);
            float nextU = mode == 1 ? sin(first) / nextImpact : inverseRadius(nextImpact, angle);
            radialSpan = abs(1.0 / max(nextU, .001) - 1.0 / u) / (OUTER - INNER);
          }
          #endif
          vec4 sampleColor = plasma(diskDirection, 1.0 / u, lod, radialSpan);
          float gain = 1.0;
          if (mode == 0) {
            float angularMomentum = -q.x * sine;
            float shift = sqrt(1.0 - 3.0 * u) / (1.0 - angularMomentum * pow(u, 1.5));
            gain = pow(shift, 3.0) * 1.8;
          }
          return mix(color, sampleColor.rgb * gain * diskGain, sampleColor.a);
        }
        return color;
      }

      void main() {
        vec2 q = (screen - lensCenter) * frameScale;
        vec3 color = vec3(.0025, .0035, .007);
        if (mode == 2) {
          vec2 source = q * .5;
          float distance = length(source);
          if (distance > ART_INNER && distance < ART_OUTER) {
            float radius = mix(INNER, OUTER, (distance - ART_INNER) / (ART_OUTER - ART_INNER));
            vec4 sampleColor = plasma(source / distance, radius, 0.0, 0.0);
            color = mix(color, sampleColor.rgb, sampleColor.a);
          }
        } else {
          q *= lensExtent;
          float impact = length(q);
          float footprint = fwidth(impact);
          #ifdef LENSED_SKY
          color = lensedSky(q, impact, footprint);
          #endif
          // The higher-order image is thinner than a pixel near the critical
          // curve. Filter radially there while leaving the rest a single draw.
          if (mode == 0 && abs(impact - SHADOW) < .24) {
            vec3 samples = vec3(0.0);
            for (int sampleIndex = 0; sampleIndex < 8; sampleIndex++) {
              float offset = (float(sampleIndex) - 3.5) * footprint / 8.0;
              samples += projectedDisk(q * (1.0 + offset / impact), color, footprint) / 8.0;
            }
            color = samples;
          } else color = projectedDisk(q, color, footprint);
        }
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return {material, tables, dispose() { material.dispose(); for (const table of tables) table.dispose(); }};
}
