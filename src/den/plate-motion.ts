import * as T from 'three';
import { HEIGHT, WIDTH } from '../playfield';
import { DEN_SCREENS } from './route';

type FlagPixels = readonly [left: number, leftY: number, right: number, rightY: number, tip: number, tipY: number, tipWidth: number];

// Rod endpoints and loose tips measured against the complete cliff and arena
// plates. Normalization keeps them registered on owner-resized copies.
const cliffFlags: readonly FlagPixels[] = [
  [48, 616, 107, 630, 80, 792, 20],
  [396, 660, 424, 648, 412, 750, 11],
  [357, 1010, 414, 994, 382, 1153, 18],
  [76, 1209, 139, 1219, 107, 1400, 22],
  [145, 2430, 214, 2441, 176, 2636, 23],
  [378, 2934, 427, 2918, 396, 3072, 13],
  [52, 3041, 110, 3025, 79, 3208, 18],
  [119, 3612, 165, 3601, 146, 3768, 14],
  [79, 4550, 138, 4567, 113, 4715, 16],
  [349, 4780, 405, 4788, 375, 4973, 16],
  [464, 5114, 497, 5107, 482, 5198, 11],
  [125, 5231, 172, 5220, 149, 5359, 13],
  [84, 6570, 151, 6595, 130, 6774, 18],
  [68, 7331, 126, 7309, 106, 7478, 13],
  [64, 9131, 146, 9102, 114, 9326, 25],
];
const arenaFlags: readonly FlagPixels[] = [
  [15, 357, 47, 352, 31, 465, 12],
  [451, 351, 484, 362, 467, 486, 12],
  [361, 473, 373, 475, 369, 530, 5],
];

type Flag = ReturnType<typeof registerFlag>;
function registerFlag([left, leftY, right, rightY, tip, tipY, tipWidth]: FlagPixels,
  width: number, height: number, screens: number, offset = 0, crop = 1) {
  const x = (px: number) => (px / width - .5) / crop + .5;
  const y = (px: number) => offset + screens * (1 - px / height);
  return {
    left: x(left), right: x(right), leftY: y(leftY), rightY: y(rightY),
    tip: x(tip), tipY: y(tipY), tipHalfWidth: tipWidth / (2 * width * crop),
    energy: 0, push: 0,
  };
}

export type DenWakeActor = { x: number; y: number; speed: number };
export type DenWakeFrame = { elapsed: number; newFlight: boolean; actors: readonly DenWakeActor[] };
const MAX_FLAGS = 8;

export function createDenPlateMotion() {
  const cliff = cliffFlags.map(flag => registerFlag(flag, 576, 10240, DEN_SCREENS));
  let arena: Flag[] = [];
  let hasCliff = false;
  const uniforms = {
    detailClock: { value: 0 },
    flagCount: { value: 0 },
    flagRods: { value: Array.from({ length: MAX_FLAGS }, () => new T.Vector4()) },
    flagTips: { value: Array.from({ length: MAX_FLAGS }, () => new T.Vector4()) },
    flagPush: { value: new Float32Array(MAX_FLAGS) },
    steamVent: { value: new T.Vector4() },
  };
  const steamX = 52 / 576, steamAt = DEN_SCREENS - 6973 / 1024;
  const steamHeight = 125 / 1024;

  return {
    uniforms,
    useCliff(hasArt: boolean) { hasCliff = hasArt; },
    useArena(crop: number) {
      arena = arenaFlags.map(flag => registerFlag(flag, 496, 793, 1, DEN_SCREENS, crop));
    },
    update(tile: number, scroll: number, clock: number, frame?: DenWakeFrame) {
      uniforms.detailClock.value = clock;
      let count = 0;
      for (const flags of [hasCliff ? cliff : [], arena]) for (const flag of flags) {
        if (frame?.newFlight) { flag.energy = 0; flag.push = 0; }
        const top = Math.max(flag.leftY, flag.rightY);
        if (top < scroll - .08 || flag.tipY > scroll + 1.08) {
          flag.energy = flag.push = 0;
          continue;
        }
        if (count >= MAX_FLAGS) break;
        if (frame && frame.elapsed > 0) {
          const x = ((flag.left + flag.right + 2 * flag.tip) * .25 - .5) * WIDTH;
          const y = ((top + flag.tipY) * .5 - scroll - .5) * HEIGHT;
          const radiusY = 1.55 + (top - flag.tipY) * HEIGHT * .4;
          let near = 0, push = 0;
          for (const actor of frame.actors) {
            const dx = x - actor.x;
            const distance = Math.hypot(dx / 2.05, (y - actor.y) / radiusY);
            const strength = (1 - T.MathUtils.smoothstep(distance, .12, 1)) * Math.min(1, .54 + actor.speed * .15);
            if (strength > near) { near = strength; push = strength * T.MathUtils.clamp(dx / .72, -1, 1); }
          }
          flag.energy = T.MathUtils.damp(flag.energy, near, near > flag.energy ? 17 : 3.1, frame.elapsed);
          flag.push = T.MathUtils.damp(flag.push, push, push ? 12 : 3.1, frame.elapsed);
        }
        uniforms.flagRods.value[count].set(flag.left, flag.leftY - tile, flag.right, flag.rightY - tile);
        uniforms.flagTips.value[count].set(flag.tip, flag.tipY - tile, flag.tipHalfWidth, flag.energy);
        uniforms.flagPush.value[count++] = flag.push;
      }
      uniforms.flagCount.value = count;
      const steamVisible = hasCliff && steamAt <= scroll + 1.03 && steamAt + steamHeight >= scroll - .03;
      uniforms.steamVent.value.set(steamX, steamAt - tile, steamVisible ? steamHeight : 0, 0);
    },
  };
}

