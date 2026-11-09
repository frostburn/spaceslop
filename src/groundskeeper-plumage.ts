import * as T from 'three';
import { preserveNoise } from './preserve-layout';
const tawny=new T.Color(0xa17a4f),buff=new T.Color(0xd1c29d),ink=new T.Color(0x3a3028),eyebrow=new T.Color(0xe0cfaa),maskInk=new T.Color(0x382f29);

// Sparrow-like countershading, broken dark streaks and warm scapular patches.
// Sample once at feather roots, so the pattern bends with the animal and never
// swims over its skin or changes when the animation is scrubbed.
export function gkCamouflage(out: T.Color, x: number, y: number, z: number, front: number, head = false) {
  const patch = preserveNoise(x * 1.7 + 17, z * 1.15 + y * .45 + 29);
  const grain = preserveNoise(x * 4.3 + 4, z * 3.1 + y * .8 + 7);
  out.setHex(0x514032).lerp(tawny, T.MathUtils.smoothstep(patch, .24, .76));
  out.lerp(buff, front * .92);
  const ribbon = Math.cos(x * (head ? 12 : 6) + .35 * Math.sin(z * 2.1) + (patch - .5) * 1.6);
  const streak = T.MathUtils.smoothstep(ribbon, .25, .82) * T.MathUtils.smoothstep(grain, .12, .62);
  const breastSpot=Math.exp(-((x/.58)**2+((z-8.6)/.60)**2))*front;
  out.lerp(ink,Math.max(streak * (front * .92 + .07),breastSpot*.75));
  if (head) {
    const brow = Math.exp(-(((Math.abs(x) - .48) / .16) ** 2 + ((z - .65) / .14) ** 2));
    const mask = Math.exp(-(((Math.abs(x) - .55) / .20) ** 2 + ((z - .43) / .13) ** 2));
    out.lerp(eyebrow, brow * .85).lerp(maskInk, mask * .9);
  }
  return out.multiplyScalar(.91 + grain * .17);
}

// A long dark shaft patch and buff vane margins read as real patterned feathers
// at close range. Broad root colors above carry the pattern at phone scale.
export function gkFeatherPattern(shader: T.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = 'varying float vGkMark; varying vec2 vGkFeatherUv;\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    vGkMark = 0.5;
    vGkFeatherUv = uv;
    #ifdef USE_INSTANCING_COLOR
      vGkMark = fract(sin(dot(instanceColor,vec3(71.3,139.7,43.9)))*437.7);
    #endif
  `);
  shader.fragmentShader = 'varying float vGkMark; varying vec2 vGkFeatherUv;\n' + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
    float shaftDistance = abs(vGkFeatherUv.x-0.5);
    float ink = (1.0-smoothstep(.10,.29,shaftDistance))
      * smoothstep(.09,.30,vGkFeatherUv.y) * (1.0-smoothstep(.80,.98,vGkFeatherUv.y));
    float margin = smoothstep(.28,.46,shaftDistance) * smoothstep(.16,.42,vGkFeatherUv.y);
    diffuseColor.rgb *= mix(1.0,.42+.18*vGkMark,ink);
    diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.50,.39,.235),margin*.20);
    #ifdef USE_MAP
      float vane = dot(texture2D(map,vMapUv).rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb *= clamp(.85+(vane-.4)*.9,.56,1.13);
    #endif
  `);
}
