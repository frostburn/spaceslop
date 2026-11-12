import * as T from 'three';
import { createBlackHoleOptics } from '../../studies/black-hole-material';
import { FONS_CYCLE } from './combat';
import type { FonsVariant } from './variants';

export function createFonsBackdrop() {
  const optics = createBlackHoleOptics();
  const royalBackdrop = { value: new T.Vector2() };
  const uniforms = { ...optics.uniforms, royalBackdrop };
  uniforms.diskGain.value = .9;

  return {
    uniforms,
    textures: optics.tables,
    fragmentShader: /* glsl */ `
      ${optics.fragmentShader}
      uniform vec2 royalBackdrop;
      const vec2 INVICTUS_LENS = vec2(.29, .73);

      vec2 bendAtInvictus(vec2 ray) {
        vec2 offset = ray - INVICTUS_LENS;
        float radius2 = dot(offset, offset);
        float deflection = .009 / (radius2 + .005);
        return ray - offset * (royalBackdrop.y * deflection);
      }

      vec3 rexSun(vec3 sky, vec2 ray, float time) {
        vec2 q = (ray - vec2(-.15, .71)) / .205;
        float radius = length(q);
        if (radius > 1.78) return sky;

        float limb = sqrt(max(0.0, 1.0 - radius * radius));
        vec2 surface = q / (.76 + .24 * limb);
        vec2 flow = vec2(time * .061, -time * .027);
        float mottling = cloudNoise(surface * 6.4 + flow);
        float granules = cloudNoise(surface * 39.0 + mottling * 2.3 + flow * 1.8);
        float heat = smoothstep(.22, .86, .55 * granules + .45 * mottling);
        vec3 photosphere = mix(vec3(.73, .12, .018), vec3(3.8, 2.18, .72), heat);
        photosphere *= .57 + .43 * limb;

        vec2 spot = (q - vec2(.34, -.26)) * vec2(12.5, 20.0);
        vec2 neighbor = (q - vec2(.49, -.19)) * vec2(19.0, 27.0);
        float spots = exp(-dot(spot, spot)) + .79 * exp(-dot(neighbor, neighbor));
        photosphere *= 1.0 - spots * (.63 + .22 * mottling);

        float angle = atan(q.y, q.x + .000001);
        float streams = cloudNoise(vec2(cos(angle), sin(angle)) * 7.0 + flow * .5);
        float air = max(0.0, radius - 1.0);
        float rim = exp(-air * 45.0) * .62;
        float corona = exp(-air * (6.0 + 8.0 * streams)) * (.16 + .47 * streams);
        float glow = (rim + corona) * (1.0 - smoothstep(1.46, 1.78, radius));
        vec3 outside = sky + vec3(1.38, .33, .052) * glow;
        float aa = max(.003, fwidth(radius) * .65);
        return mix(outside, photosphere, 1.0 - smoothstep(1.0 - aa, 1.0 + aa, radius));
      }

      vec3 showFonsBackdrop(vec3 sky, vec2 ray, vec2 screen, float time) {
        if (royalBackdrop.x > .001)
          return mix(sky, rexSun(sky, ray, time), royalBackdrop.x);
        if (royalBackdrop.y > .001) {
          vec2 q = (screen - INVICTUS_LENS) * 62.0;
          return mix(sky, sampleBlackHoleDisk(q, sky), royalBackdrop.y);
        }
        return sky;
      }
    `,
    update(variant: FonsVariant, time: number, amount: number) {
      royalBackdrop.value.set(variant === 'rex' ? amount : 0, variant === 'invictus' ? amount : 0);
      if (variant !== 'invictus') return;

      // One combat cycle tilts from almost edge-on to almost face-on and back.
      // The encounter clock also freezes when the flight pauses or ends.
      const age = Math.max(0, time);
      const phase = age * Math.PI * 2 / FONS_CYCLE;
      const tilt = .5 - .5 * Math.cos(phase);
      uniforms.inclination.value = T.MathUtils.degToRad(T.MathUtils.lerp(83, 13, tilt));
      uniforms.diskRoll.value = -.21 + .22 * Math.sin(phase);
      uniforms.diskRotation.value.set(Math.cos(age * .18), Math.sin(age * .18));
    },
  };
}