export const denPlateMotionShader = `
  uniform float detailClock;
  uniform int flagCount;
  uniform vec4 flagRods[${MAX_FLAGS}], flagTips[${MAX_FLAGS}];
  uniform float flagPush[${MAX_FLAGS}];
  uniform vec4 steamVent;

  float clothBend(vec2 p) {
    float shift = 0.0;
    for (int i = 0; i < ${MAX_FLAGS}; i++) {
      if (i >= flagCount) break;
      vec4 rod = flagRods[i], tip = flagTips[i];
      float width = rod.z - rod.x;
      if (p.x < min(rod.x, tip.x) - .052 || p.x > max(rod.z, tip.x) + .052 || p.y > max(rod.y, rod.w)) continue;
      float anchor = mix(rod.y, rod.w, clamp((p.x - rod.x) / width, 0.0, 1.0));
      float drop = (anchor - p.y) / max(.001, anchor - tip.y);
      if (drop <= 0.0 || drop >= 1.17) continue;
      float along = min(drop, 1.0);
      float center = mix((rod.x + rod.z) * .5, tip.x, along * along);
      float halfWidth = mix(width * .53, tip.z, smoothstep(.42, 1.0, along));
      float reach = min(.022, width * .32);
      float side = 1.0 - smoothstep(halfWidth + reach * .48, halfWidth + reach * 2.05 + .011, abs(p.x - center));
      float loose = pow(along, 1.35) * smoothstep(0.0, .18, drop) * (1.0 - smoothstep(.99, 1.17, drop));
      float phase = rod.x * 21.0 + width * 45.0;
      float quiet = sin(detailClock * 2.2 - along * 4.9 + phase);
      float ripples = sin(detailClock * 7.4 - along * 11.0 + phase) + .32 * sin(detailClock * 10.3 - along * 15.0 + phase);
      shift += reach * side * loose * (.17 * quiet + tip.w * (.69 * ripples + .21 * quiet) + .32 * flagPush[i]);
    }
    return shift;
  }

  float steamNoise(vec2 p) {
    vec2 cell = floor(p), f = fract(p);
    vec4 v = fract(sin(vec4(dot(cell, vec2(41.7, 89.1))) + vec4(0.0, 41.7, 89.1, 130.8)) * 43758.54);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(v.x, v.y, f.x), mix(v.z, v.w, f.x), f.y);
  }

  float risingSteam(vec2 p, inout vec2 samplePoint) {
    if (steamVent.z <= 0.0) return 0.0;
    float rise = (p.y - steamVent.y) / steamVent.z;
    if (rise <= 0.0 || rise >= 1.0 || abs(p.x - steamVent.x) > .089) return 0.0;
    float stem = steamVent.x - .024 * rise;
    float width = mix(.010, .040, rise);
    float wind = sin(detailClock * 2.75 - rise * 8.0) + .39 * sin(detailClock * 4.4 - rise * 13.0);
    float softEnds = smoothstep(0.0, .12, rise) * (1.0 - smoothstep(.72, 1.0, rise));
    float warpMask = (1.0 - smoothstep(.4, 1.15, abs((p.x - stem) / width))) * softEnds;
    samplePoint += vec2(.012 * rise * wind, .004 * sin(detailClock * 3.9 - rise * 19.0)) * warpMask;
    float center = stem + .013 * rise * wind;
    float cross = (p.x - center) / width;
    float core = 1.0 - smoothstep(.06, .98, abs(cross));
    vec2 flow = vec2(cross * 2.2 + .35 * wind, rise * 6.9 - detailClock * 2.2);
    float wisps = .67 * steamNoise(flow) + .33 * steamNoise(flow * 2.3 + 7.0);
    return core * softEnds * (.045 + .24 * smoothstep(.26, .81, wisps));
  }
`;
