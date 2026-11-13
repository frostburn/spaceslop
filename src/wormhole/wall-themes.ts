import type { LevelId } from '../levels';

export type TunnelTheme = LevelId | 'cruise';

// Colors in each row light the wall, its brighter details and the aperture.
export const wallThemes = {
  cruise:    [0x4f3479, 0x3299c7, 0x78c8fa],
  broodlock: [0x692d21, 0xc07739, 0xd6b75a],
  io:        [0x542525, 0xb74719, 0xffb037],
  vents:     [0x142e42, 0x267b82, 0x87d8b8],
  titan:     [0x54263a, 0xbc622b, 0xf8b775],
  heliostat: [0x362941, 0x9a5439, 0xffba66],
  ice:       [0x24375e, 0x589dd1, 0xc3f6ff],
  preserve:  [0x252d26, 0x618849, 0xd6c56e],
  summer:    [0x234a4e, 0x52a393, 0xe4a6c5],
  boulevard: [0x481a79, 0x19cce7, 0xfa3ab6],
  biolume:   [0x162143, 0x26849e, 0xeaa041],
  fleet:     [0x25384f, 0x657e99, 0xa2d8ed],
  den:       [0x3f1d3b, 0x96503d, 0xf3a05d],
  wormhole:  [0x7b3279, 0x3772a5, 0x76c8fa],
} as const satisfies Record<TunnelTheme, readonly [number, number, number]>;

export const wallThemeIds = Object.fromEntries(
  Object.keys(wallThemes).map((id, index) => [id, index]),
) as Record<TunnelTheme, number>;

export const wallThemesShader = /* glsl */ `
  ${Object.entries(wallThemeIds).map(([id, index]) => `const int THEME_${id.toUpperCase()} = ${index};`).join('\n  ')}

  float etchedLine(float phase, float thickness) {
    float pixel = fwidth(phase);
    float edge = abs(fract(phase + .5) - .5);
    return (1.0 - smoothstep(thickness, thickness + clamp(pixel * .7, .006, .18), edge))
      * (1.0 - smoothstep(.18, .64, pixel));
  }

  float wireLine(float phase, float width) {
    float pixel = max(fwidth(phase), .00001);
    float distance = abs(fract(phase + .5) - .5) / pixel;
    return (1.0 - smoothstep(width * .4, width, distance)) * (1.0 - smoothstep(.11, .48, pixel));
  }

  vec3 themeWall(int style, vec3 wall, vec3 tone, vec3 accent, float theta, float z, float grain, float fine) {
    float angle = theta / 6.2831853;
    if (style == THEME_BROODLOCK) {
      // Staggered hexagonal chambers, with small clusters of fungus in their recesses.
      vec2 p = vec2(angle * 10.0, z * 1.22);
      vec2 spacing = vec2(1.0, 1.732051);
      vec2 a = mod(p, spacing) - spacing * .5;
      vec2 b = mod(p + spacing * .5, spacing) - spacing * .5;
      vec2 cell = dot(a, a) < dot(b, b) ? a : b;
      vec2 q = abs(cell);
      float edge = .5 - max(q.x, dot(q, vec2(.5, .8660254)));
      float wax = 1.0 - smoothstep(.013, .12, edge);
      float spores = exp(-dot(cell, cell) * 46.0) * smoothstep(.53, .83, grain);
      return wall * .44 + fine * (tone * (.038 + .36 * wax) + accent * (.16 * wax + .45 * spores));
    }
    if (style == THEME_IO) {
      float lava = theta * 4.0 + z * .76 + .8 * sin(theta * 3.0 - z * 1.21);
      float branching = sin(lava) + .43 * sin(theta * 9.0 - z * 1.3);
      float crack = exp(-abs(branching) * 25.0) * smoothstep(.24, .61, grain);
      float heat = exp(-abs(branching) * 5.0) * (.44 + .56 * grain);
      float slag = lobe(theta * 6.0 - z * .59, 2.2);
      return wall * .58 + fine * (tone * (.14 * slag + .39 * heat) + accent * crack * .88);
    }
    if (style == THEME_VENTS) {
      vec2 p = vec2(angle * 12.0, z * 1.45);
      vec2 cell = floor(p);
      float drift = cloudHash(vec2(mod(cell.x, 12.0), cell.y));
      vec2 q = fract(p) - vec2(.30 + .39 * drift, .25 + .44 * fract(drift * 7.7));
      float bubble = exp(-abs(length(q * vec2(1.0, 1.55)) - (.08 + .15 * drift)) * 34.0);
      float plume = lobe(theta * 5.0 + sin(z * .77) * .8, 3.8) * grain;
      return wall * .59 + fine * (tone * plume * .57 + accent * bubble * .31 * smoothstep(.43, .67, drift));
    }
    if (style == THEME_HELIOSTAT) {
      float ring = etchedLine(z * 1.05, .032);
      float coil = etchedLine(angle * 8.0 + z * .52, .016);
      float pulse = lobe(z * 2.4 - travel * 1.6, 2.1);
      return wall * .49 + fine * (tone * (.26 * ring + .12 * pulse) + accent * coil * (.07 + .31 * pulse));
    }
    if (style == THEME_ICE) {
      float u = angle * 14.0, v = z * 1.12 + .2 * sin(theta * 5.0);
      float slope = mod(floor(v), 2.0) * 2.0 - 1.0;
      float seam = max(etchedLine(v, .013), etchedLine(u + slope * fract(v), .019));
      float pane = step(fract(v), fract(u)) * (.34 + .66 * grain);
      float caustic = lobe(theta * 5.0 - 1.62 * z + .45 * cos(theta * 9.0 + z), 9.0);
      return wall * .56 + fine * (tone * (.13 + .22 * pane + .26 * caustic) + accent * seam * .26);
    }
    if (style == THEME_PRESERVE) {
      float stem = angle * 8.0 + .15 * sin(z * 1.43);
      float rib = etchedLine(stem, .027);
      vec2 p = vec2(fract(stem + .5) - .5, fract(z * 1.3 + .2 * sin(theta * 3.0)));
      float side = p.y > .5 ? -1.0 : 1.0;
      vec2 leaf = vec2(p.x * side - .21, fract(p.y * 2.0) - .5);
      float blade = 1.0 - smoothstep(.78, 1.05, length(vec2(leaf.x * 4.3, leaf.y * 2.6 + leaf.x * 2.8)));
      float vein = exp(-abs(leaf.y + leaf.x * 1.3) * 35.0) * blade;
      return wall * .39 + fine * (tone * (rib * .22 + blade * (.16 + .42 * grain)) + accent * vein * .26);
    }
    if (style == THEME_SUMMER) {
      vec2 p = vec2(angle * 9.0, z * .92);
      p.x += .5 * mod(floor(p.y), 2.0);
      vec2 q = (fract(p) - .5) * vec2(1.0, 1.3);
      float radius = length(q);
      float petal = .175 + .076 * cos(atan(q.y, q.x + .000001) * 5.0);
      float flower = (1.0 - smoothstep(petal - .017, petal + .028, radius)) * smoothstep(.022, .13, radius);
      float wake = lobe(z * 4.7 + sin(theta * 4.0) * .93, 7.0);
      return wall * .54 + fine * (tone * (.11 + .27 * wake) + accent * (.48 * flower + .12 * exp(-radius * 18.0)));
    }
    if (style == THEME_BOULEVARD) {
      // The hoops, helical rails and diagonals share the same projected cells.
      float u = angle * 12.0, v = z * 1.25;
      float rails = wireLine(u, 1.0), hoops = wireLine(v, 1.2);
      float diagonals = wireLine(u - v, .78);
      float pulse = lobe(v * 1.15 - travel * .65, 1.6);
      return wall * .026 + fine * (tone * hoops * (.61 + .39 * pulse)
        + accent * rails * .65 + mix(tone, accent, .58) * diagonals * .36);
    }
    if (style == THEME_BIOLUME) {
      vec2 p = vec2(angle * 11.0 + .11 * sin(z * .86), z * 1.28);
      float cell = cloudHash(vec2(mod(floor(p.x), 11.0), floor(p.y)));
      vec2 q = fract(p) - vec2(.5, .31 + .36 * cell);
      float lantern = exp(-dot(q * vec2(8.0, 5.0), q * vec2(8.0, 5.0)) * 3.6);
      float veins = etchedLine(p.x, .019) * lobe(z * 2.8 + sin(theta * 4.0), 2.2);
      float glow = .70 + .30 * sin(cell * 22.0 + travel * .9);
      return wall * .39 + fine * (tone * veins * .68 + accent * lantern * glow * smoothstep(.23, .56, cell) * .78);
    }
    if (style == THEME_FLEET) {
      float v = z * .91, u = angle * 12.0 + .5 * mod(floor(v), 2.0);
      float seam = max(etchedLine(u, .021) * .61, etchedLine(v, .023));
      vec2 p = fract(vec2(u, v));
      float ports = (1.0 - smoothstep(.04, .08, abs(p.y - .29)))
        * (1.0 - smoothstep(.19, .39, abs(p.x - .5))) * smoothstep(.37, .66, grain);
      float alloy = smoothstep(.26, .92, p.y) * (.23 + .77 * grain);
      return wall * .34 + fine * (tone * (.13 + .31 * alloy + .32 * seam) + accent * ports * .52);
    }
    if (style == THEME_DEN) {
      float ridge = lobe(theta * 6.0 + z * .75 + grain * 1.45, 4.8);
      float stratum = lobe(z * 3.7 + .86 * sin(theta * 4.0) + grain * 2.2, 6.0);
      vec2 p = fract(vec2(angle * 6.0, z * .68));
      float tip = .39 - abs(p.x - .5) * .64;
      float pennant = (1.0 - smoothstep(.22, .28, abs(p.x - .5))) * smoothstep(.024, .07, p.y)
        * (1.0 - smoothstep(tip - .021, tip + .017, p.y));
      float hem = exp(-abs(p.y - tip) * 32.0) * pennant;
      return wall * .54 + fine * (tone * (.33 * ridge + .26 * stratum + .37 * pennant) + accent * hem * .63);
    }
    return wall;
  }
`;
